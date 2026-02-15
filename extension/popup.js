// Popup controller — chat, suggestions, memory, settings

document.addEventListener('DOMContentLoaded', init);

let isLoading = false;

async function init() {
  try {
    var ping = await chrome.runtime.sendMessage({ action: 'PING' });
    console.log('[BetterBoss Popup] Background alive:', ping);
  } catch (e) {
    console.error('[BetterBoss Popup] Background not reachable:', e.message);
  }

  setupTabs();
  setupChat();
  setupDocs();
  setupMemory();
  setupSettings();
  loadPageContext();
  loadConversationHistory();
}

// ── Tabs ────────────────────────────────────────────────────

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'settings') loadMemory();
    });
  });

  document.getElementById('btnSettings').addEventListener('click', () => {
    document.querySelector('.tab[data-tab="settings"]').click();
  });
}

// ── Chat ────────────────────────────────────────────────────

function setupChat() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('btnSend');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isLoading) sendChat();
  });
  btn.addEventListener('click', () => {
    if (!isLoading) sendChat();
  });
}

async function sendChat(textOverride) {
  const input = document.getElementById('chatInput');
  const text = textOverride || input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);
  showTyping();
  isLoading = true;
  document.getElementById('btnSend').disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHAT', text });
    hideTyping();
    if (response.error) {
      appendMessage('assistant', `⚠️ ${response.error}`);
    } else {
      appendMessage('assistant', response.text, response.sources, response.skillResults, response.usage);
    }
  } catch (err) {
    hideTyping();
    appendMessage('assistant', `⚠️ Error: ${err.message}`);
  }

  isLoading = false;
  document.getElementById('btnSend').disabled = false;
}

function appendMessage(role, text, sources, skillResults, usage) {
  sources = sources || [];
  skillResults = skillResults || [];
  const container = document.getElementById('chatMessages');
  const welcome = container.querySelector('.welcome');
  if (welcome) welcome.remove();

  // Message bubble
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${role}`;
  msgDiv.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '👤' : '⚡'}</div>
    <div class="msg-body">${role === 'assistant' ? renderMarkdown(text) : escapeHtml(text)}</div>
  `;
  container.appendChild(msgDiv);

  // Sources
  if (sources.length > 0) {
    const srcDiv = document.createElement('div');
    srcDiv.className = 'sources-box';
    const label = document.createElement('div');
    label.className = 'sources-label';
    label.textContent = 'Sources';
    srcDiv.appendChild(label);
    const list = document.createElement('div');
    list.className = 'sources-list';
    for (const s of sources) {
      const chip = document.createElement('a');
      chip.className = 'source-chip';
      chip.href = s.url;
      chip.target = '_blank';
      chip.textContent = s.title || getDomain(s.url);
      list.appendChild(chip);
    }
    srcDiv.appendChild(list);
    container.appendChild(srcDiv);
  }

  // Skill results
  if (skillResults.length > 0) {
    for (const result of skillResults) {
      if (result.type === 'error_notice') {
        const noticeDiv = document.createElement('div');
        noticeDiv.className = 'sources-box';
        noticeDiv.innerHTML = `<div style="font-size:12px;color:#f59e0b;">⚠️ ${escapeHtml(result.error)}</div>`;
        container.appendChild(noticeDiv);
        continue;
      }
      if (result.error) {
        var errDiv = document.createElement('div');
        errDiv.className = 'sources-box';
        errDiv.innerHTML = '<div style="font-size:12px;color:#ef4444;">\u274C ' + escapeHtml(result.skill || 'Skill') + ' failed: ' + escapeHtml(result.error) + '</div>';
        container.appendChild(errDiv);
        continue;
      }

      var card = renderInsightResult(result);
      if (card) {
        if (result.warnings && result.warnings.length > 0) {
          var warnDiv = document.createElement('div');
          warnDiv.className = 'insight-truncation';
          warnDiv.textContent = '\u26A0\uFE0F ' + result.warnings.join(' \u00B7 ');
          card.appendChild(warnDiv);
        }
        container.appendChild(card);
      }
    }
  }

  // Token usage & estimated cost
  if (usage && role === 'assistant') {
    var usageDiv = document.createElement('div');
    usageDiv.className = 'msg-usage';
    var inTok = usage.input_tokens || 0;
    var outTok = usage.output_tokens || 0;
    var cost = (inTok * 3 / 1000000) + (outTok * 15 / 1000000);
    usageDiv.textContent = inTok.toLocaleString() + ' in / ' + outTok.toLocaleString() + ' out \u00B7 ~$' + cost.toFixed(4);
    container.appendChild(usageDiv);
  }

  container.scrollTop = container.scrollHeight;
}

