import Anthropic from '@anthropic-ai/sdk';

/**
 * Transcribe audio using OpenAI Whisper API.
 * @param {Buffer} audioBuffer - Raw audio file buffer
 * @param {string} openaiKey - OpenAI API key (or reuse Anthropic key pattern)
 * @returns {{ text: string, language: string }}
 */
export async function transcribeAudio(audioBuffer) {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    text: data.text || '',
    language: data.language || 'en',
  };
}

/**
 * Parse a voice command transcription into structured intent and params using Claude.
 * @param {string} text - The transcription text
 * @param {string} apiKey - Anthropic API key
 * @returns {{ intent: string, params: object, confirmation: string }}
 */
export async function parseVoiceCommand(text, apiKey) {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a voice command parser for a construction project management app (JobTread integration).

Parse the following voice command and extract the intent and parameters.

Voice command: "${text}"

Available intents:
- clock_in: Clock in to a job. Params: { jobName?, jobId? }
- clock_out: Clock out of current job. Params: { jobName?, jobId? }
- add_comment: Add a comment/note to a job. Params: { jobName?, jobId?, text }
- create_daily_log: Create a daily log entry. Params: { jobName?, jobId?, notes, weather?, crew_count? }
- update_status: Update a job's status. Params: { jobName?, jobId?, status }
- search_job: Search for a job. Params: { search }
- create_job: Create a new job. Params: { name, address?, contactName? }

Return ONLY a JSON object with this structure (no markdown, no code fences):
{
  "intent": "the_intent_name",
  "params": { ... extracted parameters ... },
  "confirmation": "A human-readable summary of what will be done, e.g. 'Clock in to Smith Kitchen Remodel'"
}

If you cannot determine a clear intent, use:
{
  "intent": "unknown",
  "params": { "raw_text": "..." },
  "confirmation": "I didn't understand that command. Could you try again?"
}`,
      },
    ],
  });

  const responseText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall through to default
  }

  return {
    intent: 'unknown',
    params: { raw_text: text },
    confirmation: 'Could not parse the voice command. Please try again.',
  };
}
