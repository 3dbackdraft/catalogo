const config = window.BACKDRAFT_CONFIG || {};
const productsNode = document.querySelector("#products");
const categoriesNode = document.querySelector("#categories");
const searchNode = document.querySelector("#search");
let products = [];
let activeCategory = "Todos";
let cart = JSON.parse(localStorage.getItem("3db-cart") || "[]");

const demoProducts = [
  {codigo:"3DB-012",categoria:"Juegos de mesa",producto:"Rompecabezas numérico 3×3",descripcion:"Un desafío compacto, educativo y totalmente personalizable.",precioVenta:2500,destacado:true},
  {codigo:"3DB-013",categoria:"Juegos de mesa",producto:"Rompecabezas numérico 4×4",descripcion:"Más combinaciones para ejercitar lógica y paciencia.",precioVenta:3000},
  {codigo:"3DB-015",categoria:"Juegos de mesa",producto:"Rompecabezas numérico 6×6",descripcion:"Una versión avanzada para quienes buscan un gran desafío.",precioVenta:6000},
  {codigo:"3DB-007",categoria:"Juegos de mesa",producto:"Batalla naval",descripcion:"El clásico juego de estrategia fabricado en colores a elección.",precioVenta:0},
  {codigo:"3DB-002",categoria:"Llaveros",producto:"Huesito personalizado",descripcion:"Llavero con nombre y colores personalizados.",precioVenta:0},
  {codigo:"3DB-004",categoria:"Decoración",producto:"Revólveres decorativos",descripcion:"Piezas decorativas disponibles en distintos packs.",precioVenta:0}
];

