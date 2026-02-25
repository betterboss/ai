import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

// POST /api/quote/generate - Generate a professional cover letter for a quote
export async function POST(request) {
  try {
    const { estimate, items, companyName, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const itemSummary = (items || [])
      .map(i => `- ${i.description}: ${i.quantity} ${i.unit} @ $${i.unit_cost}/${i.unit}`)
      .join('\n');

    const prompt = `You are writing a professional quote cover letter for a construction company${companyName ? ` called "${companyName}"` : ''}.

Project: ${estimate?.name || 'Construction Project'}
Client: ${estimate?.client_name || 'Valued Customer'}
Address: ${estimate?.job_address || 'Project Site'}
Total Price: $${(estimate?.total_price || 0).toLocaleString()}

Line Items:
${itemSummary}

Write a brief, professional cover letter (3-4 paragraphs) that:
1. Thanks the client for the opportunity
2. Summarizes the scope of work in plain language (not a line-item list)
3. Highlights the value and quality they'll receive
4. Provides a clear call to action to approve

Keep it warm but professional. No fluff. Contractor-friendly tone.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return Response.json({ coverLetter: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
