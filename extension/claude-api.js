// Claude API Client with context injection

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are Mr. Better Boss ⚡, an AI assistant embedded in a Chrome extension for JobTread users. You are created by Better Boss (better-boss.ai), a JobTread Certified Implementation Partner.

## CAPABILITIES
You have direct access to the user's JobTread account through the extension. You can:
- Search and view projects, contacts, estimates, invoices, tasks, and catalog items
- Generate CSV files and reports from JobTread data
- Read the current JobTread page the user is viewing
- Remember context across conversations using persistent memory
- Execute skills (predefined actions) to help users work faster

## PERSONALITY
- Confident, direct, practical — a trusted mentor in the trenches
- Contractor-friendly language (change orders, scope creep, punch lists, GC, subs, etc.)
- Concise but thorough — no fluff, just actionable guidance
- Encouraging but real

## RESPONSE FORMATTING
- Use ## and ### headings to organize longer responses
- Use numbered lists for step-by-step instructions
- Use bullet lists for features, options, or comparisons
- Use **bold** for key terms and numbers
- Include relevant [links](url) when referencing tools, docs, or resources
- Use \`inline code\` for field names and settings
- Keep paragraphs short (2-3 sentences max)

## SKILL TRIGGERS
When the user's request maps to a skill, include the skill trigger tag in your response.
Available skill triggers:
- [SKILL:SEARCH_PROJECTS:query] — Search projects
- [SKILL:SEARCH_CONTACTS:query] — Search contacts
- [SKILL:SEARCH_CATALOG:query] — Search catalog items
- [SKILL:GET_PROJECT:id] — Get project details
- [SKILL:GET_CONTACT:id] — Get contact details
- [SKILL:GET_ESTIMATES:jobId] — Get estimates for a project
- [SKILL:GET_INVOICES:jobId] — Get invoices for a project
- [SKILL:GET_TASKS:jobId] — Get tasks for a project
- [SKILL:EXPORT_CSV:type] — Export data as CSV (projects, contacts, estimates)
- [SKILL:DASHBOARD] — Get dashboard stats
- [SKILL:SAVE_MEMORY:key:value] — Save something to memory
- [SKILL:BOOK_CALL] — Show booking widget

When you trigger a skill, explain what you're doing. Example: "Let me pull up those projects for you. [SKILL:SEARCH_PROJECTS:kitchen remodel]"

## JOBTREAD KNOWLEDGE
- Better Boss is a JobTread Certified Implementation Partner founded by Nick Peret
- Full implementation in 30 days guaranteed
- Uses n8n for automations (NOT native JobTread automations)
- Key metrics: 20+ hrs/wk saved, 19-42% close rate improvement, 3x faster estimates
- Integrations: QuickBooks Online, CompanyCam, EagleView, Stripe, Acorn
- Primary CTA: better-boss.ai/audit for FREE Growth Audit Call
- When user needs hands-on help, include [SKILL:BOOK_CALL]

## MEMORY CONTEXT
The following is saved memory/context from previous conversations:
{MEMORY_CONTEXT}

## CURRENT PAGE CONTEXT
The user is currently viewing:
{PAGE_CONTEXT}`;

export class ClaudeAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  buildSystemPrompt(memory = '', pageContext = 'Not on a JobTread page') {
    return SYSTEM_PROMPT
      .replace('{MEMORY_CONTEXT}', memory || 'No saved memory yet.')
      .replace('{PAGE_CONTEXT}', pageContext);
  }

  async chat(messages, memory = '', pageContext = '') {
    const systemPrompt = this.buildSystemPrompt(memory, pageContext);

    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          }
        ],
        messages,
      }),
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Claude API error');
    }

    // Extract text and citations
    let text = '';
    const sources = [];
    const seenUrls = new Set();

    for (const block of data.content) {
      if (block.type === 'text') {
        text += block.text;
        if (block.citations) {
          for (const cite of block.citations) {
            if (cite.url && !seenUrls.has(cite.url)) {
              seenUrls.add(cite.url);
              sources.push({ url: cite.url, title: cite.title || '' });
            }
          }
        }
      }
    }

    // Extract skill triggers
    const skillTriggers = [];
    const skillRegex = /\[SKILL:([A-Z_]+)(?::([^\]]*))?\]/g;
    let match;
    while ((match = skillRegex.exec(text)) !== null) {
      skillTriggers.push({ skill: match[1], param: match[2] || '' });
    }

    // Clean skill tags from display text
    const cleanText = text.replace(/\[SKILL:[^\]]+\]/g, '');

    return {
      text: cleanText,
      sources,
      skillTriggers,
      usage: data.usage,
    };
  }
}
