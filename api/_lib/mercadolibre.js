const crypto = require("node:crypto");

const API_BASE = "https://api.mercadolibre.com";
const SESSION_COOKIE = "mli_session";
const OAUTH_COOKIE = "mli_oauth";
const COOKIE_PATH = "/api/mercadolibre";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

function env(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function getConfig() {
  return {
    clientId: env("MELI_CLIENT_ID"),
    clientSecret: env("MELI_CLIENT_SECRET"),
    redirectUri: env("MELI_REDIRECT_URI"),
    sessionSecret: env("MELI_SESSION_SECRET")
  };
}

function sendJson(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return result;
      result[part.slice(0, separator)] = decodeURIComponent(
        part.slice(separator + 1)
      );
      return result;
    }, {});
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || COOKIE_PATH}`);
  parts.push("HttpOnly", "Secure", "SameSite=Lax");
  if (Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  return parts.join("; ");
}

function setCookies(res, values) {
  res.setHeader("Set-Cookie", values);
}

function keyFromSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptJson(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, encrypted]
    .map(part => Buffer.isBuffer(part) ? part.toString("base64url") : part)
    .join(".");
}

function decryptJson(value, secret) {
  const [version, ivValue, tagValue, encryptedValue] = String(value || "").split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Sesión inválida.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyFromSecret(secret),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function oauthCookie(req, config) {
  return decryptJson(parseCookies(req)[OAUTH_COOKIE], config.sessionSecret);
}

function sessionFromRequest(req, config) {
  const value = parseCookies(req)[SESSION_COOKIE];
  if (!value) {
    throw Object.assign(
      new Error("La cuenta de Mercado Libre no está autorizada."),
      {status: 401}
    );
  }
  return decryptJson(value, config.sessionSecret);
}

function sessionCookie(session, config) {
  return cookie(
    SESSION_COOKIE,
    encryptJson(session, config.sessionSecret),
    {maxAge: SESSION_MAX_AGE}
  );
}

function clearCookie(name) {
  return cookie(name, "", {maxAge: 0});
}

async function readResponse(response) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {
    body = {message: text || "Respuesta vacía"};
  }
  if (!response.ok) {
    const message = body.message || body.error || `Error HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

async function tokenRequest(params) {
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });
  return readResponse(response);
}

function compactSession(token) {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Number(token.expires_in || 0) * 1000,
    userId: token.user_id || null,
    scope: token.scope || ""
  };
}

async function exchangeCode(code, verifier, config) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier
  });
  return compactSession(token);
}

async function refreshSession(session, config) {
  if (!session.refreshToken) {
    throw new Error("La sesión no tiene refresh token. Volvé a autorizar la cuenta.");
  }
  const token = await tokenRequest({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: session.refreshToken
  });
  return compactSession(token);
}

async function activeSession(req, config) {
  const session = sessionFromRequest(req, config);
  if (Number(session.expiresAt || 0) > Date.now() + 60_000) {
    return {session, refreshed: false};
  }
  return {session: await refreshSession(session, config), refreshed: true};
}

async function apiRequest(path, options = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${options.accessToken}`,
    ...(options.headers || {})
  };
  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body
  });
  return readResponse(response);
}

function publicError(error) {
  const status = Number(error.status) || 500;
  const rawDetails = error && error.details && typeof error.details === "object"
    ? error.details
    : null;
  const causes = Array.isArray(rawDetails && rawDetails.cause)
    ? rawDetails.cause.slice(0, 20).map(cause => ({
        code: String(cause.code || cause.cause_id || "").slice(0, 160),
        message: String(cause.message || "").slice(0, 500),
        references: Array.isArray(cause.references)
          ? cause.references.slice(0, 20).map(reference =>
              String(reference || "").slice(0, 240)
            )
          : []
      }))
    : [];
  const diagnostic = rawDetails && status >= 400 && status < 500
    ? JSON.stringify(rawDetails).slice(0, 8000)
    : "";
  return {
    status: status >= 400 && status < 600 ? status : 500,
    body: {
      ok: false,
      error: status === 500
        ? "No se pudo completar la operación con Mercado Libre."
        : String(error.message || "Error de Mercado Libre"),
      ...(causes.length ? {causes} : {}),
      ...(diagnostic ? {diagnostic} : {})
    }
  };
}

module.exports = {
  API_BASE,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  activeSession,
  apiRequest,
  clearCookie,
  cookie,
  decryptJson,
  encryptJson,
  exchangeCode,
  getConfig,
  oauthCookie,
  pkceChallenge,
  publicError,
  randomToken,
  safeEqual,
  sendJson,
  sessionCookie,
  setCookies
};
