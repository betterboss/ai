// Popup controller — chat, skills, memory, settings

document.addEventListener('DOMContentLoaded', init);

let isLoading = false;

async function init() {
  // Verify background service worker is alive
  try {
    var ping = await chrome.runtime.sendMessage({ action: 'PING' });
    console.log('[BetterBoss Popup] Background alive:', ping);
    if (!ping || !ping.pong) {
      console.warn('[BetterBoss Popup] Background did not respond to PING');
    }
  } catch (e) {
    console.error('[BetterBoss Popup] Background not reachable:', e.message);
  }

  setupTabs();
  setupChat();
  setupSkills();
  setupMemory();
  setupSettings();
  loadPageStatus();
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

      // Refresh panel data
      if (tab.dataset.tab === 'memory') loadMemory();
    });
  });

  // Header button shortcuts
  document.getElementById('btnMemory').addEventListener('click', () => {
    document.querySelector('.tab[data-tab="memory"]').click();
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

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);
  showTyping();
  isLoading = true;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'CHAT', text });

    hideTyping();

    if (response.error) {
      appendMessage('assistant', `⚠️ ${response.error}`);
    } else {
      appendMessage('assistant', response.text, response.sources, response.skillResults);
    }
  } catch (err) {
    hideTyping();
    appendMessage('assistant', `⚠️ Error: ${err.message}`);
  }

  isLoading = false;
}

function appendMessage(role, text, sources = [], skillResults = []) {
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
  if (sources && sources.length > 0) {
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
  if (skillResults && skillResults.length > 0) {
    for (const result of skillResults) {
      if (result.error) continue;
      if (result.type === 'booking') {
        const bookDiv = document.createElement('div');
        bookDiv.className = 'booking-inline';
        bookDiv.innerHTML = `
          <button class="booking-inline-btn" onclick="window.open('${result.url}', '_blank')">📞 Book Your FREE Growth Audit Call</button>
          <span class="booking-inline-note">Free 30-min call with Nick Peret — no obligation</span>
        `;
        container.appendChild(bookDiv);
      } else if (Array.isArray(result.data) && result.data.length > 0) {
        container.appendChild(renderSkillResult(result));
      } else if (result.type === 'dashboard') {
        container.appendChild(renderDashboard(result.data));
      }
    }
  }

  // Check for [BOOK_CALL] in raw text
  if (role === 'assistant' && text.includes('[BOOK_CALL]')) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'booking-inline';
    bookDiv.innerHTML = `
      <button class="booking-inline-btn" onclick="window.open('https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call', '_blank')">📞 Book Your FREE Growth Audit Call</button>
      <span class="booking-inline-note">Free 30-min call with Nick Peret — no obligation</span>
    `;
    container.appendChild(bookDiv);
  }

  container.scrollTop = container.scrollHeight;
}

function renderSkillResult(result) {
  const div = document.createElement('div');
  div.className = 'skill-result-card';

  const cols = result.columns || Object.keys(result.data[0] || {});
  const getValue = (obj, key) => key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : '—'), obj);
  const displayCols = cols.slice(0, 4); // Max 4 columns in popup

  let tableHTML = `
    <div class="skill-result-title">${result.title} (${result.count} results)</div>
    <table class="skill-result-table">
      <thead><tr>${displayCols.map(c => `<th>${c.split('.').pop()}</th>`).join('')}</tr></thead>
      <tbody>
        ${result.data.slice(0, 8).map(item => `
          <tr>${displayCols.map(c => {
            let val = getValue(item, c);
            if (typeof val === 'number' && c.toLowerCase().includes('price')) val = '$' + val.toLocaleString();
            return `<td>${val}</td>`;
          }).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;

  if (result.data.length > 8) {
    tableHTML += `<div class="sub" style="margin-top:6px;">+ ${result.data.length - 8} more rows</div>`;
  }

  div.innerHTML = tableHTML;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'skill-result-actions';
  const csvBtn = document.createElement('button');
  csvBtn.className = 'small-btn';
  csvBtn.textContent = '📄 Download CSV';
  csvBtn.addEventListener('click', () => downloadCSV(result));
  actionsDiv.appendChild(csvBtn);
  div.appendChild(actionsDiv);

  return div;
}

function renderDashboard(data) {
  const fmt = (n) => typeof n === 'number' ? '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$0.00';
  const div = document.createElement('div');
  div.className = 'skill-result-card';
  div.innerHTML = `
    <div class="skill-result-title">📊 Dashboard Stats</div>
    <div style="display:flex;gap:12px;margin-top:8px;">
      <div style="flex:1;text-align:center;padding:10px;background:rgba(93,71,250,0.1);border-radius:10px;">
        <div style="font-size:24px;font-weight:700;color:#7a64ff;">${data.activeJobs}</div>
        <div style="font-size:11px;color:#6b6b8a;">Active Jobs</div>
      </div>
      <div style="flex:1;text-align:center;padding:10px;background:rgba(245,158,11,0.1);border-radius:10px;">
        <div style="font-size:24px;font-weight:700;color:#f59e0b;">${data.pendingEstimates}</div>
        <div style="font-size:11px;color:#6b6b8a;">Pending Estimates</div>
        <div style="font-size:13px;font-weight:600;color:#f59e0b;margin-top:4px;">${fmt(data.pendingEstimatesTotal)}</div>
      </div>
      <div style="flex:1;text-align:center;padding:10px;background:rgba(16,185,129,0.1);border-radius:10px;">
        <div style="font-size:24px;font-weight:700;color:#10b981;">${data.unpaidInvoices}</div>
        <div style="font-size:11px;color:#6b6b8a;">Unpaid Invoices</div>
        <div style="font-size:13px;font-weight:600;color:#10b981;margin-top:4px;">${fmt(data.unpaidInvoicesTotal)}</div>
      </div>
    </div>
  `;
  return div;
}

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

