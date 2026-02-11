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

const SYSTEM_PROMPT = `You are Mr. Better Boss ⚡, an AI business analyst for JobTread users. You live inside a Chrome extension and help contractors understand their business data, spot problems, and make smarter decisions. You are created by Better Boss (better-boss.ai), a JobTread Certified Implementation Partner.

## YOUR ROLE
You are an insights layer on top of JobTread — not a replacement for it. You DON'T duplicate JT's native search, navigation, or data entry. Instead, you ANALYZE data and surface actionable insights a contractor can't easily get from the JT interface alone.

## WHAT YOU DO
- Analyze project profitability (estimated revenue vs cost, margins, invoiced vs collected)
- Surface cash flow insights (who owes money, aging invoices, pending pipeline)
- Check project health (task progress, overdue items, budget status)
- Review client history (past projects, payment patterns)
- Give a business-wide health check (active jobs, pipeline, AR aging)
- Answer JT questions with real data — not generic advice

## PAGE CONTEXT
When the user is on a specific JT page, you know the page type and any IDs. Use them:
- On a job page → offer to analyze that project (you have the Job ID)
- On a contact page → offer to review that client's history (you have the Contact ID)
- On the dashboard → offer a business health check

## SKILL TRIGGERS
Include these tags to pull live data. Always explain what you're doing first.
- [SKILL:ANALYZE_PROJECT:jobId] — Full project analysis (profitability, invoicing, tasks)
- [SKILL:BUSINESS_OVERVIEW] — Company-wide KPIs, pipeline, AR aging
- [SKILL:CASH_FLOW] — Aging report, oldest invoices, pipeline value
- [SKILL:FIND_PROJECT:query] — Find a project by name (returns clickable links)
- [SKILL:FIND_CONTACT:query] — Find a contact by name
- [SKILL:CLIENT_HISTORY:contactId] — Client's job history and status
- [SKILL:SAVE_MEMORY:key:value] — Remember something for later
- [SKILL:BOOK_CALL] — Offer Better Boss consulting

## ANALYSIS GUIDELINES
- Lead with the insight, then show the data that supports it
- Always show dollar amounts formatted ($XX,XXX)
- Calculate margins and flag if below 15% (typical contractor target: 15-25%)
- Flag overdue invoices, stalled tasks, and low-margin projects in red
- Give specific action items: "Follow up with Smith Construction on Invoice #1042"
- When something looks bad, say so — but offer a path forward

## PERSONALITY
- Confident, direct, practical — a business advisor who knows construction
- Contractor-friendly language (change orders, scope creep, punch lists, GC, subs)
- Lead with what matters, skip the fluff
- When user needs hands-on implementation help, include [SKILL:BOOK_CALL]

## FORMATTING
- Use ## headings for sections
- Use **bold** for key numbers and alerts
- Keep paragraphs to 2-3 sentences
- Use bullet lists for action items

## JOBTREAD KNOWLEDGE
- Better Boss: JT Certified Implementation Partner, founded by Nick Peret
- 30-day implementation guaranteed, uses n8n for automations
- Key results: 20+ hrs/wk saved, 19-42% close rate improvement, 3x faster estimates
- Integrations: QuickBooks Online, CompanyCam, EagleView, Stripe, Acorn

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

      case 'ANALYZE_PROJECT': {
        var data = await paveQuery(grantKey, {
          job: {
            $: { id: param },
            id: {}, name: {}, number: {}, closedOn: {},
            documents: {
              $: { size: 100 },
              nodes: { id: {}, type: {}, status: {}, price: {}, cost: {}, amountPaid: {}, name: {}, number: {} }
            },
            tasks: {
              $: { size: 100, sortBy: [{ field: 'startDate' }] },
              nodes: { id: {}, name: {}, progress: {}, startDate: {}, endDate: {} }
            }
          }
        });
        var job = data.job || {};
        var docs = (job.documents && job.documents.nodes) || [];
        var tasks = (job.tasks && job.tasks.nodes) || [];
        var estimates = docs.filter(function(d) { return d.type === 'customerOrder'; });
        var invoices = docs.filter(function(d) { return d.type === 'customerInvoice'; });
        var approved = estimates.filter(function(e) { return e.status === 'approved' || e.status === 'accepted'; });
        var estimatedRevenue = approved.reduce(function(s, e) { return s + (e.price || 0); }, 0);
        var estimatedCost = approved.reduce(function(s, e) { return s + (e.cost || 0); }, 0);
        var expectedMargin = estimatedRevenue > 0 ? ((estimatedRevenue - estimatedCost) / estimatedRevenue * 100) : 0;
        var totalInvoiced = invoices.reduce(function(s, i) { return s + (i.price || 0); }, 0);
        var totalCollected = invoices.reduce(function(s, i) { return s + (i.amountPaid || 0); }, 0);
        var taskCount = tasks.length;
        var completedTasks = tasks.filter(function(t) { return t.progress >= 1; }).length;
        var taskCompletion = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
        var today = new Date().toISOString().slice(0, 10);
        var overdueTasks = tasks.filter(function(t) { return t.endDate && t.endDate < today && t.progress < 1; });
        return {
          type: 'project_analysis',
          title: (job.name || 'Project') + (job.number ? ' #' + job.number : ''),
          jobId: param,
          data: {
            status: job.closedOn ? 'Closed' : 'Active',
            estimatedRevenue: estimatedRevenue,
            estimatedCost: estimatedCost,
            expectedMargin: expectedMargin,
            totalInvoiced: totalInvoiced,
            totalCollected: totalCollected,
            outstandingBalance: totalInvoiced - totalCollected,
            remainingToInvoice: estimatedRevenue - totalInvoiced,
            pendingEstimates: estimates.filter(function(e) { return e.status === 'pending'; }).length,
            pendingEstimateValue: estimates.filter(function(e) { return e.status === 'pending'; }).reduce(function(s, e) { return s + (e.price || 0); }, 0),
            taskCount: taskCount,
            completedTasks: completedTasks,
            taskCompletion: taskCompletion,
            overdueTasks: overdueTasks.length,
            overdueTaskNames: overdueTasks.slice(0, 3).map(function(t) { return t.name; }),
          }
        };
      }

      case 'BUSINESS_OVERVIEW': {
        var orgId = await getOrgId(grantKey);
        var data = await paveQuery(grantKey, {
          organization: {
            $: { id: orgId },
            activeJobs: {
              _: 'jobs',
              $: { where: ['closedOn', '=', null], size: 100 },
              nodes: { id: {} }
            },
            pendingEstimates: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerOrder'], ['status', '=', 'pending']] }, size: 100 },
              nodes: { id: {}, price: {} }
            },
            unpaidInvoices: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerInvoice'], ['status', '!=', 'paid']] }, size: 100 },
              nodes: { id: {}, price: {}, amountPaid: {}, createdAt: {} }
            }
          }
        });
        var org = data.organization || {};
        var activeJobs = (org.activeJobs && org.activeJobs.nodes) || [];
        var pendingEst = (org.pendingEstimates && org.pendingEstimates.nodes) || [];
        var unpaidInv = (org.unpaidInvoices && org.unpaidInvoices.nodes) || [];
        var pipelineValue = pendingEst.reduce(function(s, e) { return s + (e.price || 0); }, 0);
        var now = Date.now();
        var aging = { current: 0, over30: 0, over60: 0, over90: 0 };
        var agingCounts = { current: 0, over30: 0, over60: 0, over90: 0 };
        var totalAR = 0;
        unpaidInv.forEach(function(inv) {
          var owed = (inv.price || 0) - (inv.amountPaid || 0);
          if (owed <= 0) return;
          totalAR += owed;
          var days = inv.createdAt ? Math.floor((now - new Date(inv.createdAt).getTime()) / 86400000) : 0;
          if (days > 90) { aging.over90 += owed; agingCounts.over90++; }
          else if (days > 60) { aging.over60 += owed; agingCounts.over60++; }
          else if (days > 30) { aging.over30 += owed; agingCounts.over30++; }
          else { aging.current += owed; agingCounts.current++; }
        });
        return {
          type: 'business_overview',
          title: 'Business Overview',
          data: {
            activeJobs: activeJobs.length,
            pendingEstimates: pendingEst.length,
            pipelineValue: pipelineValue,
            unpaidInvoices: unpaidInv.length,
            totalAR: totalAR,
            aging: aging,
            agingCounts: agingCounts,
          }
        };
      }

      case 'CASH_FLOW': {
        var orgId = await getOrgId(grantKey);
        var data = await paveQuery(grantKey, {
          organization: {
            $: { id: orgId },
            pendingEstimates: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerOrder'], ['status', '=', 'pending']] }, size: 100 },
              nodes: { id: {}, price: {}, name: {} }
            },
            unpaidInvoices: {
              _: 'documents',
              $: { where: { and: [['type', '=', 'customerInvoice'], ['status', '!=', 'paid']] }, size: 100 },
              nodes: { id: {}, price: {}, amountPaid: {}, name: {}, number: {}, createdAt: {} }
            }
          }
        });
        var org = data.organization || {};
        var pendingEst = (org.pendingEstimates && org.pendingEstimates.nodes) || [];
        var unpaidInv = (org.unpaidInvoices && org.unpaidInvoices.nodes) || [];
        var pipelineValue = pendingEst.reduce(function(s, e) { return s + (e.price || 0); }, 0);
        var now = Date.now();
        var buckets = [
          { label: '0-30 days', min: 0, max: 30, total: 0, count: 0 },
          { label: '31-60 days', min: 31, max: 60, total: 0, count: 0 },
          { label: '61-90 days', min: 61, max: 90, total: 0, count: 0 },
          { label: '90+ days', min: 91, max: Infinity, total: 0, count: 0 },
        ];
        var oldestInvoices = [];
        unpaidInv.forEach(function(inv) {
          var owed = (inv.price || 0) - (inv.amountPaid || 0);
          if (owed <= 0) return;
          var days = inv.createdAt ? Math.floor((now - new Date(inv.createdAt).getTime()) / 86400000) : 0;
          for (var i = 0; i < buckets.length; i++) {
            if (days >= buckets[i].min && (days <= buckets[i].max || buckets[i].max === Infinity)) {
              buckets[i].total += owed; buckets[i].count++; break;
            }
          }
          if (days > 60) oldestInvoices.push({ name: inv.name || inv.number || 'Invoice', owed: owed, days: days });
        });
        oldestInvoices.sort(function(a, b) { return b.days - a.days; });
        var totalAR = buckets.reduce(function(s, b) { return s + b.total; }, 0);
        return {
          type: 'cash_flow',
          title: 'Cash Flow',
          data: {
            pipelineValue: pipelineValue,
            pendingEstimateCount: pendingEst.length,
            totalAR: totalAR,
            unpaidInvoiceCount: unpaidInv.length,
            buckets: buckets,
            oldestInvoices: oldestInvoices.slice(0, 5),
          }
        };
      }

      case 'FIND_PROJECT': {
        var orgId = await getOrgId(grantKey);
        var params = { size: 20, sortBy: [{ field: 'createdAt', order: 'desc' }] };
        if (param) params.where = ['name', '~', param];
        var data;
        try {
          data = await paveQuery(grantKey, {
            organization: { $: { id: orgId }, jobs: { $: params, nodes: { id: {}, name: {}, number: {}, closedOn: {} } } }
          });
        } catch (e) {
          delete params.where;
          data = await paveQuery(grantKey, {
            organization: { $: { id: orgId }, jobs: { $: params, nodes: { id: {}, name: {}, number: {}, closedOn: {} } } }
          });
          if (param) {
            var search = param.toLowerCase();
            data.organization.jobs.nodes = (data.organization.jobs.nodes || []).filter(function(j) {
              return (j.name && j.name.toLowerCase().indexOf(search) !== -1) || (j.number && String(j.number).toLowerCase().indexOf(search) !== -1);
            });
          }
        }
        var items = (data.organization && data.organization.jobs && data.organization.jobs.nodes) || [];
        return {
          type: 'search_results',
          title: 'Projects' + (param ? ' matching "' + param + '"' : ''),
          entityType: 'project',
          data: items.map(function(j) {
            return { id: j.id, name: j.name, number: j.number, status: j.closedOn ? 'Closed' : 'Active', url: 'https://app.jobtread.com/jobs/' + j.id };
          }),
          count: items.length,
        };
      }

      case 'FIND_CONTACT': {
        var orgId = await getOrgId(grantKey);
        var params = { size: 20, sortBy: [{ field: 'name' }] };
        if (param) params.where = ['name', '~', param];
        var data;
        try {
          data = await paveQuery(grantKey, {
            organization: { $: { id: orgId }, contacts: { $: params, nodes: { id: {}, name: {}, title: {}, account: { id: {}, name: {}, type: {} } } } }
          });
        } catch (e) {
          delete params.where;
          data = await paveQuery(grantKey, {
            organization: { $: { id: orgId }, contacts: { $: params, nodes: { id: {}, name: {}, title: {}, account: { id: {}, name: {}, type: {} } } } }
          });
          if (param) {
            var search = param.toLowerCase();
            data.organization.contacts.nodes = (data.organization.contacts.nodes || []).filter(function(c) {
              return (c.name && c.name.toLowerCase().indexOf(search) !== -1);
            });
          }
        }
        var items = (data.organization && data.organization.contacts && data.organization.contacts.nodes) || [];
        return {
          type: 'search_results',
          title: 'Contacts' + (param ? ' matching "' + param + '"' : ''),
          entityType: 'contact',
          data: items.map(function(c) {
            return { id: c.id, name: c.name + (c.title ? ' — ' + c.title : ''), subtitle: c.account ? c.account.name : '', status: c.account ? c.account.type : '', url: 'https://app.jobtread.com/contacts/' + c.id };
          }),
          count: items.length,
        };
      }

      case 'CLIENT_HISTORY': {
        var contactData = await paveQuery(grantKey, {
          contact: {
            $: { id: param },
            id: {}, name: {}, title: {},
            account: { id: {}, name: {}, type: {} }
          }
        });
        var contact = contactData.contact || {};
        var account = contact.account || {};
        var jobs = [];
        if (account.id) {
          var orgId = await getOrgId(grantKey);
          try {
            var jobsData = await paveQuery(grantKey, {
              organization: {
                $: { id: orgId },
                jobs: {
                  $: { where: ['account.id', '=', account.id], size: 50, sortBy: [{ field: 'createdAt', order: 'desc' }] },
                  nodes: { id: {}, name: {}, number: {}, closedOn: {} }
                }
              }
            });
            jobs = (jobsData.organization && jobsData.organization.jobs && jobsData.organization.jobs.nodes) || [];
          } catch (e) {
            console.warn('[BetterBoss] Could not fetch jobs for account:', e.message);
          }
        }
        return {
          type: 'client_history',
          title: 'Client: ' + (contact.name || 'Unknown'),
          contactId: param,
          data: {
            name: contact.name,
            title: contact.title,
            accountName: account.name,
            accountType: account.type,
            totalJobs: jobs.length,
            activeJobs: jobs.filter(function(j) { return !j.closedOn; }).length,
            closedJobs: jobs.filter(function(j) { return j.closedOn; }).length,
            recentJobs: jobs.slice(0, 5).map(function(j) {
              return { id: j.id, name: j.name, number: j.number, status: j.closedOn ? 'Closed' : 'Active', url: 'https://app.jobtread.com/jobs/' + j.id };
            }),
          }
        };
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