// ── Insight Result Renderers ────────────────────────────────

function renderInsightResult(result) {
  switch (result.type) {
    case 'project_analysis': return renderProjectAnalysis(result);
    case 'business_overview': return renderBusinessOverview(result);
    case 'cash_flow': return renderCashFlow(result);
    case 'search_results': return renderSearchResults(result);
    case 'client_history': return renderClientHistory(result);
    case 'memory_save': return renderMemorySave(result);
    case 'booking': return renderBooking(result);
    default: return null;
  }
}

function fmtDollars(n) {
  return '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function renderProjectAnalysis(result) {
  const d = result.data;
  const div = document.createElement('div');
  div.className = 'insight-card';

  let alerts = '';
  if (d.overdueTasks > 0) alerts += `<div class="insight-alert warning">⚠️ ${d.overdueTasks} overdue task${d.overdueTasks > 1 ? 's' : ''}${d.overdueTaskNames.length ? ': ' + d.overdueTaskNames.map(n => escapeHtml(n)).join(', ') : ''}</div>`;
  if (d.outstandingBalance > 0) alerts += `<div class="insight-alert warning">💰 ${fmtDollars(d.outstandingBalance)} outstanding balance</div>`;
  if (d.expectedMargin > 0 && d.expectedMargin < 15) alerts += `<div class="insight-alert danger">📉 Low margin: ${d.expectedMargin.toFixed(1)}% (target: 15-25%)</div>`;

  div.innerHTML = `
    <div class="insight-title">📊 ${escapeHtml(result.title)}</div>
    <div class="insight-status">${escapeHtml(d.status)}${d.pendingEstimates > 0 ? ' · ' + d.pendingEstimates + ' pending estimate(s)' : ''}</div>
    ${alerts}
    <div class="insight-grid">
      <div class="insight-metric">
        <div class="insight-metric-value">${fmtDollars(d.estimatedRevenue)}</div>
        <div class="insight-metric-label">Est. Revenue</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value">${d.expectedMargin.toFixed(1)}%</div>
        <div class="insight-metric-label">Margin</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value">${fmtDollars(d.totalInvoiced)}</div>
        <div class="insight-metric-label">Invoiced</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value">${fmtDollars(d.totalCollected)}</div>
        <div class="insight-metric-label">Collected</div>
      </div>
    </div>
    ${d.taskCount > 0 ? `
    <div class="insight-progress">
      <div class="insight-progress-bar" style="width:${d.taskCompletion}%"></div>
      <span>${d.taskCompletion}% complete (${d.completedTasks}/${d.taskCount} tasks)</span>
    </div>` : ''}
    ${result.jobId ? `<a class="jt-link" href="https://app.jobtread.com/jobs/${encodeURIComponent(result.jobId)}" target="_blank">Open in JobTread →</a>` : ''}
  `;
  return div;
}

function renderBusinessOverview(result) {
  const d = result.data;
  const div = document.createElement('div');
  div.className = 'insight-card';

  let alerts = '';
  var over60 = (d.agingCounts.over60 || 0) + (d.agingCounts.over90 || 0);
  var over60amt = (d.aging.over60 || 0) + (d.aging.over90 || 0);
  if (over60 > 0) alerts += `<div class="insight-alert danger">🔴 ${over60} invoice${over60 > 1 ? 's' : ''} over 60 days (${fmtDollars(over60amt)})</div>`;

  div.innerHTML = `
    <div class="insight-title">📊 Business Overview</div>
    ${alerts}
    <div class="insight-grid">
      <div class="insight-metric">
        <div class="insight-metric-value">${d.activeJobs}</div>
        <div class="insight-metric-label">Active Jobs</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value">${fmtDollars(d.pipelineValue)}</div>
        <div class="insight-metric-label">Pipeline (${d.pendingEstimates})</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value" style="color:#ef4444;">${fmtDollars(d.totalAR)}</div>
        <div class="insight-metric-label">Outstanding AR</div>
      </div>
    </div>
    <div class="insight-aging">
      <div class="insight-aging-label">Invoice Aging</div>
      <div class="insight-aging-row"><span>0-30 days</span><span>${fmtDollars(d.aging.current)} (${d.agingCounts.current})</span></div>
      <div class="insight-aging-row"><span>31-60 days</span><span>${fmtDollars(d.aging.over30)} (${d.agingCounts.over30})</span></div>
      <div class="insight-aging-row ${d.agingCounts.over60 > 0 ? 'warning' : ''}"><span>61-90 days</span><span>${fmtDollars(d.aging.over60)} (${d.agingCounts.over60})</span></div>
      <div class="insight-aging-row ${d.agingCounts.over90 > 0 ? 'danger' : ''}"><span>90+ days</span><span>${fmtDollars(d.aging.over90)} (${d.agingCounts.over90})</span></div>
    </div>
  `;
  return div;
}