const money = value => Number(value)>0 ? new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(value) : "Consultar";
const escapeHtml = value => String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function renderCategories(){
  const categories = ["Todos",...new Set(products.map(p=>p.categoria).filter(Boolean))];
  categoriesNode.innerHTML = categories.map(category=>`<button class="chip ${category===activeCategory?"active":""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
  categoriesNode.querySelectorAll("button").forEach(button=>button.onclick=()=>{activeCategory=button.dataset.category;renderCategories();renderProducts()});
}

function renderProducts(){
  const query = searchNode.value.toLowerCase().trim();
  const filtered = products.filter(product=>{
    const categoryMatch = activeCategory==="Todos" || product.categoria===activeCategory;
    const text = `${product.producto} ${product.descripcion} ${product.codigo}`.toLowerCase();
    return categoryMatch && text.includes(query);
  });
  document.querySelector("#result-count").textContent = `${filtered.length} producto${filtered.length===1?"":"s"}`;
  document.querySelector("#empty").hidden = filtered.length>0;
  productsNode.innerHTML = filtered.map(product=>`
    <article class="product" data-product-code="${escapeHtml(product.codigo)}" tabindex="0" role="button" aria-label="Ver detalles de ${escapeHtml(product.producto)}">
      <div class="product-image">
        ${product.fotoPrincipal?`<img src="${escapeHtml(product.fotoPrincipal)}" alt="${escapeHtml(product.producto)}" loading="lazy">`:`<span class="placeholder">3D</span>`}
        ${product.destacado?'<span class="badge">DESTACADO</span>':""}
      </div>
      <div class="product-body">
        <small>${escapeHtml(product.categoria)}</small>
        <h3>${escapeHtml(product.producto)}</h3>
        <p>${escapeHtml(product.descripcion)}</p>
        <div class="buy-row"><span class="price">${money(product.precioVenta)}</span><button class="add" data-code="${escapeHtml(product.codigo)}">Agregar</button></div>
      </div>
    </article>`).join("");
  productsNode.querySelectorAll(".add").forEach(button=>button.onclick=()=>addToCart(button.dataset.code));
  productsNode.querySelectorAll(".product").forEach(card=>{
    card.addEventListener("click",event=>{
      if(event.target.closest(".add")) return;
      openProductDetail(card.dataset.productCode);
    });
    card.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        openProductDetail(card.dataset.productCode);
      }
    });
  });
}

function addToCart(code){
  const product = products.find(item=>item.codigo===code);
  const existing = cart.find(item=>item.codigo===code);
  if(existing) existing.quantity += 1;
  else cart.push({codigo:product.codigo,producto:product.producto,precioVenta:Number(product.precioVenta)||0,quantity:1});
  saveCart();
  openCart();
}

function saveCart(){
  localStorage.setItem("3db-cart",JSON.stringify(cart));
  document.querySelector("#cart-count").textContent = cart.reduce((sum,item)=>sum+item.quantity,0);
  document.querySelector("#cart-total").textContent = money(cart.reduce((sum,item)=>sum+item.precioVenta*item.quantity,0));
  document.querySelector("#cart-items").innerHTML = cart.length ? cart.map(item=>`
    <div class="cart-item"><strong>${escapeHtml(item.producto)}</strong><small>${item.quantity} × ${money(item.precioVenta)}</small><button data-code="${escapeHtml(item.codigo)}" aria-label="Quitar">×</button></div>`).join("") : '<p class="cart-empty">Todavía no agregaste productos.</p>';
  document.querySelectorAll(".cart-item button").forEach(button=>button.onclick=()=>{cart=cart.filter(item=>item.codigo!==button.dataset.code);saveCart()});
}

function openCart(){document.querySelector("#cart").classList.add("open");document.querySelector("#overlay").classList.add("open");document.querySelector("#cart").setAttribute("aria-hidden","false");document.querySelector("#cart-button").setAttribute("aria-expanded","true")}
function closeCart(){document.querySelector("#cart").classList.remove("open");document.querySelector("#overlay").classList.remove("open");document.querySelector("#cart").setAttribute("aria-hidden","true");document.querySelector("#cart-button").setAttribute("aria-expanded","false")}

function openProductDetail(code){
  const product = products.find(item=>item.codigo===code);
  if(!product) return;
  const imageNode = document.querySelector("#detail-image");
  imageNode.innerHTML = product.fotoPrincipal
    ? `<img src="${escapeHtml(product.fotoPrincipal)}" alt="${escapeHtml(product.producto)}">`
    : '<span class="placeholder">3D</span>';
  document.querySelector("#detail-category").textContent = product.categoria || "Producto 3D";
  document.querySelector("#detail-name").textContent = product.producto;
  document.querySelector("#detail-description").textContent = product.descripcion || "Pieza fabricada especialmente para vos.";
  document.querySelector("#detail-code").textContent = product.codigo || "—";
  document.querySelector("#detail-material").textContent = product.material || "PLA";
  document.querySelector("#detail-size").textContent = product.tamano || "A consultar";
  document.querySelector("#detail-pack").textContent = `${product.cantidadPack || 1} unidad${Number(product.cantidadPack)===1?"":"es"}`;
  document.querySelector("#detail-price").textContent = money(product.precioVenta);
  document.querySelector("#detail-add").dataset.code = product.codigo;
  document.querySelector("#product-modal").classList.add("open");
  document.querySelector("#product-modal").setAttribute("aria-hidden","false");
  document.body.classList.add("no-scroll");
  document.querySelector("#close-detail").focus();
}

function closeProductDetail(){
  document.querySelector("#product-modal").classList.remove("open");
  document.querySelector("#product-modal").setAttribute("aria-hidden","true");
  document.body.classList.remove("no-scroll");
}

document.querySelector("#cart-button").onclick=openCart;
document.querySelector("#close-cart").onclick=closeCart;
document.querySelector("#overlay").onclick=closeCart;
document.querySelector("#close-detail").onclick=closeProductDetail;
document.querySelector("#product-modal").addEventListener("click",event=>{
  if(event.target===event.currentTarget) closeProductDetail();
});
document.querySelector("#detail-add").onclick=event=>{
  addToCart(event.currentTarget.dataset.code);
  closeProductDetail();
};
searchNode.addEventListener("input",renderProducts);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeProductDetail()}});

document.querySelector("#whatsapp").onclick=()=>{
  if(!cart.length) return;
  const number = String(config.whatsappNumber||"").replace(/\D/g,"");
  if(!number){alert("Falta configurar el número de WhatsApp en config.js.");return}
  const lines = cart.map(item=>`• ${item.quantity} × ${item.producto} (${item.codigo})`);
  const message = ["¡Hola! Quisiera consultar por estos productos:","",...lines,"","¿Podemos coordinar colores y detalles?"].join("\n");
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,"_blank","noopener");
};

async function loadProducts(){
  try{
    if(!config.apiUrl) throw new Error("Modo demostración");
    const response = await fetch(`${config.apiUrl}?action=list`);
    const result = await response.json();
    if(!result.ok) throw new Error(result.error);
    products = result.products;
  }catch(_){products = demoProducts}
  renderCategories();
  renderProducts();
}
saveCart();
loadProducts();
