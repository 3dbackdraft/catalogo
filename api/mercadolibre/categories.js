const {
  activeSession,
  apiRequest,
  getConfig,
  publicError,
  sendJson,
  sessionCookie,
  setCookies
} = require("../_lib/mercadolibre");

module.exports = async function categories(req, res) {
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

    const categoryId = String(req.query.category_id || "").trim();
    if (categoryId) {
      if (!/^MLA\d+$/.test(categoryId)) {
        return sendJson(res, 400, {ok: false, error: "Categoría inválida."});
      }
      const attributes = await apiRequest(
        `/categories/${encodeURIComponent(categoryId)}/attributes`,
        {accessToken: result.session.accessToken}
      );
      return sendJson(res, 200, {
        ok: true,
        categoryId,
        attributes: attributes.map(attribute => ({
          id: attribute.id,
          name: attribute.name,
          valueType: attribute.value_type,
          values: attribute.values || [],
          tags: attribute.tags || {}
        }))
      });
    }

    const query = String(req.query.q || "").trim();
    if (query.length < 3 || query.length > 120) {
      return sendJson(res, 400, {
        ok: false,
        error: "Ingresá una búsqueda de entre 3 y 120 caracteres."
      });
    }
    const matches = await apiRequest(
      `/sites/MLA/domain_discovery/search?q=${encodeURIComponent(query)}&limit=8`,
      {accessToken: result.session.accessToken}
    );
    return sendJson(res, 200, {
      ok: true,
      matches: matches.map(match => ({
        domainId: match.domain_id,
        domainName: match.domain_name,
        categoryId: match.category_id,
        categoryName: match.category_name,
        attributes: match.attributes || []
      }))
    });
  } catch (error) {
    const response = publicError(error);
    return sendJson(res, response.status, response.body);
  }
};
