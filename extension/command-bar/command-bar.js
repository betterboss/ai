// Command Bar — Ctrl+K quick command palette for the Chrome extension
// Injects an overlay onto any page for rapid JobTread actions

(function () {
  let overlay = null;
  let isOpen = false;
  let commands = [];
  let filteredCommands = [];
  let selectedIndex = 0;

  // Register keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandBar();
    }
    if (e.key === 'Escape' && isOpen) {
      closeCommandBar();
    }
  });

  function toggleCommandBar() {
    if (isOpen) {
      closeCommandBar();
    } else {
      openCommandBar();
    }
  }

  function openCommandBar() {
    if (isOpen) return;
    isOpen = true;

    // Load commands
    commands = getCommands();
    filteredCommands = [...commands];
    selectedIndex = 0;

    // Create overlay
    overlay = document.createElement('div');
    overlay.id = 'bb-command-bar-overlay';
    overlay.innerHTML = `
      <div id="bb-command-bar">
        <div class="bb-cb-input-wrap">
          <span class="bb-cb-icon">⚡</span>
          <input type="text" id="bb-cb-input" placeholder="Type a command..." autocomplete="off" />
          <span class="bb-cb-shortcut">ESC</span>
        </div>
        <div id="bb-cb-results"></div>
      </div>
    `;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:20vh;';

    const bar = overlay.querySelector('#bb-command-bar');
    bar.style.cssText = 'width:520px;max-width:90vw;background:#1a1b26;border:1px solid rgba(93,71,250,0.3);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    const inputWrap = overlay.querySelector('.bb-cb-input-wrap');
    inputWrap.style.cssText = 'display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);';

    const icon = overlay.querySelector('.bb-cb-icon');
    icon.style.cssText = 'font-size:18px;';

    const input = overlay.querySelector('#bb-cb-input');
    input.style.cssText = 'flex:1;background:none;border:none;color:#e5e7eb;font-size:15px;outline:none;';

    const shortcut = overlay.querySelector('.bb-cb-shortcut');
    shortcut.style.cssText = 'font-size:11px;color:#6b7280;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;';

    document.body.appendChild(overlay);

    // Focus input
    setTimeout(() => input.focus(), 50);

    // Event handlers
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      filteredCommands = query
        ? commands.filter(c => c.label.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))
        : [...commands];
      selectedIndex = 0;
      renderResults();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults();
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex]);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCommandBar();
    });

    renderResults();
  }

  function closeCommandBar() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    isOpen = false;
  }

  function renderResults() {
    const container = overlay.querySelector('#bb-cb-results');
    container.style.cssText = 'max-height:320px;overflow-y:auto;padding:8px;';

    if (filteredCommands.length === 0) {
      container.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280;font-size:13px;">No matching commands</div>';
      return;
    }

    container.innerHTML = filteredCommands.map((cmd, i) => {
      const isSelected = i === selectedIndex;
      return `
        <div class="bb-cb-item" data-index="${i}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;background:${isSelected ? 'rgba(93,71,250,0.15)' : 'transparent'};transition:background 0.1s;">
          <span style="font-size:18px;width:28px;text-align:center;">${cmd.icon}</span>
          <div style="flex:1;">
            <div style="color:${isSelected ? '#fff' : '#d1d5db'};font-size:14px;font-weight:500;">${cmd.label}</div>
            <div style="color:#6b7280;font-size:12px;">${cmd.description}</div>
          </div>
          ${cmd.shortcut ? `<span style="font-size:11px;color:#6b7280;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:4px;">${cmd.shortcut}</span>` : ''}
        </div>
      `;
    }).join('');

    // Click handlers
    container.querySelectorAll('.bb-cb-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        executeCommand(filteredCommands[idx]);
      });
      item.addEventListener('mouseenter', () => {
        selectedIndex = parseInt(item.dataset.index);
        renderResults();
      });
    });
  }

  function executeCommand(cmd) {
    closeCommandBar();
    if (cmd.action) {
      cmd.action();
    } else if (cmd.url) {
      window.open(cmd.url, '_blank');
    }
  }

  function getCommands() {
    return [
      {
        icon: '🔍',
        label: 'Search Jobs',
        description: 'Find a job by name or number',
        action: () => promptAndSend('Search jobs:', 'search_jobs'),
      },
      {
        icon: '👤',
        label: 'Search Contacts',
        description: 'Find a contact by name',
        action: () => promptAndSend('Search contacts:', 'search_contacts'),
      },
      {
        icon: '➕',
        label: 'Create Job',
        description: 'Create a new job in JobTread',
        url: 'https://app.jobtread.com/jobs/new',
      },
      {
        icon: '📝',
        label: 'New Estimate',
        description: 'Create an AI-powered estimate',
        action: () => window.open(getBBUrl('/estimate'), '_blank'),
      },
      {
        icon: '📊',
        label: 'Dashboard',
        description: 'View your business dashboard',
        action: () => window.open(getBBUrl('/dashboard'), '_blank'),
      },
      {
        icon: '🤖',
        label: 'AI Agent',
        description: 'Chat with your AI assistant',
        action: () => window.open(getBBUrl('/agent'), '_blank'),
      },
      {
        icon: '📨',
        label: 'Write Email',
        description: 'AI-generate a customer email',
        action: () => window.open(getBBUrl('/write'), '_blank'),
      },
      {
        icon: '🔔',
        label: 'Sequences',
        description: 'Manage follow-up sequences',
        action: () => window.open(getBBUrl('/sequences'), '_blank'),
      },
      {
        icon: '📋',
        label: 'Leads',
        description: 'View captured leads',
        action: () => window.open(getBBUrl('/leads'), '_blank'),
      },
      {
        icon: '🎤',
        label: 'Voice Command',
        description: 'Talk to JobTread',
        action: () => window.open(getBBUrl('/voice'), '_blank'),
      },
      {
        icon: '⚙️',
        label: 'Settings',
        description: 'Open extension settings',
        action: () => chrome.runtime.sendMessage({ action: 'OPEN_POPUP' }),
      },
    ];
  }

  function getBBUrl(path) {
    // Use the deployed app URL or localhost
    return `https://mr-better-boss.vercel.app${path}`;
  }

  async function promptAndSend(label, toolName) {
    const query = prompt(label);
    if (!query) return;

    try {
      const settings = await chrome.storage.local.get(['claudeApiKey', 'jobtreadToken']);
      if (!settings.jobtreadToken) {
        alert('Please set your JobTread grant key in extension settings first.');
        return;
      }

      // Send to agent API
      const response = await fetch(getBBUrl('/api/agent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${toolName === 'search_jobs' ? 'Search for jobs matching' : 'Search for contacts named'}: "${query}"` }],
          apiKey: settings.claudeApiKey,
          grantKey: settings.jobtreadToken,
        }),
      });

      const data = await response.json();
      if (data.content) {
        // Show result in a notification-style overlay
        showResultOverlay(data.content);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  function showResultOverlay(text) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:20px;right:20px;max-width:400px;background:#1a1b26;border:1px solid rgba(93,71,250,0.3);border-radius:12px;padding:16px;z-index:999999;box-shadow:0 10px 40px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e5e7eb;font-size:13px;line-height:1.5;white-space:pre-wrap;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;color:#6b7280;font-size:18px;cursor:pointer;';
    closeBtn.onclick = () => div.remove();

    div.textContent = text.slice(0, 500);
    div.appendChild(closeBtn);
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 15000);
  }
})();