function renderCashFlow(result) {
  const d = result.data;
  const div = document.createElement('div');
  div.className = 'insight-card';

  div.innerHTML = `
    <div class="insight-title">💰 Cash Flow</div>
    <div class="insight-grid">
      <div class="insight-metric">
        <div class="insight-metric-value" style="color:#f59e0b;">${fmtDollars(d.pipelineValue)}</div>
        <div class="insight-metric-label">Pipeline (${d.pendingEstimateCount})</div>
      </div>
      <div class="insight-metric">
        <div class="insight-metric-value" style="color:#ef4444;">${fmtDollars(d.totalAR)}</div>
        <div class="insight-metric-label">Receivables (${d.unpaidInvoiceCount})</div>
      </div>
    </div>
    <div class="insight-aging">
      <div class="insight-aging-label">Aging Breakdown</div>
      ${d.buckets.map(function(b) {
        var cls = b.label.includes('90') ? 'danger' : b.label.includes('61') ? 'warning' : '';
        return '<div class="insight-aging-row ' + cls + '"><span>' + b.label + '</span><span>' + fmtDollars(b.total) + ' (' + b.count + ')</span></div>';
      }).join('')}
    </div>
    ${d.oldestInvoices.length > 0 ? `
    <div class="insight-section">
      <div class="insight-aging-label">Oldest Outstanding</div>
      ${d.oldestInvoices.map(function(inv) {
        return '<div class="insight-aging-row danger"><span>' + escapeHtml(inv.name) + '</span><span>' + fmtDollars(inv.owed) + ' (' + inv.days + 'd)</span></div>';
      }).join('')}
    </div>` : ''}
  `;
  return div;
}

function renderSearchResults(result) {
  const div = document.createElement('div');
  div.className = 'insight-card';
  let html = `<div class="insight-title">${escapeHtml(result.title)} (${result.count})</div>`;
  html += '<div class="search-results-list">';
  for (const item of result.data.slice(0, 10)) {
    var statusCls = (item.status === 'Active' || item.status === 'Closed') ? item.status.toLowerCase() : '';
    html += `<a class="search-result-item" href="${escapeHtml(item.url)}" target="_blank">
      <div>
        <span class="search-result-name">${escapeHtml(item.name)}${item.number ? ' #' + item.number : ''}</span>
        ${item.subtitle ? '<div class="search-result-subtitle">' + escapeHtml(item.subtitle) + '</div>' : ''}
      </div>
      <span class="search-result-status ${statusCls}">${escapeHtml(item.status)}</span>
    </a>`;
  }
  html += '</div>';
  div.innerHTML = html;
  return div;
}

