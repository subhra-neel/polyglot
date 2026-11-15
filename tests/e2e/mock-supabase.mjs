/**
 * A stand-in for Supabase, large enough to run the whole app in a test:
 * sign-up, sign-in, session checks and sign-out are imitated here, and
 * database calls (/rest/v1/rpc/...) run the REAL migrations and content in
 * a real Postgres engine (PGlite), as the signed-in learner.
 *
 * It is NOT Supabase: it proves our code handles the documented responses,
 * not that a real project is configured correctly.
 */
import { createServer } from "node:http";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, asUser, createTestDb } from "../helpers/db.mjs";

const SECRET = "mock-secret";
const users = new Map(); // email -> { id, email, password }
const sessions = new Map(); // access token -> user
const recoveries = []; // reset emails "sent": { email, redirectTo, challenge, method }
const codes = new Map(); // one-time ?code= values -> recovery
const tokenHashes = new Map(); // one-time ?token_hash= values -> user email
const speechRequests = []; // calls to the stand-in Sarvam voice service

/** Bytes the stand-in voice "speaks": readable, so tests can check what was asked for. */
export const fakeAudio = (text, pace) => Buffer.from(`audio|${text}|${pace}`);

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

function readJson(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

/** Calls a database function with named arguments, as `userId` (or anon). */
async function callFunction(db, userId, name, args) {
  if (!/^[a-z_]+$/.test(name)) throw Object.assign(new Error("bad function name"), { status: 404 });
  const names = Object.keys(args);
  if (!names.every((n) => /^p_[a-z_]+$/.test(n))) throw Object.assign(new Error("bad argument"), { status: 400 });
  const list = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
  return asUser(db, userId, async () => {
    const { rows } = await db.query(`select public.${name}(${list}) as result`, Object.values(args));
    return rows[0].result;
  });
}

export async function startMockSupabase(port) {
  const db = await createTestDb(readFileSync(join(ROOT, "supabase", "content.sql"), "utf8"));
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
      await db.query("insert into auth.users (id, email) values ($1, $2)", [user.id, email]);
      return send(200, issueSession(user));
    }

    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const { email, password } = await readJson(request);
      const user = users.get(email);
      if (url.searchParams.get("grant_type") === "password" && user && user.password === password) {
        return send(200, issueSession(user));
      }
      return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    }

    // Password reset: Supabase emails a link. Here the "email" is recorded so
    // the test can follow the link Supabase would have sent.
    if (url.pathname === "/auth/v1/recover" && request.method === "POST") {
      const body = await readJson(request);
      recoveries.push({
        email: body.email,
        redirectTo: url.searchParams.get("redirect_to"),
        challenge: body.code_challenge,
        method: body.code_challenge_method,
      });
      return send(200, {});
    }

    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      const { auth_code, code_verifier } = await readJson(request);
      const recovery = codes.get(auth_code);
      codes.delete(auth_code);
      const expected =
        recovery?.method === "s256"
          ? createHash("sha256").update(code_verifier ?? "").digest("base64url")
          : code_verifier;
      const user = recovery && users.get(recovery.email);
      if (!user || expected !== recovery.challenge) {
        return send(400, { code: 400, error_code: "bad_code_verifier", msg: "code challenge does not match" });
      }
      return send(200, issueSession(user));
    }

    if (url.pathname === "/auth/v1/verify" && request.method === "POST") {
      const { token_hash, type } = await readJson(request);
      const email = tokenHashes.get(token_hash);
      tokenHashes.delete(token_hash);
      const user = email && users.get(email);
      if (!user || type !== "recovery") {
        return send(403, { code: 403, error_code: "otp_expired", msg: "Email link is invalid or has expired" });
      }
      return send(200, issueSession(user));
    }

    if (url.pathname === "/auth/v1/user" && request.method === "PUT") {
      const user = sessions.get(token);
      if (!user) return send(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      const { password } = await readJson(request);
      if (password === user.password) {
        return send(422, { code: 422, error_code: "same_password", msg: "New password should be different" });
      }
      user.password = password;
      return send(200, publicUser(user));
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

    // Stand-in for Sarvam's text-to-speech (the app's SARVAM_API_BASE points here).
    if (url.pathname === "/text-to-speech" && request.method === "POST") {
      const body = await readJson(request);
      speechRequests.push({ key: request.headers["api-subscription-key"], ...body });
      if (request.headers["api-subscription-key"] !== "test-sarvam-key") {
        return send(403, { error: { message: "Invalid API key" } });
      }
      return send(200, { request_id: randomUUID(), audios: [fakeAudio(body.text, body.pace).toString("base64")] });
    }

    // Reading one sentence by id, as the signed-in learner (row-level security applies).
    if (url.pathname === "/rest/v1/sentences" && request.method === "GET") {
      const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
      const userId = sessions.get(token)?.id ?? null;
      try {
        const rows = await asUser(db, userId, async () =>
          (await db.query("select text_script, language_code from public.sentences where id = $1", [id])).rows,
        );
        return send(200, rows);
      } catch (error) {
        return send(400, { code: "22P02", message: error.message });
      }
    }

    if (url.pathname.startsWith("/rest/v1/rpc/") && request.method === "POST") {
      const name = url.pathname.slice("/rest/v1/rpc/".length);
      const userId = sessions.get(token)?.id ?? null;
      try {
        const result = await callFunction(db, userId, name, await readJson(request));
        return send(200, result);
      } catch (error) {
        const denied = /permission denied/.test(error.message);
        return send(error.status ?? (denied ? 401 : 400), { code: denied ? "42501" : "P0001", message: error.message });
      }
    }

    send(404, { message: `mock-supabase: no handler for ${request.method} ${url.pathname}` });
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    db,
    recoveries,
    speechRequests,
    /** The link in the default email template: Supabase redirects with ?code=. */
    codeLinkFor(recovery) {
      const code = randomUUID();
      codes.set(code, recovery);
      const link = new URL(recovery.redirectTo);
      link.searchParams.set("code", code);
      return link.toString();
    },
    /** The link in the recommended template: ?token_hash=…&type=recovery. */
    tokenHashLinkFor(email, siteUrl) {
      const hash = randomUUID();
      tokenHashes.set(hash, email);
      return `${siteUrl}/auth/confirm?token_hash=${hash}&type=recovery&next=/reset-password`;
    },
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
