// GoHighLevel API client

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

/**
 * Base request helper for GoHighLevel API.
 * @param {object} config - { apiKey, locationId }
 * @param {string} endpoint - API endpoint path (e.g., '/contacts/')
 * @param {string} method - HTTP method
 * @param {object} data - Request body data (optional)
 * @returns {Promise<object>}
 */
export async function makeGHLRequest(config, endpoint, method = 'GET', data = null) {
  if (!config?.apiKey) {
    throw new Error('GHL API key is required');
  }

  const url = `${GHL_API_BASE}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const options = { method, headers };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GHL API error (${res.status}): ${errText}`);
  }

  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Create a contact in GoHighLevel.
 * @param {object} config - { apiKey, locationId }
 * @param {{ name: string, email?: string, phone?: string }} contact
 * @returns {Promise<object>}
 */
export async function createGHLContact(config, { name, email, phone }) {
  if (!config.locationId) {
    throw new Error('GHL location ID is required');
  }

  const nameParts = (name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const body = {
    locationId: config.locationId,
    firstName,
    lastName,
  };
  if (email) body.email = email;
  if (phone) body.phone = phone;

  return makeGHLRequest(config, '/contacts/', 'POST', body);
}

/**
 * Update an opportunity in GoHighLevel.
 * @param {object} config - { apiKey, locationId }
 * @param {{ id: string, status?: string, monetaryValue?: number }} opportunity
 * @returns {Promise<object>}
 */
export async function updateGHLOpportunity(config, { id, status, monetaryValue }) {
  if (!id) throw new Error('Opportunity ID is required');

  const body = {};
  if (status) body.status = status;
  if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;

  return makeGHLRequest(config, `/opportunities/${id}`, 'PUT', body);
}

/**
 * Create an opportunity in GoHighLevel.
 * @param {object} config - { apiKey, locationId }
 * @param {{ contactId: string, name: string, pipelineId: string, stageId: string, monetaryValue?: number }} opp
 * @returns {Promise<object>}
 */
export async function createGHLOpportunity(config, { contactId, name, pipelineId, stageId, monetaryValue }) {
  if (!contactId) throw new Error('Contact ID is required');
  if (!pipelineId) throw new Error('Pipeline ID is required');
  if (!stageId) throw new Error('Stage ID is required');

  const body = {
    locationId: config.locationId,
    contactId,
    name: name || 'New Opportunity',
    pipelineId,
    pipelineStageId: stageId,
  };
  if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;

  return makeGHLRequest(config, '/opportunities/', 'POST', body);
}

/**
 * Trigger a GHL workflow/automation.
 * @param {object} config - { apiKey, locationId }
 * @param {{ workflowId: string, contactId: string }} params
 * @returns {Promise<object>}
 */
export async function triggerGHLWorkflow(config, { workflowId, contactId }) {
  if (!workflowId) throw new Error('Workflow ID is required');
  if (!contactId) throw new Error('Contact ID is required');

  return makeGHLRequest(config, `/workflows/${workflowId}/trigger`, 'POST', {
    locationId: config.locationId,
    contactId,
  });
}
