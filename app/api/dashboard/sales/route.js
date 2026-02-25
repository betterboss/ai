export const runtime = 'nodejs';

import { getOrgId, paveQuery } from '../../../lib/jobtread';

// GET /api/dashboard/sales - Sales pipeline dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grantKey = searchParams.get('grantKey');

    if (!grantKey) {
      return Response.json({ error: 'grantKey is required' }, { status: 400 });
    }

    const org = await getOrgId(grantKey);

    // Fetch estimates (customerOrder docs) and pipeline stages in parallel
    const [estimates, approvedDocs, stages] = await Promise.all([
      getCustomerOrders(grantKey, org.id),
      getApprovedOrders(grantKey, org.id),
      getPipelineStagesForOrg(grantKey, org.id),
    ]);

    // Estimate count
    const estimateCount = estimates.length;

    // Conversion rate: approved / total
    const approvedCount = approvedDocs.length;
    const conversionRate = estimateCount > 0
      ? Math.round((approvedCount / estimateCount) * 1000) / 10
      : 0;

    // Pipeline by stage: count jobs in each stage
    const stageMap = {};
    for (const stage of stages) {
      stageMap[stage.name] = { name: stage.name, count: 0, value: 0 };
    }

    for (const est of estimates) {
      if (est.status === 'approved' || est.status === 'closed' || est.status === 'rejected') continue;
      // Group open estimates into a "Pending" stage
      const stageName = 'Pending';
      if (!stageMap[stageName]) {
        stageMap[stageName] = { name: stageName, count: 0, value: 0 };
      }
      stageMap[stageName].count += 1;
      stageMap[stageName].value += parseFloat(est.price) || 0;
    }

    // Also track approved and rejected
    for (const est of estimates) {
      if (est.status === 'approved') {
        if (!stageMap['Won']) stageMap['Won'] = { name: 'Won', count: 0, value: 0 };
        stageMap['Won'].count += 1;
        stageMap['Won'].value += parseFloat(est.price) || 0;
      } else if (est.status === 'rejected') {
        if (!stageMap['Lost']) stageMap['Lost'] = { name: 'Lost', count: 0, value: 0 };
        stageMap['Lost'].count += 1;
        stageMap['Lost'].value += parseFloat(est.price) || 0;
      }
    }

    const pipelineByStage = Object.values(stageMap).filter(s => s.count > 0);

    // Recent estimates (last 10)
    const recentEstimates = estimates.slice(0, 10).map(e => ({
      id: e.id,
      name: e.name,
      number: e.number,
      price: parseFloat(e.price) || 0,
      status: e.status,
      createdAt: e.createdAt,
    }));

    // Lead sources - aggregate from job pipeline stages as a proxy
    const leadSources = computeLeadSources(estimates);

    return Response.json({
      estimateCount,
      conversionRate,
      pipelineByStage,
      recentEstimates,
      leadSources,
      totalPipelineValue: estimates
        .filter(e => e.status !== 'approved' && e.status !== 'closed' && e.status !== 'rejected')
        .reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0),
    });
  } catch (error) {
    console.error('Sales dashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Get customer orders (estimates)
async function getCustomerOrders(grantKey, orgId) {
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

// Helper: Get approved customer orders
async function getApprovedOrders(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: {
          organizationId: { eq: orgId },
          type: { eq: 'customerOrder' },
          status: { eq: 'approved' },
        },
        size: 200,
      },
      nodes: {
        id: {},
        status: {},
      },
    },
  });
  return data.documents?.nodes || [];
}

// Helper: Get pipeline stages for org
async function getPipelineStagesForOrg(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    pipelineStages: {
      $: {
        organizationId: orgId,
        size: 100,
        sortBy: [{ field: 'position' }],
      },
      nodes: {
        id: {},
        name: {},
        position: {},
      },
    },
  });
  return data.pipelineStages?.nodes || [];
}

// Helper: Compute lead sources by month bucket
function computeLeadSources(estimates) {
  const now = new Date();
  const thisMonth = [];
  const lastMonth = [];
  const older = [];

  for (const est of estimates) {
    if (!est.createdAt) {
      older.push(est);
      continue;
    }
    const d = new Date(est.createdAt);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      thisMonth.push(est);
    } else if (
      (d.getMonth() === now.getMonth() - 1 && d.getFullYear() === now.getFullYear()) ||
      (now.getMonth() === 0 && d.getMonth() === 11 && d.getFullYear() === now.getFullYear() - 1)
    ) {
      lastMonth.push(est);
    } else {
      older.push(est);
    }
  }

  return [
    { label: 'This Month', count: thisMonth.length, value: thisMonth.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) },
    { label: 'Last Month', count: lastMonth.length, value: lastMonth.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) },
    { label: 'Older', count: older.length, value: older.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) },
  ];
}
