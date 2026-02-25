import { getServerClient } from '../../../../lib/db';
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

    const db = getServerClient();

    // Load estimate and line items
    const [estimateRes, itemsRes] = await Promise.all([
      db.from('estimates').select('*').eq('id', id).single(),
      db.from('estimate_items').select('*').eq('estimate_id', id).order('sort_order'),
    ]);

    if (estimateRes.error) throw estimateRes.error;
    const estimate = estimateRes.data;
    const items = itemsRes.data || [];

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
      costCodeId: null, // Will be mapped when catalog has JT cost code IDs
    }));

    const jtEstimate = await createEstimateDocument(grantKey, {
      jobId,
      name: estimate.name,
      contactId,
      lineItems,
    });

    // Update our estimate with JobTread IDs
    await db.from('estimates').update({
      jobtread_job_id: jobId,
      jobtread_estimate_id: jtEstimate.id,
      status: 'sent',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

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
