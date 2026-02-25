import { paveQuery, getOrgId } from '../../../lib/jobtread';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const grantKey = req.headers.get('x-jobtread-key');
    if (!grantKey) return Response.json({ error: 'Missing JobTread grant key' }, { status: 401 });

    const org = await getOrgId(grantKey);
    const data = await paveQuery(grantKey, {
      documents: {
        $: {
          organizationId: org.id,
          filter: { type: { in: ['customerInvoice'] } },
          size: 200,
          sortBy: [{ field: 'createdAt', direction: 'DESC' }]
        },
        nodes: {
          id: {},
          name: {},
          number: {},
          type: {},
          status: {},
          price: {},
          priceWithTax: {},
          amountPaid: {},
          createdAt: {},
          dueDate: {},
          job: { id: {}, name: {}, number: {} },
          account: { id: {}, name: {} }
        }
      }
    });

    const invoices = (data.documents?.nodes || []).map(inv => ({
      ...inv,
      outstanding: (parseFloat(inv.priceWithTax || inv.price || 0) - parseFloat(inv.amountPaid || 0)),
      isOverdue: inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'accepted',
    }));

    return Response.json({ invoices });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
