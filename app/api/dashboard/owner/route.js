export const runtime = 'nodejs';

import { getOrgId, paveQuery, getOrganizationJobs, getInvoices } from '../../../lib/jobtread';

// GET /api/dashboard/owner - Owner P&L dashboard data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grantKey = searchParams.get('grantKey');
    const userId = searchParams.get('userId');

    if (!grantKey) {
      return Response.json({ error: 'grantKey is required' }, { status: 400 });
    }

    const org = await getOrgId(grantKey);

    // Fetch active jobs, invoices, and estimates in parallel
    const [activeJobsList, allInvoices, estimatesDocs] = await Promise.all([
      getOrganizationJobs(grantKey, { size: 100 }),
      getInvoicesWithAmounts(grantKey, org.id),
      getEstimateDocuments(grantKey, org.id),
    ]);

    // Active jobs (those without a closedOn date or with open status)
    const activeJobs = activeJobsList.filter(j => !j.closedOn || j.status === 'open' || j.status === 'active');

    // Revenue from invoices
    const totalRevenue = allInvoices.reduce((sum, inv) => sum + (parseFloat(inv.price) || 0), 0);

    // Outstanding AR: invoices that are not fully paid
    const outstandingInvoices = allInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'closed');
    const outstandingAR = outstandingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.price) || 0), 0);

    // Pipeline value from estimates not yet approved
    const openEstimates = estimatesDocs.filter(d => d.status !== 'approved' && d.status !== 'closed' && d.status !== 'rejected');
    const pipelineValue = openEstimates.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

    // Recent jobs (last 10)
    const recentJobs = activeJobsList.slice(0, 10).map(j => ({
      id: j.id,
      name: j.name,
      number: j.number,
      status: j.status,
      stage: j.pipelineStage?.name || null,
    }));

    // Compute margins from invoices that have both price and cost
    const invoicesWithMargin = allInvoices.filter(inv => inv.price > 0 && inv.cost >= 0);
    const totalCost = invoicesWithMargin.reduce((sum, inv) => sum + (parseFloat(inv.cost) || 0), 0);
    const totalPrice = invoicesWithMargin.reduce((sum, inv) => sum + (parseFloat(inv.price) || 0), 0);
    const overallMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice * 100) : 0;

    // Revenue by month (last 6 months from invoices)
    const revenueByMonth = computeRevenueByMonth(allInvoices);

    return Response.json({
      activeJobs: activeJobs.length,
      totalRevenue,
      outstandingAR,
      pipelineValue,
      recentJobs,
      margins: {
        overall: Math.round(overallMargin * 10) / 10,
        totalCost,
        totalPrice,
      },
      revenueByMonth,
      organization: org.name,
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Get invoices with full price/cost data
async function getInvoicesWithAmounts(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: {
          organizationId: { eq: orgId },
          type: { eq: 'customerInvoice' },
        },
        size: 200,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        price: {},
        cost: {},
        status: {},
        createdAt: {},
      },
    },
  });
  return data.documents?.nodes || [];
}

// Helper: Get estimate documents
async function getEstimateDocuments(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: {
          organizationId: { eq: orgId },
          type: { eq: 'customerOrder' },
        },
        size: 200,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        price: {},
        cost: {},
        status: {},
        createdAt: {},
      },
    },
  });
  return data.documents?.nodes || [];
}

// Helper: Compute revenue by month for last 6 months
function computeRevenueByMonth(invoices) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      revenue: 0,
    });
  }

  for (const inv of invoices) {
    if (!inv.createdAt) continue;
    const monthKey = new Date(inv.createdAt).toISOString().slice(0, 7);
    const bucket = months.find(m => m.key === monthKey);
    if (bucket) {
      bucket.revenue += parseFloat(inv.price) || 0;
    }
  }

  return months.map(m => ({ label: m.label, revenue: Math.round(m.revenue) }));
}
