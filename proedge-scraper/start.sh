#!/bin/bash

# ═══════════════════════════════════════════════════════
#  ProEdge Build Data Exporter - Quick Start
#  Better Boss Construction Tools
# ═══════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       ProEdge Build Data Exporter - Setup            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Check Node.js ────────────────────────────────────────────────────────

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Install it from: https://nodejs.org (v18+ required)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18+ required. You have $(node -v)"
    echo "   Update from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# ─── Install dependencies ────────────────────────────────────────────────

echo ""
echo "Installing dependencies..."
npm install --silent

echo "Installing Playwright Chromium..."
npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium

echo "✅ Dependencies installed"

# ─── Check Chrome remote debugging ────────────────────────────────────────

echo ""
echo "Checking for Chrome remote debugging on port 9222..."

if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
    echo "✅ Chrome remote debugging is active"

    # Check for ProEdge Build tab
    TABS=$(curl -s http://localhost:9222/json)
    if echo "$TABS" | grep -q "proedgebuild"; then
        echo "✅ ProEdge Build tab detected"
    else
        echo "⚠️  No ProEdge Build tab found."
        echo "   Please open https://www.proedgebuild.com/main.cfm in Chrome and log in."
        echo ""
        read -p "Press Enter when you're logged in..."
    fi
else
    echo "❌ Chrome remote debugging is not running."
    echo ""
    echo "Please do the following:"
    echo ""
    echo "  1. CLOSE all Chrome windows completely"
    echo "  2. Relaunch Chrome with remote debugging:"
    echo ""

    case "$(uname -s)" in
        Darwin)
            echo '     /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222'
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo '     "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222'
            ;;
        *)
            echo '     google-chrome --remote-debugging-port=9222'
            ;;
    esac

    echo ""
    echo "  3. Log into ProEdge Build at https://www.proedgebuild.com/main.cfm"
    echo ""
    read -p "Press Enter when Chrome is running with remote debugging and you're logged in..."

    # Re-check
    if ! curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
        echo "❌ Still can't connect to Chrome on port 9222. Exiting."
        exit 1
    fi
    echo "✅ Chrome remote debugging is now active"
fi

# ─── Run scraper ──────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Starting ProEdge Build export..."
echo "═══════════════════════════════════════════════════════"
echo ""

node scraper.js

# ─── Post-scrape options ──────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Export complete! Files are in: ./exports/"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if Google Drive credentials exist
if [ -f "credentials.json" ]; then
    echo "Google Drive credentials found."
    read -p "Upload to Google Drive? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -n "$1" ]; then
            node gdrive-upload.js --folder-id "$1"
        else
            echo "Enter Google Drive folder ID (or press Enter for Drive root):"
            read -r FOLDER_ID
            if [ -n "$FOLDER_ID" ]; then
                node gdrive-upload.js --folder-id "$FOLDER_ID"
            else
                node gdrive-upload.js
            fi
        fi
    fi
else
    echo "To upload to Google Drive, set up credentials.json"
    echo "See: node gdrive-upload.js --help"
    echo ""
    echo "Or just drag the exports/ folder into Google Drive manually."
fi

echo ""
echo "Done! 🎉"
