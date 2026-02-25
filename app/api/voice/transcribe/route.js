import { transcribeAudio, parseVoiceCommand } from '../../../lib/voice';

export const runtime = 'nodejs';

// POST /api/voice/transcribe - Accept audio file, transcribe with Whisper, parse intent with Claude
export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const apiKey = formData.get('apiKey');

    if (!audioFile) {
      return Response.json({ error: 'Audio file is required' }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    // Convert the file to a buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Step 1: Transcribe with Whisper
    const transcription = await transcribeAudio(audioBuffer);

    if (!transcription.text || transcription.text.trim().length === 0) {
      return Response.json({
        error: 'Could not detect any speech in the audio. Please try again.',
      }, { status: 400 });
    }

    // Step 2: Parse intent with Claude
    const parsed = await parseVoiceCommand(transcription.text, apiKey);

    return Response.json({
      transcription: transcription.text,
      language: transcription.language,
      intent: parsed.intent,
      params: parsed.params,
      confirmation: parsed.confirmation,
    });
  } catch (error) {
    console.error('Voice transcription error:', error);

    if (error.message?.includes('Whisper')) {
      return Response.json({ error: 'Speech recognition failed. Please try again.' }, { status: 502 });
    }
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    return Response.json({ error: error.message || 'Failed to process voice command' }, { status: 500 });
  }
}
