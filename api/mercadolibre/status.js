const {
  activeSession,
  apiRequest,
  getConfig,
  publicError,
  sendJson,
  sessionCookie,
  setCookies
} = require("../_lib/mercadolibre");

module.exports = async function status(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {ok: false, error: "Método no permitido."});
  }

  try {
    const config = getConfig();
    const result = await activeSession(req, config);
    if (result.refreshed) {
      setCookies(res, [sessionCookie(result.session, config)]);
    }
    const user = await apiRequest("/users/me", {
      accessToken: result.session.accessToken
    });
    return sendJson(res, 200, {
      ok: true,
      connected: true,
      user: {id: user.id, nickname: user.nickname},
      expiresAt: result.session.expiresAt
    });
  } catch (error) {
    const response = publicError(error);
    return sendJson(res, response.status, response.body);
  }
};
