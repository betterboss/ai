import { testConnection } from '../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/jobtread/test - Test JobTread grant key connection
export async function POST(request) {
  try {
    const { grantKey } = await request.json();

    if (!grantKey) {
      return Response.json({ error: 'Grant key is required' }, { status: 400 });
    }

    const result = await testConnection(grantKey);

    if (result.success) {
      return Response.json({
        success: true,
        organization: result.organization.name,
      });
    } else {
      return Response.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
