// JobTread Pave API Client
// API: https://api.jobtread.com/pave (grantKey auth in query body)
// Docs: JobTread uses the Pave query language, NOT GraphQL.

const JT_API = 'https://api.jobtread.com/pave';

export class JobTreadAPI {
  constructor(grantKey) {
    this.grantKey = grantKey;
    this.orgId = null;
  }

  async paveQuery(query) {
    var fullQuery = Object.assign({ $: { grantKey: this.grantKey } }, query);
    const res = await fetch(JT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: fullQuery }),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`JobTread API returned ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(`JobTread API error ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    }
    if (json.errors) throw new Error(json.errors.map(e => e.message || JSON.stringify(e)).join(', '));
    return json;
  }

  async getOrgId() {
    if (this.orgId) return this.orgId;

    const data = await this.paveQuery({
      currentGrant: {
        user: {
          memberships: {
            nodes: {
              organization: { id: {}, name: {} }
            }
          }
        }
      }
    });

    const nodes = data.currentGrant?.user?.memberships?.nodes;
    if (nodes?.length > 0 && nodes[0].organization) {
      this.orgId = nodes[0].organization.id;
      return this.orgId;
    }

    throw new Error('Could not find organization.');
  }
}
