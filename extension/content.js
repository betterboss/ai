// Content script — runs on JobTread pages (app.jobtread.com)
// Extracts page context and enables page interaction

(function () {
  'use strict';

  // ── Page Context Extraction ─────────────────────────────

  function getPageContext() {
    const url = window.location.href;
    const path = window.location.pathname;
    const context = { url, path, type: 'unknown', data: {} };

    // Detect page type from URL pattern
    if (path.match(/\/jobs\/([^/]+)/)) {
      context.type = 'project';
      context.data.jobId = path.match(/\/jobs\/([^/]+)/)[1];
    } else if (path.match(/\/contacts\/([^/]+)/)) {
      context.type = 'contact';
      context.data.contactId = path.match(/\/contacts\/([^/]+)/)[1];
    } else if (path.match(/\/estimates\/([^/]+)/)) {
      context.type = 'estimate';
      context.data.estimateId = path.match(/\/estimates\/([^/]+)/)[1];
    } else if (path.match(/\/invoices\/([^/]+)/)) {
      context.type = 'invoice';
      context.data.invoiceId = path.match(/\/invoices\/([^/]+)/)[1];
    } else if (path.match(/\/tasks/)) {
      context.type = 'tasks';
    } else if (path.match(/\/calendar/)) {
      context.type = 'calendar';
    } else if (path.match(/\/reports/)) {
      context.type = 'reports';
    } else if (path === '/' || path === '/dashboard') {
      context.type = 'dashboard';
    }

    // Extract visible page data
    context.data.title = document.title || '';

    // Try to extract key data from page content
    const pageText = extractPageData();
    if (pageText) {
      context.data.pageContent = pageText;
    }

    return context;
  }

  function extractPageData() {
    const parts = [];

    // Page title / heading
    const h1 = document.querySelector('h1, [class*="title"], [class*="header"] h2');
    if (h1) parts.push(`Page: ${h1.textContent.trim()}`);

    // Status badges
    const statuses = document.querySelectorAll('[class*="status"], [class*="badge"]');
    statuses.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 50) parts.push(`Status: ${text}`);
    });

    // Key-value data fields (common in detail pages)
    const fields = document.querySelectorAll('[class*="field"], [class*="detail-row"], [class*="info-row"], dl dt, dl dd');
    const kvPairs = [];
    for (let i = 0; i < fields.length && i < 30; i++) {
      const text = fields[i].textContent.trim();
      if (text && text.length < 200) kvPairs.push(text);
    }
    if (kvPairs.length > 0) parts.push('Fields: ' + kvPairs.join(' | '));

    // Table data (first few rows)
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      if (headers.length > 0) parts.push('Table columns: ' + headers.join(', '));

      const rows = table.querySelectorAll('tbody tr');
      const rowCount = rows.length;
      parts.push(`Table rows: ${rowCount}`);

      // First 3 rows of data
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.textContent.trim());
        parts.push('  Row: ' + cells.join(' | '));
      }
    });

    // Financial totals
    const totals = document.querySelectorAll('[class*="total"], [class*="amount"], [class*="price"]');
    totals.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.match(/\$[\d,.]+/)) parts.push(`Amount: ${text}`);
    });

    return parts.join('\n');
  }

  // ── Message Handling ────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'GET_PAGE_CONTEXT':
        sendResponse(getPageContext());
        break;

      case 'EXTRACT_TABLE_DATA':
        sendResponse(extractTableAsJSON());
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true; // async response
  });

  // ── Page Interaction Helpers ────────────────────────────

  function extractTableAsJSON() {
    const table = document.querySelector('table');
    if (!table) return { error: 'No table found on page' };

    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    );

    const data = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });

    return { headers, data, rowCount: data.length };
  }

  // ── Auto-report context on page change ──────────────────

  let lastPath = window.location.pathname;

  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      const context = getPageContext();
      chrome.runtime.sendMessage({ action: 'PAGE_CONTEXT_UPDATE', context });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Report initial context
  setTimeout(() => {
    const context = getPageContext();
    chrome.runtime.sendMessage({ action: 'PAGE_CONTEXT_UPDATE', context });
  }, 1000);
})();
