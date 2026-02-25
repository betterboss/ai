import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, executeTool } from '../../../lib/agent-tools';
import { getSQL } from '../../../lib/db';

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
- You are responding via Slack. Keep formatting Slack-compatible (use *bold*, _italic_, and bullet points).
- Keep responses concise since this is a chat context.`;

// POST /api/agent/slack — Slack Events API webhook handler
export async function POST(request) {
  try {
    const body = await request.json();

    // ------------------------------------------------------------------
    // 1. Slack URL verification challenge
    // ------------------------------------------------------------------
    if (body.type === 'url_verification') {
      return Response.json({ challenge: body.challenge });
    }

    // ------------------------------------------------------------------
    // 2. Ignore non-event_callback payloads
    // ------------------------------------------------------------------
    if (body.type !== 'event_callback') {
      return Response.json({ ok: true });
    }

    const event = body.event;

    // Only handle message events (not subtypes like message_changed, bot_message, etc.)
    if (!event || event.type !== 'message' || event.subtype || event.bot_id) {
      return Response.json({ ok: true });
    }

    const slackTeamId = body.team_id;
    const channelId = event.channel;
    const userId = event.user;
    const messageText = event.text;

    if (!messageText || !messageText.trim()) {
      return Response.json({ ok: true });
    }

    const sql = getSQL();

    // ------------------------------------------------------------------
    // 3. Look up the integration to find the user, their keys, and bot token
    //    The integrations table stores Slack config as:
    //    { slack_bot_token, slack_team_id, ... }
    //    linked to a user who has anthropic_api_key and jobtread_grant_key.
    // ------------------------------------------------------------------
    const integrationRows = await sql`
      SELECT
        i.config,
        u.id AS user_id,
        u.anthropic_api_key,
        u.jobtread_grant_key
      FROM integrations i
      JOIN users u ON u.id = i.user_id
      WHERE i.platform = 'slack'
        AND i.is_active = true
        AND i.config->>'slack_team_id' = ${slackTeamId}
      LIMIT 1
    `;

    if (!integrationRows.length) {
      console.error('Slack webhook: no integration found for team', slackTeamId);
      return Response.json({ ok: true });
    }

    const integration = integrationRows[0];
    const slackBotToken = integration.config?.slack_bot_token || process.env.SLACK_BOT_TOKEN;
    const anthropicApiKey = integration.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    const grantKey = integration.jobtread_grant_key;

    if (!slackBotToken) {
      console.error('Slack webhook: no bot token available');
      return Response.json({ ok: true });
    }

    if (!anthropicApiKey || !grantKey) {
      await postSlackMessage(
        slackBotToken,
        channelId,
        'I\'m not fully configured yet — the account owner needs to add their API key and JobTread grant key in Better Boss settings.'
      );
      return Response.json({ ok: true });
    }

    // ------------------------------------------------------------------
    // 4. Create / retrieve conversation in DB
    // ------------------------------------------------------------------
    const existingConv = await sql`
      SELECT id FROM conversations
      WHERE user_id = ${integration.user_id}
        AND channel = 'slack'
        AND title = ${`slack-${channelId}`}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let convId;
    if (existingConv.length) {
      convId = existingConv[0].id;
    } else {
      const newConv = await sql`
        INSERT INTO conversations (user_id, channel, title)
        VALUES (${integration.user_id}, 'slack', ${`slack-${channelId}`})
        RETURNING id
      `;
      convId = newConv[0].id;
    }

    // Save inbound user message
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${convId}, 'user', ${messageText})
    `;

    // ------------------------------------------------------------------
    // 5. Load recent conversation history for context (last 20 messages)
    // ------------------------------------------------------------------
    const historyRows = await sql`
      SELECT role, content FROM messages
      WHERE conversation_id = ${convId}
      ORDER BY created_at ASC
    `;

    // Build Anthropic messages array from DB history
    const anthropicMessages = historyRows.map(row => ({
      role: row.role === 'user' ? 'user' : 'assistant',
      content: row.content,
    }));

    // Ensure messages alternate properly — collapse consecutive same-role
    const cleanedMessages = [];
    for (const msg of anthropicMessages) {
      if (cleanedMessages.length > 0 && cleanedMessages[cleanedMessages.length - 1].role === msg.role) {
        cleanedMessages[cleanedMessages.length - 1].content += '\n' + msg.content;
      } else {
        cleanedMessages.push({ ...msg });
      }
    }

    // Keep the last 20 messages to stay within token limits
    const recentMessages = cleanedMessages.slice(-20);

    // ------------------------------------------------------------------
    // 6. Run the Anthropic agent loop (tool_use pattern)
    // ------------------------------------------------------------------
    const client = new Anthropic({ apiKey: anthropicApiKey });
    let currentMessages = [...recentMessages];
    let finalText = null;
    let allToolCalls = [];
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
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
      finalText = 'I ran into an issue processing that request. Could you try rephrasing?';
    }

    // ------------------------------------------------------------------
    // 7. Save assistant response to DB
    // ------------------------------------------------------------------
    await sql`
      INSERT INTO messages (conversation_id, role, content, tool_calls)
      VALUES (${convId}, 'assistant', ${finalText},
              ${allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null})
    `;

    // ------------------------------------------------------------------
    // 8. Post reply back to Slack channel
    // ------------------------------------------------------------------
    await postSlackMessage(slackBotToken, channelId, finalText);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Slack agent error:', error);
    return Response.json({ ok: true });
  }
}

// Helper: post a message to a Slack channel via chat.postMessage
async function postSlackMessage(token, channel, text) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error('Slack chat.postMessage error:', data.error);
  }
  return data;
}