function renderClientHistory(result) {
  const d = result.data;
  const div = document.createElement('div');
  div.className = 'insight-card';
  let html = `
    <div class="insight-title">👤 ${escapeHtml(d.name || 'Unknown')}</div>
    <div class="insight-status">${d.title ? escapeHtml(d.title) + ' — ' : ''}${escapeHtml(d.accountName || '')}${d.accountType ? ' (' + escapeHtml(d.accountType) + ')' : ''}</div>
    <div class="insight-grid">
      <div class="insight-metric"><div class="insight-metric-value">${d.totalJobs}</div><div class="insight-metric-label">Total Jobs</div></div>
      <div class="insight-metric"><div class="insight-metric-value" style="color:#10b981;">${d.activeJobs}</div><div class="insight-metric-label">Active</div></div>
      <div class="insight-metric"><div class="insight-metric-value">${d.closedJobs}</div><div class="insight-metric-label">Completed</div></div>
    </div>
  `;
  if (d.recentJobs && d.recentJobs.length > 0) {
    html += '<div class="insight-section"><div class="insight-aging-label">Recent Jobs</div><div class="search-results-list">';
    for (const job of d.recentJobs) {
      html += `<a class="search-result-item" href="${escapeHtml(job.url)}" target="_blank">
        <span class="search-result-name">${escapeHtml(job.name)}${job.number ? ' #' + job.number : ''}</span>
        <span class="search-result-status ${job.status === 'Active' ? 'active' : 'closed'}">${job.status}</span>
      </a>`;
    }
    html += '</div></div>';
  }
  if (result.contactId) {
    html += `<a class="jt-link" href="https://app.jobtread.com/contacts/${encodeURIComponent(result.contactId)}" target="_blank">Open in JobTread →</a>`;
  }
  div.innerHTML = html;
  return div;
}

function renderMemorySave(result) {
  const div = document.createElement('div');
  div.className = 'sources-box';
  div.innerHTML = `<div style="font-size:12px;color:#10b981;">🧠 Saved to memory: <strong>${escapeHtml(result.key)}</strong> = ${escapeHtml(result.value)}</div>`;
  return div;
}

function renderBooking(result) {
  const div = document.createElement('div');
  div.className = 'booking-inline';
  const btn = document.createElement('button');
  btn.className = 'booking-inline-btn';
  btn.textContent = '📞 Book Your FREE Growth Audit Call';
  btn.addEventListener('click', function() { window.open(result.url, '_blank'); });
  const note = document.createElement('span');
  note.className = 'booking-inline-note';
  note.textContent = 'Free 30-min call with Nick Peret — no obligation';
  div.appendChild(btn);
  div.appendChild(note);
  return div;
}

// ── Docs Tab ────────────────────────────────────────────────

var loadedFields = [];
var currentTemplateId = null;

function setupDocs() {
  document.getElementById('btnLoadFields').addEventListener('click', loadJobFields);
  document.getElementById('btnSaveTemplate').addEventListener('click', saveCurrentTemplate);
  document.getElementById('btnDeleteTemplate').addEventListener('click', deleteCurrentTemplate);
  document.getElementById('btnCopyOutput').addEventListener('click', copyOutput);
  document.getElementById('templateSelect').addEventListener('change', loadSelectedTemplate);
  document.getElementById('templateEditor').addEventListener('input', updateOutput);
  document.getElementById('fieldSearch').addEventListener('input', filterFields);

  loadTemplateList();
}

