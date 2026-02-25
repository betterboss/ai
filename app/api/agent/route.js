import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, executeTool } from '../../lib/agent-tools';
import { getSQL } from '../../lib/db';

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
- Be efficient — contractors are busy`;

// POST /api/agent - Conversational AI agent with JobTread tool use
export async function POST(request) {
  try {
    const { messages, apiKey, grantKey, conversationId, userId } = await request.json();

    if (!apiKey) return Response.json({ error: 'API key required' }, { status: 400 });
    if (!grantKey) return Response.json({ error: 'JobTread grant key required' }, { status: 400 });

    const client = new Anthropic({ apiKey });
    const sql = getSQL();

    // Save conversation if userId provided
    let convId = conversationId;
    if (userId && !convId) {
      const rows = await sql`
        INSERT INTO conversations (user_id, channel, title)
        VALUES (${userId}, 'web', ${messages[messages.length - 1]?.content?.slice(0, 100) || 'New Chat'})
        RETURNING id
      `;
      convId = rows[0]?.id;
    }

    // Save user message
    if (userId && convId) {
      const lastMsg = messages[messages.length - 1];
      await sql`
        INSERT INTO messages (conversation_id, role, content)
        VALUES (${convId}, ${lastMsg.role}, ${typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content)})
      `;
    }

    // Run the agent loop (tool use can require multiple rounds)
    let currentMessages = [...messages];
    let finalResponse = null;
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

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const textBlocks = response.content.filter(b => b.type === 'text');

      if (toolUseBlocks.length === 0) {
        // No more tool calls — we have our final response
        finalResponse = {
          content: textBlocks.map(b => b.text).join(''),
          toolCalls: allToolCalls,
          usage: response.usage,
          conversationId: convId,
        };
        break;
      }

      // Execute tool calls
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

      // Add assistant response and tool results to messages for next iteration
      currentMessages.push({ role: 'assistant', content: response.content });
      currentMessages.push({ role: 'user', content: toolResults });
    }

    if (!finalResponse) {
      finalResponse = {
        content: 'I ran into an issue processing that request. Could you try rephrasing?',
        toolCalls: allToolCalls,
        conversationId: convId,
      };
    }

    // Save assistant response
    if (userId && convId) {
      await sql`
        INSERT INTO messages (conversation_id, role, content, tool_calls)
        VALUES (${convId}, 'assistant', ${finalResponse.content},
                ${allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null})
      `;
    }

    return Response.json(finalResponse);
  } catch (error) {
    console.error('Agent error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}
