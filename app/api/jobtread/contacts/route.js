import { paveQuery, getOrgId } from '../../../lib/jobtread';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const grantKey = req.headers.get('x-jobtread-key');
    if (!grantKey) return Response.json({ error: 'Missing JobTread grant key' }, { status: 401 });

    const org = await getOrgId(grantKey);
    const data = await paveQuery(grantKey, {
      contacts: {
        $: {
          organizationId: org.id,
          size: 200,
          sortBy: [{ field: 'name' }]
        },
        nodes: {
          id: {},
          name: {},
          email: {},
          phone: {},
          createdAt: {},
          jobs: {
            $: { size: 5 },
            nodes: { id: {}, name: {} }
          }
        }
      }
    });

    return Response.json({ contacts: data.contacts?.nodes || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
