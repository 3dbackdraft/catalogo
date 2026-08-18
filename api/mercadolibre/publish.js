const crypto = require("node:crypto");
const {
  activeSession,
  apiRequest,
  getConfig,
  publicError,
  sendJson,
  sessionCookie,
  setCookies
} = require("../_lib/mercadolibre");

const LISTING_TYPES = new Set(["free", "gold_special", "gold_pro"]);

function text(value, maximum) {
  return String(value || "").trim().slice(0, maximum);
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function cleanAttributes(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 80).map(attribute => {
    const result = {id: text(attribute.id, 80)};
    if (attribute.value_id) result.value_id = text(attribute.value_id, 120);
    if (attribute.value_name) result.value_name = text(attribute.value_name, 240);
    if (Array.isArray(attribute.values)) {
      result.values = attribute.values.slice(0, 30).map(value => ({
        ...(value.id ? {id: text(value.id, 120)} : {}),
        ...(value.name ? {name: text(value.name, 240)} : {})
      }));
    }
    return result;
  }).filter(attribute => attribute.id);
}

function cleanSaleTerms(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 20).map(term => ({
    id: text(term.id, 80),
    ...(term.value_id ? {value_id: text(term.value_id, 120)} : {}),
    ...(term.value_name ? {value_name: text(term.value_name, 240)} : {})
  })).filter(term => term.id);
}

function listingFrom(body) {
  const title = text(body.title, 60);
  const familyName = text(body.family_name, 60);
  const categoryId = text(body.category_id, 30);
  const price = number(body.price);
  const quantity = Math.floor(number(body.available_quantity));
  const listingType = text(body.listing_type_id || "gold_special", 30);
  const pictures = Array.isArray(body.pictures)
    ? body.pictures.slice(0, 12).map(value => text(
        typeof value === "string" ? value : value.source,
        1800
      )).filter(value => /^https:\/\//i.test(value))
    : [];

  if (!title && !familyName) {\n    throw Object.assign(new Error("Falta el título o la familia del producto."), {status: 400});\n  }
  if (!/^MLA\d+$/.test(categoryId)) {
    throw Object.assign(new Error("La categoría de Mercado Libre es inválida."), {status: 400});
  }
  if (price <= 0) throw Object.assign(new Error("El precio es inválido."), {status: 400});
  if (quantity < 1 || quantity > 99999) {
    throw Object.assign(new Error("El stock debe estar entre 1 y 99999."), {status: 400});
  }
  if (!LISTING_TYPES.has(listingType)) {
    throw Object.assign(new Error("El tipo de publicación no está permitido."), {status: 400});
  }
  if (!pictures.length) {
    throw Object.assign(new Error("Mercado Libre requiere al menos una foto HTTPS."), {status: 400});
  }

  return {
    title,
    ...(familyName ? {family_name: familyName} : {}),
    category_id: categoryId,
    price,
    currency_id: "ARS",
    available_quantity: quantity,
    buying_mode: "buy_it_now",
    listing_type_id: listingType,
    condition: "new",
    pictures: pictures.map(source => ({source})),
    attributes: cleanAttributes(body.attributes),
    sale_terms: cleanSaleTerms(body.sale_terms),
    ...(body.seller_custom_field
      ? {seller_custom_field: text(body.seller_custom_field, 64)}
      : {}),
    ...(body.shipping && typeof body.shipping === "object"
      ? {shipping: {
          ...(body.shipping.mode ? {mode: text(body.shipping.mode, 30)} : {}),
          free_shipping: Boolean(body.shipping.free_shipping),
          local_pick_up: Boolean(body.shipping.local_pick_up)
        }}
      : {})
  };
}

module.exports = async function publish(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, {ok: false, error: "Método no permitido."});
  }

  try {
    const body = req.body && typeof req.body === "object"
      ? req.body
      : JSON.parse(req.body || "{}");
    if (body.confirmation !== "APROBADO") {
      return sendJson(res, 409, {
        ok: false,
        error: "La publicación requiere confirmación explícita."
      });
    }

    const config = getConfig();
    const expectedOrigin = new URL(config.redirectUri).origin;
    if (String(req.headers.origin || "") !== expectedOrigin) {
      return sendJson(res, 403, {
        ok: false,
        error: "Origen de publicación no permitido."
      });
    }
    const result = await activeSession(req, config);
    if (result.refreshed) {
      setCookies(res, [sessionCookie(result.session, config)]);
    }

    const listing = listingFrom(body);
    const requestedKey = text(body.idempotency_key, 100);
    const idempotencyKey = /^[A-Za-z0-9_-]{8,100}$/.test(requestedKey)
      ? requestedKey
      : crypto.randomUUID();
    const item = await apiRequest("/items", {
      method: "POST",
      accessToken: result.session.accessToken,
      headers: {"X-Idempotency-Key": idempotencyKey},
      body: listing
    });

    let descriptionSaved = false;
    let descriptionWarning = "";
    const description = text(body.description, 50000);
    if (description) {
      try {
        await apiRequest(`/items/${encodeURIComponent(item.id)}/description`, {
          method: "POST",
          accessToken: result.session.accessToken,
          body: {plain_text: description}
        });
        descriptionSaved = true;
      } catch (_) {
        descriptionWarning = "La publicación fue creada, pero la descripción deberá revisarse.";
      }
    }

    return sendJson(res, 201, {
      ok: true,
      item: {
        id: item.id,
        permalink: item.permalink,
        status: item.status
      },
      descriptionSaved,
      warning: descriptionWarning || undefined,
      idempotencyKey
    });
  } catch (error) {
    const response = publicError(error);
    return sendJson(res, response.status, response.body);
  }
};
