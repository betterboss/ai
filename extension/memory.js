// Persistent memory system using chrome.storage.local

const STORAGE_KEYS = {
  CONVERSATIONS: 'bb_conversations',
  NOTES: 'bb_notes',
  SETTINGS: 'bb_settings',
  CONTEXT: 'bb_context',
};

const MAX_CONVERSATION_MESSAGES = 100;
const MAX_NOTES = 200;

export class Memory {
  // ── Conversations ─────────────────────────────────────────

  static async getConversations() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
    return data[STORAGE_KEYS.CONVERSATIONS] || [];
  }

  static async saveMessage(role, content, sources = [], skillResults = []) {
    const messages = await this.getConversations();
    messages.push({
      role,
      content,
      sources,
      skillResults,
      timestamp: Date.now(),
    });

    // Trim to max
    while (messages.length > MAX_CONVERSATION_MESSAGES) {
      messages.shift();
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: messages });
    return messages;
  }

  static async clearConversations() {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: [] });
  }

  // Build API-compatible message array (only role + content)
  static async getApiMessages() {
    const messages = await this.getConversations();
    return messages.map(m => ({ role: m.role, content: m.content }));
  }

  // ── Notes / Memory Store ──────────────────────────────────

  static async getNotes() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.NOTES);
    return data[STORAGE_KEYS.NOTES] || {};
  }

  static async saveNote(key, value) {
    const notes = await this.getNotes();
    notes[key] = { value, updatedAt: Date.now() };

    // Trim oldest if over limit
    const keys = Object.keys(notes);
    if (keys.length > MAX_NOTES) {
      const sorted = keys.sort((a, b) => notes[a].updatedAt - notes[b].updatedAt);
      delete notes[sorted[0]];
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
    return notes;
  }

  static async deleteNote(key) {
    const notes = await this.getNotes();
    delete notes[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
    return notes;
  }

  static async clearNotes() {
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: {} });
  }

  // Build memory context string for Claude
  static async getMemoryContext() {
    const notes = await this.getNotes();
    const entries = Object.entries(notes);
    if (entries.length === 0) return '';

    return entries
      .map(([key, val]) => `- ${key}: ${val.value}`)
      .join('\n');
  }

  // ── Settings ──────────────────────────────────────────────

  static async getSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return data[STORAGE_KEYS.SETTINGS] || {
      claudeApiKey: '',
      jobtreadToken: '',
      autoSearch: true,
      theme: 'dark',
    };
  }

  static async saveSettings(settings) {
    const current = await this.getSettings();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  }

  // ── Page Context ──────────────────────────────────────────

  static async setPageContext(context) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONTEXT]: context });
  }

  static async getPageContext() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CONTEXT);
    return data[STORAGE_KEYS.CONTEXT] || 'Not on a JobTread page';
  }

  // ── Export All Data ───────────────────────────────────────

  static async exportAll() {
    const [conversations, notes, settings] = await Promise.all([
      this.getConversations(),
      this.getNotes(),
      this.getSettings(),
    ]);
    return { conversations, notes, settings, exportedAt: new Date().toISOString() };
  }
}
