const config = window.BACKDRAFT_CONFIG || {};
const productsNode = document.querySelector("#products");
const searchNode = document.querySelector("#search");
const categoryFilter = document.querySelector("#category-filter");
const subcategoryFilter = document.querySelector("#subcategory-filter");
let products = [];
let cart = JSON.parse(localStorage.getItem("3db-cart") || "[]");
let detailImages = [];
let detailImageIndex = 0;
let activeDetailCode = "";
let imageObserver = null;
const imageRequests = new Map();

const money = value => Number(value) > 0
  ? new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(value)
  : "Consultar";

const escapeHtml = value => String(value ?? "").replace(
  /[&<>"']/g,
  char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]
);

function populateCategoryFilters() {
  const current = categoryFilter.value || "Todos";
  const categories = [...new Set(
    products.map(product => product.categoria).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  categoryFilter.innerHTML =
    '<option value="Todos">Todas</option>' +
    categories.map(value =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    ).join("");
  categoryFilter.value = categories.includes(current)
    ? current
    : "Todos";
  populateSubcategoryFilter();
}

function renderCategoryGateway() {
  const counts = products.reduce((result, product) => {
    const category = product.categoria || "Sin categoría";
    result[category] = (result[category] || 0) + 1;
    return result;
  }, {});
  const categories = Object.keys(counts).sort((a, b) =>
    a.localeCompare(b)
  );
  document.querySelector("#category-buttons").innerHTML = [
    `<button class="category-button" data-category="Todos"><span>Todas las piezas <b>→</b></span><small>${products.length} productos</small></button>`,
    ...categories.map(category => `
      <button class="category-button" data-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)} <b>→</b></span>
        <small>${counts[category]} producto${counts[category] === 1 ? "" : "s"}</small>
      </button>
    `)
  ].join("");
  document.querySelectorAll(".category-button").forEach(button => {
    button.onclick = () => openCategory(button.dataset.category);
  });
}

function openCategory(category) {
  categoryFilter.value = category;
  populateSubcategoryFilter();
  document.querySelector("#selected-category-title").textContent =
    category === "Todos" ? "Todas las piezas" : category;
  document.querySelector("#category-gateway").hidden = true;
  document.querySelector("#product-browser").hidden = false;
  renderProducts();
}

function showCategoryGateway() {
  document.querySelector("#product-browser").hidden = true;
  document.querySelector("#category-gateway").hidden = false;
  if (imageObserver) imageObserver.disconnect();
}

function populateSubcategoryFilter() {
  const current = subcategoryFilter.value || "Todos";
  const selectedCategory = categoryFilter.value;
  const subcategories = [...new Set(
    products
      .filter(product =>
        selectedCategory === "Todos" ||
        product.categoria === selectedCategory
      )
      .map(product => product.subcategoria)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  subcategoryFilter.innerHTML =
    '<option value="Todos">Todas</option>' +
    subcategories.map(value =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    ).join("");
  subcategoryFilter.value = subcategories.includes(current)
    ? current
    : "Todos";
}

function renderProducts() {
  const query = searchNode.value.toLowerCase().trim();
  const selectedCategory = categoryFilter.value;
  const selectedSubcategory = subcategoryFilter.value;
  const filtered = products.filter(product => {
    const categoryMatch =
      selectedCategory === "Todos" ||
      product.categoria === selectedCategory;
    const subcategoryMatch =
      selectedSubcategory === "Todos" ||
      product.subcategoria === selectedSubcategory;
    const text = [
      product.producto,
      product.descripcion,
      product.codigo,
      product.categoria,
      product.subcategoria
    ].join(" ").toLowerCase();
    return categoryMatch && subcategoryMatch && text.includes(query);
  });

  document.querySelector("#result-count").textContent =
    `${filtered.length} producto${filtered.length === 1 ? "" : "s"}`;
  const empty = document.querySelector("#empty");
  empty.hidden = filtered.length > 0;
  if (!filtered.length && products.length) {
    empty.textContent = "No encontramos productos con esos filtros.";
  }

  productsNode.innerHTML = filtered.map(product => `
    <article
      class="product"
      data-product-code="${escapeHtml(product.codigo)}"
      tabindex="0"
      role="button"
      aria-label="Ver detalles de ${escapeHtml(product.producto)}"
    >
      <div class="product-image">
        ${product.fotoPrincipal
          ? `<img src="${escapeHtml(product.fotoPrincipal)}" alt="${escapeHtml(product.producto)}" loading="lazy">`
          : `<div class="image-loading" data-image-code="${escapeHtml(product.codigo)}" aria-label="Cargando foto"></div>`}
      </div>
      <div class="product-body">
        <small>${escapeHtml(product.categoria)}${product.subcategoria ? ` · ${escapeHtml(product.subcategoria)}` : ""}</small>
        <h3>${escapeHtml(product.producto)}</h3>
        <p>${escapeHtml(product.descripcion)}</p>
        <div class="buy-row">
          <span class="price">${money(product.precioVenta)}</span>
          <button class="add" data-code="${escapeHtml(product.codigo)}">Agregar</button>
        </div>
      </div>
    </article>
  `).join("");

  productsNode.querySelectorAll(".add").forEach(button => {
    button.onclick = () => addToCart(button.dataset.code);
  });
  productsNode.querySelectorAll(".product").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest(".add")) return;
      openProductDetail(card.dataset.productCode);
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProductDetail(card.dataset.productCode);
      }
    });
  });
  observeProductImages();
}