async function loadJobFields() {
  var btn = document.getElementById('btnLoadFields');
  var label = document.getElementById('docsJobLabel');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  label.textContent = 'Fetching fields...';

  try {
    // Get current job ID from page context
    var ctxResponse = await chrome.runtime.sendMessage({ action: 'GET_PAGE_CONTEXT' });
    var ctx = ctxResponse.context || '';
    var jobMatch = ctx.match(/Job ID: ([^\n]+)/);
    var jobId = jobMatch ? jobMatch[1].trim() : null;

    if (!jobId) {
      label.textContent = 'No job detected — navigate to a project page';
      btn.disabled = false;
      btn.textContent = 'Load Fields';
      return;
    }

    var result = await chrome.runtime.sendMessage({ action: 'FETCH_JOB_FIELDS', jobId: jobId });
    if (result.error) {
      label.textContent = 'Error: ' + result.error;
      btn.disabled = false;
      btn.textContent = 'Load Fields';
      return;
    }

    loadedFields = result.fields || [];
    label.textContent = escapeHtml(result.jobName) + ' (' + loadedFields.length + ' fields)';
    renderFields(loadedFields);
    updateOutput();
  } catch (err) {
    label.textContent = 'Error: ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Load Fields';
}

function renderFields(fields) {
  var container = document.getElementById('fieldsList');
  if (fields.length === 0) {
    container.innerHTML = '<div class="docs-empty">No fields found</div>';
    return;
  }

  var html = '';
  var currentGroup = '';

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.group !== currentGroup) {
      currentGroup = f.group;
      html += '<div class="docs-group-header">' + (currentGroup === 'custom' ? 'Custom Fields' : 'Standard Fields') + '</div>';
    }
    var displayValue = f.value || '<em>empty</em>';
    if (displayValue.length > 60) displayValue = escapeHtml(displayValue.slice(0, 57)) + '...';
    else if (f.value) displayValue = escapeHtml(displayValue);

    html += '<div class="docs-field-row" data-key="' + escapeHtml(f.key) + '">' +
      '<div class="docs-field-info">' +
        '<span class="docs-field-label">' + escapeHtml(f.label) + '</span>' +
        '<span class="docs-field-value">' + displayValue + '</span>' +
      '</div>' +
      '<div class="docs-field-actions">' +
        '<button class="docs-field-btn insert-btn" data-key="' + escapeHtml(f.key) + '" title="Insert {{' + escapeHtml(f.key) + '}} into template">+</button>' +
        '<button class="docs-field-btn copy-btn" data-value="' + escapeHtml(f.value || '') + '" title="Copy value">Copy</button>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML = html;

  // Bind insert buttons
  container.querySelectorAll('.insert-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = btn.dataset.key;
      var editor = document.getElementById('templateEditor');
      var pos = editor.selectionStart;
      var text = editor.value;
      var tag = '{{' + key + '}}';
      editor.value = text.slice(0, pos) + tag + text.slice(pos);
      editor.focus();
      editor.selectionStart = editor.selectionEnd = pos + tag.length;
      updateOutput();
      showBtnFeedback(btn, '+', 'Done');
    });
  });

  // Bind copy buttons
  container.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var val = btn.dataset.value;
      navigator.clipboard.writeText(val).then(function() {
        showBtnFeedback(btn, 'Copy', 'OK!');
      });
    });
  });
}

function filterFields() {
  var search = document.getElementById('fieldSearch').value.toLowerCase().trim();
  if (!search) {
    renderFields(loadedFields);
    return;
  }
  var filtered = loadedFields.filter(function(f) {
    return f.label.toLowerCase().indexOf(search) !== -1 ||
           f.key.toLowerCase().indexOf(search) !== -1 ||
           (f.value && f.value.toLowerCase().indexOf(search) !== -1);
  });
  renderFields(filtered);
}

function updateOutput() {
  var template = document.getElementById('templateEditor').value;
  var output = document.getElementById('templateOutput');

  if (!template.trim()) {
    output.innerHTML = '<span class="docs-empty-inline">Fill in a template above to see the output here.</span>';
    return;
  }

  // Build field map
  var fieldMap = {};
  for (var i = 0; i < loadedFields.length; i++) {
    fieldMap[loadedFields[i].key] = loadedFields[i].value || '';
  }

  // Replace placeholders
  var filled = template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    if (fieldMap.hasOwnProperty(key)) {
      return fieldMap[key];
    }
    return match; // leave unresolved placeholders as-is
  });

  // Highlight unresolved placeholders
  var html = escapeHtml(filled).replace(/\{\{(\w+)\}\}/g, '<span class="docs-unresolved">{{$1}}</span>');
  // Preserve line breaks
  html = html.replace(/\n/g, '<br>');
  output.innerHTML = html;
}

function copyOutput() {
  var template = document.getElementById('templateEditor').value;
  var fieldMap = {};
  for (var i = 0; i < loadedFields.length; i++) {
    fieldMap[loadedFields[i].key] = loadedFields[i].value || '';
  }
  var filled = template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    if (fieldMap.hasOwnProperty(key)) {
      return fieldMap[key];
    }
    return match;
  });

  navigator.clipboard.writeText(filled).then(function() {
    var btn = document.getElementById('btnCopyOutput');
    showBtnFeedback(btn, 'Copy', 'Copied!');
  });
}

// Template management
async function loadTemplateList() {
  try {
    var response = await chrome.runtime.sendMessage({ action: 'GET_TEMPLATES' });
    var templates = response.templates || [];
    var select = document.getElementById('templateSelect');
    select.innerHTML = '<option value="">-- New Template --</option>';
    for (var i = 0; i < templates.length; i++) {
      var opt = document.createElement('option');
      opt.value = templates[i].id;
      opt.textContent = templates[i].name;
      select.appendChild(opt);
    }
  } catch (e) {
    console.error('[BetterBoss] Failed to load templates:', e);
  }
}

