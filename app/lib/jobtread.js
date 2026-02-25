// Server-side JobTread Pave API client
// Ported from extension/background.js:316-422

const JT_API = 'https://api.jobtread.com/pave';

// Core Pave query function with retry — grantKey goes INSIDE the query body
export async function paveQuery(grantKey, query) {
  const MAX_RETRIES = 2;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }

    const fullQuery = { $: { grantKey }, ...query };

    let res;
    try {
      res = await fetch(JT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: fullQuery }),
      });
    } catch (networkErr) {
      lastError = new Error('Could not reach JobTread API: ' + networkErr.message);
      continue;
    }

    const text = await res.text();

    // Non-retryable auth errors
    if (res.status === 401 || res.status === 403) {
      throw new Error('JobTread authentication failed (HTTP ' + res.status + '). Check your grant key.');
    }
    if (res.status === 404) {
      throw new Error('JobTread API endpoint not found (HTTP 404).');
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('JobTread returned invalid response (HTTP ' + res.status + '): ' + text.slice(0, 200));
    }

    // Retryable server errors (5xx)
    if (res.status >= 500) {
      lastError = new Error('JobTread server error (HTTP ' + res.status + ')');
      continue;
    }

    // Other non-OK client errors (don't retry)
    if (!res.ok) {
      throw new Error('JobTread error ' + res.status + ': ' + JSON.stringify(json).slice(0, 200));
    }

    // Query-level errors
    if (json.errors) {
      const errMsgs = json.errors.map(e => e.message || JSON.stringify(e)).join(', ');
      throw new Error('JobTread query error: ' + errMsgs);
    }

    return json;
  }

  throw lastError;
}

// Get organization ID from the current grant
export async function getOrgId(grantKey) {
  const data = await paveQuery(grantKey, {
    currentGrant: {
      user: {
        memberships: {
          nodes: {
            organization: {
              id: {},
              name: {}
            }
          }
        }
      }
    }
  });

  const memberships = data.currentGrant?.user?.memberships;
  const nodes = memberships?.nodes;
  if (nodes?.length > 0 && nodes[0].organization) {
    return { id: nodes[0].organization.id, name: nodes[0].organization.name };
  }

  throw new Error('Could not find your organization. Make sure your grant key has access.');
}

// Search contacts by name
export async function searchContacts(grantKey, search) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    contacts: {
      $: {
        organizationId: org.id,
        filter: { name: { ilike: '%' + search + '%' } },
        size: 20,
        sortBy: [{ field: 'name' }]
      },
      nodes: {
        id: {},
        name: {},
        email: {},
        phone: {}
      }
    }
  });
  return data.contacts?.nodes || [];
}

// Search jobs by name
export async function searchJobs(grantKey, search) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    jobs: {
      $: {
        organizationId: org.id,
        filter: { name: { ilike: '%' + search + '%' } },
        size: 20,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        closedOn: {}
      }
    }
  });
  return data.jobs?.nodes || [];
}

// Get cost codes from JobTread
export async function getCostCodes(grantKey) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    costCodes: {
      $: {
        organizationId: org.id,
        size: 500,
        sortBy: [{ field: 'name' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        description: {}
      }
    }
  });
  return data.costCodes?.nodes || [];
}

// Create a job in JobTread
export async function createJob(grantKey, { name, address, contactId }) {
  const org = await getOrgId(grantKey);
  const input = {
    name,
    organizationId: org.id,
  };
  if (address) {
    input.locationInput = { address };
  }
  if (contactId) {
    input.contactId = contactId;
  }

  const data = await paveQuery(grantKey, {
    createJob: {
      $: { input },
      id: {},
      number: {},
      name: {}
    }
  });
  return data.createJob;
}

// Create a customer order (estimate) in JobTread with line items
export async function createEstimateDocument(grantKey, { jobId, name, contactId, lineItems }) {
  const input = {
    jobId,
    type: 'customerOrder',
    name: name || 'Estimate',
  };
  if (contactId) {
    input.contactId = contactId;
  }

  // Create the document first
  const docData = await paveQuery(grantKey, {
    createDocument: {
      $: { input },
      id: {},
      number: {},
      name: {},
      price: {},
      cost: {}
    }
  });

  const documentId = docData.createDocument.id;

  // Add line items one at a time (Pave API pattern)
  for (const item of lineItems) {
    const lineInput = {
      documentId,
      name: item.description,
      quantity: item.quantity || 1,
      unitCost: item.unit_cost || 0,
      unitPrice: item.unit_price || item.unit_cost || 0,
    };
    if (item.costCodeId) {
      lineInput.costCodeId = item.costCodeId;
    }

    await paveQuery(grantKey, {
      createLineItem: {
        $: { input: lineInput },
        id: {},
        name: {}
      }
    });
  }

  // Re-fetch the document to get updated totals
  const refreshed = await paveQuery(grantKey, {
    document: {
      $: { id: documentId },
      id: {},
      number: {},
      name: {},
      price: {},
      cost: {},
      status: {}
    }
  });

  return refreshed.document;
}

// Test connection to JobTread
export async function testConnection(grantKey) {
  try {
    const org = await getOrgId(grantKey);
    return { success: true, organization: org };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
