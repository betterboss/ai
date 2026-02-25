import { paveQuery, getOrgId } from '../../../lib/jobtread';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const grantKey = req.headers.get('x-jobtread-key');
    if (!grantKey) return Response.json({ error: 'Missing JobTread grant key' }, { status: 401 });

    const org = await getOrgId(grantKey);
    const data = await paveQuery(grantKey, {
      jobs: {
        $: {
          organizationId: org.id,
          size: 200,
          sortBy: [{ field: 'createdAt', direction: 'DESC' }]
        },
        nodes: {
          id: {},
          name: {},
          number: {},
          status: {},
          closedOn: {},
          createdAt: {},
          location: { address: {} },
          account: { id: {}, name: {} },
          documents: {
            $: { filter: { type: { in: ['customerProposal', 'estimate', 'customerOrder'] } } },
            nodes: { id: {}, type: {}, status: {}, price: {}, name: {} }
          }
        }
      }
    });

    const jobs = data.jobs?.nodes || [];
    return Response.json({ jobs, organization: org });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
