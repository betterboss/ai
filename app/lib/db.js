import { neon } from '@neondatabase/serverless';

// Neon serverless Postgres client
// Uses DATABASE_URL from Vercel environment (auto-injected by Neon integration)
export function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL environment variable. Connect Neon to your Vercel project.');
  }
  return neon(url);
}
