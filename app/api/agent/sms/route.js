import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, executeTool } from '../../../lib/agent-tools';
import { getSQL } from '../../../lib/db';
import { sendSMS } from '../../../lib/sms';

export const runtime = 'nodejs';

const AGENT_SYSTEM_PROMPT = `You are the Better Boss AI Agent — a hands-on assistant for construction contractors using JobTread.

You have tools to interact directly with the user's JobTread account. You can search jobs, create contacts, add comments, check the pipeline, and more.

## How to work:
1. When a user asks you to DO something (create a job, add a comment, etc.), use your tools to execute it
2. When a user asks a QUESTION (what's my pipeline look like?), use tools to fetch data, then summarize clearly
3. Always confirm what you did after executing an action
4. Use contractor-friendly language — you know the trade

## Key behaviors:
- For ambiguous requests, ask for clarification before acting
- After creating/updating anything, report back with the result (job number, name, etc.)
- When showing lists of jobs or contacts, format them clearly
- For pipeline questions, break down by stage
- Keep responses concise and actionable

## Tone:
- Direct and practical — like a trusted project manager
- Use construction terms naturally (GC, sub, CO, punch list, etc.)
- Be efficient — contractors are busy

## Context:
- You are responding via SMS. Keep responses SHORT (under 1500 characters when possible).
- No markdown formatting — plain text only.
- Use line breaks for lists, not bullet symbols.
- Get to the point fast.`;

// POST /api/agent/sms — Twilio inbound SMS webhook handler
export async function POST(request) {
  try {
    // ------------------------------------------------------------------
    // 1. Parse Twilio form data
    // ------------------------------------------------------------------
    const formData = await request.formData();
    const from = formData.get('From');   // Sender's phone number (E.164)
    const to = formData.get('To');       // Your Twilio number
    const body = formData.get('Body');   // Message text

    if (!from || !body || !body.trim()) {
      return twimlResponse('');
    }

    const sql = getSQL();

    // ------------------------------------------------------------------
    // 2. Look up user by phone number
    //    Check company_phone field on users table (normalized to E.164)
    // ------------------------------------------------------------------
    const normalizedFrom = normalizePhone(from);

    const userRows = await sql`
      SELECT id, anthropic_api_key, jobtread_grant_key, company_phone, name
      FROM users
      WHERE replace(replace(replace(replace(company_phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ${'%' + normalizedFrom.slice(-10)}
      LIMIT 1
    `;

    if (!userRows.length) {
      // No user found — send a polite message and return
      await sendSMS({
        to: from,
        body: 'Better Boss: We could not find an account linked to this phone number. Sign up at betterboss.ai to get started.',
      });
      return twimlResponse('');
    }

    const user = userRows[0];
    const anthropicApiKey = user.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    const grantKey = user.jobtread_grant_key;

    if (!anthropicApiKey || !grantKey) {
      await sendSMS({
        to: from,
        body: 'Better Boss: Your account is not fully set up yet. Please add your API key and JobTread grant key in settings.',
      });
      return twimlResponse('');
    }

    // ------------------------------------------------------------------
    // 3. Create / retrieve conversation in DB
    // ------------------------------------------------------------------
    const existingConv = await sql`
      SELECT id FROM conversations
      WHERE user_id = ${user.id}
        AND channel = 'sms'
        AND title = ${`sms-${normalizedFrom}`}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let convId;
    if (existingConv.length) {
      convId = existingConv[0].id;
    } else {
      const newConv = await sql`
        INSERT INTO conversations (user_id, channel, title)
        VALUES (${user.id}, 'sms', ${`sms-${normalizedFrom}`})
        RETURNING id
      `;
      convId = newConv[0].id;
    }

    // Save inbound SMS message
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${body.trim()})
    `;

    // ------------------------------------------------------------------
    // 4. Load recent conversation history for context
    // ------------------------------------------------------------------
    const historyRows = await sql`
      SELECT role, content FROM messages
      WHERE conversation_id = ${convId}
      ORDER BY created_at ASC
    `;

    const anthropicMessages = historyRows.map(row => ({
      role: row.role === 'user' ? 'user' : 'assistant',
      content: row.content,
    }));

    // Collapse consecutive same-role messages
    const cleanedMessages = [];
    for (const msg of anthropicMessages) {
      if (cleanedMessages.length > 0 && cleanedMessages[cleanedMessages.length - 1].role === msg.role) {
        cleanedMessages[cleanedMessages.length - 1].content += '\n' + msg.content;
      } else {
        cleanedMessages.push({ ...msg });
      }
    }

    // Keep last 10 messages — SMS context windows should be smaller
    const recentMessages = cleanedMessages.slice(-10);

    // ------------------------------------------------------------------
    // 5. Run the Anthropic agent loop (tool_use pattern)
    // ------------------------------------------------------------------
    const client = new Anthropic({ apiKey: anthropicApiKey });
    let currentMessages = [...recentMessages];
    let finalText = null;
    let allToolCalls = [];
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: AGENT_SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: currentMessages,
      });

      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const textBlocks = response.content.filter(b => b.type === 'text');

      if (toolUseBlocks.length === 0) {
        finalText = textBlocks.map(b => b.text).join('');
        break;
      }

      // Execute each tool call
      const toolResults = [];
      for (const toolCall of toolUseBlocks) {
        try {
          const result = await executeTool(grantKey, toolCall.name, toolCall.input);
          allToolCalls.push({
            name: toolCall.name,
            input: toolCall.input,
            result,
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true,
          });
        }
      }

      currentMessages.push({ role: 'assistant', content: response.content });
      currentMessages.push({ role: 'user', content: toolResults });
    }

    if (!finalText) {
      finalText = 'Had trouble processing that. Try rephrasing?';
    }

    // Truncate if too long for SMS (Twilio limit is 1600 chars per segment)
    if (finalText.length > 1500) {
      finalText = finalText.slice(0, 1497) + '...';
    }

    // ------------------------------------------------------------------
    // 6. Save assistant response to DB
    // ------------------------------------------------------------------
    await sql`
      INSERT INTO messages (conversation_id, role, content, tool_calls)
      VALUES (${convId}, 'assistant', ${finalText},
              ${allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null})
    `;

    // ------------------------------------------------------------------
    // 7. Reply via Twilio REST API
    // ------------------------------------------------------------------
    await sendSMS({ to: from, body: finalText });

    // ------------------------------------------------------------------
    // 8. Return empty TwiML to acknowledge receipt
    //    (We already sent the reply via REST API above, so the TwiML
    //     response body is empty to avoid sending a duplicate.)
    // ------------------------------------------------------------------
    return twimlResponse('');
  } catch (error) {
    console.error('SMS agent error:', error);
    return twimlResponse('');
  }
}

// Return a properly formatted TwiML XML response
function twimlResponse(messageBody) {
  const twiml = messageBody
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(messageBody)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Escape XML special characters
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Normalize phone number to digits only (for comparison)
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  if (digits.length === 10) return '1' + digits;
  return digits;
}
