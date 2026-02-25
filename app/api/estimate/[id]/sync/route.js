import { getSQL } from '../../../../lib/db';
import { createJob, createEstimateDocument, searchContacts } from '../../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/estimate/[id]/sync - Push estimate to JobTread
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { grantKey } = await request.json();

    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load estimate and line items
    const [estimates, items] = await Promise.all([
      sql`SELECT * FROM estimates WHERE id = ${id}`,
      sql`SELECT * FROM estimate_items WHERE estimate_id = ${id} ORDER BY sort_order`,
    ]);

    if (estimates.length === 0) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const estimate = estimates[0];

    if (items.length === 0) {
      return Response.json({ error: 'Estimate has no line items to sync' }, { status: 400 });
    }

    // Find or create contact in JobTread
    let contactId = null;
    if (estimate.client_name) {
      const contacts = await searchContacts(grantKey, estimate.client_name);
      if (contacts.length > 0) {
        contactId = contacts[0].id;
      }
    }

    // Create or find job in JobTread
    let jobId = estimate.jobtread_job_id;
    if (!jobId) {
      const job = await createJob(grantKey, {
        name: estimate.name,
        address: estimate.job_address,
        contactId,
      });
      jobId = job.id;
    }

    // Create customer order (estimate) with line items
    const lineItems = items.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unit_cost: parseFloat(item.unit_cost) || 0,
      unit_price: parseFloat(item.total_price) / (parseFloat(item.quantity) || 1),
      costCodeId: null,
    }));

    const jtEstimate = await createEstimateDocument(grantKey, {
      jobId,
      name: estimate.name,
      contactId,
      lineItems,
    });

    // Update our estimate with JobTread IDs
    await sql`
      UPDATE estimates SET
        jobtread_job_id = ${jobId},
        jobtread_estimate_id = ${jtEstimate.id},
        status = 'sent',
        updated_at = now()
      WHERE id = ${id}
    `;

    return Response.json({
      success: true,
      jobtread_job_id: jobId,
      jobtread_estimate_id: jtEstimate.id,
      jobtread_estimate_number: jtEstimate.number,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
