// Background service worker — v3 SELF-CONTAINED, no imports
const BG_VERSION = 'v3-' + Date.now();

// ═══════════════════════════════════════════════════════════
// MEMORY
// ═══════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  CONVERSATIONS: 'bb_conversations',
  NOTES: 'bb_notes',
  SETTINGS: 'bb_settings',
  CONTEXT: 'bb_context',
};

const MAX_CONVERSATION_MESSAGES = 50;
const MAX_NOTES = 200;

const Memory = {
  async getConversations() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
    return data[STORAGE_KEYS.CONVERSATIONS] || [];
  },

  async saveMessage(role, content, sources, skillResults) {
    const messages = await Memory.getConversations();
    messages.push({ role, content, sources: sources || [], skillResults: skillResults || [], timestamp: Date.now() });
    while (messages.length > MAX_CONVERSATION_MESSAGES) messages.shift();
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: messages });
    return messages;
  },

  async clearConversations() {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: [] });
  },

  async getApiMessages() {
    const messages = await Memory.getConversations();
    return messages.map(m => ({ role: m.role, content: m.content }));
  },

  async getNotes() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.NOTES);
    return data[STORAGE_KEYS.NOTES] || {};
  },

  async saveNote(key, value) {
    const notes = await Memory.getNotes();
    notes[key] = { value, updatedAt: Date.now() };
    const keys = Object.keys(notes);
    if (keys.length > MAX_NOTES) {
      const sorted = keys.sort((a, b) => notes[a].updatedAt - notes[b].updatedAt);
      delete notes[sorted[0]];
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
    return notes;
  },

  async deleteNote(key) {
    const notes = await Memory.getNotes();
    delete notes[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
    return notes;
  },

  async clearNotes() {
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: {} });
  },

  async getMemoryContext() {
    const notes = await Memory.getNotes();
    const entries = Object.entries(notes);
    if (entries.length === 0) return '';
    return entries.map(([key, val]) => `- ${key}: ${val.value}`).join('\n');
  },

  async getSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return data[STORAGE_KEYS.SETTINGS] || { claudeApiKey: '', jobtreadToken: '' };
  },

  async saveSettings(settings) {
    const current = await Memory.getSettings();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  },

  async setPageContext(context) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXT]: context });
  },

  async getPageContext() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CONTEXT);
    return data[STORAGE_KEYS.CONTEXT] || 'Not on a JobTread page';
  },

  async exportAll() {
    const [conversations, notes, settings] = await Promise.all([
      Memory.getConversations(), Memory.getNotes(), Memory.getSettings(),
    ]);
    return { conversations, notes, settings, exportedAt: new Date().toISOString() };
  },
};

// ═══════════════════════════════════════════════════════════
// CLAUDE API
// ═══════════════════════════════════════════════════════════

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are Mr. Better Boss ⚡, an AI assistant embedded in a Chrome extension for JobTread users. You are created by Better Boss (better-boss.ai), a JobTread Certified Implementation Partner.

## CAPABILITIES
You have direct access to the user's JobTread account through the extension. You can:
- Search and view projects, contacts, estimates, invoices, tasks, and catalog items
- Generate CSV files and reports from JobTread data
- Read the current JobTread page the user is viewing
- Remember context across conversations using persistent memory
- Execute skills (predefined actions) to help users work faster

## PERSONALITY
- Confident, direct, practical — a trusted mentor in the trenches
- Contractor-friendly language (change orders, scope creep, punch lists, GC, subs, etc.)
- Concise but thorough — no fluff, just actionable guidance
- Encouraging but real

## RESPONSE FORMATTING
- Use ## and ### headings to organize longer responses
- Use numbered lists for step-by-step instructions
- Use bullet lists for features, options, or comparisons
- Use **bold** for key terms and numbers
- Include relevant [links](url) when referencing tools, docs, or resources
- Keep paragraphs short (2-3 sentences max)