// CSV download from skill result
window.downloadCSV = function (result) {
  chrome.runtime.sendMessage({ action: 'DOWNLOAD_CSV', result });
};

// ── Load conversation history ───────────────────────────────

async function loadConversationHistory() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_CONVERSATIONS' });
    if (response.messages && response.messages.length > 0) {
      const container = document.getElementById('chatMessages');
      const welcome = container.querySelector('.welcome');
      if (welcome) welcome.remove();

      for (const msg of response.messages) {
        appendMessage(msg.role, msg.content, msg.sources, msg.skillResults);
      }
    }
  } catch (e) {
    // Fresh session
  }
}

// ── Skills ──────────────────────────────────────────────────

function setupSkills() {
  const grid = document.getElementById('skillsGrid');
  const skills = [
    { id: 'SEARCH_PROJECTS', label: 'Search Projects', icon: '🏗️', desc: 'Find projects by name, number, or customer', needsInput: true },
    { id: 'SEARCH_CONTACTS', label: 'Search Contacts', icon: '👥', desc: 'Find contacts, customers, or vendors', needsInput: true },
    { id: 'SEARCH_CATALOG', label: 'Search Catalog', icon: '📦', desc: 'Search your catalog items and pricing', needsInput: true },
    { id: 'DASHBOARD', label: 'Dashboard', icon: '📊', desc: 'Quick stats on jobs, estimates, invoices', needsInput: false },
    { id: 'EXPORT_CSV', label: 'Export CSV', icon: '📄', desc: 'Export projects, contacts, or catalog', needsInput: true, placeholder: 'Type: projects, contacts, or catalog' },
    { id: 'BOOK_CALL', label: 'Book Audit Call', icon: '📞', desc: 'FREE Growth Audit with Nick Peret', needsInput: false },
  ];

  skills.forEach(skill => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.innerHTML = `
      <div class="skill-icon">${skill.icon}</div>
      <div class="skill-label">${skill.label}</div>
      <div class="skill-desc">${skill.desc}</div>
    `;
    card.addEventListener('click', () => activateSkill(skill));
    grid.appendChild(card);
  });

  document.getElementById('btnSkillRun').addEventListener('click', runActiveSkill);
  document.getElementById('skillInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runActiveSkill();
  });
}

let activeSkill = null;

function activateSkill(skill) {
  if (!skill.needsInput) {
    // Execute immediately
    executeSkill(skill.id, '');
    return;
  }

  activeSkill = skill;
  document.getElementById('skillInputArea').style.display = 'block';
  document.getElementById('skillActive').textContent = `${skill.icon} ${skill.label}`;
  const input = document.getElementById('skillInput');
  input.placeholder = skill.placeholder || `Search ${skill.label.toLowerCase()}...`;
  input.focus();
}

async function runActiveSkill() {
  if (!activeSkill) return;
  const input = document.getElementById('skillInput');
  const query = input.value.trim();
  input.value = '';
  executeSkill(activeSkill.id, query);
}

async function executeSkill(skillId, param) {
  const resultDiv = document.getElementById('skillResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="sub" style="padding:12px;text-align:center;">Loading...</div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'EXECUTE_SKILL',
      skill: skillId,
      param,
    });

    if (response.error) {
      resultDiv.innerHTML = `<div style="color:#ef4444;padding:12px;">⚠️ ${response.error}</div>`;
      return;
    }

    if (response.type === 'booking') {
      window.open(response.url, '_blank');
      resultDiv.style.display = 'none';
      return;
    }

    if (response.type === 'dashboard') {
      resultDiv.innerHTML = '';
      resultDiv.appendChild(renderDashboard(response.data));
      return;
    }

    if (Array.isArray(response.data)) {
      resultDiv.innerHTML = '';
      resultDiv.appendChild(renderSkillResult(response));
    } else {
      resultDiv.innerHTML = `<pre style="font-size:11px;white-space:pre-wrap;padding:12px;">${JSON.stringify(response.data, null, 2)}</pre>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:#ef4444;padding:12px;">⚠️ ${err.message}</div>`;
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
          <p>I'm your AI JobTread assistant with <strong>memory</strong>, <strong>skills</strong>, and <strong>direct API access</strong>.</p>
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
    a.download = `betterboss-memory-${new Date().toISOString().slice(0, 10)}.json`;
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
      list.innerHTML = '<div class="sub" style="padding:8px;">No saved memory yet. Add key-value pairs above.</div>';
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
  } catch (e) {
    // Fresh install
  }
}

async function saveSettings() {
  const settings = {
    claudeApiKey: document.getElementById('settingClaudeKey').value.trim(),
    jobtreadToken: document.getElementById('settingJtToken').value.trim(),
  };
  await chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings });
  document.getElementById('btnSaveSettings').textContent = '✓ Saved!';
  setTimeout(() => {
    document.getElementById('btnSaveSettings').textContent = '💾 Save Settings';
  }, 2000);
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
    // Save settings first so token is available
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

// ── Page Status ─────────────────────────────────────────────

async function loadPageStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_PAGE_CONTEXT' });
    const el = document.getElementById('pageStatus');
    if (response.context && !response.context.includes('Not on')) {
      el.textContent = '🟢 Connected to JobTread';
      el.style.color = '#10b981';
    } else {
      el.textContent = 'JobTread AI Assistant';
    }
  } catch (e) {
    // Not connected
  }
}

// ── Markdown Renderer ───────────────────────────────────────

function renderMarkdown(text) {
  const clean = text.replace(/\[BOOK_CALL\]/g, '').replace(/\[SKILL:[^\]]+\]/g, '');

  // Extract code blocks
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
  return str
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
