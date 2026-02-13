/**
 * ProEdge Build — Browser Console Exporter
 *
 * INSTRUCTIONS:
 *   1. Log into ProEdge Build (https://www.proedgebuild.com/main.cfm)
 *   2. Press F12 → Console
 *   3. Paste this ENTIRE script and press Enter
 *   4. Wait — it will crawl every section and download a ZIP when done
 *
 * No installs. No terminal. No Node.js. Just paste and go.
 */

(async () => {
  // ─── Config ─────────────────────────────────────────────────────────
  const BASE = window.location.origin;
  const DELAY = 1200;
  const SECTIONS = [
    'main.cfm', 'projects.cfm', 'project_list.cfm',
    'estimates.cfm', 'estimate_list.cfm',
    'proposals.cfm', 'proposal_list.cfm',
    'invoices.cfm', 'invoice_list.cfm',
    'payments.cfm', 'payment_list.cfm',
    'contacts.cfm', 'contact_list.cfm',
    'customers.cfm', 'customer_list.cfm',
    'leads.cfm', 'lead_list.cfm',
    'vendors.cfm', 'vendor_list.cfm',
    'subcontractors.cfm', 'sub_list.cfm',
    'schedules.cfm', 'schedule_list.cfm',
    'calendar.cfm',
    'tasks.cfm', 'task_list.cfm',
    'timesheets.cfm', 'timesheet_list.cfm',
    'purchase_orders.cfm', 'po_list.cfm',
    'change_orders.cfm', 'co_list.cfm',
    'daily_logs.cfm', 'dailylog_list.cfm',
    'documents.cfm', 'document_list.cfm',
    'files.cfm', 'file_list.cfm',
    'photos.cfm', 'photo_list.cfm',
    'reports.cfm', 'report_list.cfm',
    'settings.cfm', 'company_settings.cfm',
    'users.cfm', 'user_list.cfm',
    'templates.cfm', 'template_list.cfm',
    'catalog.cfm', 'item_list.cfm',
    'categories.cfm', 'tags.cfm'
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ─── Status UI ──────────────────────────────────────────────────────
  const statusDiv = document.createElement('div');
  statusDiv.id = 'pe-export-status';
  statusDiv.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 999999;
    background: #1a1a2e; color: #0ff; font-family: monospace; font-size: 13px;
    padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    min-width: 320px; max-height: 80vh; overflow-y: auto;
    border: 1px solid #0ff;
  `;
  statusDiv.innerHTML = `
    <div style="font-size:15px;font-weight:bold;margin-bottom:8px;">ProEdge Build Exporter</div>
    <div id="pe-status-text">Initializing...</div>
    <div style="margin-top:8px;background:#333;border-radius:4px;height:6px;">
      <div id="pe-progress-bar" style="background:#0ff;height:100%;border-radius:4px;width:0%;transition:width 0.3s;"></div>
    </div>
    <div id="pe-stats" style="margin-top:8px;font-size:11px;color:#888;"></div>
  `;
  document.body.appendChild(statusDiv);

  const statusText = document.getElementById('pe-status-text');
  const progressBar = document.getElementById('pe-progress-bar');
  const statsDiv = document.getElementById('pe-stats');

  function updateStatus(msg, pct) {
    statusText.textContent = msg;
    if (pct !== undefined) progressBar.style.width = pct + '%';
  }

  // ─── Parse HTML to extract tables ───────────────────────────────────
  function parseTables(doc) {
    const tables = [];
    doc.querySelectorAll('table').forEach((table, ti) => {
      const headers = [];
      const rows = [];

      table.querySelectorAll('thead th, thead td, tr:first-child th').forEach(th => {
        headers.push(th.innerText.trim());
      });

      if (headers.length === 0) {
        const firstRow = table.querySelector('tr');
        if (firstRow) firstRow.querySelectorAll('th, td').forEach(c => headers.push(c.innerText.trim()));
      }

      const bodyRows = table.querySelectorAll('tbody tr, tr');
      bodyRows.forEach((tr, ri) => {
        if (ri === 0 && headers.length > 0 && !table.querySelector('thead')) return;
        const cells = [];
        tr.querySelectorAll('td').forEach(td => cells.push(td.innerText.trim()));
        if (cells.length > 0) {
          const row = {};
          cells.forEach((c, i) => { row[headers[i] || `col_${i}`] = c; });
          rows.push(row);
        }
      });

      if (rows.length > 0) tables.push({ headers, rows });
    });
    return tables;
  }

  // ─── Extract links ──────────────────────────────────────────────────
  function parseLinks(doc) {
    const links = [];
    const seen = new Set();
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (!href || seen.has(href) || href.startsWith('javascript:') || href === '#') return;
      seen.add(href);
      const isFile = /\.(pdf|doc|docx|xls|xlsx|csv|zip|png|jpg|jpeg|gif|tif|dwg)(\?|$)/i.test(href);
      links.push({ text: a.innerText.trim().substring(0, 200), href, isFile });
    });
    return links;
  }

  // ─── Extract images ─────────────────────────────────────────────────
  function parseImages(doc) {
    const images = [];
    const seen = new Set();
    doc.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      if (!src || seen.has(src) || src.startsWith('data:') || src.includes('favicon') || src.includes('/icons/')) return;
      seen.add(src);
      images.push({ src, alt: img.alt || '' });
    });
    return images;
  }

  // ─── Table to CSV ───────────────────────────────────────────────────
  function tableToCSV(table) {
    const h = table.headers.length ? table.headers : Object.keys(table.rows[0]);
    const lines = [h.map(c => `"${c.replace(/"/g, '""')}"`).join(',')];
    for (const row of table.rows) {
      lines.push(h.map(k => `"${(row[k] || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(','));
    }
    return lines.join('\n');
  }

  // ─── Fetch a file as blob ───────────────────────────────────────────
  async function fetchBlob(url) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) return null;
      return await r.blob();
    } catch { return null; }
  }

  // ─── Simple ZIP builder (no dependencies) ───────────────────────────
  // Minimal ZIP implementation — stores files uncompressed
  class SimpleZip {
    constructor() {
      this.files = [];
    }

    addFile(name, content) {
      const encoder = new TextEncoder();
      const data = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
      this.files.push({ name: encoder.encode(name), data });
    }

    async addBlob(name, blob) {
      const buffer = await blob.arrayBuffer();
      this.addFile(name, new Uint8Array(buffer));
    }

    generate() {
      const localFiles = [];
      const centralDir = [];
      let offset = 0;

      for (const file of this.files) {
        // Local file header
        const header = new Uint8Array(30 + file.name.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x04034b50, true);  // signature
        view.setUint16(4, 20, true);           // version needed
        view.setUint16(6, 0, true);            // flags
        view.setUint16(8, 0, true);            // compression (store)
        view.setUint16(10, 0, true);           // mod time
        view.setUint16(12, 0, true);           // mod date
        view.setUint32(14, this._crc32(file.data), true);
        view.setUint32(18, file.data.length, true);  // compressed
        view.setUint32(22, file.data.length, true);  // uncompressed
        view.setUint16(26, file.name.length, true);
        view.setUint16(28, 0, true);           // extra length
        header.set(file.name, 30);

        localFiles.push(header, file.data);

        // Central directory entry
        const cdEntry = new Uint8Array(46 + file.name.length);
        const cdView = new DataView(cdEntry.buffer);
        cdView.setUint32(0, 0x02014b50, true);
        cdView.setUint16(4, 20, true);
        cdView.setUint16(6, 20, true);
        cdView.setUint16(8, 0, true);
        cdView.setUint16(10, 0, true);
        cdView.setUint16(12, 0, true);
        cdView.setUint16(14, 0, true);
        cdView.setUint32(16, this._crc32(file.data), true);
        cdView.setUint32(20, file.data.length, true);
        cdView.setUint32(24, file.data.length, true);
        cdView.setUint16(28, file.name.length, true);
        cdView.setUint16(30, 0, true);
        cdView.setUint16(32, 0, true);
        cdView.setUint16(34, 0, true);
        cdView.setUint16(36, 0, true);
        cdView.setUint32(38, 0, true);
        cdView.setUint32(42, offset, true);
        cdEntry.set(file.name, 46);

        centralDir.push(cdEntry);
        offset += header.length + file.data.length;
      }

      // End of central directory
      const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);
      eocdView.setUint32(0, 0x06054b50, true);
      eocdView.setUint16(4, 0, true);
      eocdView.setUint16(6, 0, true);
      eocdView.setUint16(8, this.files.length, true);
      eocdView.setUint16(10, this.files.length, true);
      eocdView.setUint32(12, cdSize, true);
      eocdView.setUint32(16, offset, true);
      eocdView.setUint16(20, 0, true);

      const parts = [...localFiles, ...centralDir, eocd];
      const totalSize = parts.reduce((s, p) => s + p.length, 0);
      const result = new Uint8Array(totalSize);
      let pos = 0;
      for (const part of parts) {
        result.set(part, pos);
        pos += part.length;
      }
      return result;
    }

    _crc32(data) {
      let crc = 0xFFFFFFFF;
      if (!SimpleZip._table) {
        SimpleZip._table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          SimpleZip._table[i] = c;
        }
      }
      for (let i = 0; i < data.length; i++) {
        crc = SimpleZip._table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MAIN EXPORT
  // ═══════════════════════════════════════════════════════════════════════

  const zip = new SimpleZip();
  const allData = {};
  let totalTables = 0, totalRows = 0, totalFiles = 0, totalImages = 0;

  updateStatus('Starting export...', 0);

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const sectionName = section.replace('.cfm', '');
    const pct = Math.round((i / SECTIONS.length) * 80);
    updateStatus(`Crawling ${sectionName}... (${i + 1}/${SECTIONS.length})`, pct);

    try {
      const url = `${BASE}/${section}`;
      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) {
        console.log(`Skipped ${section}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Check if redirected to login
      if (html.includes('login') && html.includes('password') && html.length < 5000) {
        console.warn(`Session expired at ${section}`);
        updateStatus('SESSION EXPIRED — please log in and re-run', pct);
        break;
      }

      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const tables = parseTables(doc);
      const links = parseLinks(doc);
      const images = parseImages(doc);

      // Save HTML snapshot
      zip.addFile(`html/${sectionName}.html`, html);

      // Save table data as CSV
      for (let t = 0; t < tables.length; t++) {
        const csv = tableToCSV(tables[t]);
        const fname = tables.length > 1 ? `${sectionName}_table${t + 1}` : sectionName;
        zip.addFile(`csv/${fname}.csv`, csv);
        totalRows += tables[t].rows.length;
      }
      totalTables += tables.length;

      // Save JSON data
      allData[sectionName] = { url, tables, links, images };

      // Download linked files
      const fileLinks = links.filter(l => l.isFile);
      for (const link of fileLinks) {
        try {
          updateStatus(`Downloading file: ${link.text || link.href.split('/').pop()}...`, pct);
          const blob = await fetchBlob(link.href);
          if (blob && blob.size > 0) {
            const fname = link.href.split('/').pop().split('?')[0] || `file_${totalFiles}`;
            await zip.addBlob(`files/${sectionName}/${fname}`, blob);
            totalFiles++;
          }
        } catch (e) {
          console.warn(`Failed to download: ${link.href}`);
        }
      }

      // Download images
      for (const img of images) {
        try {
          const blob = await fetchBlob(img.src);
          if (blob && blob.size > 100) {
            const fname = img.src.split('/').pop().split('?')[0] || `img_${totalImages}.png`;
            await zip.addBlob(`images/${sectionName}/${fname}`, blob);
            totalImages++;
          }
        } catch (e) {
          console.warn(`Failed to download image: ${img.src}`);
        }
      }

      statsDiv.textContent = `Tables: ${totalTables} | Rows: ${totalRows} | Files: ${totalFiles} | Images: ${totalImages}`;

      await sleep(DELAY);

    } catch (err) {
      console.error(`Error on ${section}:`, err);
    }
  }

  // ─── Save full JSON ─────────────────────────────────────────────────
  updateStatus('Building export...', 85);
  zip.addFile('data/full_export.json', JSON.stringify(allData, null, 2));

  // ─── Build manifest ─────────────────────────────────────────────────
  zip.addFile('manifest.json', JSON.stringify({
    exportDate: new Date().toISOString(),
    source: BASE,
    stats: { totalTables, totalRows, totalFiles, totalImages }
  }, null, 2));

  // ─── Generate and download ZIP ──────────────────────────────────────
  updateStatus('Generating ZIP file...', 90);
  const zipData = zip.generate();
  const blob = new Blob([zipData], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `ProEdge_Build_Export_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  updateStatus(`DONE! ${totalRows} rows, ${totalFiles} files, ${totalImages} images exported.`, 100);
  progressBar.style.background = '#0f0';
  statusDiv.style.borderColor = '#0f0';

  console.log('=== ProEdge Build Export Complete ===');
  console.log(`Tables: ${totalTables}, Rows: ${totalRows}, Files: ${totalFiles}, Images: ${totalImages}`);

})();