function observeProductImages() {
  if (imageObserver) imageObserver.disconnect();
  const targets = productsNode.querySelectorAll("[data-image-code]");
  if (!("IntersectionObserver" in window)) {
    targets.forEach(target => loadCardImage(target.dataset.imageCode));
    return;
  }
  imageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      imageObserver.unobserve(entry.target);
      loadCardImage(entry.target.dataset.imageCode);
    });
  }, {rootMargin: "300px 0px"});
  targets.forEach(target => imageObserver.observe(target));
}

async function loadCardImage(code) {
  const product = products.find(item => item.codigo === code);
  if (!product || product.fotoPrincipal) return;
  if (!imageRequests.has(code)) {
    imageRequests.set(code, fetch(
      `${config.apiUrl}?action=images&code=${encodeURIComponent(code)}`
    ).then(response => response.json()).catch(() => ({ok: false})));
  }
  const result = await imageRequests.get(code);
  if (!result.ok || !Array.isArray(result.images)) return;
  product.imagenes = result.images;
  product.fotoPrincipal = result.images[0] || "";
  document.querySelectorAll(`[data-image-code="${CSS.escape(code)}"]`)
    .forEach(target => {
      const container = target.closest(".product-image");
      if (product.fotoPrincipal) {
        container.innerHTML = `<img src="${escapeHtml(product.fotoPrincipal)}" alt="${escapeHtml(product.producto)}" loading="lazy">`;
      } else {
        target.outerHTML = '<span class="placeholder">Sin foto</span>';
      }
      container.classList.add("image-ready");
    });
}

function addToCart(code) {
  const product = products.find(item => item.codigo === code);
  if (!product) return;
  const existing = cart.find(item => item.codigo === code);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      codigo: product.codigo,
      producto: product.producto,
      precioVenta: Number(product.precioVenta) || 0,
      quantity: 1
    });
  }
  saveCart();
  openCart();
}

function saveCart() {
  localStorage.setItem("3db-cart", JSON.stringify(cart));
  document.querySelector("#cart-count").textContent = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  document.querySelector("#cart-total").textContent = money(
    cart.reduce(
      (sum, item) => sum + item.precioVenta * item.quantity,
      0
    )
  );
  document.querySelector("#cart-items").innerHTML = cart.length
    ? cart.map(item => `
        <div class="cart-item">
          <strong>${escapeHtml(item.producto)}</strong>
          <small>${item.quantity} × ${money(item.precioVenta)}</small>
          <button data-code="${escapeHtml(item.codigo)}" aria-label="Quitar">×</button>
        </div>
      `).join("")
    : '<p class="cart-empty">Todavía no agregaste productos.</p>';
  document.querySelectorAll(".cart-item button").forEach(button => {
    button.onclick = () => {
      cart = cart.filter(item => item.codigo !== button.dataset.code);
      saveCart();
    };
  });
}

