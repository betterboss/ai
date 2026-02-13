#!/usr/bin/env node

/**
 * Google Drive Uploader for ProEdge Build Exports
 *
 * Uploads the entire exports/ directory to a specified Google Drive folder,
 * preserving the folder structure.
 *
 * Setup:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use existing)
 *   3. Enable the Google Drive API
 *   4. Create OAuth 2.0 credentials (Desktop app type)
 *   5. Download the credentials JSON and save as credentials.json in this directory
 *   6. Run: node gdrive-upload.js
 *   7. On first run, it will open a browser for OAuth consent. Approve it.
 *
 * Usage:
 *   node gdrive-upload.js                          # Upload to root of Drive
 *   node gdrive-upload.js --folder-id FOLDER_ID    # Upload to specific folder
 *   node gdrive-upload.js --folder-id 1Wxx1iNN81kaQx6ZaNsRflItOMPJvH6Tx
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');
const mimeTypes = require('mime-types');

// ─── Configuration ──────────────────────────────────────────────────────────

const EXPORT_DIR = path.join(__dirname, 'exports');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Parse CLI args
const args = process.argv.slice(2);
let targetFolderId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--folder-id' && args[i + 1]) {
    targetFolderId = args[i + 1];
    i++;
  }
}

// ─── Auth ───────────────────────────────────────────────────────────────────

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('Error: credentials.json not found.');
    console.error('');
    console.error('To set up Google Drive API credentials:');
    console.error('1. Go to https://console.cloud.google.com');
    console.error('2. Create/select a project');
    console.error('3. Enable the Google Drive API');
    console.error('4. Go to Credentials > Create Credentials > OAuth 2.0 Client IDs');
    console.error('5. Select "Desktop app" as the application type');
    console.error('6. Download the JSON and save it as credentials.json in this directory');
    process.exit(1);
  }

  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
  const { client_secret, client_id, redirect_uris } = JSON.parse(content).installed ||
    JSON.parse(content).web || {};

  if (!client_id || !client_secret) {
    console.error('Error: Invalid credentials.json format.');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3333/oauth2callback'
  );

  // Check for existing token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);

    // Check if token is expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      console.log('Token expired, refreshing...');
      try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
        console.log('Token refreshed successfully.');
      } catch (err) {
        console.log('Token refresh failed, re-authenticating...');
        return await getNewToken(oAuth2Client);
      }
    }

    return oAuth2Client;
  }

  return await getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('');
    console.log('Authorize this app by visiting this URL:');
    console.log(authUrl);
    console.log('');
    console.log('Waiting for OAuth callback on http://localhost:3333 ...');

    // Start a temporary local server to receive the OAuth callback
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url, 'http://localhost:3333');
        if (urlObj.pathname === '/oauth2callback') {
          const code = urlObj.searchParams.get('code');
          if (!code) {
            res.writeHead(400);
            res.end('No code received');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');

          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log('Authentication successful! Token saved.');

          server.close();
          resolve(oAuth2Client);
        }
      } catch (err) {
        res.writeHead(500);
        res.end('Error');
        server.close();
        reject(err);
      }
    });

    server.listen(3333, () => {
      // Try to open the auth URL in the default browser
      const { exec } = require('child_process');
      const platform = process.platform;
      if (platform === 'darwin') exec(`open "${authUrl}"`);
      else if (platform === 'win32') exec(`start "${authUrl}"`);
      else exec(`xdg-open "${authUrl}"`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout - no callback received within 5 minutes'));
    }, 300000);
  });
}

// ─── Upload Logic ───────────────────────────────────────────────────────────

async function createDriveFolder(drive, name, parentId) {
  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const res = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name',
  });

  return res.data.id;
}

async function uploadFile(drive, filePath, parentId) {
  const fileName = path.basename(filePath);
  const mimeType = mimeTypes.lookup(filePath) || 'application/octet-stream';

  const fileMetadata = {
    name: fileName,
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const media = {
    mimeType,
    body: fs.createReadStream(filePath),
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, size',
  });

  return res.data;
}

async function uploadDirectory(drive, localDir, parentFolderId, indent = '') {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  let totalUploaded = 0;
  let totalSize = 0;

  // Sort: directories first, then files
  const dirs = entries.filter(e => e.isDirectory());
  const files = entries.filter(e => e.isFile());

  // Create subdirectories
  for (const dir of dirs) {
    const dirPath = path.join(localDir, dir.name);
    console.log(`${indent}📁 Creating folder: ${dir.name}`);

    const folderId = await createDriveFolder(drive, dir.name, parentFolderId);
    const subResult = await uploadDirectory(drive, dirPath, folderId, indent + '  ');
    totalUploaded += subResult.totalUploaded;
    totalSize += subResult.totalSize;
  }

  // Upload files
  for (const file of files) {
    const filePath = path.join(localDir, file.name);
    const fileSize = fs.statSync(filePath).size;

    try {
      console.log(`${indent}📄 Uploading: ${file.name} (${formatBytes(fileSize)})`);
      await uploadFile(drive, filePath, parentFolderId);
      totalUploaded++;
      totalSize += fileSize;
    } catch (err) {
      console.error(`${indent}❌ Failed to upload ${file.name}: ${err.message}`);
    }
  }

  return { totalUploaded, totalSize };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       ProEdge Build → Google Drive Uploader         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Verify exports directory exists
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error('Error: exports/ directory not found.');
    console.error('Run the scraper first: node scraper.js');
    process.exit(1);
  }

  // Count files to upload
  function countFiles(dir) {
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
      else count++;
    }
    return count;
  }

  const fileCount = countFiles(EXPORT_DIR);
  console.log(`Found ${fileCount} files to upload from exports/`);
  console.log('');

  // Authenticate
  const auth = await authorize();
  const drive = google.drive({ version: 'v3', auth });

  // Create root export folder
  const timestamp = new Date().toISOString().substring(0, 10);
  const rootFolderName = `ProEdge_Build_Export_${timestamp}`;

  console.log(`Creating root folder: ${rootFolderName}`);
  const rootFolderId = await createDriveFolder(drive, rootFolderName, targetFolderId);
  console.log(`Root folder ID: ${rootFolderId}`);
  console.log('');

  // Upload everything
  const startTime = Date.now();
  const result = await uploadDirectory(drive, EXPORT_DIR, rootFolderId);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                UPLOAD COMPLETE                       ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Files uploaded: ${String(result.totalUploaded).padEnd(36)}║`);
  console.log(`║  Total size:     ${String(formatBytes(result.totalSize)).padEnd(36)}║`);
  console.log(`║  Duration:       ${String(duration + 's').padEnd(36)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');

  if (targetFolderId) {
    console.log(`║  Folder: https://drive.google.com/drive/folders/${targetFolderId}`);
  }
  console.log(`║  Export: ${rootFolderName.padEnd(44)}║`);

  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
