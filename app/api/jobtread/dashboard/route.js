import { paveQuery, getOrgId } from '../../../lib/jobtread';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const grantKey = req.headers.get('x-jobtread-key');
    if (!grantKey) return Response.json({ error: 'Missing JobTread grant key' }, { status: 401 });

    const org = await getOrgId(grantKey);

    // Fetch jobs, proposals, and invoices in parallel-ish
    const [jobsData, proposalsData, invoicesData] = await Promise.all([
      paveQuery(grantKey, {
        jobs: {
          $: { organizationId: org.id, size: 500 },
          nodes: { id: {}, status: {}, closedOn: {}, createdAt: {} }
        }
      }),
      paveQuery(grantKey, {
        documents: {
          $: {
            organizationId: org.id,
            filter: { type: { in: ['customerProposal', 'estimate', 'customerOrder'] } },
            size: 500
          },
          nodes: { id: {}, type: {}, status: {}, price: {}, priceWithTax: {}, createdAt: {} }
        }
      }),
      paveQuery(grantKey, {
        documents: {
          $: {
            organizationId: org.id,
            filter: { type: { in: ['customerInvoice'] } },
            size: 500
          },
          nodes: { id: {}, status: {}, price: {}, priceWithTax: {}, amountPaid: {}, dueDate: {} }
        }
      }),
    ]);

    const jobs = jobsData.jobs?.nodes || [];
    const proposals = proposalsData.documents?.nodes || [];
    const invoices = invoicesData.documents?.nodes || [];

    const activeJobs = jobs.filter(j => !j.closedOn).length;
    const totalJobs = jobs.length;

    const wonProposals = proposals.filter(p => p.status === 'accepted');
    const wonValue = wonProposals.reduce((s, p) => s + parseFloat(p.priceWithTax || p.price || 0), 0);
    const dealsWon = wonProposals.length;
    const pendingProposals = proposals.filter(p => p.status === 'pending' || p.status === 'sent');
    const pendingValue = pendingProposals.reduce((s, p) => s + parseFloat(p.priceWithTax || p.price || 0), 0);
    const winRate = proposals.length > 0 ? Math.round((dealsWon / proposals.length) * 100) : 0;

    const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.priceWithTax || i.price || 0), 0);
    const totalCollected = invoices.reduce((s, i) => s + parseFloat(i.amountPaid || 0), 0);
    const outstandingAR = totalInvoiced - totalCollected;
    const overdueCount = invoices.filter(i =>
      i.dueDate && new Date(i.dueDate) < new Date() &&
      parseFloat(i.amountPaid || 0) < parseFloat(i.priceWithTax || i.price || 0)
    ).length;

    return Response.json({
      organization: org,
      sales: { wonValue, dealsWon, winRate, pendingValue, pendingCount: pendingProposals.length },
      jobs: { total: totalJobs, active: activeJobs },
      invoices: { totalInvoiced, totalCollected, outstandingAR, overdueCount },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