function openCart() {
  document.querySelector("#cart").classList.add("open");
  document.querySelector("#overlay").classList.add("open");
  document.querySelector("#cart").setAttribute("aria-hidden", "false");
  document.querySelector("#cart-button").setAttribute(
    "aria-expanded",
    "true"
  );
}

function closeCart() {
  document.querySelector("#cart").classList.remove("open");
  document.querySelector("#overlay").classList.remove("open");
  document.querySelector("#cart").setAttribute("aria-hidden", "true");
  document.querySelector("#cart-button").setAttribute(
    "aria-expanded",
    "false"
  );
}

function renderDetailImage() {
  const imageNode = document.querySelector("#detail-image");
  const thumbnails = document.querySelector("#detail-thumbnails");
  const hasImages = detailImages.length > 0;
  imageNode.innerHTML = hasImages
    ? `<img src="${escapeHtml(detailImages[detailImageIndex])}" alt="Foto ${detailImageIndex + 1} del producto">`
    : '<span class="placeholder">Sin foto</span>';
  thumbnails.innerHTML = detailImages.map((url, index) => `
    <button class="${index === detailImageIndex ? "active" : ""}" data-index="${index}" aria-label="Ver foto ${index + 1}">
      <img src="${escapeHtml(url)}" alt="">
    </button>
  `).join("");
  thumbnails.hidden = detailImages.length < 2;
  document.querySelector("#gallery-prev").hidden =
    detailImages.length < 2;
  document.querySelector("#gallery-next").hidden =
    detailImages.length < 2;
  document.querySelector("#detail-counter").textContent = hasImages
    ? `${detailImageIndex + 1} / ${detailImages.length}`
    : "";
  thumbnails.querySelectorAll("button").forEach(button => {
    button.onclick = () => {
      detailImageIndex = Number(button.dataset.index);
      renderDetailImage();
    };
  });
}

function changeDetailImage(direction) {
  if (detailImages.length < 2) return;
  detailImageIndex =
    (detailImageIndex + direction + detailImages.length) %
    detailImages.length;
  renderDetailImage();
}

function openProductDetail(code) {
  const product = products.find(item => item.codigo === code);
  if (!product) return;

  activeDetailCode = product.codigo;
  detailImages = Array.isArray(product.imagenes)
    ? product.imagenes
    : product.fotoPrincipal
      ? [product.fotoPrincipal]
      : [];
  detailImageIndex = 0;
  renderDetailImage();

  document.querySelector("#detail-category").textContent =
    [product.categoria, product.subcategoria]
      .filter(Boolean)
      .join(" · ") || "Producto personalizado";
  document.querySelector("#detail-name").textContent = product.producto;
  document.querySelector("#detail-description").textContent =
    product.descripcion || "Pieza fabricada especialmente para vos.";
  document.querySelector("#detail-code").textContent =
    product.codigo || "—";
  document.querySelector("#detail-category-value").textContent =
    product.categoria || "Sin categoría";
  document.querySelector("#detail-subcategory").textContent =
    product.subcategoria || "Sin subcategoría";
  document.querySelector("#detail-material").textContent =
    product.material || "PLA";
  document.querySelector("#detail-size").textContent =
    product.tamano || "A consultar";
  document.querySelector("#detail-pack").textContent =
    `${product.cantidadPack || 1} unidad${
      Number(product.cantidadPack) === 1 ? "" : "es"
    }`;
  document.querySelector("#detail-price").textContent = money(
    product.precioVenta
  );
  document.querySelector("#detail-add").dataset.code = product.codigo;
  document.querySelector("#product-modal").classList.add("open");
  document.querySelector("#product-modal").setAttribute(
    "aria-hidden",
    "false"
  );
  document.body.classList.add("no-scroll");
  document.querySelector("#close-detail").focus();
  loadDetailImages(product.codigo);
}

async function loadDetailImages(code) {
  if (!config.apiUrl) return;
  try {
    if (!imageRequests.has(code)) {
      imageRequests.set(code, fetch(
        `${config.apiUrl}?action=images&code=${encodeURIComponent(code)}`
      ).then(response => response.json()));
    }
    const result = await imageRequests.get(code);
    if (
      !result.ok ||
      activeDetailCode !== code ||
      !Array.isArray(result.images) ||
      !result.images.length
    ) {
      return;
    }
    detailImages = [...new Set(result.images)];
    detailImageIndex = 0;
    renderDetailImage();
  } catch (error) {
    console.error("No se pudieron cargar todas las fotos.", error);
  }
}

