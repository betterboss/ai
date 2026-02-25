export const runtime = 'nodejs';

import { getSQL } from '../../../lib/db';
import { getOrgId, paveQuery, getOrganizationJobs } from '../../../lib/jobtread';

// GET /api/dashboard/snapshot - Retrieve cached snapshot, or run cron if authorized
export async function GET(request) {
  try {
    // Check if this is a cron invocation (Vercel crons send GET with Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return generateSnapshots(request);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Get the most recent snapshot for this user
    const rows = await sql`
      SELECT * FROM dashboard_snapshots
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ snapshot: null, message: 'No snapshot available yet' });
    }

    return Response.json({
      snapshot: rows[0].data,
      createdAt: rows[0].created_at,
      stale: isStale(rows[0].created_at),
    });
  } catch (error) {
    console.error('Snapshot GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/dashboard/snapshot - Cron handler to cache dashboard data
// Called by Vercel Cron every 4 hours
export async function POST(request) {
  return generateSnapshots(request);
}

// Shared cron handler for both GET (Vercel cron) and POST invocations
async function generateSnapshots(request) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.VERCEL === '1') {
      return Response.json(
        { error: 'CRON_SECRET environment variable is required in production. Set it in Vercel project settings.' },
        { status: 403 }
      );
    }

    const sql = getSQL();

    // Get all users with JT grant keys
    const users = await sql`
      SELECT id, jobtread_grant_key FROM users
      WHERE jobtread_grant_key IS NOT NULL AND jobtread_grant_key != ''
    `;

    const results = [];

    for (const user of users) {
      try {
        const data = await generateSnapshotData(user.jobtread_grant_key);

        // Insert new snapshot
        await sql`
          INSERT INTO dashboard_snapshots (user_id, data)
          VALUES (${user.id}, ${JSON.stringify(data)})
        `;

        // Clean up old snapshots (keep last 10)
        await sql`
          DELETE FROM dashboard_snapshots
          WHERE user_id = ${user.id}
          AND id NOT IN (
            SELECT id FROM dashboard_snapshots
            WHERE user_id = ${user.id}
            ORDER BY created_at DESC
            LIMIT 10
          )
        `;

        results.push({ userId: user.id, success: true });
      } catch (err) {
        console.error(`Snapshot failed for user ${user.id}:`, err.message);
        results.push({ userId: user.id, success: false, error: err.message });
      }
    }

    return Response.json({
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Snapshot cron error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Generate combined dashboard snapshot data for a user
async function generateSnapshotData(grantKey) {
  const org = await getOrgId(grantKey);

  // Fetch core data in parallel
  const [jobs, invoices, estimates] = await Promise.all([
    getOrganizationJobs(grantKey, { size: 100 }),
    getOrgInvoices(grantKey, org.id),
    getOrgEstimates(grantKey, org.id),
  ]);

  const activeJobs = jobs.filter(j => !j.closedOn && j.status !== 'closed');
  const totalRevenue = invoices.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const unpaid = invoices.filter(i => i.status !== 'paid' && i.status !== 'closed');
  const outstandingAR = unpaid.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const openEstimates = estimates.filter(e => e.status !== 'approved' && e.status !== 'closed' && e.status !== 'rejected');
  const pipelineValue = openEstimates.reduce((s, e) => s + (parseFloat(e.price) || 0), 0);

  const totalCost = invoices.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0);
  const totalPrice = invoices.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const overallMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice * 100) : 0;

  const approvedEstimates = estimates.filter(e => e.status === 'approved');
  const conversionRate = estimates.length > 0 ? (approvedEstimates.length / estimates.length * 100) : 0;

  return {
    owner: {
      activeJobs: activeJobs.length,
      totalRevenue: Math.round(totalRevenue),
      outstandingAR: Math.round(outstandingAR),
      pipelineValue: Math.round(pipelineValue),
      margin: Math.round(overallMargin * 10) / 10,
    },
    sales: {
      estimateCount: estimates.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
      pipelineValue: Math.round(pipelineValue),
      openEstimates: openEstimates.length,
    },
    accounting: {
      totalOutstanding: Math.round(outstandingAR),
      unpaidCount: unpaid.length,
      paidCount: invoices.filter(i => i.status === 'paid' || i.status === 'closed').length,
      totalInvoices: invoices.length,
    },
    pm: {
      activeProjects: activeJobs.length,
    },
    organization: org.name,
    generatedAt: new Date().toISOString(),
  };
}

// Helper: Get invoices
async function getOrgInvoices(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: { organizationId: { eq: orgId }, type: { eq: 'customerInvoice' } },
        size: 500,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      nodes: { id: {}, name: {}, number: {}, price: {}, cost: {}, status: {}, createdAt: {} },
    },
  });
  return data.documents?.nodes || [];
}

// Helper: Get estimates
async function getOrgEstimates(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: { organizationId: { eq: orgId }, type: { eq: 'customerOrder' } },
        size: 500,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      nodes: { id: {}, name: {}, number: {}, price: {}, cost: {}, status: {}, createdAt: {} },
    },
  });
  return data.documents?.nodes || [];
}

// Check if a snapshot is stale (older than 4 hours)
function isStale(createdAt) {
  const age = Date.now() - new Date(createdAt).getTime();
  return age > 4 * 60 * 60 * 1000;
}
