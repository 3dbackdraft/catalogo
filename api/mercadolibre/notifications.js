const {sendJson} = require("../_lib/mercadolibre");

module.exports = async function notifications(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      message: "Callback de notificaciones activo."
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, {ok: false, error: "Método no permitido."});
  }

  // Se responde rápido para evitar reintentos. La sincronización de ventas,
  // mensajes y envíos se incorporará cuando esos permisos sean necesarios.
  return sendJson(res, 200, {ok: true, received: true});
};
