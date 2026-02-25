import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';
import { pdfToImages, imageToBase64Content } from '../../../lib/pdf';

const TAKEOFF_PROMPT = `You are an expert construction takeoff specialist. Analyze this blueprint/plan page and extract ALL measurable quantities.

Extract the following categories:

1. ROOMS: Each room with dimensions (L x W), area in sqft, ceiling height if shown
2. LINEAR MEASUREMENTS: Walls, trim, baseboards, countertops, railings (in linear feet)
3. AREA MEASUREMENTS: Flooring, paint, tile, roofing, siding (in sqft)
4. COUNTS: Doors, windows, outlets, switches, fixtures, appliances, cabinets
5. PLUMBING: Fixtures (sinks, toilets, showers), pipe runs, drains
6. ELECTRICAL: Panels, circuits, outlets, switches, light fixtures, fans
7. STRUCTURAL: Beams, columns, footings with dimensions

Look for:
- Scale indicators to calculate real-world measurements
- Dimension lines and callouts
- Material specifications noted on the drawings
- Room labels and annotations
- Any notes or legends

Return as JSON (no markdown, just pure JSON):
{
  "page_description": "Brief description of what this page shows",
  "scale": "Scale if identifiable (e.g., 1/4 inch = 1 foot) or null",
  "rooms": [
    { "name": "Kitchen", "length_ft": 15, "width_ft": 12, "area_sqft": 180, "ceiling_height_ft": 9 }
  ],
  "items": [
    { "category": "Flooring", "description": "Kitchen tile floor", "quantity": 180, "unit": "sqft", "notes": "Porcelain tile specified" },
    { "category": "Electrical", "description": "Duplex outlets", "quantity": 8, "unit": "each", "notes": "Per kitchen layout" }
  ]
}

Be thorough — count every element. If you can calculate an area or length from dimensions shown, do it. If a quantity is unclear, provide your best estimate with a note. Always prefer being comprehensive over concise.`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const apiKey = formData.get('apiKey');
    const estimateId = formData.get('estimateId');

    if (!file) {
      return Response.json({ error: 'PDF file is required' }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    const sql = getSQL();
    const buffer = await file.arrayBuffer();

    // Create takeoff record
    const takeoffRows = await sql`
      INSERT INTO takeoffs (estimate_id, file_name, status)
      VALUES (${estimateId || null}, ${file.name}, 'analyzing')
      RETURNING *
    `;
    const takeoff = takeoffRows[0];

    // Convert PDF to images
    let pdfResult;
    try {
      pdfResult = await pdfToImages(buffer);
    } catch (pdfError) {
      await sql`
        UPDATE takeoffs SET status = 'error', raw_analysis = ${JSON.stringify({ error: 'PDF conversion failed: ' + pdfError.message })}
        WHERE id = ${takeoff.id}
      `;
      return Response.json({ error: 'Failed to process PDF: ' + pdfError.message }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const allItems = [];
    const allRooms = [];
    const pageAnalyses = [];

    // Analyze each page with Claude Vision
    for (const image of pdfResult.images) {
      const content = [];
      const imageContent = imageToBase64Content(image);

      if (imageContent.type === 'image') {
        content.push(imageContent);
        content.push({ type: 'text', text: TAKEOFF_PROMPT });
      } else {
        content.push({
          type: 'text',
          text: imageContent.text + '\n\n' + TAKEOFF_PROMPT
        });
      }

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content }],
        });

        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('');

        let parsed;
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [], rooms: [] };
        } catch {
          parsed = { page_description: text, items: [], rooms: [] };
        }

        pageAnalyses.push(parsed);
        if (parsed.rooms) allRooms.push(...parsed.rooms);
        if (parsed.items) allItems.push(...parsed.items);
      } catch (aiError) {
        pageAnalyses.push({
          page_description: `Page ${image.pageNumber} analysis failed`,
          error: aiError.message,
          items: [],
          rooms: [],
        });
      }
    }

    // Deduplicate and aggregate items
    const aggregated = aggregateItems(allItems);

    // Update takeoff record
    await sql`
      UPDATE takeoffs SET
        status = 'complete',
        page_count = ${pdfResult.pageCount},
        raw_analysis = ${JSON.stringify({ pages: pageAnalyses, rooms: allRooms })},
        extracted_items = ${JSON.stringify(aggregated)}
      WHERE id = ${takeoff.id}
    `;

    return Response.json({
      takeoff_id: takeoff.id,
      page_count: pdfResult.pageCount,
      rooms: allRooms,
      items: aggregated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Aggregate similar items across pages
function aggregateItems(items) {
  const map = new Map();

  for (const item of items) {
    const key = `${item.category}|${item.description}|${item.unit}`;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.quantity += item.quantity || 0;
      if (item.notes && !existing.notes.includes(item.notes)) {
        existing.notes += '; ' + item.notes;
      }
    } else {
      map.set(key, { ...item, quantity: item.quantity || 0 });
    }
  }

  return Array.from(map.values());
}
