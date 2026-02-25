import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/sequences/templates - List message templates
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    const sql = getSQL();
    let templates;

    if (category) {
      templates = await sql`
        SELECT * FROM message_templates
        WHERE user_id = ${userId} AND category = ${category}
        ORDER BY name ASC
      `;
    } else {
      templates = await sql`
        SELECT * FROM message_templates
        WHERE user_id = ${userId}
        ORDER BY category, name ASC
      `;
    }

    return Response.json({ templates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/sequences/templates - Create a message template
export async function POST(request) {
  try {
    const { userId, name, category, channel, subject, body, variables } = await request.json();
    if (!userId || !name || !body) {
      return Response.json({ error: 'userId, name, and body required' }, { status: 400 });
    }

    const sql = getSQL();
    const rows = await sql`
      INSERT INTO message_templates (user_id, name, category, channel, subject, body, variables)
      VALUES (${userId}, ${name}, ${category || 'general'}, ${channel || 'email'},
              ${subject || ''}, ${body}, ${JSON.stringify(variables || [])})
      RETURNING *
    `;

    return Response.json({ template: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/sequences/templates - Update a template
export async function PUT(request) {
  try {
    const { id, name, category, channel, subject, body, variables } = await request.json();
    if (!id) return Response.json({ error: 'Template id required' }, { status: 400 });

    const sql = getSQL();
    const rows = await sql`
      UPDATE message_templates SET
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        channel = COALESCE(${channel}, channel),
        subject = COALESCE(${subject}, subject),
        body = COALESCE(${body}, body),
        variables = COALESCE(${variables ? JSON.stringify(variables) : null}, variables)
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) return Response.json({ error: 'Template not found' }, { status: 404 });
    return Response.json({ template: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/sequences/templates
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'Template id required' }, { status: 400 });

    const sql = getSQL();
    await sql`DELETE FROM message_templates WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
