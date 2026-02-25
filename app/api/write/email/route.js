import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const EMAIL_TYPES = {
  follow_up: {
    description: 'Follow up with a client after sending an estimate or meeting',
    guidance: 'Be warm but purposeful. Reference the specific estimate or conversation. Ask if they have questions. Gently nudge toward a decision without being pushy.',
  },
  estimate_sent: {
    description: 'Accompany a newly sent estimate',
    guidance: 'Thank them for the opportunity. Highlight 2-3 key value points about your proposal. Mention your availability to walk through it together. Include the total price.',
  },
  payment_reminder: {
    description: 'Remind a client about an outstanding payment',
    guidance: 'Be polite but firm. Reference the invoice number/amount if available. Mention the original due date. Provide payment methods. Keep it brief and professional.',
  },
  project_update: {
    description: 'Update the client on project progress',
    guidance: 'Start with what has been completed. Mention what is coming next. Flag any issues proactively. Include timeline expectations. Be transparent and confidence-building.',
  },
  complaint_response: {
    description: 'Respond to a client complaint or concern',
    guidance: 'Acknowledge the issue immediately. Do NOT be defensive. Show empathy. Provide a specific plan to resolve. Give a timeline. Offer direct contact for follow-up.',
  },
  thank_you: {
    description: 'Thank a client after project completion',
    guidance: 'Express genuine gratitude. Mention specifics about the project. Ask for a review/referral naturally. Mention warranty coverage. Leave the door open for future work.',
  },
  change_order: {
    description: 'Communicate a change order to the client',
    guidance: 'Clearly explain what changed and why. Show the cost impact. Be transparent about timeline impact. Frame it as protecting their interests. Request written approval.',
  },
  review_request: {
    description: 'Ask a satisfied client for an online review',
    guidance: 'Reference the completed project. Express pride in the work. Make it EASY by including a direct link placeholder. Keep it short. Do not be overly salesy.',
  },
};

// POST /api/write/email - Generate customer emails
export async function POST(request) {
  try {
    const { type, context, recipientName, estimateId, jobName, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!type || !EMAIL_TYPES[type]) {
      return Response.json({
        error: `Invalid email type. Must be one of: ${Object.keys(EMAIL_TYPES).join(', ')}`,
      }, { status: 400 });
    }

    const emailType = EMAIL_TYPES[type];

    const prompt = `You are an expert email writer for construction contractors. Write a professional email for the following scenario.

## EMAIL TYPE
${type.replace(/_/g, ' ').toUpperCase()}: ${emailType.description}

## TONE GUIDANCE
${emailType.guidance}

## DETAILS
Recipient Name: ${recipientName || 'Valued Customer'}
${jobName ? `Project/Job Name: ${jobName}` : ''}
${estimateId ? `Estimate Reference: ${estimateId}` : ''}
${context ? `Additional Context: ${context}` : ''}

## REQUIREMENTS
1. Write a compelling subject line (concise, specific, not clickbait)
2. Write the email body in a contractor-friendly voice:
   - Sound like a real person, not a template
   - Use construction industry language naturally
   - Be direct and respectful of the client's time
   - Keep paragraphs short (2-3 sentences max)
   - Include a clear call-to-action
3. Use proper email formatting with greeting and sign-off
4. Sign off with a placeholder like "[Your Name]" and "[Company Name]"
5. Keep the total email under 250 words

Return your response in this EXACT JSON format (no markdown, just pure JSON):
{
  "subject": "The email subject line",
  "body": "The full email body with proper line breaks using \\n"
}`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed || !parsed.subject || !parsed.body) {
      // Fallback: try to extract subject and body from plain text
      const lines = text.split('\n').filter(l => l.trim());
      const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
      return Response.json({
        subject: subjectLine ? subjectLine.replace(/^subject:\s*/i, '') : `Re: ${jobName || 'Your Project'}`,
        body: text,
        usage: response.usage,
      });
    }

    return Response.json({
      subject: parsed.subject,
      body: parsed.body,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Email generation error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate email' }, { status: 500 });
  }
}
