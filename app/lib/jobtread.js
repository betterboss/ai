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

// Create a contact in JobTread
export async function createContact(grantKey, { name, email, phone, accountType }) {
  const org = await getOrgId(grantKey);
  const input = {
    organizationId: org.id,
    name,
  };
  if (email) {
    input.email = email;
  }
  if (phone) {
    input.phone = phone;
  }
  if (accountType) {
    input.accountType = accountType;
  }

  const data = await paveQuery(grantKey, {
    createContact: {
      $: { input },
      id: {},
      name: {},
      email: {},
      phone: {}
    }
  });
  return data.createContact;
}

// Create a location on an existing job
export async function createLocation(grantKey, { jobId, address }) {
  const input = {
    jobId,
    address,
  };

  const data = await paveQuery(grantKey, {
    createLocation: {
      $: { input },
      id: {},
      address: {}
    }
  });
  return data.createLocation;
}

// Update a job's name or status
export async function updateJob(grantKey, { jobId, name, status }) {
  const input = {};
  if (name) {
    input.name = name;
  }
  if (status) {
    input.status = status;
  }

  const data = await paveQuery(grantKey, {
    updateJob: {
      $: { id: jobId, input },
      id: {},
      name: {},
      number: {},
      status: {}
    }
  });
  return data.updateJob;
}

// Add a comment to a job
export async function addJobComment(grantKey, { jobId, text }) {
  const input = {
    jobId,
    body: text,
  };

  const data = await paveQuery(grantKey, {
    createComment: {
      $: { input },
      id: {},
      body: {},
      createdAt: {}
    }
  });
  return data.createComment;
}

// Get full job details including contacts, locations, and documents
export async function getJobDetails(grantKey, jobId) {
  const data = await paveQuery(grantKey, {
    job: {
      $: { id: jobId },
      id: {},
      name: {},
      number: {},
      status: {},
      address: {},
      contacts: {
        nodes: {
          id: {},
          name: {},
          email: {},
          phone: {}
        }
      },
      documents: {
        nodes: {
          id: {},
          name: {},
          number: {},
          type: {},
          price: {},
          cost: {},
          status: {}
        }
      }
    }
  });
  return data.job;
}

// Get jobs filtered by status
export async function getJobsByStatus(grantKey, { status, size }) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    jobs: {
      $: {
        organizationId: org.id,
        filter: { status: { eq: status } },
        size: size || 20,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        status: {},
        closedOn: {}
      }
    }
  });
  return data.jobs?.nodes || [];
}

// Get documents for a job (estimates, invoices, POs)
export async function getDocuments(grantKey, { jobId, type }) {
  const filter = { jobId: { eq: jobId } };
  if (type) {
    filter.type = { eq: type };
  }

  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter,
        size: 100,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        type: {},
        price: {},
        cost: {},
        status: {}
      }
    }
  });
  return data.documents?.nodes || [];
}

// Get invoices optionally filtered by status
export async function getInvoices(grantKey, { status, size } = {}) {
  const org = await getOrgId(grantKey);
  const filter = {
    organizationId: { eq: org.id },
    type: { eq: 'customerInvoice' },
  };
  if (status) {
    filter.status = { eq: status };
  }

  const data = await paveQuery(grantKey, {
    documents: {
      $: {
        filter,
        size: size || 20,
        sortBy: [{ field: 'createdAt', direction: 'DESC' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        type: {},
        price: {},
        cost: {},
        status: {}
      }
    }
  });
  return data.documents?.nodes || [];
}

// Get all pipeline stages for the organization
export async function getPipelineStages(grantKey) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    pipelineStages: {
      $: {
        organizationId: org.id,
        size: 100,
        sortBy: [{ field: 'position' }]
      },
      nodes: {
        id: {},
        name: {},
        position: {}
      }
    }
  });
  return data.pipelineStages?.nodes || [];
}

// Get all organization jobs with pagination
export async function getOrganizationJobs(grantKey, { size, sortBy } = {}) {
  const org = await getOrgId(grantKey);
  const data = await paveQuery(grantKey, {
    jobs: {
      $: {
        organizationId: org.id,
        size: size || 20,
        sortBy: sortBy || [{ field: 'createdAt', direction: 'DESC' }]
      },
      nodes: {
        id: {},
        name: {},
        number: {},
        status: {},
        pipelineStage: {
          id: {},
          name: {}
        }
      }
    }
  });
  return data.jobs?.nodes || [];
}

// Helper that handles cursor-based pagination for large result sets
export async function paginatedPaveQuery(grantKey, query, pageSize) {
  const allNodes = [];
  let cursor = null;
  const size = pageSize || 100;

  // Find the top-level query key (e.g. 'jobs', 'contacts', 'documents')
  const queryKeys = Object.keys(query);
  if (queryKeys.length === 0) {
    throw new Error('paginatedPaveQuery requires a query with at least one top-level key');
  }
  const rootKey = queryKeys[0];

  while (true) {
    // Build the paginated query by injecting size and cursor
    const paginatedQuery = JSON.parse(JSON.stringify(query));
    if (!paginatedQuery[rootKey].$) {
      paginatedQuery[rootKey].$ = {};
    }
    paginatedQuery[rootKey].$.size = size;
    if (cursor) {
      paginatedQuery[rootKey].$.after = cursor;
    }

    // Ensure we request the cursor field for pagination
    if (!paginatedQuery[rootKey].cursor) {
      paginatedQuery[rootKey].cursor = {};
    }

    const data = await paveQuery(grantKey, paginatedQuery);
    const result = data[rootKey];
    const nodes = result?.nodes || [];
    allNodes.push(...nodes);

    // If we got fewer results than the page size, we've reached the end
    if (nodes.length < size || !result?.cursor) {
      break;
    }

    cursor = result.cursor;
  }

  return allNodes;
}