## SKILL TRIGGERS
When the user's request maps to a skill, include the skill trigger tag in your response.
Available skill triggers:
- [SKILL:SEARCH_PROJECTS:query] — Search projects
- [SKILL:SEARCH_CONTACTS:query] — Search contacts
- [SKILL:SEARCH_CATALOG:query] — Search catalog items
- [SKILL:GET_PROJECT:id] — Get project details
- [SKILL:GET_CONTACT:id] — Get contact details
- [SKILL:GET_ESTIMATES:jobId] — Get estimates for a project
- [SKILL:GET_INVOICES:jobId] — Get invoices for a project
- [SKILL:GET_TASKS:jobId] — Get tasks for a project
- [SKILL:EXPORT_CSV:type] — Export data as CSV (projects, contacts, catalog)
- [SKILL:DASHBOARD] — Get dashboard stats
- [SKILL:SAVE_MEMORY:key:value] — Save something to memory
- [SKILL:BOOK_CALL] — Show booking widget

When you trigger a skill, explain what you're doing. Example: "Let me pull up those projects for you. [SKILL:SEARCH_PROJECTS:kitchen remodel]"

## JOBTREAD KNOWLEDGE
- Better Boss is a JobTread Certified Implementation Partner founded by Nick Peret
- Full implementation in 30 days guaranteed
- Uses n8n for automations (NOT native JobTread automations)
- Key metrics: 20+ hrs/wk saved, 19-42% close rate improvement, 3x faster estimates
- Integrations: QuickBooks Online, CompanyCam, EagleView, Stripe, Acorn
- Primary CTA: better-boss.ai/audit for FREE Growth Audit Call
- When user needs hands-on help, include [SKILL:BOOK_CALL]

## MEMORY CONTEXT
{MEMORY_CONTEXT}

