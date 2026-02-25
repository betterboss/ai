export const runtime = 'nodejs';

import { getOrgId, paveQuery } from '../../../lib/jobtread';

// GET /api/dashboard/accounting - Accounting dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grantKey = searchParams.get('grantKey');

    if (!grantKey) {
      return Response.json({ error: 'grantKey is required' }, { status: 400 });
    }

    const org = await getOrgId(grantKey);

    // Fetch all invoices
    const invoices = await getAllInvoices(grantKey, org.id);

    // AR Aging buckets
    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
    const agingCounts = { current: 0, days30: 0, days60: 0, days90plus: 0 };

    const unpaidInvoices = invoices.filter(inv =>
      inv.status !== 'paid' && inv.status !== 'closed'
    );

    for (const inv of unpaidInvoices) {
      const amount = parseFloat(inv.price) || 0;
      const created = new Date(inv.createdAt);
      const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));

      if (daysSince <= 30) {
        aging.current += amount;
        agingCounts.current++;
      } else if (daysSince <= 60) {
        aging.days30 += amount;
        agingCounts.days30++;
      } else if (daysSince <= 90) {
        aging.days60 += amount;
        agingCounts.days60++;
      } else {
        aging.days90plus += amount;
        agingCounts.days90plus++;
      }
    }

    const arAging = [
      { label: 'Current', amount: Math.round(aging.current), count: agingCounts.current },
      { label: '31-60 Days', amount: Math.round(aging.days30), count: agingCounts.days30 },
      { label: '61-90 Days', amount: Math.round(aging.days60), count: agingCounts.days60 },
      { label: '90+ Days', amount: Math.round(aging.days90plus), count: agingCounts.days90plus },
    ];

    // Invoices by status
    const statusCounts = {};
    for (const inv of invoices) {
      const st = inv.status || 'unknown';
      if (!statusCounts[st]) statusCounts[st] = { count: 0, total: 0 };
      statusCounts[st].count++;
      statusCounts[st].total += parseFloat(inv.price) || 0;
    }
    const invoicesByStatus = Object.entries(statusCounts).map(([status, data]) => ({
      status,
      count: data.count,
      total: Math.round(data.total),
    }));

    // Top outstanding invoices (sorted by amount desc)
    const topOutstanding = unpaidInvoices
      .sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0))
      .slice(0, 10)
      .map(inv => ({
        id: inv.id,
        name: inv.name,
        number: inv.number,
        amount: parseFloat(inv.price) || 0,
        status: inv.status,
        createdAt: inv.createdAt,
        daysOld: Math.floor((now - new Date(inv.createdAt)) / (1000 * 60 * 60 * 24)),
      }));

    // Payment velocity: average days from creation to paid (for paid invoices)
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' || inv.status === 'closed');
    let avgPaymentDays = 0;
    if (paidInvoices.length > 0) {
      // We don't have paidAt, so use a rough metric from the last 30 paid
      // For now, show ratio of paid vs total as velocity indicator
      avgPaymentDays = invoices.length > 0
        ? Math.round((paidInvoices.length / invoices.length) * 100)
        : 0;
    }

    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.price) || 0), 0);

    return Response.json({
      arAging,
      invoicesByStatus,
      topOutstanding,
      paymentVelocity: {
        paidCount: paidInvoices.length,
        totalCount: invoices.length,
        collectionRate: avgPaymentDays,
      },
      totalOutstanding: Math.round(totalOutstanding),
      unpaidCount: unpaidInvoices.length,
    });
  } catch (error) {
    console.error('Accounting dashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Get all invoices for the organization
async function getAllInvoices(grantKey, orgId) {
  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter: {
          organizationId: { eq: orgId },
          type: { eq: 'customerInvoice' },
        },
        size: 500,
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