function loadSelectedTemplate() {
  var select = document.getElementById('templateSelect');
  var id = select.value;
  if (!id) {
    currentTemplateId = null;
    document.getElementById('templateName').value = '';
    document.getElementById('templateEditor').value = '';
    updateOutput();
    return;
  }

  chrome.runtime.sendMessage({ action: 'GET_TEMPLATES' }, function(response) {
    var templates = response.templates || [];
    var tpl = templates.find(function(t) { return t.id === id; });
    if (tpl) {
      currentTemplateId = tpl.id;
      document.getElementById('templateName').value = tpl.name;
      document.getElementById('templateEditor').value = tpl.content;
      updateOutput();
    }
  });
}

async function saveCurrentTemplate() {
  var name = document.getElementById('templateName').value.trim();
  var content = document.getElementById('templateEditor').value;

  if (!name) {
    document.getElementById('templateName').focus();
    document.getElementById('templateName').style.borderColor = '#ef4444';
    setTimeout(function() { document.getElementById('templateName').style.borderColor = ''; }, 2000);
    return;
  }

  var template = { name: name, content: content };
  if (currentTemplateId) template.id = currentTemplateId;

  var response = await chrome.runtime.sendMessage({ action: 'SAVE_TEMPLATE', template: template });
  if (!currentTemplateId && response.templates) {
    // Find the newly created template
    var newest = response.templates[response.templates.length - 1];
    if (newest) currentTemplateId = newest.id;
  }

  loadTemplateList();

  // Restore selection
  if (currentTemplateId) {
    setTimeout(function() {
      document.getElementById('templateSelect').value = currentTemplateId;
    }, 100);
  }

  var btn = document.getElementById('btnSaveTemplate');
  showBtnFeedback(btn, 'Save', 'Saved!');
}

async function deleteCurrentTemplate() {
  if (!currentTemplateId) return;
  if (!confirm('Delete this template?')) return;

  await chrome.runtime.sendMessage({ action: 'DELETE_TEMPLATE', id: currentTemplateId });
  currentTemplateId = null;
  document.getElementById('templateName').value = '';
  document.getElementById('templateEditor').value = '';
  document.getElementById('templateSelect').value = '';
  updateOutput();
  loadTemplateList();
}

function showBtnFeedback(btn, originalText, feedbackText) {
  btn.textContent = feedbackText;
  btn.classList.add('feedback');
  setTimeout(function() {
    btn.textContent = originalText;
    btn.classList.remove('feedback');
  }, 1200);
}

// ── Smart Suggestions ───────────────────────────────────────

var currentContext = { type: 'none', jobId: null, contactId: null };

function updateSuggestions(ctx) {
  const el = document.getElementById('suggestions');
  el.innerHTML = '';
  var chips = [];

  if (ctx.type === 'project' && ctx.jobId) {
    chips.push({ label: '📊 Analyze this project', text: 'Analyze this project' });
    chips.push({ label: '💰 What\'s outstanding?', text: 'What\'s the outstanding balance on this project?' });
    chips.push({ label: '📋 Task progress', text: 'How are the tasks progressing on this project?' });
  } else if (ctx.type === 'contact' && ctx.contactId) {
    chips.push({ label: '👤 Client history', text: 'Show me this client\'s history' });
    chips.push({ label: '📊 Business overview', text: 'How\'s my business doing?' });
  } else if (ctx.type === 'dashboard') {
    chips.push({ label: '📊 Business health', text: 'Give me a business health check' });
    chips.push({ label: '💰 Who owes me?', text: 'Who owes me money right now?' });
    chips.push({ label: '📈 Cash flow', text: 'Show me my cash flow situation' });
  } else {
    chips.push({ label: '📊 Business overview', text: 'How\'s my business doing?' });
    chips.push({ label: '💰 Cash flow', text: 'Show me my cash flow' });
    chips.push({ label: '📈 Who owes me?', text: 'Who owes me money?' });
  }

  chips.forEach(function(c) {
    var chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.textContent = c.label;
    chip.addEventListener('click', function() {
      if (!isLoading) sendChat(c.text);
    });
    el.appendChild(chip);
  });
}