## CURRENT PAGE CONTEXT
{PAGE_CONTEXT}`;

async function callClaude(apiKey, messages, memory, pageContext) {
  const system = SYSTEM_PROMPT
    .replace('{MEMORY_CONTEXT}', memory || 'No saved memory yet.')
    .replace('{PAGE_CONTEXT}', pageContext || 'Not on a JobTread page');

  // Try with web search first, fall back to plain if it fails
  var body = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: system,
    messages: messages,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      }
    ],
  };

  var data = await claudeFetch(apiKey, body);

  // If first call fails, retry without web search tools
  if (data._fetchError) {
    console.warn('[BetterBoss] First attempt failed: ' + data._fetchError + ', retrying without web search');
    var fallbackBody = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: system,
      messages: messages,
    };
    data = await claudeFetch(apiKey, fallbackBody);
    if (data._fetchError) {
      throw new Error(data._fetchError);
    }
  }

  // Extract text and citations
  var text = '';
  var sources = [];
  var seenUrls = {};

  var contentBlocks = data.content || [];
  for (var i = 0; i < contentBlocks.length; i++) {
    var block = contentBlocks[i];
    if (block.type === 'text') {
      text += block.text;
      if (block.citations) {
        for (var j = 0; j < block.citations.length; j++) {
          var cite = block.citations[j];
          if (cite.url && !seenUrls[cite.url]) {
            seenUrls[cite.url] = true;
            sources.push({ url: cite.url, title: cite.title || '' });
          }
        }
      }
    }
  }

  if (!text) {
    text = 'I received a response but couldn\'t extract the text. Raw response type: ' + (contentBlocks.length > 0 ? contentBlocks.map(function(b) { return b.type; }).join(', ') : 'empty');
  }

  // Extract and clean skill triggers
  var skillTriggers = [];
  var re = /\[SKILL:([A-Z_]+)(?::([^\]]*))?\]/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    skillTriggers.push({ skill: m[1], param: m[2] || '' });
  }
  var cleanText = text.replace(/\[SKILL:[^\]]+\]/g, '');

  return { text: cleanText, sources: sources, skillTriggers: skillTriggers, usage: data.usage };
}

// Low-level fetch to Claude API with safe response handling
async function claudeFetch(apiKey, body) {
  var responseText = '';
  var status = 0;
  try {
    var headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    // Add beta header when web search tool is present
    if (body.tools && body.tools.some(function(t) { return t.type === 'web_search_20250305'; })) {
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }
    var res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });
    status = res.status;
    responseText = await res.text();
    console.log('[BetterBoss] Claude API status:', status, 'response length:', responseText.length);
  } catch (fetchErr) {
    return { _fetchError: 'Network error: ' + fetchErr.message };
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (parseErr) {
    return { _fetchError: 'API returned non-JSON (HTTP ' + status + '): ' + responseText.slice(0, 200) };
  }

  if (status < 200 || status >= 300 || data.error) {
    var errMsg = 'HTTP ' + status;
    if (data.error) {
      errMsg = data.error.message || data.error.type || JSON.stringify(data.error);
    }
    return { _fetchError: errMsg };
  }

  return data;
}

// ═══════════════════════════════════════════════════════════
// JOBTREAD API (Pave Query Language)
// Docs: https://api.jobtread.com — POST to /pave with grantKey
// ═══════════════════════════════════════════════════════════

const JT_API = 'https://api.jobtread.com/pave';

// Cached org ID (cleared when settings change)
var cachedOrgId = null;

// Core Pave query function — grantKey goes INSIDE the query body
async function paveQuery(grantKey, query) {
  var fullQuery = Object.assign({ $: { grantKey: grantKey } }, query);
  console.log('[BetterBoss] paveQuery →', JT_API, JSON.stringify(fullQuery).slice(0, 300));

  var res;
  try {
    res = await fetch(JT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: fullQuery }),
    });
  } catch (networkErr) {
    console.error('[BetterBoss] JT network error:', networkErr);
    throw new Error('Could not reach JobTread API. Network error: ' + networkErr.message);
  }

  var text = await res.text();
  console.log('[BetterBoss] JT response:', res.status, 'body:', text.slice(0, 500));

  if (res.status === 401 || res.status === 403) {
    throw new Error('JobTread authentication failed (HTTP ' + res.status + '). Check your grant key in Settings.');
  }

  if (res.status === 404) {
    throw new Error('JobTread API endpoint not found (HTTP 404). URL: ' + JT_API);
  }

  var json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('JobTread returned invalid response (HTTP ' + res.status + '): ' + text.slice(0, 200));
  }

  if (!res.ok) {
    throw new Error('JobTread error ' + res.status + ': ' + JSON.stringify(json).slice(0, 200));
  }

  if (json.errors) {
    var errMsgs = json.errors.map(function(e) { return e.message || JSON.stringify(e); }).join(', ');
    console.error('[BetterBoss] JT Pave errors:', errMsgs);
    throw new Error('JobTread query error: ' + errMsgs);
  }

  return json;
}

// Get organization ID from the current grant
async function getOrgId(grantKey) {
  if (cachedOrgId) return cachedOrgId;

  var data = await paveQuery(grantKey, {
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

  var memberships = data.currentGrant && data.currentGrant.user && data.currentGrant.user.memberships;
  var nodes = memberships && memberships.nodes;
  if (nodes && nodes.length > 0 && nodes[0].organization) {
    cachedOrgId = nodes[0].organization.id;
    console.log('[BetterBoss] Org ID resolved:', cachedOrgId, '(' + nodes[0].organization.name + ')');
    return cachedOrgId;
  }

  throw new Error('Could not find your organization. Make sure your grant key has access.');
}

// Clear cached org ID when settings change
var _origSaveSettings = Memory.saveSettings;
Memory.saveSettings = async function(settings) {
  cachedOrgId = null;
  return _origSaveSettings.call(Memory, settings);
};

// ═══════════════════════════════════════════════════════════
// SKILLS (Pave queries)
// ═══════════════════════════════════════════════════════════

async function executeSkillAction(grantKey, skill, param) {
  try {
    switch (skill) {
      case 'SEARCH_PROJECTS': {
        var orgId = await getOrgId(grantKey);
        var jobsParams = { size: 50, sortBy: [{ field: 'createdAt', order: 'desc' }] };
        var serverFiltered = false;
        if (param) {
          jobsParams.where = ['name', '~', param];
          serverFiltered = true;
        }
        var data;
        try {
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              jobs: {
                $: jobsParams,
                nodes: { id: {}, name: {}, number: {}, closedOn: {} }
              }
            }
          });
        } catch (e) {
          if (!serverFiltered) throw e;
          // ~ operator failed — fall back to client-side filter
          console.warn('[BetterBoss] Server search failed, using client-side filter:', e.message);
          delete jobsParams.where;
          serverFiltered = false;
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              jobs: {
                $: jobsParams,
                nodes: { id: {}, name: {}, number: {}, closedOn: {} }
              }
            }
          });
        }
        var items = (data.organization && data.organization.jobs && data.organization.jobs.nodes) || [];
        if (param && !serverFiltered) {
          var search = param.toLowerCase();
          items = items.filter(function(item) {
            return (item.name && item.name.toLowerCase().indexOf(search) !== -1) ||
                   (item.number && String(item.number).toLowerCase().indexOf(search) !== -1);
          });
        }
        return { type: 'projects', title: 'Projects' + (param ? ' matching "' + param + '"' : ''), data: items, count: items.length, columns: ['name', 'number', 'closedOn'] };
      }

      case 'SEARCH_CONTACTS': {
        var orgId = await getOrgId(grantKey);
        var contactsParams = { size: 50, sortBy: [{ field: 'name' }] };
        var serverFiltered = false;
        if (param) {
          contactsParams.where = ['name', '~', param];
          serverFiltered = true;
        }
        var data;
        try {
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              contacts: {
                $: contactsParams,
                nodes: {
                  id: {},
                  name: {},
                  title: {},
                  account: { id: {}, name: {}, type: {} }
                }
              }
            }
          });
        } catch (e) {
          if (!serverFiltered) throw e;
          console.warn('[BetterBoss] Server search failed, using client-side filter:', e.message);
          delete contactsParams.where;
          serverFiltered = false;
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              contacts: {
                $: contactsParams,
                nodes: {
                  id: {},
                  name: {},
                  title: {},
                  account: { id: {}, name: {}, type: {} }
                }
              }
            }
          });
        }
        var items = (data.organization && data.organization.contacts && data.organization.contacts.nodes) || [];
        if (param && !serverFiltered) {
          var search = param.toLowerCase();
          items = items.filter(function(item) {
            return (item.name && item.name.toLowerCase().indexOf(search) !== -1) ||
                   (item.title && item.title.toLowerCase().indexOf(search) !== -1) ||
                   (item.account && item.account.name && item.account.name.toLowerCase().indexOf(search) !== -1);
          });
        }
        return { type: 'contacts', title: 'Contacts' + (param ? ' matching "' + param + '"' : ''), data: items, count: items.length, columns: ['name', 'title', 'account.name', 'account.type'] };
      }

      case 'SEARCH_CATALOG': {
        var orgId = await getOrgId(grantKey);
        var costParams = { size: 50, sortBy: [{ field: 'name' }] };
        var serverFiltered = false;
        if (param) {
          costParams.where = ['name', '~', param];
          serverFiltered = true;
        }
        var data;
        try {
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              costItems: {
                $: costParams,
                nodes: { id: {}, name: {}, unitPrice: {}, unitCost: {}, unit: { id: {}, name: {} } }
              }
            }
          });
        } catch (e) {
          if (!serverFiltered) throw e;
          console.warn('[BetterBoss] Server search failed, using client-side filter:', e.message);
          delete costParams.where;
          serverFiltered = false;
          data = await paveQuery(grantKey, {
            organization: {
              $: { id: orgId },
              costItems: {
                $: costParams,
                nodes: { id: {}, name: {}, unitPrice: {}, unitCost: {}, unit: { id: {}, name: {} } }
              }
            }
          });
        }
        var items = (data.organization && data.organization.costItems && data.organization.costItems.nodes) || [];
        items = items.map(function(item) {
          return Object.assign({}, item, { unitName: (item.unit && item.unit.name) || '' });
        });
        if (param && !serverFiltered) {
          var search = param.toLowerCase();
          items = items.filter(function(item) {
            return (item.name && item.name.toLowerCase().indexOf(search) !== -1);
          });
        }
        return { type: 'catalog', title: 'Catalog items' + (param ? ' matching "' + param + '"' : ''), data: items, count: items.length, columns: ['name', 'unitPrice', 'unitCost', 'unitName'] };
      }

      case 'DASHBOARD': {
        var orgId = await getOrgId(grantKey);
        var data = await paveQuery(grantKey, {
          organization: {
            $: { id: orgId },
            activeJobs: {
              _: 'jobs',
              $: { where: ['closedOn', '=', null], size: 200 },
              nodes: { id: {} }
            },
            pendingEstimates: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerOrder'], ['status', '=', 'pending']] }, size: 200 },
              nodes: { id: {}, price: {} }
            },
            unpaidInvoices: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerInvoice'], ['status', '!=', 'paid']] }, size: 200 },
              nodes: { id: {}, price: {}, amountPaid: {} }
            }
          }
        });
        var org = data.organization || {};
        var activeNodes = (org.activeJobs && org.activeJobs.nodes) || [];
        var estNodes = (org.pendingEstimates && org.pendingEstimates.nodes) || [];
        var invNodes = (org.unpaidInvoices && org.unpaidInvoices.nodes) || [];
        var estTotal = estNodes.reduce(function(sum, n) { return sum + (n.price || 0); }, 0);
        var invTotal = invNodes.reduce(function(sum, n) { return sum + ((n.price || 0) - (n.amountPaid || 0)); }, 0);
        return {
          type: 'dashboard',
          title: 'Dashboard Stats',
          data: {
            activeJobs: activeNodes.length,
            pendingEstimates: estNodes.length,
            pendingEstimatesTotal: estTotal,
            unpaidInvoices: invNodes.length,
            unpaidInvoicesTotal: invTotal,
          }
        };
      }

      case 'GET_PROJECT': {
        var data = await paveQuery(grantKey, {
          job: {
            $: { id: param },
            id: {},
            name: {},
            number: {},
            closedOn: {},
            description: {}
          }
        });
        return { type: 'project', title: 'Project Details', data: data.job || {} };
      }

      case 'GET_CONTACT': {
        var data = await paveQuery(grantKey, {
          contact: {
            $: { id: param },
            id: {},
            name: {},
            title: {},
            account: { id: {}, name: {}, type: {} }
          }
        });
        var contact = data.contact || {};
        return { type: 'contact', title: 'Contact: ' + (contact.name || 'Unknown'), data: contact };
      }

      case 'GET_ESTIMATES': {
        var data = await paveQuery(grantKey, {
          job: {
            $: { id: param },
            id: {},
            name: {},
            documents: {
              $: { where: ['type', '=', 'customerOrder'], size: 50, sortBy: [{ field: 'createdAt', order: 'desc' }] },
              nodes: {
                id: {},
                name: {},
                number: {},
                status: {},
                price: {},
                cost: {}
              }
            }
          }
        });
        var items = (data.job && data.job.documents && data.job.documents.nodes) || [];
        return { type: 'estimates', title: 'Estimates for ' + ((data.job && data.job.name) || 'project'), data: items, count: items.length, columns: ['name', 'number', 'status', 'price', 'cost'] };
      }

      case 'GET_INVOICES': {
        var data = await paveQuery(grantKey, {
          job: {
            $: { id: param },
            id: {},
            name: {},
            documents: {
              $: { where: ['type', '=', 'customerInvoice'], size: 50, sortBy: [{ field: 'createdAt', order: 'desc' }] },
              nodes: {
                id: {},
                name: {},
                number: {},
                status: {},
                price: {},
                amountPaid: {}
              }
            }
          }
        });
        var items = (data.job && data.job.documents && data.job.documents.nodes) || [];
        return { type: 'invoices', title: 'Invoices for ' + ((data.job && data.job.name) || 'project'), data: items, count: items.length, columns: ['name', 'number', 'status', 'price', 'amountPaid'] };
      }

      case 'GET_TASKS': {
        var data = await paveQuery(grantKey, {
          job: {
            $: { id: param },
            id: {},
            name: {},
            tasks: {
              $: { size: 50, sortBy: [{ field: 'startDate' }] },
              nodes: {
                id: {},
                name: {},
                progress: {},
                startDate: {},
                endDate: {}
              }
            }
          }
        });
        var items = (data.job && data.job.tasks && data.job.tasks.nodes) || [];
        return { type: 'tasks', title: 'Tasks', data: items, count: items.length, columns: ['name', 'progress', 'startDate', 'endDate'] };
      }

      case 'EXPORT_CSV': {
        var result = await executeSkillAction(grantKey, 'SEARCH_' + (param || 'projects').toUpperCase(), '');
        result.exportAs = 'csv';
        return result;
      }

      case 'SAVE_MEMORY': {
        var idx = (param || '').indexOf(':');
        if (idx === -1) return { error: 'Invalid format. Use key:value' };
        return { type: 'memory_save', key: param.slice(0, idx).trim(), value: param.slice(idx + 1).trim() };
      }

      case 'BOOK_CALL':
        return { type: 'booking', url: 'https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call' };

      default:
        return { error: 'Unknown skill: ' + skill };
    }
  } catch (err) {
    return { error: err.message, skill: skill };
  }
}

// ═══════════════════════════════════════════════════════════
// FILE UTILS (CSV)
// ═══════════════════════════════════════════════════════════

function toCSV(data, columns) {
  if (!data || data.length === 0) return '';
  var getValue = function(obj, key) {
    return key.split('.').reduce(function(o, k) { return (o && o[k] != null) ? o[k] : ''; }, obj);
  };
  var cols = columns || Object.keys(data[0]);
  var header = cols.map(function(c) { return '"' + c + '"'; }).join(',');
  var rows = data.map(function(item) {
    return cols.map(function(col) {
      return '"' + String(getValue(item, col)).replace(/"/g, '""') + '"';
    }).join(',');
  });
  return header + '\n' + rows.join('\n');
}

function downloadCSV(result) {
  var csv = toCSV(result.data, result.columns);
  var timestamp = new Date().toISOString().slice(0, 10);
  var filename = 'jobtread-' + result.type + '-' + timestamp + '.csv';

  // Use data URL instead of blob URL (service workers can't use createObjectURL)
  var dataUrl = 'data:text/csv;base64,' + btoa(unescape(encodeURIComponent(csv)));
  chrome.downloads.download({ url: dataUrl, filename: filename, saveAs: true });
  return { success: true, filename: filename, rowCount: result.data.length };
}

// ═══════════════════════════════════════════════════════════
// MESSAGE ROUTER
// ═══════════════════════════════════════════════════════════

let currentPageContext = 'Not on a JobTread page';

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  handleMessage(message).then(sendResponse).catch(function(err) {
    console.error('Background error:', err);
    sendResponse({ error: err.message || String(err) });
  });
  return true;
});

async function handleMessage(message) {
  switch (message.action) {
    case 'PING':
      return { pong: true, version: BG_VERSION };

    case 'CHAT':
      return handleChat(message.text);

    case 'EXECUTE_SKILL':
      return handleSkill(message.skill, message.param);

    case 'GET_MEMORY':
      return { notes: await Memory.getNotes() };
    case 'SAVE_NOTE':
      return { notes: await Memory.saveNote(message.key, message.value) };
    case 'DELETE_NOTE':
      return { notes: await Memory.deleteNote(message.key) };
    case 'CLEAR_MEMORY':
      await Memory.clearNotes();
      return { success: true };

    case 'GET_CONVERSATIONS':
      return { messages: await Memory.getConversations() };
    case 'CLEAR_CONVERSATIONS':
      await Memory.clearConversations();
      return { success: true };

    case 'GET_SETTINGS':
      return { settings: await Memory.getSettings() };
    case 'SAVE_SETTINGS':
      return { settings: await Memory.saveSettings(message.settings) };

    case 'TEST_JT_CONNECTION':
      return testJtConnection();

    case 'PAGE_CONTEXT_UPDATE':
      currentPageContext = formatPageContext(message.context);
      await Memory.setPageContext(currentPageContext);
      return { success: true };
    case 'GET_PAGE_CONTEXT':
      return { context: currentPageContext };

    case 'DOWNLOAD_CSV':
      return downloadCSV(message.result);

    case 'EXPORT_ALL':
      return Memory.exportAll();

    default:
      return { error: 'Unknown action: ' + message.action };
  }
}

// ═══════════════════════════════════════════════════════════
// TEST CONNECTION
// ═══════════════════════════════════════════════════════════

async function testJtConnection() {
  const settings = await Memory.getSettings();
  if (!settings.jobtreadToken) {
    return { error: 'No grant key saved. Paste your JobTread grant key above and click Save first.' };
  }

  const grantKey = settings.jobtreadToken;
  console.log('[BetterBoss] Testing JT connection, key length:', grantKey.length, 'first 8 chars:', grantKey.slice(0, 8) + '...');

  try {
    // Use the currentGrant query to verify auth and get org info
    var data = await paveQuery(grantKey, {
      currentGrant: {
        id: {},
        user: {
          id: {},
          name: {},
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

    var user = data.currentGrant && data.currentGrant.user;
    var memberships = user && user.memberships && user.memberships.nodes;
    var orgName = (memberships && memberships.length > 0 && memberships[0].organization && memberships[0].organization.name) || 'Unknown';

    // Cache the org ID
    if (memberships && memberships.length > 0 && memberships[0].organization) {
      cachedOrgId = memberships[0].organization.id;
    }

    return { info: 'Connected as ' + (user.name || 'Unknown') + ' — Org: ' + orgName };
  } catch (err) {
    console.error('[BetterBoss] Test connection error:', err);
    return { error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// CHAT HANDLER
// ═══════════════════════════════════════════════════════════

async function handleChat(text) {
  try {
    const settings = await Memory.getSettings();

    if (!settings.claudeApiKey) {
      return { error: 'Please set your Claude API key in Settings (⚙️ tab).' };
    }

    // Save user message
    await Memory.saveMessage('user', text);

    // Build context
    const memoryContext = await Memory.getMemoryContext();
    const pageContext = await Memory.getPageContext();
    const apiMessages = await Memory.getApiMessages();

    console.log('[BetterBoss ' + BG_VERSION + '] Calling Claude with', apiMessages.length, 'messages');

    // Call Claude
    const response = await callClaude(settings.claudeApiKey, apiMessages, memoryContext, pageContext);

    console.log('[BetterBoss] Claude response received, text length:', response.text.length);

    // Execute any skill triggers
    const skillResults = [];
    if (response.skillTriggers.length > 0 && !settings.jobtreadToken) {
      // Filter out non-JT skills that don't need a token
      const needsToken = response.skillTriggers.some(t => t.skill !== 'BOOK_CALL' && t.skill !== 'SAVE_MEMORY');
      if (needsToken) {
        skillResults.push({ type: 'error_notice', error: 'Set your JobTread grant key in Settings to use data skills.' });
      }
    }
    for (const trigger of response.skillTriggers) {
      // BOOK_CALL and SAVE_MEMORY don't need a JT token
      if (trigger.skill === 'BOOK_CALL' || trigger.skill === 'SAVE_MEMORY') {
        const result = await executeSkillAction('', trigger.skill, trigger.param);
        if (result.type === 'memory_save') {
          await Memory.saveNote(result.key, result.value);
          result.success = true;
        }
        skillResults.push(result);
        continue;
      }
      // All other skills need a JT token
      if (!settings.jobtreadToken) continue;
      const result = await executeSkillAction(settings.jobtreadToken, trigger.skill, trigger.param);
      if (result.exportAs === 'csv') {
        result.downloadInfo = downloadCSV(result);
      }
      skillResults.push(result);
    }

    // Save assistant message
    await Memory.saveMessage('assistant', response.text, response.sources, skillResults);

    return { text: response.text, sources: response.sources, skillResults: skillResults, usage: response.usage };
  } catch (err) {
    console.error('[BetterBoss ' + BG_VERSION + '] handleChat error:', err);
    return { error: 'Chat error: ' + (err.message || String(err)) };
  }
}

// ═══════════════════════════════════════════════════════════
// SKILL HANDLER
// ═══════════════════════════════════════════════════════════

async function handleSkill(skill, param) {
  if (skill === 'BOOK_CALL') {
    return { type: 'booking', url: 'https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call' };
  }

  const settings = await Memory.getSettings();
  if (!settings.jobtreadToken) {
    return { error: 'Please set your JobTread API token in Settings (⚙️ tab).' };
  }

  const result = await executeSkillAction(settings.jobtreadToken, skill, param);
  if (result.exportAs === 'csv') downloadCSV(result);
  return result;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function formatPageContext(context) {
  if (!context || context.type === 'unknown') return 'Not on a recognizable JobTread page';
  var str = 'Page type: ' + context.type + '\nURL: ' + context.url;
  if (context.data && context.data.title) str += '\nTitle: ' + context.data.title;
  if (context.data && context.data.jobId) str += '\nJob ID: ' + context.data.jobId;
  if (context.data && context.data.contactId) str += '\nContact ID: ' + context.data.contactId;
  if (context.data && context.data.pageContent) str += '\n\nPage Data:\n' + context.data.pageContent;
  return str;
}

// Track page context when user switches tabs
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab && tab.url && tab.url.indexOf('app.jobtread.com') !== -1) {
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'GET_PAGE_CONTEXT' }, function(ctx) {
        if (chrome.runtime.lastError) return; // content script not loaded
        if (ctx) {
          currentPageContext = formatPageContext(ctx);
          Memory.setPageContext(currentPageContext);
        }
      });
    }
  });
});

console.log('Mr. Better Boss ⚡ service worker loaded — ' + BG_VERSION);
