const {
  OAUTH_COOKIE,
  cookie,
  encryptJson,
  getConfig,
  pkceChallenge,
  publicError,
  randomToken,
  sendJson,
  setCookies
} = require("../_lib/mercadolibre");

module.exports = async function authorize(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, {ok: false, error: "Método no permitido."});
  }

  try {
    const config = getConfig();
    const state = randomToken(24);
    const verifier = randomToken(48);
    const oauthState = encryptJson({
      state,
      verifier,
      createdAt: Date.now()
    }, config.sessionSecret);

    setCookies(res, [cookie(OAUTH_COOKIE, oauthState, {maxAge: 600})]);
    res.setHeader("Cache-Control", "no-store");

    const url = new URL("https://auth.mercadolibre.com.ar/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return res.redirect(302, url.toString());
  } catch (error) {
    const response = publicError(error);
    return sendJson(res, response.status, response.body);
  }
};
