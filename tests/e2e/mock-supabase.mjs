/**
 * A stand-in for Supabase, just large enough to exercise sign-up, sign-in,
 * session checks, sign-out and one table read. It lets the smoke test run
 * the whole app without touching a real project.
 *
 * It is NOT Supabase: it proves our code handles the documented responses,
 * not that a real project is configured correctly.
 */
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const SECRET = "mock-secret";
const users = new Map(); // email -> { id, email, password }
const sessions = new Map(); // access token -> user

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function issueSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
  })}`;
  const access_token = `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
  sessions.set(access_token, user);
  return {
    access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: randomUUID(),
    user: publicUser(user),
  };
}

const publicUser = (user) => ({
  id: user.id,
  aud: "authenticated",
  role: "authenticated",
  email: user.email,
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
});

const UNITS = [
  "Greetings and politeness",
  "Who I am, who you are",
  "This and that; yes and no",
  "I want, I do not want",
  "Is there, there is not; where",
  "Numbers, money, how much",
  "Come, go, give, stop: polite requests",
  "I did not understand: repairing a conversation",
].map((title, index) => ({ position: index + 1, title, levels: { language_code: "kn", number: 1 } }));

function readJson(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

export function startMockSupabase(port, { tablesExist = true } = {}) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
    const send = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(payload === undefined ? "" : JSON.stringify(payload));
    };

    if (url.pathname === "/auth/v1/signup" && request.method === "POST") {
      const { email, password } = await readJson(request);
      if (users.has(email)) return send(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      const user = { id: randomUUID(), email, password };
      users.set(email, user);
      return send(200, issueSession(user));
    }

    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      const { email, password } = await readJson(request);
      const user = users.get(email);
      if (url.searchParams.get("grant_type") === "password" && user && user.password === password) {
        return send(200, issueSession(user));
      }
      return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    }

    if (url.pathname === "/auth/v1/user") {
      const user = sessions.get(token);
      return user ? send(200, publicUser(user)) : send(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }

    if (url.pathname === "/auth/v1/logout") {
      sessions.delete(token);
      return send(204);
    }

    if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(200, { keys: [] });

    if (url.pathname === "/rest/v1/units") {
      if (!tablesExist) {
        return send(404, { code: "PGRST205", message: "Could not find the table 'public.units' in the schema cache" });
      }
      // Row-level security: content is readable only when signed in.
      return send(200, sessions.has(token) ? UNITS : []);
    }

    send(404, { message: `mock-supabase: no handler for ${request.method} ${url.pathname}` });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
