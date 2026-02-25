import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/contracts/clauses - List contract clauses
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    const sql = getSQL();

    let rows;
    if (userId && category) {
      rows = await sql`
        SELECT * FROM contract_clauses
        WHERE user_id = ${userId} AND category = ${category}
        ORDER BY is_default DESC, title ASC
      `;
    } else if (userId) {
      rows = await sql`
        SELECT * FROM contract_clauses
        WHERE user_id = ${userId}
        ORDER BY category ASC, is_default DESC, title ASC
      `;
    } else if (category) {
      rows = await sql`
        SELECT * FROM contract_clauses
        WHERE category = ${category}
        ORDER BY is_default DESC, title ASC
      `;
    } else {
      rows = await sql`
        SELECT * FROM contract_clauses
        ORDER BY category ASC, is_default DESC, title ASC
      `;
    }

    return Response.json({ clauses: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/contracts/clauses - Create a new clause
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, title, category, clauseText, whenToUse, isDefault } = body;

    if (!title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!clauseText) {
      return Response.json({ error: 'Clause text is required' }, { status: 400 });
    }

    const sql = getSQL();

    const rows = await sql`
      INSERT INTO contract_clauses (
        user_id, title, category, clause_text, when_to_use, is_default
      )
      VALUES (
        ${userId || null},
        ${title},
        ${category || 'general'},
        ${clauseText},
        ${whenToUse || null},
        ${isDefault || false}
      )
      RETURNING *
    `;

    return Response.json({ clause: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
