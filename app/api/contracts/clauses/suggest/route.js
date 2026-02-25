import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// POST /api/contracts/clauses/suggest - AI-powered clause suggestions
export async function POST(request) {
  try {
    const { apiKey, projectType, concerns } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!projectType) {
      return Response.json({ error: 'Project type is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const concernsList = (concerns || []).length > 0
      ? `\n\nSpecific concerns to address:\n${concerns.map(c => `- ${c}`).join('\n')}`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a construction contract expert. Generate relevant contract clauses for a ${projectType} project.${concernsList}

Return a JSON array of clause suggestions. Each clause should have:
- "title": Short descriptive title
- "category": One of: delays, materials, payments, permits, changes, warranty, dispute
- "clauseText": The full legal clause text (professional but plain language)
- "whenToUse": Brief guidance on when this clause applies

Generate 5-8 relevant clauses. Focus on the most important protections for this project type.

Return ONLY the JSON array, no other text.`,
        },
      ],
    });

    const responseText = message.content[0].text.trim();

    // Parse the JSON from the response
    let suggestions;
    try {
      // Handle potential markdown code blocks
      const jsonStr = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
      suggestions = JSON.parse(jsonStr);
    } catch (parseErr) {
      return Response.json({
        error: 'Failed to parse AI response',
        raw: responseText,
      }, { status: 500 });
    }

    return Response.json({ suggestions });
  } catch (error) {
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
