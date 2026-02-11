// JobTread GraphQL API Client
// API: https://api.jobtread.com/ (Bearer token auth)

const JT_API = 'https://api.jobtread.com/graphql';

export class JobTreadAPI {
  constructor(token) {
    this.token = token;
  }

  async query(gql, variables = {}) {
    const res = await fetch(JT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`JobTread API returned ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(`JobTread API error ${res.status}: ${json.message || text.slice(0, 200)}`);
    }
    if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
    return json.data;
  }

  // ── Projects ──────────────────────────────────────────────

  async searchProjects(search = '', limit = 20) {
    return this.query(`
      query($limit: Int, $search: String) {
        jobs(first: $limit, filter: { search: $search }) {
          edges {
            node {
              id
              name
              status
              number
              createdAt
              customer { id name }
              address { line1 city state zip }
              totalPrice
              totalCost
            }
          }
        }
      }
    `, { limit, search: search || undefined });
  }

  async getProject(id) {
    return this.query(`
      query($id: ID!) {
        job(id: $id) {
          id
          name
          status
          number
          description
          createdAt
          updatedAt
          customer { id name email phone }
          address { line1 line2 city state zip }
          totalPrice
          totalCost
          estimateTotal
          invoiceTotal
          paidTotal
          costGroups {
            edges {
              node { id name totalPrice totalCost }
            }
          }
        }
      }
    `, { id });
  }

  // ── Contacts ──────────────────────────────────────────────

  async searchContacts(search = '', limit = 20) {
    return this.query(`
      query($limit: Int, $search: String) {
        contacts(first: $limit, filter: { search: $search }) {
          edges {
            node {
              id
              name
              email
              phone
              company
              type
              createdAt
            }
          }
        }
      }
    `, { limit, search: search || undefined });
  }

  async getContact(id) {
    return this.query(`
      query($id: ID!) {
        contact(id: $id) {
          id
          name
          email
          phone
          company
          type
          address { line1 line2 city state zip }
          jobs {
            edges {
              node { id name status totalPrice }
            }
          }
        }
      }
    `, { id });
  }

  // ── Estimates ─────────────────────────────────────────────

  async getEstimates(jobId, limit = 10) {
    return this.query(`
      query($jobId: ID!, $limit: Int) {
        estimates(first: $limit, filter: { jobId: $jobId }) {
          edges {
            node {
              id
              name
              status
              totalPrice
              totalCost
              createdAt
              lineItems {
                edges {
                  node {
                    id
                    name
                    description
                    quantity
                    unitPrice
                    totalPrice
                    costGroup { id name }
                  }
                }
              }
            }
          }
        }
      }
    `, { jobId, limit });
  }

  async createEstimate(input) {
    return this.query(`
      mutation($input: CreateEstimateInput!) {
        createEstimate(input: $input) {
          estimate {
            id
            name
            status
            totalPrice
          }
        }
      }
    `, { input });
  }

  // ── Invoices ──────────────────────────────────────────────

  async getInvoices(jobId, limit = 10) {
    return this.query(`
      query($jobId: ID!, $limit: Int) {
        invoices(first: $limit, filter: { jobId: $jobId }) {
          edges {
            node {
              id
              number
              status
              totalAmount
              paidAmount
              dueDate
              createdAt
            }
          }
        }
      }
    `, { jobId, limit });
  }

  // ── Catalog ───────────────────────────────────────────────

  async searchCatalog(search = '', limit = 20) {
    return this.query(`
      query($limit: Int, $search: String) {
        catalogItems(first: $limit, filter: { search: $search }) {
          edges {
            node {
              id
              name
              description
              unitPrice
              unitCost
              unit
              category
            }
          }
        }
      }
    `, { limit, search: search || undefined });
  }

  // ── Tasks ─────────────────────────────────────────────────

  async getTasks(jobId, limit = 50) {
    return this.query(`
      query($jobId: ID!, $limit: Int) {
        tasks(first: $limit, filter: { jobId: $jobId }) {
          edges {
            node {
              id
              name
              status
              dueDate
              assignee { id name }
              completedAt
            }
          }
        }
      }
    `, { jobId, limit });
  }

  // ── Dashboard / Stats ─────────────────────────────────────

  async getDashboardStats() {
    return this.query(`
      query {
        activeJobs: jobs(filter: { status: ACTIVE }) {
          totalCount
        }
        pendingEstimates: estimates(filter: { status: PENDING }) {
          totalCount
        }
        unpaidInvoices: invoices(filter: { status: SENT }) {
          totalCount
        }
      }
    `);
  }
}
