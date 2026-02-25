import { getServerClient } from '../../lib/db';

export const runtime = 'edge';

// GET /api/estimate - List all estimates
// POST /api/estimate - Create a new estimate
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const db = getServerClient();
    let query = db.from('estimates').select('*').order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ estimates: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, client_name, client_email, client_phone, job_address, notes, user_id } = body;

    if (!name) {
      return Response.json({ error: 'Estimate name is required' }, { status: 400 });
    }

    const db = getServerClient();
    const { data, error } = await db.from('estimates').insert({
      name,
      client_name: client_name || null,
      client_email: client_email || null,
      client_phone: client_phone || null,
      job_address: job_address || null,
      notes: notes || null,
      user_id: user_id || null,
      status: 'draft',
      total_cost: 0,
      total_price: 0,
      margin_pct: 0,
    }).select().single();

    if (error) throw error;

    return Response.json({ estimate: data }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
