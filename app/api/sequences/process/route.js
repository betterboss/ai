import { processSequences } from '../../../lib/sequences';

export const runtime = 'nodejs';

// POST /api/sequences/process - Cron-triggered sequence processor
// Called by Vercel Cron every 15 minutes
export async function POST(request) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
