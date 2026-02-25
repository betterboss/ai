import { processSequences } from '../../../lib/sequences';

export const runtime = 'nodejs';

// POST /api/sequences/process - Cron-triggered sequence processor
// Called by Vercel Cron every 15 minutes
export async function POST(request) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.VERCEL === '1') {
      return Response.json(
        { error: 'CRON_SECRET environment variable is required in production. Set it in Vercel project settings.' },
        { status: 403 }
      );
    }

    const results = await processSequences();

    return Response.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sequence processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Also support GET for Vercel Cron (crons use GET by default)
export async function GET(request) {
  return POST(request);
}
