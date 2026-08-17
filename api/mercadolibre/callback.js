const {
  OAUTH_COOKIE,
  clearCookie,
  exchangeCode,
  getConfig,
  oauthCookie,
  publicError,
  safeEqual,
  sessionCookie,
  setCookies
} = require("../_lib/mercadolibre");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function page(title, message, ok) {
  const color = ok ? "#2f7d32" : "#b42318";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#f7f4fb;color:#241036;display:grid;min-height:100vh;place-items:center}
    main{width:min(560px,calc(100% - 40px));background:#fff;border-radius:20px;padding:32px;box-shadow:0 18px 60px #2410361c}
    h1{margin-top:0;color:${color}}p{line-height:1.55}a{color:#5424a8;font-weight:700}
  </style>
</head>
<body><main><h1>${safeTitle}</h1><p>${safeMessage}</p>${ok ? '<p><a href="/api/mercadolibre/status">Comprobar conexión</a></p>' : ""}</main></body>
</html>`;
}

module.exports = async function callback(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send(page(
      "Solicitud no válida",
      "La ruta de autorización solo admite solicitudes GET.",
      false
    ));
  }

  try {
    const config = getConfig();
    if (req.query.error) {
      throw new Error("La autorización fue cancelada o rechazada.");
    }
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) throw new Error("Faltan datos de autorización.");

    const stored = oauthCookie(req, config);
    if (
      !safeEqual(state, stored.state) ||
      Date.now() - Number(stored.createdAt || 0) > 10 * 60 * 1000
    ) {
      throw new Error("La autorización venció o no coincide. Volvé a iniciarla.");
    }

    const session = await exchangeCode(code, stored.verifier, config);
    setCookies(res, [
      sessionCookie(session, config),
      clearCookie(OAUTH_COOKIE)
    ]);
    return res.status(200).send(page(
      "Mercado Libre conectado",
      "La cuenta quedó autorizada para crear y actualizar publicaciones. Ya podés cerrar esta pestaña.",
      true
    ));
  } catch (error) {
    const response = publicError(error);
    return res.status(response.status).send(page(
      "No se pudo conectar Mercado Libre",
      response.body.error,
      false
    ));
  }
};
