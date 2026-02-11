// Background service worker — SELF-CONTAINED, no imports
// All modules inlined for Chrome extension service worker compatibility

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
- [SKILL:EXPORT_CSV:type] — Export data as CSV (projects, contacts, estimates)
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

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2025-04-14',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: system,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: messages,
    }),
  });

  // Safely parse response
  const responseText = await res.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error('API returned ' + res.status + ': ' + responseText.slice(0, 300));
  }

  if (!res.ok || data.error) {
    throw new Error(data.error ? (data.error.message || data.error.type || JSON.stringify(data.error)) : 'HTTP ' + res.status);
  }

  // Extract text and citations
  let text = '';
  const sources = [];
  const seenUrls = {};

  for (const block of (data.content || [])) {
    if (block.type === 'text') {
      text += block.text;
      if (block.citations) {
        for (const cite of block.citations) {
          if (cite.url && !seenUrls[cite.url]) {
            seenUrls[cite.url] = true;
            sources.push({ url: cite.url, title: cite.title || '' });
          }
        }
      }
    }
  }

  // Extract and clean skill triggers
  const skillTriggers = [];
  const re = /\[SKILL:([A-Z_]+)(?::([^\]]*))?\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    skillTriggers.push({ skill: m[1], param: m[2] || '' });
  }
  const cleanText = text.replace(/\[SKILL:[^\]]+\]/g, '');

  return { text: cleanText, sources: sources, skillTriggers: skillTriggers, usage: data.usage };
}

// ═══════════════════════════════════════════════════════════
// JOBTREAD API
// ═══════════════════════════════════════════════════════════

const JT_API = 'https://api.jobtread.com/graphql';

async function jtQuery(token, gql, variables) {
  const res = await fetch(JT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ query: gql, variables: variables || {} }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('JobTread API returned ' + res.status + ': ' + text.slice(0, 200));
  }
  if (!res.ok) throw new Error('JobTread API error ' + res.status + ': ' + (json.message || text.slice(0, 200)));
  if (json.errors) throw new Error(json.errors.map(function(e) { return e.message; }).join(', '));
  return json.data;
}

// ═══════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════

async function executeSkillAction(token, skill, param) {
  try {
    switch (skill) {
      case 'SEARCH_PROJECTS': {
        const data = await jtQuery(token, 'query($limit:Int,$search:String){jobs(first:$limit,filter:{search:$search}){edges{node{id name status number createdAt customer{id name} totalPrice totalCost}}}}', { limit: 20, search: param || undefined });
        const items = (data.jobs && data.jobs.edges || []).map(function(e) { return e.node; });
        return { type: 'projects', title: 'Projects matching "' + param + '"', data: items, count: items.length, columns: ['name', 'number', 'status', 'customer.name', 'totalPrice'] };
      }
      case 'SEARCH_CONTACTS': {
        const data = await jtQuery(token, 'query($limit:Int,$search:String){contacts(first:$limit,filter:{search:$search}){edges{node{id name email phone company type}}}}', { limit: 20, search: param || undefined });
        const items = (data.contacts && data.contacts.edges || []).map(function(e) { return e.node; });
        return { type: 'contacts', title: 'Contacts matching "' + param + '"', data: items, count: items.length, columns: ['name', 'email', 'phone', 'company', 'type'] };
      }
      case 'SEARCH_CATALOG': {
        const data = await jtQuery(token, 'query($limit:Int,$search:String){catalogItems(first:$limit,filter:{search:$search}){edges{node{id name description unitPrice unitCost unit category}}}}', { limit: 20, search: param || undefined });
        const items = (data.catalogItems && data.catalogItems.edges || []).map(function(e) { return e.node; });
        return { type: 'catalog', title: 'Catalog items matching "' + param + '"', data: items, count: items.length, columns: ['name', 'unitPrice', 'unitCost', 'unit', 'category'] };
      }
      case 'DASHBOARD': {
        const data = await jtQuery(token, 'query{activeJobs:jobs(filter:{status:ACTIVE}){totalCount} pendingEstimates:estimates(filter:{status:PENDING}){totalCount} unpaidInvoices:invoices(filter:{status:SENT}){totalCount}}');
        return { type: 'dashboard', title: 'Dashboard Stats', data: { activeJobs: (data.activeJobs && data.activeJobs.totalCount) || 0, pendingEstimates: (data.pendingEstimates && data.pendingEstimates.totalCount) || 0, unpaidInvoices: (data.unpaidInvoices && data.unpaidInvoices.totalCount) || 0 } };
      }
      case 'GET_ESTIMATES': {
        const data = await jtQuery(token, 'query($jobId:ID!,$limit:Int){estimates(first:$limit,filter:{jobId:$jobId}){edges{node{id name status totalPrice totalCost createdAt}}}}', { jobId: param, limit: 10 });
        const items = (data.estimates && data.estimates.edges || []).map(function(e) { return e.node; });
        return { type: 'estimates', title: 'Estimates', data: items, count: items.length, columns: ['name', 'status', 'totalPrice', 'totalCost', 'createdAt'] };
      }
      case 'GET_INVOICES': {
        const data = await jtQuery(token, 'query($jobId:ID!,$limit:Int){invoices(first:$limit,filter:{jobId:$jobId}){edges{node{id number status totalAmount paidAmount dueDate}}}}', { jobId: param, limit: 10 });
        const items = (data.invoices && data.invoices.edges || []).map(function(e) { return e.node; });
        return { type: 'invoices', title: 'Invoices', data: items, count: items.length, columns: ['number', 'status', 'totalAmount', 'paidAmount', 'dueDate'] };
      }
      case 'GET_TASKS': {
        const data = await jtQuery(token, 'query($jobId:ID!,$limit:Int){tasks(first:$limit,filter:{jobId:$jobId}){edges{node{id name status dueDate assignee{id name}}}}}', { jobId: param, limit: 50 });
        const items = (data.tasks && data.tasks.edges || []).map(function(e) { return e.node; });
        return { type: 'tasks', title: 'Tasks', data: items, count: items.length, columns: ['name', 'status', 'dueDate', 'assignee.name'] };
      }
      case 'EXPORT_CSV': {
        const result = await executeSkillAction(token, 'SEARCH_' + (param || 'projects').toUpperCase(), '');
        result.exportAs = 'csv';
        return result;
      }
      case 'SAVE_MEMORY': {
        const idx = (param || '').indexOf(':');
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
// CHAT HANDLER
// ═══════════════════════════════════════════════════════════

async function handleChat(text) {
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

  // Call Claude
  const response = await callClaude(settings.claudeApiKey, apiMessages, memoryContext, pageContext);

  // Execute any skill triggers
  const skillResults = [];
  if (response.skillTriggers.length > 0 && settings.jobtreadToken) {
    for (const trigger of response.skillTriggers) {
      const result = await executeSkillAction(settings.jobtreadToken, trigger.skill, trigger.param);

      if (result.type === 'memory_save') {
        await Memory.saveNote(result.key, result.value);
        result.success = true;
      }
      if (result.exportAs === 'csv') {
        result.downloadInfo = downloadCSV(result);
      }
      skillResults.push(result);
    }
  }

  // Save assistant message
  await Memory.saveMessage('assistant', response.text, response.sources, skillResults);

  return { text: response.text, sources: response.sources, skillResults: skillResults, usage: response.usage };
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

console.log('Mr. Better Boss ⚡ service worker loaded');
