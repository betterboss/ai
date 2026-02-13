#!/usr/bin/env node

/**
 * ProEdge Build Data Exporter
 *
 * Connects to an active Chrome session (via remote debugging) and systematically
 * crawls all sections of ProEdge Build to export data, files, and images.
 *
 * Prerequisites:
 *   1. Close all Chrome windows
 *   2. Relaunch Chrome with:
 *      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *   3. Log into ProEdge Build at https://www.proedgebuild.com/main.cfm
 *   4. Run: node scraper.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG = {
  baseUrl: 'https://www.proedgebuild.com',
  cdpEndpoint: 'http://localhost:9222',
  exportDir: path.join(__dirname, 'exports'),
  requestDelay: 1500,       // ms between page navigations (be polite)
  downloadTimeout: 30000,   // ms timeout for file downloads
  pageLoadTimeout: 60000,   // ms timeout for page loads
  maxRetries: 3,
  sections: [
    // Core data sections
    { name: 'dashboard',    path: '/main.cfm' },
    { name: 'projects',     path: '/projects.cfm' },
    { name: 'projects',     path: '/project_list.cfm' },
    { name: 'estimates',    path: '/estimates.cfm' },
    { name: 'estimates',    path: '/estimate_list.cfm' },
    { name: 'proposals',    path: '/proposals.cfm' },
    { name: 'proposals',    path: '/proposal_list.cfm' },
    { name: 'invoices',     path: '/invoices.cfm' },
    { name: 'invoices',     path: '/invoice_list.cfm' },
    { name: 'payments',     path: '/payments.cfm' },
    { name: 'payments',     path: '/payment_list.cfm' },
    { name: 'contacts',     path: '/contacts.cfm' },
    { name: 'contacts',     path: '/contact_list.cfm' },
    { name: 'customers',    path: '/customers.cfm' },
    { name: 'customers',    path: '/customer_list.cfm' },
    { name: 'leads',        path: '/leads.cfm' },
    { name: 'leads',        path: '/lead_list.cfm' },
    { name: 'vendors',      path: '/vendors.cfm' },
    { name: 'vendors',      path: '/vendor_list.cfm' },
    { name: 'subcontractors', path: '/subcontractors.cfm' },
    { name: 'subcontractors', path: '/sub_list.cfm' },
    { name: 'schedules',    path: '/schedules.cfm' },
    { name: 'schedules',    path: '/schedule_list.cfm' },
    { name: 'calendar',     path: '/calendar.cfm' },
    { name: 'tasks',        path: '/tasks.cfm' },
    { name: 'tasks',        path: '/task_list.cfm' },
    { name: 'timesheets',   path: '/timesheets.cfm' },
    { name: 'timesheets',   path: '/timesheet_list.cfm' },
    { name: 'purchase_orders', path: '/purchase_orders.cfm' },
    { name: 'purchase_orders', path: '/po_list.cfm' },
    { name: 'change_orders', path: '/change_orders.cfm' },
    { name: 'change_orders', path: '/co_list.cfm' },
    { name: 'daily_logs',   path: '/daily_logs.cfm' },
    { name: 'daily_logs',   path: '/dailylog_list.cfm' },
    { name: 'documents',    path: '/documents.cfm' },
    { name: 'documents',    path: '/document_list.cfm' },
    { name: 'files',        path: '/files.cfm' },
    { name: 'files',        path: '/file_list.cfm' },
    { name: 'photos',       path: '/photos.cfm' },
    { name: 'photos',       path: '/photo_list.cfm' },
    { name: 'reports',      path: '/reports.cfm' },
    { name: 'reports',      path: '/report_list.cfm' },
    // Settings & config
    { name: 'settings',     path: '/settings.cfm' },
    { name: 'settings',     path: '/company_settings.cfm' },
    { name: 'users',        path: '/users.cfm' },
    { name: 'users',        path: '/user_list.cfm' },
    { name: 'templates',    path: '/templates.cfm' },
    { name: 'templates',    path: '/template_list.cfm' },
    { name: 'catalog',      path: '/catalog.cfm' },
    { name: 'catalog',      path: '/item_list.cfm' },
    { name: 'categories',   path: '/categories.cfm' },
    { name: 'tags',         path: '/tags.cfm' },
  ]
};

// ─── Utilities ──────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 200);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] ${msg}`);
}

function logError(msg) {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.error(`[${timestamp}] ERROR: ${msg}`);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const request = protocol.get(url, { timeout: CONFIG.downloadTimeout }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });

    request.on('timeout', () => {
      request.destroy();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// ─── Data Extraction ────────────────────────────────────────────────────────

async function extractTableData(page) {
  return await page.evaluate(() => {
    const tables = [];
    document.querySelectorAll('table').forEach((table, tableIndex) => {
      const rows = [];
      const headers = [];

      // Extract headers
      table.querySelectorAll('thead th, thead td, tr:first-child th').forEach(th => {
        headers.push(th.innerText.trim());
      });

      // If no thead, try first row
      if (headers.length === 0) {
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          firstRow.querySelectorAll('th, td').forEach(cell => {
            headers.push(cell.innerText.trim());
          });
        }
      }

      // Extract body rows
      const bodyRows = table.querySelectorAll('tbody tr, tr');
      bodyRows.forEach((tr, rowIndex) => {
        // Skip header row if we already got headers from it
        if (rowIndex === 0 && headers.length > 0 && !table.querySelector('thead')) return;

        const row = {};
        const cells = tr.querySelectorAll('td');
        cells.forEach((td, cellIndex) => {
          const key = headers[cellIndex] || `column_${cellIndex}`;
          row[key] = td.innerText.trim();

          // Also capture any links in the cell
          const link = td.querySelector('a');
          if (link && link.href) {
            row[`${key}_link`] = link.href;
          }
        });

        if (Object.keys(row).length > 0) {
          rows.push(row);
        }
      });

      if (rows.length > 0) {
        tables.push({
          tableIndex,
          headers,
          rowCount: rows.length,
          rows
        });
      }
    });

    return tables;
  });
}

async function extractFormData(page) {
  return await page.evaluate(() => {
    const forms = [];
    document.querySelectorAll('form').forEach((form, formIndex) => {
      const fields = {};

      form.querySelectorAll('input, select, textarea').forEach(el => {
        const name = el.name || el.id || `field_${Math.random().toString(36).substring(7)}`;
        if (el.type === 'hidden' && !el.value) return;
        if (el.type === 'password') return;

        if (el.tagName === 'SELECT') {
          const selected = el.querySelector('option:checked');
          fields[name] = {
            type: 'select',
            value: el.value,
            selectedText: selected ? selected.text : '',
            options: Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
          };
        } else if (el.tagName === 'TEXTAREA') {
          fields[name] = { type: 'textarea', value: el.value };
        } else {
          fields[name] = { type: el.type, value: el.value };
        }
      });

      if (Object.keys(fields).length > 0) {
        forms.push({
          formIndex,
          action: form.action,
          method: form.method,
          fields
        });
      }
    });

    return forms;
  });
}

async function extractLinks(page) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const seen = new Set();

    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (!href || seen.has(href)) return;
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || href === '#') return;
      seen.add(href);

      links.push({
        text: a.innerText.trim().substring(0, 200),
        href,
        isInternal: href.includes(new URL(baseUrl).hostname),
        isFile: /\.(pdf|doc|docx|xls|xlsx|csv|zip|rar|png|jpg|jpeg|gif|bmp|tif|tiff|dwg|dxf)(\?|$)/i.test(href)
      });
    });

    return links;
  }, CONFIG.baseUrl);
}

async function extractImages(page) {
  return await page.evaluate(() => {
    const images = [];
    const seen = new Set();

    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      if (!src || seen.has(src)) return;
      // Skip tiny icons and tracking pixels
      if (img.width < 20 && img.height < 20 && img.width > 0) return;
      seen.add(src);

      images.push({
        src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      });
    });

    return images;
  });
}

// ─── Pagination ─────────────────────────────────────────────────────────────

async function handlePagination(page, sectionName, sectionDir) {
  let pageNum = 1;
  let allData = { tables: [], forms: [], links: [], images: [] };

  while (true) {
    log(`  Page ${pageNum} of ${sectionName}`);

    // Extract data from current page
    const tables = await extractTableData(page);
    const forms = await extractFormData(page);
    const links = await extractLinks(page);
    const images = await extractImages(page);

    allData.tables.push(...tables);
    allData.forms.push(...forms);
    allData.links.push(...links);
    allData.images.push(...images);

    // Save HTML snapshot
    const html = await page.content();
    const snapshotPath = path.join(sectionDir, `page_${pageNum}.html`);
    fs.writeFileSync(snapshotPath, html);

    // Look for next page link/button
    const hasNextPage = await page.evaluate(() => {
      // Common pagination patterns
      const nextSelectors = [
        'a:has-text("Next")',
        'a:has-text("next")',
        'a:has-text(">")',
        'a:has-text(">>")',
        '.pagination .next a',
        '.paging .next a',
        'a.next',
        'a.nextPage',
        'input[value="Next"]',
        'button:has-text("Next")',
        '[class*="next"]:not(.disabled) a',
        'a[rel="next"]'
      ];

      for (const selector of nextSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && !el.classList.contains('disabled') && el.offsetParent !== null) {
            return selector;
          }
        } catch (e) {
          // querySelector might fail on some pseudo-selectors, try querySelectorAll approach
        }
      }

      // Also check for numbered pagination links
      const allLinks = document.querySelectorAll('.pagination a, .paging a, [class*="page"] a');
      for (const link of allLinks) {
        const text = link.innerText.trim();
        const currentPage = document.querySelector('.pagination .active, .paging .active, [class*="page"] .active');
        const currentNum = currentPage ? parseInt(currentPage.innerText.trim()) : 1;
        if (parseInt(text) === currentNum + 1) {
          return `pagination_number_${text}`;
        }
      }

      return null;
    });

    if (!hasNextPage || pageNum > 100) break;

    // Click next page
    try {
      if (hasNextPage.startsWith('pagination_number_')) {
        const num = hasNextPage.replace('pagination_number_', '');
        await page.click(`.pagination a:has-text("${num}"), .paging a:has-text("${num}"), [class*="page"] a:has-text("${num}")`);
      } else {
        await page.click(hasNextPage);
      }

      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await sleep(CONFIG.requestDelay);
      pageNum++;
    } catch (err) {
      log(`  Pagination ended: ${err.message}`);
      break;
    }
  }

  return allData;
}

// ─── File Download ──────────────────────────────────────────────────────────

async function downloadFiles(page, links, images, sectionDir) {
  const filesDir = path.join(sectionDir, 'files');
  const imagesDir = path.join(sectionDir, 'images');
  ensureDir(filesDir);
  ensureDir(imagesDir);

  let downloadedFiles = 0;
  let downloadedImages = 0;

  // Download linked files (PDFs, docs, spreadsheets, etc.)
  const fileLinks = links.filter(l => l.isFile);
  for (const link of fileLinks) {
    try {
      const urlObj = new URL(link.href);
      const filename = sanitizeFilename(
        path.basename(urlObj.pathname) || `file_${downloadedFiles}`
      );
      const destPath = path.join(filesDir, filename);

      if (!fs.existsSync(destPath)) {
        // Use the browser context to download (preserves auth cookies)
        const response = await page.request.get(link.href);
        const buffer = await response.body();
        fs.writeFileSync(destPath, buffer);
        downloadedFiles++;
        log(`    Downloaded file: ${filename}`);
      }
    } catch (err) {
      logError(`    Failed to download file ${link.href}: ${err.message}`);
    }
  }

  // Download images
  const imageUrls = images.filter(img => {
    // Skip data URIs, tiny images, common UI images
    if (img.src.startsWith('data:')) return false;
    if (img.src.includes('favicon')) return false;
    if (img.src.includes('/icons/')) return false;
    return true;
  });

  for (const img of imageUrls) {
    try {
      const urlObj = new URL(img.src);
      const ext = path.extname(urlObj.pathname) || '.png';
      const filename = sanitizeFilename(
        img.alt || path.basename(urlObj.pathname) || `image_${downloadedImages}`
      );
      const destPath = path.join(imagesDir, `${filename}${ext.includes('.') ? '' : ext}`);

      if (!fs.existsSync(destPath)) {
        const response = await page.request.get(img.src);
        const buffer = await response.body();
        fs.writeFileSync(destPath, buffer);
        downloadedImages++;
        log(`    Downloaded image: ${filename}`);
      }
    } catch (err) {
      logError(`    Failed to download image ${img.src}: ${err.message}`);
    }
  }

  return { downloadedFiles, downloadedImages };
}

// ─── Detail Page Crawling ───────────────────────────────────────────────────

async function crawlDetailPages(page, links, sectionName, sectionDir) {
  const detailDir = path.join(sectionDir, 'details');
  ensureDir(detailDir);

  // Find internal links that look like detail pages (e.g., /project.cfm?id=123)
  const detailLinks = links.filter(l => {
    if (!l.isInternal) return false;
    // Match common detail page patterns
    return /\.(cfm|php|asp)\?.*id=/i.test(l.href) ||
           /\/(view|detail|edit|show)\//i.test(l.href);
  });

  // Deduplicate
  const uniqueLinks = [...new Map(detailLinks.map(l => [l.href, l])).values()];

  log(`  Found ${uniqueLinks.length} detail pages to crawl in ${sectionName}`);

  const detailData = [];

  for (let i = 0; i < uniqueLinks.length; i++) {
    const link = uniqueLinks[i];
    try {
      log(`  Crawling detail ${i + 1}/${uniqueLinks.length}: ${link.text || link.href}`);

      await page.goto(link.href, {
        waitUntil: 'networkidle',
        timeout: CONFIG.pageLoadTimeout
      });

      await sleep(CONFIG.requestDelay);

      const tables = await extractTableData(page);
      const forms = await extractFormData(page);
      const pageLinks = await extractLinks(page);
      const images = await extractImages(page);
      const html = await page.content();

      // Save detail HTML snapshot
      const safeName = sanitizeFilename(link.text || `detail_${i}`);
      fs.writeFileSync(path.join(detailDir, `${safeName}.html`), html);

      // Download any files/images on the detail page
      await downloadFiles(page, pageLinks, images, detailDir);

      detailData.push({
        url: link.href,
        title: link.text,
        tables,
        forms,
        linkCount: pageLinks.length,
        imageCount: images.length
      });

    } catch (err) {
      logError(`  Failed to crawl detail ${link.href}: ${err.message}`);
    }
  }

  return detailData;
}

// ─── Main Scraper ───────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       ProEdge Build Data Exporter v1.0              ║');
  console.log('║       Better Boss Construction Tools                ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Connecting to Chrome via remote debugging...       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Set up export directory structure
  ensureDir(CONFIG.exportDir);
  ensureDir(path.join(CONFIG.exportDir, 'data'));
  ensureDir(path.join(CONFIG.exportDir, 'files'));
  ensureDir(path.join(CONFIG.exportDir, 'images'));
  ensureDir(path.join(CONFIG.exportDir, 'html_snapshots'));

  let browser;

  try {
    // Connect to existing Chrome instance
    log('Connecting to Chrome on localhost:9222...');
    browser = await chromium.connectOverCDP(CONFIG.cdpEndpoint);
    log('Connected to Chrome!');

    // Get existing browser contexts
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts found. Make sure Chrome is open with a ProEdge Build tab.');
    }

    const context = contexts[0];
    const pages = context.pages();

    // Find the ProEdge Build tab
    let page = pages.find(p => p.url().includes('proedgebuild.com'));

    if (!page) {
      log('No ProEdge Build tab found. Using first available tab and navigating...');
      page = pages[0];
      await page.goto(`${CONFIG.baseUrl}/main.cfm`, {
        waitUntil: 'networkidle',
        timeout: CONFIG.pageLoadTimeout
      });
    }

    // Verify we're logged in (not on login page)
    const currentUrl = page.url();
    const pageTitle = await page.title();
    log(`Current page: ${pageTitle} (${currentUrl})`);

    const isLoginPage = await page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('sign in') || body.includes('log in') || body.includes('username') && body.includes('password');
    });

    if (isLoginPage) {
      throw new Error(
        'ProEdge Build login page detected. Please log in first, then re-run the scraper.'
      );
    }

    log('Authenticated session detected. Starting export...');
    console.log('');

    // ─── Crawl all sections ───────────────────────────────────────────

    const exportManifest = {
      exportDate: new Date().toISOString(),
      source: CONFIG.baseUrl,
      sections: {},
      stats: {
        totalPages: 0,
        totalTables: 0,
        totalRows: 0,
        totalFiles: 0,
        totalImages: 0,
        errors: []
      }
    };

    const visitedPaths = new Set();

    for (const section of CONFIG.sections) {
      const sectionPath = section.path;

      // Skip duplicate paths
      if (visitedPaths.has(sectionPath)) continue;
      visitedPaths.add(sectionPath);

      const sectionDir = path.join(CONFIG.exportDir, 'html_snapshots', section.name);
      const dataDir = path.join(CONFIG.exportDir, 'data');
      ensureDir(sectionDir);

      console.log('─'.repeat(55));
      log(`SECTION: ${section.name} (${sectionPath})`);

      try {
        // Navigate to section
        const url = `${CONFIG.baseUrl}${sectionPath}`;
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: CONFIG.pageLoadTimeout
        });

        // Check if page loaded successfully
        if (!response || response.status() >= 400) {
          log(`  Skipping ${sectionPath} - HTTP ${response ? response.status() : 'no response'}`);
          continue;
        }

        await sleep(CONFIG.requestDelay);

        // Check if we got redirected to login
        if (page.url().includes('login') || page.url().includes('signin')) {
          logError(`  Session expired! Redirected to login page.`);
          exportManifest.stats.errors.push({
            section: section.name,
            error: 'Session expired - redirected to login'
          });
          break;
        }

        // Extract data with pagination
        const data = await handlePagination(page, section.name, sectionDir);

        // Download files and images
        const downloads = await downloadFiles(page, data.links, data.images,
          path.join(CONFIG.exportDir));

        // Crawl detail pages (individual records)
        const detailData = await crawlDetailPages(page, data.links, section.name, sectionDir);

        // Save section data as JSON
        const sectionData = {
          section: section.name,
          path: sectionPath,
          exportDate: new Date().toISOString(),
          url,
          tables: data.tables,
          forms: data.forms,
          links: data.links,
          images: data.images,
          details: detailData
        };

        const dataFilePath = path.join(dataDir, `${section.name}.json`);

        // Merge with existing data if section was split across multiple paths
        if (fs.existsSync(dataFilePath)) {
          const existing = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
          existing.tables.push(...sectionData.tables);
          existing.forms.push(...sectionData.forms);
          existing.links.push(...sectionData.links);
          existing.images.push(...sectionData.images);
          existing.details.push(...sectionData.details);
          fs.writeFileSync(dataFilePath, JSON.stringify(existing, null, 2));
        } else {
          fs.writeFileSync(dataFilePath, JSON.stringify(sectionData, null, 2));
        }

        // Update manifest stats
        const totalRows = data.tables.reduce((sum, t) => sum + t.rows.length, 0);
        exportManifest.sections[section.name] = {
          path: sectionPath,
          pages: 1,
          tables: data.tables.length,
          rows: totalRows,
          files: downloads.downloadedFiles,
          images: downloads.downloadedImages,
          details: detailData.length
        };

        exportManifest.stats.totalPages++;
        exportManifest.stats.totalTables += data.tables.length;
        exportManifest.stats.totalRows += totalRows;
        exportManifest.stats.totalFiles += downloads.downloadedFiles;
        exportManifest.stats.totalImages += downloads.downloadedImages;

        log(`  Done: ${data.tables.length} tables, ${totalRows} rows, ${downloads.downloadedFiles} files, ${downloads.downloadedImages} images, ${detailData.length} details`);

      } catch (err) {
        logError(`Failed on ${section.name}: ${err.message}`);
        exportManifest.stats.errors.push({
          section: section.name,
          path: sectionPath,
          error: err.message
        });
      }
    }

    // ─── Generate CSV exports from table data ─────────────────────────

    log('');
    log('Generating CSV exports from extracted tables...');

    const csvDir = path.join(CONFIG.exportDir, 'csv');
    ensureDir(csvDir);

    const dataDir = path.join(CONFIG.exportDir, 'data');
    const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

    for (const file of dataFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      const sectionName = file.replace('.json', '');

      for (let i = 0; i < data.tables.length; i++) {
        const table = data.tables[i];
        if (table.rows.length === 0) continue;

        // Build CSV
        const headers = table.headers.length > 0
          ? table.headers
          : Object.keys(table.rows[0]).filter(k => !k.endsWith('_link'));

        const csvRows = [
          headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')
        ];

        for (const row of table.rows) {
          const values = headers.map(h => {
            const val = (row[h] || '').replace(/"/g, '""').replace(/\n/g, ' ');
            return `"${val}"`;
          });
          csvRows.push(values.join(','));
        }

        const csvFilename = `${sectionName}${data.tables.length > 1 ? `_table${i + 1}` : ''}.csv`;
        fs.writeFileSync(path.join(csvDir, csvFilename), csvRows.join('\n'));
        log(`  CSV: ${csvFilename} (${table.rows.length} rows)`);
      }
    }

    // ─── Save manifest ────────────────────────────────────────────────

    fs.writeFileSync(
      path.join(CONFIG.exportDir, 'manifest.json'),
      JSON.stringify(exportManifest, null, 2)
    );

    // ─── Summary ──────────────────────────────────────────────────────

    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                  EXPORT COMPLETE                     ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Pages crawled:  ${String(exportManifest.stats.totalPages).padEnd(35)}║`);
    console.log(`║  Tables found:   ${String(exportManifest.stats.totalTables).padEnd(35)}║`);
    console.log(`║  Data rows:      ${String(exportManifest.stats.totalRows).padEnd(35)}║`);
    console.log(`║  Files saved:    ${String(exportManifest.stats.totalFiles).padEnd(35)}║`);
    console.log(`║  Images saved:   ${String(exportManifest.stats.totalImages).padEnd(35)}║`);
    console.log(`║  Errors:         ${String(exportManifest.stats.errors.length).padEnd(35)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Output: ./exports/                                  ║`);
    console.log('╚══════════════════════════════════════════════════════╝');

    if (exportManifest.stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      exportManifest.stats.errors.forEach(err => {
        console.log(`  - ${err.section}: ${err.error}`);
      });
    }

  } catch (err) {
    logError(`Fatal error: ${err.message}`);

    if (err.message.includes('ECONNREFUSED')) {
      console.log('\n──────────────────────────────────────────────');
      console.log('Could not connect to Chrome. Make sure you:');
      console.log('1. Close ALL Chrome windows');
      console.log('2. Relaunch Chrome with remote debugging:');
      console.log('');
      console.log('   Mac:');
      console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      console.log('');
      console.log('   Windows:');
      console.log('   "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
      console.log('');
      console.log('   Linux:');
      console.log('   google-chrome --remote-debugging-port=9222');
      console.log('');
      console.log('3. Log into ProEdge Build');
      console.log('4. Re-run: node scraper.js');
      console.log('──────────────────────────────────────────────');
    }

    process.exit(1);
  } finally {
    if (browser) {
      // Disconnect (don't close - it's the user's browser)
      browser.close().catch(() => {});
    }
  }
}

main();