function parsePageContext(ctxString) {
  var result = { type: 'none', jobId: null, contactId: null };
  if (!ctxString || ctxString.includes('Not on')) return result;
  var typeMatch = ctxString.match(/Page type: (\w+)/);
  if (typeMatch) result.type = typeMatch[1];
  var jobMatch = ctxString.match(/Job ID: ([^\n]+)/);
  if (jobMatch) result.jobId = jobMatch[1].trim();
  var contactMatch = ctxString.match(/Contact ID: ([^\n]+)/);
  if (contactMatch) result.contactId = contactMatch[1].trim();
  return result;
}

// ── Typing Indicator ────────────────────────────────────────

function showTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.id = 'typing';
  div.className = 'msg assistant';
  div.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="typing"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

// ── Load conversation history ───────────────────────────────

async function loadConversationHistory() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_CONVERSATIONS' });
    if (response.messages && response.messages.length > 0) {
      for (const msg of response.messages) {
        appendMessage(msg.role, msg.content, msg.sources, msg.skillResults);
      }
    }
  } catch (e) {
    // Fresh session
  }
}

// ── Page Context ────────────────────────────────────────────

async function loadPageContext() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_PAGE_CONTEXT' });
    const el = document.getElementById('pageStatus');
    const ctx = response.context || '';
    if (ctx && !ctx.includes('Not on')) {
      el.textContent = '🟢 Connected to JobTread';
      el.style.color = '#10b981';
    } else {
      el.textContent = 'JobTread AI Assistant';
    }
    currentContext = parsePageContext(ctx);
    updateSuggestions(currentContext);
  } catch (e) {
    updateSuggestions({ type: 'none' });
  }
}

// ── Memory ──────────────────────────────────────────────────

function setupMemory() {
  document.getElementById('btnAddMemory').addEventListener('click', addMemory);
  document.getElementById('btnClearMemory').addEventListener('click', async () => {
    if (confirm('Clear all saved memory?')) {
      await chrome.runtime.sendMessage({ action: 'CLEAR_MEMORY' });
      loadMemory();
    }
  });
  document.getElementById('btnClearChat').addEventListener('click', async () => {
    if (confirm('Clear conversation history?')) {
      await chrome.runtime.sendMessage({ action: 'CLEAR_CONVERSATIONS' });
      const container = document.getElementById('chatMessages');
      container.innerHTML = `
        <div class="welcome">
          <div class="welcome-robot">
            <span class="welcome-eyes"><span class="eye lg"></span><span class="eye lg"></span></span>
            <span class="welcome-bolt">⚡</span>
          </div>
          <h2>Hey there! ⚡</h2>
          <p>I'm your AI business analyst for JobTread. I analyze your data and surface <strong>insights</strong> you can't easily see in JT alone.</p>
          <p class="sub">Try: "How's my business doing?" or navigate to a project and ask "Analyze this project"</p>
        </div>
      `;
      loadMemory();
    }
  });
  document.getElementById('btnExportMemory').addEventListener('click', async () => {
    const data = await chrome.runtime.sendMessage({ action: 'EXPORT_ALL' });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betterboss-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  loadMemory();
}

async function loadMemory() {
  try {
    const [memResponse, convResponse] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'GET_MEMORY' }),
      chrome.runtime.sendMessage({ action: 'GET_CONVERSATIONS' }),
    ]);

    const list = document.getElementById('memoryList');
    const notes = memResponse.notes || {};
    const entries = Object.entries(notes);

    if (entries.length === 0) {
      list.innerHTML = '<div class="sub" style="padding:8px;">No saved memory yet.</div>';
    } else {
      list.innerHTML = entries.map(([key, val]) => `
        <div class="memory-item">
          <span class="memory-item-key">${escapeHtml(key)}</span>
          <span class="memory-item-value">${escapeHtml(val.value)}</span>
          <button class="memory-item-delete" data-key="${escapeHtml(key)}">×</button>
        </div>
      `).join('');

      list.querySelectorAll('.memory-item-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          await chrome.runtime.sendMessage({ action: 'DELETE_NOTE', key: btn.dataset.key });
          loadMemory();
        });
      });
    }

    const msgCount = (convResponse.messages || []).length;
    document.getElementById('conversationCount').textContent = `${msgCount} messages`;
  } catch (e) {
    // Extension context might not be ready
  }
}

