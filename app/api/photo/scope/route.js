import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// POST /api/photo/scope - Accept photos, generate scope of work with line items
export async function POST(request) {
  try {
    const formData = await request.formData();
    const photos = formData.getAll('photos');
    const projectType = formData.get('projectType') || 'General Construction';
    const apiKey = formData.get('apiKey');

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!photos || photos.length === 0) {
      return Response.json({ error: 'At least one photo is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // Step 1: Analyze each photo for existing conditions
    const photoAnalyses = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const arrayBuffer = await photo.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      let mediaType = 'image/jpeg';
      const name = photo.name?.toLowerCase() || '';
      if (name.endsWith('.png')) mediaType = 'image/png';
      else if (name.endsWith('.webp')) mediaType = 'image/webp';
      else if (name.endsWith('.gif')) mediaType = 'image/gif';

      const analysis = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `You are a construction estimator analyzing existing conditions for a ${projectType} project. Examine this photo and describe:

1. Current condition of surfaces, structures, and materials visible
2. Approximate dimensions or scale (use context clues)
3. Work that appears to be needed (repairs, replacements, new construction)
4. Materials visible and their condition
5. Any access issues, obstacles, or special considerations

Be specific and detailed. This is photo ${i + 1} of ${photos.length}. Focus on generating actionable scope items.`,
              },
            ],
          },
        ],
      });

      photoAnalyses.push(
        analysis.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('')
      );
    }

    // Step 2: Generate scope of work with line items
    const combinedAnalysis = photoAnalyses
      .map((a, i) => `Photo ${i + 1}: ${a}`)
      .join('\n\n');

    const scopeResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert construction estimator generating a scope of work from site photos.

## PROJECT TYPE
${projectType}

## SITE CONDITION ANALYSIS
${combinedAnalysis}

## INSTRUCTIONS
Based on the photo analysis, generate:

1. A detailed scope of work narrative (3-5 paragraphs) describing all work to be performed
2. Individual line items broken down by category

Return your response in this EXACT JSON format (no markdown, no code fences):
{
  "scope_text": "Detailed scope of work narrative describing all work to be performed...",
  "items": [
    {
      "category": "Category name (e.g., Demolition, Framing, Electrical, Plumbing, Finishing, etc.)",
      "description": "Specific work item description",
      "quantity": 1,
      "unit": "sqft|lf|each|hour|day|ls"
    }
  ]
}

Guidelines:
- Use standard construction categories: Demolition, Site Prep, Framing, Roofing, Electrical, Plumbing, HVAC, Drywall, Painting, Flooring, Trim/Finish, Cleanup, etc.
- Include quantities with realistic estimates based on what you can see
- Use standard construction units (sqft, lf, sy, each, hour, day, ls)
- Be thorough - include prep work, cleanup, and support items
- Order items by typical construction sequence
- Generate at least 8-15 line items for a typical project`,
        },
      ],
    });

    const responseText = scopeResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return Response.json({
        scope_text: responseText,
        items: [],
        usage: scopeResponse.usage,
      });
    }

    return Response.json({
      scope_text: parsed.scope_text || '',
      items: parsed.items || [],
      usage: scopeResponse.usage,
    });
  } catch (error) {
    console.error('Photo scope error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate scope' }, { status: 500 });
  }
}