function closeProductDetail() {
  activeDetailCode = "";
  document.querySelector("#product-modal").classList.remove("open");
  document.querySelector("#product-modal").setAttribute(
    "aria-hidden",
    "true"
  );
  document.body.classList.remove("no-scroll");
}

document.querySelector("#cart-button").onclick = openCart;
document.querySelector("#close-cart").onclick = closeCart;
document.querySelector("#overlay").onclick = closeCart;
document.querySelector("#close-detail").onclick = closeProductDetail;
document.querySelector("#gallery-prev").onclick = () =>
  changeDetailImage(-1);
document.querySelector("#gallery-next").onclick = () =>
  changeDetailImage(1);
let galleryTouchStart = 0;
document.querySelector("#detail-image").addEventListener(
  "touchstart",
  event => {
    galleryTouchStart = event.changedTouches[0].clientX;
  },
  {passive: true}
);
document.querySelector("#detail-image").addEventListener(
  "touchend",
  event => {
    const distance =
      event.changedTouches[0].clientX - galleryTouchStart;
    if (Math.abs(distance) > 45) {
      changeDetailImage(distance > 0 ? -1 : 1);
    }
  },
  {passive: true}
);
document.querySelector("#product-modal").addEventListener(
  "click",
  event => {
    if (event.target === event.currentTarget) closeProductDetail();
  }
);
document.querySelector("#detail-add").onclick = event => {
  addToCart(event.currentTarget.dataset.code);
  closeProductDetail();
};
searchNode.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", () => {
  populateSubcategoryFilter();
  document.querySelector("#selected-category-title").textContent =
    categoryFilter.value === "Todos"
      ? "Todas las piezas"
      : categoryFilter.value;
  renderProducts();
});
subcategoryFilter.addEventListener("change", renderProducts);
document.querySelector("#back-to-categories").onclick = showCategoryGateway;
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeCart();
    closeProductDetail();
  }
  if (
    document.querySelector("#product-modal").classList.contains("open")
  ) {
    if (event.key === "ArrowLeft") changeDetailImage(-1);
    if (event.key === "ArrowRight") changeDetailImage(1);
  }
});

document.querySelector("#whatsapp").onclick = () => {
  if (!cart.length) return;
  const number = String(config.whatsappNumber || "").replace(/\D/g, "");
  if (!number) {
    alert("Falta configurar el número de WhatsApp.");
    return;
  }
  const lines = cart.map(item =>
    `• ${item.quantity} × ${item.producto} (${item.codigo})`
  );
  const message = [
    "¡Hola! Quisiera consultar por estos productos:",
    "",
    ...lines,
    "",
    "¿Podemos coordinar colores y detalles?"
  ].join("\n");
  window.open(
    `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
};

document.querySelector("#share-catalog").onclick = async () => {
  const url = config.catalogShareUrl ||
    "https://catalogo-lovat-psi.vercel.app/";
  const status = document.querySelector("#share-status");
  const shareData = {
    title: "Catálogo · 3D Backdraft",
    text: "Mirá el catálogo de productos personalizados de 3D Backdraft.",
    url
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      status.textContent = "Catálogo compartido.";
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = url;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    status.textContent = "Enlace copiado. Ya podés pegarlo donde quieras.";
  } catch (error) {
    if (error.name !== "AbortError") {
      status.innerHTML =
        `Compartí este enlace: <a href="${url}">${url}</a>`;
    }
  }
};

async function loadProducts() {
  const empty = document.querySelector("#empty");
  try {
    if (!config.apiUrl) {
      throw new Error("El catálogo todavía no está conectado.");
    }
    const response = await fetch(`${config.apiUrl}?action=list`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error);
    products = (result.products || []).filter(product =>
      /^3DB/i.test(String(product.codigo || ""))
    );
    populateCategoryFilters();
    renderCategoryGateway();
    showCategoryGateway();
  } catch (error) {
    products = [];
    productsNode.innerHTML = "";
    empty.hidden = false;
    empty.textContent =
      "No pudimos cargar los productos. Intentá nuevamente en unos minutos.";
    console.error(error);
  }
}

saveCart();
loadProducts();
