import { getServerSession } from 'next-auth';
import { getSQL } from './db';

// Get the authenticated user from the session
// Returns full user object with JT grant key and API keys
export async function getAuthUser(req) {
  // Try NextAuth session first
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const sql = getSQL();
  const rows = await sql`
    SELECT id, email, name, company_name, company_logo_url, default_markup_pct,
           jobtread_grant_key, anthropic_api_key,
           subscription_tier, subscription_status
    FROM users WHERE id = ${session.user.id}
  `;
  return rows[0] || null;
}

// Require authentication - throws 401 if not authenticated
export async function requireAuth(req) {
  const user = await getAuthUser(req);
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

// Require a minimum subscription tier
const TIER_LEVELS = {
  free: 0,
  toolkit: 1,
  vault: 2,
  crew: 3,
  ai: 4,
  complete: 5,
};

export async function requireTier(req, minimumTier) {
  const user = await requireAuth(req);
  const userLevel = TIER_LEVELS[user.subscription_tier] || 0;
  const requiredLevel = TIER_LEVELS[minimumTier] || 0;

  if (userLevel < requiredLevel) {
    throw new AuthError(`This feature requires the ${minimumTier} plan or higher`, 403);
  }
  return user;
}

// Require a valid JobTread grant key
export async function requireJobTreadKey(req) {
  const user = await requireAuth(req);
  if (!user.jobtread_grant_key) {
    throw new AuthError('JobTread grant key not configured. Visit Settings to connect your account.', 400);
  }
  return user;
}

// Require Anthropic API key
export async function requireAnthropicKey(req) {
  const user = await requireAuth(req);
  if (!user.anthropic_api_key) {
    throw new AuthError('Anthropic API key not configured. Visit Settings to add your key.', 400);
  }
  return user;
}

// Custom error class for auth errors
export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

// Helper to handle auth errors in API routes
export function handleAuthError(error) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

// Fallback: extract API key from request body (for backward compatibility)
export function getApiKeyFromBody(body) {
  return body?.apiKey || null;
}
