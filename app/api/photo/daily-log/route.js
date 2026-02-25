import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

export const runtime = 'nodejs';

// POST /api/photo/daily-log - Accept photos, generate daily log narrative
export async function POST(request) {
  try {
    const formData = await request.formData();
    const photos = formData.getAll('photos');
    const jobId = formData.get('jobId');
    const jobName = formData.get('jobName');
    const apiKey = formData.get('apiKey');

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!photos || photos.length === 0) {
      return Response.json({ error: 'At least one photo is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    // Step 1: Analyze each photo with Claude Vision
    const photoAnalyses = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const arrayBuffer = await photo.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Detect media type
      let mediaType = 'image/jpeg';
      const name = photo.name?.toLowerCase() || '';
      if (name.endsWith('.png')) mediaType = 'image/png';
      else if (name.endsWith('.webp')) mediaType = 'image/webp';
      else if (name.endsWith('.gif')) mediaType = 'image/gif';

      const analysis = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
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
                text: `You are analyzing a construction site photo for a daily log. Describe what you see in 2-3 sentences. Focus on:
- Work being performed (framing, plumbing, electrical, finishing, etc.)
- Progress indicators (completion stage, materials delivered, equipment on site)
- Weather/site conditions visible
- Number of workers visible
- Any safety observations

Be specific and factual. This is photo ${i + 1} of ${photos.length}.`,
              },
            ],
          },
        ],
      });

      const analysisText = analysis.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');

      photoAnalyses.push({
        index: i + 1,
        filename: photo.name || `photo_${i + 1}`,
        analysis: analysisText,
      });
    }

    // Step 2: Generate cohesive daily log narrative from all analyses
    const combinedAnalysis = photoAnalyses
      .map((p) => `Photo ${p.index} (${p.filename}): ${p.analysis}`)
      .join('\n\n');

    const narrativeResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a construction superintendent writing a professional daily log entry based on site photos.

## PROJECT
Job: ${jobName || 'Construction Project'}
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Photos analyzed: ${photos.length}

## PHOTO ANALYSES
${combinedAnalysis}

## INSTRUCTIONS
Write a cohesive daily log narrative that:
1. Summarizes all work observed across the photos
2. Notes the stage of construction and progress made
3. Mentions weather/site conditions if visible
4. Notes crew activity and any safety observations
5. Uses professional construction language
6. Is 3-5 paragraphs long

Also extract:
- A brief weather description (or "Not visible" if not determinable)
- Estimated crew count on site

Return your response in this JSON format (no markdown, no code fences):
{
  "narrative": "The full daily log narrative text...",
  "weather": "Weather description",
  "crew_count": 0,
  "work_categories": ["framing", "electrical", etc.]
}`,
        },
      ],
    });

    const narrativeText = narrativeResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed;
    try {
      const jsonMatch = narrativeText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    const narrative = parsed?.narrative || narrativeText;
    const weather = parsed?.weather || 'Not specified';
    const crewCount = parsed?.crew_count || null;

    // Step 3: Save to database
    const sql = getSQL();

    try {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id TEXT,
          job_name TEXT,
          narrative TEXT,
          weather TEXT,
          crew_count INT,
          photos JSONB DEFAULT '[]',
          source TEXT DEFAULT 'photo',
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    } catch { /* table may exist */ }

    const logRows = await sql`
      INSERT INTO daily_logs (job_id, job_name, narrative, weather, crew_count, photos, source)
      VALUES (
        ${jobId || null},
        ${jobName || null},
        ${narrative},
        ${weather},
        ${crewCount},
        ${JSON.stringify(photoAnalyses)},
        'photo'
      )
      RETURNING *
    `;

    return Response.json({
      dailyLog: {
        ...logRows[0],
        narrative,
        weather,
        photos_analyzed: photoAnalyses.length,
      },
      usage: narrativeResponse.usage,
    });
  } catch (error) {
    console.error('Photo daily log error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate daily log' }, { status: 500 });
  }
}
