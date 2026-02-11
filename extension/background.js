// Background service worker — orchestrates everything
import { JobTreadAPI } from './jobtread-api.js';
import { ClaudeAPI } from './claude-api.js';
import { Memory } from './memory.js';
import { Skills } from './skills.js';
import { FileUtils } from './file-utils.js';

let currentPageContext = 'Not on a JobTread page';

// ── Message Router ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  return true; // async
});

async function handleMessage(message) {
  switch (message.action) {
    // ── Chat ──────────────────────────────────────────────
    case 'CHAT':
      return handleChat(message.text);

    // ── Skills ────────────────────────────────────────────
    case 'EXECUTE_SKILL':
      return executeSkill(message.skill, message.param);

    // ── Memory ────────────────────────────────────────────
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

    // ── Settings ──────────────────────────────────────────
    case 'GET_SETTINGS':
      return { settings: await Memory.getSettings() };

    case 'SAVE_SETTINGS':
      return { settings: await Memory.saveSettings(message.settings) };

    // ── Page Context ──────────────────────────────────────
    case 'PAGE_CONTEXT_UPDATE':
      currentPageContext = formatPageContext(message.context);
      await Memory.setPageContext(currentPageContext);
      return { success: true };

    case 'GET_PAGE_CONTEXT':
      return { context: currentPageContext };

    // ── File Operations ───────────────────────────────────
    case 'DOWNLOAD_CSV':
      return FileUtils.downloadCSV(message.result);

    case 'DOWNLOAD_REPORT':
      return FileUtils.downloadReport(message.result);

    // ── Export ─────────────────────────────────────────────
    case 'EXPORT_ALL':
      return Memory.exportAll();

    default:
      return { error: `Unknown action: ${message.action}` };
  }
}

// ── Chat Handler ────────────────────────────────────────────

async function handleChat(text) {
  const settings = await Memory.getSettings();

  if (!settings.claudeApiKey) {
    return { error: 'Please set your Claude API key in Settings.' };
  }

  // Save user message
  await Memory.saveMessage('user', text);

  // Build context
  const memoryContext = await Memory.getMemoryContext();
  const pageContext = await Memory.getPageContext();
  const apiMessages = await Memory.getApiMessages();

  // Call Claude
  const claude = new ClaudeAPI(settings.claudeApiKey);
  const response = await claude.chat(apiMessages, memoryContext, pageContext);

  // Execute any skill triggers
  const skillResults = [];
  if (response.skillTriggers.length > 0 && settings.jobtreadToken) {
    const jt = new JobTreadAPI(settings.jobtreadToken);
    const skills = new Skills(jt);

    for (const trigger of response.skillTriggers) {
      const result = await skills.execute(trigger.skill, trigger.param);

      // Handle special cases
      if (result.type === 'memory_save') {
        await Memory.saveNote(result.key, result.value);
        result.success = true;
      }

      if (result.exportAs === 'csv') {
        const dlResult = FileUtils.downloadCSV(result);
        result.downloadInfo = dlResult;
      }

      skillResults.push(result);
    }
  }

  // Save assistant message
  await Memory.saveMessage('assistant', response.text, response.sources, skillResults);

  return {
    text: response.text,
    sources: response.sources,
    skillResults,
    usage: response.usage,
  };
}

// ── Skill Execution ─────────────────────────────────────────

async function executeSkill(skill, param) {
  const settings = await Memory.getSettings();

  if (skill === 'BOOK_CALL') {
    return {
      type: 'booking',
      url: 'https://cal.com/mybetterboss.ai/jobtread-free-growth-audit-call',
    };
  }

  if (!settings.jobtreadToken) {
    return { error: 'Please set your JobTread API token in Settings.' };
  }

  const jt = new JobTreadAPI(settings.jobtreadToken);
  const skills = new Skills(jt);
  const result = await skills.execute(skill, param);

  if (result.exportAs === 'csv') {
    FileUtils.downloadCSV(result);
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────

function formatPageContext(context) {
  if (!context || context.type === 'unknown') return 'Not on a recognizable JobTread page';

  let str = `Page type: ${context.type}\nURL: ${context.url}`;
  if (context.data?.title) str += `\nTitle: ${context.data.title}`;
  if (context.data?.jobId) str += `\nJob ID: ${context.data.jobId}`;
  if (context.data?.contactId) str += `\nContact ID: ${context.data.contactId}`;
  if (context.data?.pageContent) str += `\n\nPage Data:\n${context.data.pageContent}`;
  return str;
}

// ── Keep page context fresh ─────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeInfo.tabId },
      func: () => window.location.href,
    });
    if (result?.result?.includes('app.jobtread.com')) {
      chrome.tabs.sendMessage(activeInfo.tabId, { action: 'GET_PAGE_CONTEXT' }, (ctx) => {
        if (ctx) {
          currentPageContext = formatPageContext(ctx);
          Memory.setPageContext(currentPageContext);
        }
      });
    }
  } catch (e) {
    // Tab might not be accessible
  }
});
