import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { getSQL } from '../../../lib/db';

// Custom Neon adapter for NextAuth (lazy SQL init to avoid build-time errors)
function NeonAdapter() {
  let _sql;
  const sql = (...args) => {
    if (!_sql) _sql = getSQL();
    return _sql(...args);
  };

  return {
    async createUser(user) {
      const rows = await sql`
        INSERT INTO users (email, name, image, email_verified)
        VALUES (${user.email}, ${user.name}, ${user.image}, ${user.emailVerified || null})
        RETURNING id, email, name, image, email_verified as "emailVerified"
      `;
      return rows[0];
    },

    async getUser(id) {
      const rows = await sql`
        SELECT id, email, name, image, email_verified as "emailVerified"
        FROM users WHERE id = ${id}
      `;
      return rows[0] || null;
    },

    async getUserByEmail(email) {
      const rows = await sql`
        SELECT id, email, name, image, email_verified as "emailVerified"
        FROM users WHERE email = ${email}
      `;
      return rows[0] || null;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const rows = await sql`
        SELECT u.id, u.email, u.name, u.image, u.email_verified as "emailVerified"
        FROM users u
        JOIN accounts a ON a.user_id = u.id
        WHERE a.provider = ${provider} AND a.provider_account_id = ${providerAccountId}
      `;
      return rows[0] || null;
    },

    async updateUser(user) {
      const rows = await sql`
        UPDATE users SET
          name = COALESCE(${user.name}, name),
          email = COALESCE(${user.email}, email),
          image = COALESCE(${user.image}, image),
          email_verified = COALESCE(${user.emailVerified}, email_verified)
        WHERE id = ${user.id}
        RETURNING id, email, name, image, email_verified as "emailVerified"
      `;
      return rows[0];
    },

    async deleteUser(userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
    },

    async linkAccount(account) {
      await sql`
        INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
        VALUES (${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId}, ${account.refresh_token || null}, ${account.access_token || null}, ${account.expires_at || null}, ${account.token_type || null}, ${account.scope || null}, ${account.id_token || null}, ${account.session_state || null})
      `;
      return account;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await sql`
        DELETE FROM accounts WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}
      `;
    },

    async createSession(session) {
      const rows = await sql`
        INSERT INTO sessions (session_token, user_id, expires)
        VALUES (${session.sessionToken}, ${session.userId}, ${session.expires})
        RETURNING session_token as "sessionToken", user_id as "userId", expires
      `;
      return rows[0];
    },

    async getSessionAndUser(sessionToken) {
      const rows = await sql`
        SELECT s.session_token as "sessionToken", s.user_id as "userId", s.expires,
               u.id, u.email, u.name, u.image, u.email_verified as "emailVerified"
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_token = ${sessionToken} AND s.expires > NOW()
      `;
      if (!rows[0]) return null;
      const row = rows[0];
      return {
        session: { sessionToken: row.sessionToken, userId: row.userId, expires: row.expires },
        user: { id: row.id, email: row.email, name: row.name, image: row.image, emailVerified: row.emailVerified },
      };
    },

    async updateSession(session) {
      const rows = await sql`
        UPDATE sessions SET expires = ${session.expires}
        WHERE session_token = ${session.sessionToken}
        RETURNING session_token as "sessionToken", user_id as "userId", expires
      `;
      return rows[0];
    },

    async deleteSession(sessionToken) {
      await sql`DELETE FROM sessions WHERE session_token = ${sessionToken}`;
    },

    async createVerificationToken(token) {
      const rows = await sql`
        INSERT INTO verification_tokens (identifier, token, expires)
        VALUES (${token.identifier}, ${token.token}, ${token.expires})
        RETURNING identifier, token, expires
      `;
      return rows[0];
    },

    async useVerificationToken({ identifier, token }) {
      const rows = await sql`
        DELETE FROM verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
        RETURNING identifier, token, expires
      `;
      return rows[0] || null;
    },
  };
}

const authOptions = {
  adapter: NeonAdapter(),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    ] : []),
    ...(process.env.EMAIL_SERVER_HOST ? [
      EmailProvider({
        server: {
          host: process.env.EMAIL_SERVER_HOST,
          port: process.env.EMAIL_SERVER_PORT,
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        },
        from: process.env.EMAIL_FROM,
      }),
    ] : []),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