async function addMemory() {
  const keyEl = document.getElementById('memoryKey');
  const valEl = document.getElementById('memoryValue');
  const key = keyEl.value.trim();
  const value = valEl.value.trim();
  if (!key || !value) return;
  await chrome.runtime.sendMessage({ action: 'SAVE_NOTE', key, value });
  keyEl.value = '';
  valEl.value = '';
  loadMemory();
}

// ── Settings ────────────────────────────────────────────────

function setupSettings() {
  loadSettings();
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnToggleKey').addEventListener('click', () => {
    const el = document.getElementById('settingClaudeKey');
    el.type = el.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('btnToggleJtKey').addEventListener('click', () => {
    const el = document.getElementById('settingJtToken');
    el.type = el.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('btnBookCall').addEventListener('click', () => {
    window.open('https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call', '_blank');
  });
  document.getElementById('btnTestConnection').addEventListener('click', testConnection);
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
    const s = response.settings || {};
    document.getElementById('settingClaudeKey').value = s.claudeApiKey || '';
    document.getElementById('settingJtToken').value = s.jobtreadToken || '';
  } catch (e) {}
}

async function saveSettings() {
  const settings = {
    claudeApiKey: document.getElementById('settingClaudeKey').value.trim(),
    jobtreadToken: document.getElementById('settingJtToken').value.trim(),
  };
  await chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings });
  document.getElementById('btnSaveSettings').textContent = '✓ Saved!';
  setTimeout(() => { document.getElementById('btnSaveSettings').textContent = '💾 Save Settings'; }, 2000);
}

async function testConnection() {
  const resultDiv = document.getElementById('testResult');
  const btn = document.getElementById('btnTestConnection');
  resultDiv.style.display = 'block';
  resultDiv.style.background = 'rgba(107,107,138,0.1)';
  resultDiv.style.color = '#6b6b8a';
  resultDiv.textContent = 'Testing connection...';
  btn.disabled = true;

  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({ action: 'TEST_JT_CONNECTION' });
    if (response.error) {
      resultDiv.style.background = 'rgba(239,68,68,0.1)';
      resultDiv.style.color = '#ef4444';
      resultDiv.textContent = 'Failed: ' + response.error;
    } else {
      resultDiv.style.background = 'rgba(16,185,129,0.1)';
      resultDiv.style.color = '#10b981';
      resultDiv.textContent = 'Connected! ' + (response.info || '');
    }
  } catch (err) {
    resultDiv.style.background = 'rgba(239,68,68,0.1)';
    resultDiv.style.color = '#ef4444';
    resultDiv.textContent = 'Error: ' + err.message;
  }
  btn.disabled = false;
}

// ── Markdown Renderer ───────────────────────────────────────

function renderMarkdown(text) {
  const clean = text.replace(/\[SKILL:[^\]]+\]/g, '');

  const codeBlocks = [];
  let processed = clean.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(code.trim());
    return `\n%%CB_${idx}%%\n`;
  });

  const lines = processed.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const cbMatch = line.match(/^%%CB_(\d+)%%$/);
    if (cbMatch) {
      html += `<pre><code>${escapeHtml(codeBlocks[parseInt(cbMatch[1])])}</code></pre>`;
      i++; continue;
    }

    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const lvl = hMatch[1].length;
      html += `<h${lvl}>${inlineFmt(hMatch[2])}</h${lvl}>`;
      i++; continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      html += '<hr/>';
      i++; continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      html += '<ul>';
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        html += `<li>${inlineFmt(lines[i].replace(/^\s*[-*]\s/, ''))}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      html += '<ol>';
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        html += `<li>${inlineFmt(lines[i].replace(/^\s*\d+\.\s/, ''))}</li>`;
        i++;
      }
      html += '</ol>';
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    let para = '';
    while (i < lines.length && lines[i].trim() !== '' && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !/^%%CB_/.test(lines[i]) && !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())) {
      if (para) para += '<br/>';
      para += inlineFmt(lines[i]);
      i++;
    }
    if (para) html += `<p>${para}</p>`;
  }

  return html;
}

function inlineFmt(str) {
  const safe = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return safe
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}
