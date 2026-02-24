/* ═══════════════════════════════════════
   GIFTESS – STOREFRONT LOGIC v2.0
   app.js  (requires config.js + Supabase CDN)
═══════════════════════════════════════ */
// 🔑 Defaults
const DEFAULT_WA = "916002698296"; // ← replace with your real WhatsApp number
/* ── Init Supabase ── */
/* ── Init Supabase ── */
const sb = window.supabase;



/* ── State ── */
let currentUser   = null;
let cartItems     = JSON.parse(localStorage.getItem('gft_cart') || '[]');
let allProducts   = [];
let allCategories = [];
let lbPhotos      = [], lbIdx = 0;
let storeSettings = { wa_number: DEFAULT_WA, shipping_fee: 99, free_shipping_min: 999, tax_enabled: false, tax_percent: 0, promo_codes: [] };
const custSel     = { box: '', products: [], msg: '' };

const EMOJIS = ['🎁','🥂','🛁','💕','🎂','🌸','🍫','🥃','🌹','💐'];
const GRADS  = [
  'linear-gradient(135deg,#ffd6e0,#ffb3cc)',
  'linear-gradient(135deg,#ffe5d5,#ffc5a0)',
  'linear-gradient(135deg,#ffe0f0,#ffadd4)',
  'linear-gradient(135deg,#ffe0e6,#ffb3c6)',
  'linear-gradient(135deg,#d0f0d0,#90c890)',
  'linear-gradient(135deg,#d0d8f8,#a0a8e8)',
];

/* ── Load Store Settings ── */
async function loadStoreSettings() {
  try {
    const { data } = await sb.from('store_settings').select('*').eq('id', 1).single();
    if (data) {
      storeSettings = { ...storeSettings, ...data };
      if (data.promo_codes && typeof data.promo_codes === 'string') {
        storeSettings.promo_codes = JSON.parse(data.promo_codes);
      }
    }
  } catch(e) { /* use defaults */ }
}
function getWaNum() { return storeSettings.wa_number || DEFAULT_WA; }

/* ════════════════════════════════════
   BOOT
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadStoreSettings();
  await checkSession();
  await loadHero();
  await loadCategories();
  await loadProducts();
  updateCartBadge();
  initReveal();
  initNavScroll();
});

/* ── Navbar scroll ── */
function initNavScroll() {
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

/* ── Auth session ── */
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await fetchProfile();
    renderNavUser();
  }
  sb.auth.onAuthStateChange((_e, session) => {
    currentUser = session?.user || null;
    if (currentUser) fetchProfile().then(renderNavUser);
    else renderNavUser();
  });
}

async function fetchProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentUser.profile = data;
}

/* ════════════════════════════════════
   HERO
════════════════════════════════════ */
async function loadHero() {
  const { data } = await sb.from('hero_settings').select('*').eq('id', 1).single();
  if (!data) return;
  const t = document.getElementById('heroTitle');
  const s = document.getElementById('heroSub');
  const b1 = document.getElementById('heroBtn1');
  const b2 = document.getElementById('heroBtn2');
  if (t)  t.textContent  = data.title    || 'Premium Customised Gift Hampers';
  if (s)  s.textContent  = data.subtitle || 'Crafted with love. Delivered with care.';
  if (b1) b1.textContent = data.btn1     || 'Shop Now';
  if (b2) b2.textContent = data.btn2     || 'Create Your Own Hamper';
}

/* ════════════════════════════════════
   CATEGORIES
════════════════════════════════════ */
async function loadCategories() {
  const { data } = await sb.from('categories').select('*').eq('status', 'active').order('display_order');
  if (!data || !data.length) return;
  allCategories = data;

  const catGrid = document.getElementById('catGrid');
  if (!catGrid) return;

  const bgClasses = ['bg1','bg2','bg3','bg4','bg5','bg6'];
  catGrid.innerHTML = data.map((c, i) => {
    const imgContent = c.photo
      ? `<img src="${c.photo}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span style="font-size:3rem;display:none;align-items:center;justify-content:center;width:100%;height:100%">${c.emoji || '🎁'}</span>`
      : `<span style="font-size:3rem">${c.emoji || '🎁'}</span>`;
    return `
    <div class="cat-card reveal" onclick="${c.slug === 'custom' ? "openCustomModal()" : `filterCat('${c.slug}')`}">
      <div class="cat-img ${bgClasses[i % bgClasses.length]}" style="${c.photo ? 'padding:0;overflow:hidden;' : ''}">${imgContent}</div>
      <span class="cat-label">${c.name}</span>
    </div>`;
  }).join('');
  initReveal();
}

/* ════════════════════════════════════
   PRODUCTS
════════════════════════════════════ */
async function loadProducts(cat = '') {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner">Loading products…</div>';

  let query = sb.from('products').select('*').eq('status', 'active');
  if (!cat) query = query.eq('featured', true);
  if (cat)  query = query.eq('category', cat);
  query = query.order('created_at', { ascending: false }).limit(8);

  const { data, error } = await query;
  if (error) { grid.innerHTML = '<div class="no-products">Failed to load products.</div>'; return; }

  allProducts = data || [];
  renderProductCards(allProducts, 'productsGrid');
}

function renderProductCards(prods, gridId = 'productsGrid') {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (!prods.length) { grid.innerHTML = '<div class="no-products">No products found.</div>'; return; }

  grid.innerHTML = prods.map((p, i) => {
    const hasPhotos = p.photos && p.photos.length > 0;
    const imgContent = hasPhotos
      ? `<img src="${p.photos[0]}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'prod-emoji\\' style=\\'background:${GRADS[i % GRADS.length]};width:100%;height:100%;display:flex;align-items:center;justify-content:center;\\'>${EMOJIS[i % EMOJIS.length]}</div>'"/>`
      : `<div class="prod-emoji" style="background:${GRADS[i % GRADS.length]};width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${EMOJIS[i % EMOJIS.length]}</div>`;

    const dots = hasPhotos && p.photos.length > 1
      ? `<div class="img-dots">${p.photos.map((_, j) => `<div class="img-dot${j === 0 ? ' active' : ''}"></div>`).join('')}</div>`
      : '';

    return `
    <div class="product-card reveal">
      <div class="prod-img-wrap" onclick="openLightbox('${p.id}',0)">
        ${imgContent}
        ${p.price_old > p.price_sale ? '<span class="prod-badge">SALE</span>' : ''}${dots}
      </div>
      <div class="prod-info">
        <h3>${p.name}</h3>
        ${p.description ? `<p class="prod-desc">${p.description.substring(0,80)}…</p>` : ''}
        <div class="price-wrap">
          ${p.price_old > p.price_sale ? `<span class="price-old">₹${Number(p.price_old).toLocaleString('en-IN')}</span>` : ''}
          <span class="price-new">₹${Number(p.price_sale).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div class="prod-btns">
        <button class="btn-cart btn-dark" onclick="addToCart('${p.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          Add to Cart
        </button>
      </div>
    </div>`;
  }).join('');

  initReveal();
}

function filterCat(cat) {
  if (document.getElementById('productsGrid')) {
    loadProducts(cat);
    document.getElementById('bestsellers')?.scrollIntoView({ behavior: 'smooth' });
    toast(`Showing ${cat} gifts!`, 'info');
  }
}

/* ════════════════════════════════════
   LIGHTBOX
════════════════════════════════════ */
function openLightbox(prodId, startIdx) {
  const pool = (typeof allPageProducts !== 'undefined' && allPageProducts.length) ? allPageProducts : allProducts;
  const p = pool.find(x => x.id === prodId);
  if (!p || !p.photos || !p.photos.length) return;
  lbPhotos = p.photos; lbIdx = startIdx;
  document.getElementById('lbImg').src = lbPhotos[lbIdx];
  document.getElementById('lightbox').classList.add('open');
}
function closeLb() { document.getElementById('lightbox').classList.remove('open'); }
function lbNav(dir) {
  lbIdx = (lbIdx + dir + lbPhotos.length) % lbPhotos.length;
  document.getElementById('lbImg').src = lbPhotos[lbIdx];
}

/* ════════════════════════════════════
   ORDER ID GENERATOR
════════════════════════════════════ */
function generateOrderId() {
  const now  = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `GF-${date}-${rand}`;
}

/* ════════════════════════════════════
   CART
════════════════════════════════════ */
function addToCart(prodId) {
  const pool = (typeof allPageProducts !== 'undefined' && allPageProducts.length) ? allPageProducts : allProducts;
  const p    = pool.find(x => x.id === prodId);
  if (!p) return;
  const ex = cartItems.find(c => c.id === prodId);
  if (ex) ex.qty++;
  else cartItems.push({ id: prodId, name: p.name, price: p.price_sale, qty: 1, photo: (p.photos && p.photos[0]) || '' });
  saveCart();
  updateCartBadge();
  toast(`${p.name} added to cart!`, 'success');
}

function saveCart() { localStorage.setItem('gft_cart', JSON.stringify(cartItems)); }
function updateCartBadge() {
  document.querySelectorAll('#cartBadge').forEach(b => {
    b.textContent = cartItems.reduce((a, c) => a + c.qty, 0);
  });
}

function calcCartTotals(promoDiscount = 0) {
  const subtotal = cartItems.reduce((a, c) => a + c.price * c.qty, 0);
  const shipping  = subtotal >= storeSettings.free_shipping_min ? 0 : (storeSettings.shipping_fee || 0);
  const afterPromo = Math.max(0, subtotal - promoDiscount);
  const taxAmount  = storeSettings.tax_enabled ? Math.round(afterPromo * (storeSettings.tax_percent || 0) / 100) : 0;
  const total      = afterPromo + shipping + taxAmount;
  return { subtotal, shipping, promoDiscount, taxAmount, total };
}

function openCart() {
  const wrap  = document.getElementById('cartItemsWrap');
  const total = document.getElementById('cartTotal');
  if (!wrap) return;
  if (!cartItems.length) {
    wrap.innerHTML  = '<p style="text-align:center;padding:2rem;color:var(--gray)">Your cart is empty 🛒</p>';
    if (total) total.innerHTML = '';
    return openModal('cartModal');
  }
  wrap.innerHTML = cartItems.map((c, i) => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${c.photo ? `<img src="${c.photo}" alt="${c.name}" onerror="this.style.display='none'"/>` : '🎁'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-sub">₹${Number(c.price).toLocaleString('en-IN')} each</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="cartQty(${i},-1)">−</button>
        <span>${c.qty}</span>
        <button class="qty-btn" onclick="cartQty(${i},1)">+</button>
        <button class="cart-remove" onclick="cartRemove(${i})" title="Remove">×</button>
      </div>
      <div class="cart-item-price">₹${Number(c.price * c.qty).toLocaleString('en-IN')}</div>
    </div>`).join('');

  renderCartTotals();
  openModal('cartModal');
}

function renderCartTotals(promoDiscount = 0) {
  const total = document.getElementById('cartTotal');
  if (!total) return;
  const t = calcCartTotals(promoDiscount);
  let html = `<div class="cart-totals">`;
  html += `<div class="ct-row"><span>Subtotal</span><span>₹${Number(t.subtotal).toLocaleString('en-IN')}</span></div>`;
  if (t.promoDiscount > 0)
    html += `<div class="ct-row discount"><span>Promo Discount</span><span>-₹${Number(t.promoDiscount).toLocaleString('en-IN')}</span></div>`;
  if (t.shipping === 0)
    html += `<div class="ct-row success"><span>Shipping</span><span>FREE</span></div>`;
  else
    html += `<div class="ct-row"><span>Shipping</span><span>₹${Number(t.shipping).toLocaleString('en-IN')}</span></div>`;
  if (t.taxAmount > 0)
    html += `<div class="ct-row"><span>Tax (${storeSettings.tax_percent}%)</span><span>₹${Number(t.taxAmount).toLocaleString('en-IN')}</span></div>`;
  html += `<div class="ct-row total"><span>Total</span><span>₹${Number(t.total).toLocaleString('en-IN')}</span></div>`;
  if (t.shipping > 0)
    html += `<div class="ct-shipping-note">Free shipping on orders over ₹${Number(storeSettings.free_shipping_min).toLocaleString('en-IN')}</div>`;
  html += `</div>`;
  total.innerHTML = html;
}

function cartQty(i, d) {
  cartItems[i].qty += d;
  if (cartItems[i].qty <= 0) cartItems.splice(i, 1);
  saveCart(); updateCartBadge(); openCart();
}
function cartRemove(i) { cartItems.splice(i, 1); saveCart(); updateCartBadge(); openCart(); }

/* ════════════════════════════════════
   PROMO CODE (in cart)
════════════════════════════════════ */
let appliedPromo = null;

function applyPromoCode() {
  const input  = document.getElementById('promoInput');
  const code   = (input?.value || '').trim().toUpperCase();
  const msg    = document.getElementById('promoMsg');
  appliedPromo = null;
  if (!code) { if (msg) msg.textContent = ''; return; }

  const promos = storeSettings.promo_codes || [];
  const found  = promos.find(p => p.code && p.code.toUpperCase() === code && p.active !== false);
  if (!found) {
    if (msg) { msg.textContent = 'Invalid promo code.'; msg.className = 'promo-msg error'; }
    renderCartTotals(0);
    return;
  }
  const subtotal = cartItems.reduce((a, c) => a + c.price * c.qty, 0);
  let discount = 0;
  if (found.type === 'percent') discount = Math.round(subtotal * found.value / 100);
  else discount = Math.min(found.value, subtotal);

  appliedPromo = { ...found, discount };
  if (msg) { msg.textContent = `Promo applied! -₹${discount}`; msg.className = 'promo-msg success'; }
  renderCartTotals(discount);
}

/* ════════════════════════════════════
   CHECKOUT – Delivery Details
════════════════════════════════════ */
function doCheckout() {
  if (!cartItems.length) return;
  closeModal('cartModal');
  // Pre-fill from profile
  const p = currentUser?.profile;
  if (p) {
    const n = document.getElementById('chkName');
    const ph = document.getElementById('chkPhone');
    if (n) n.value = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (ph) ph.value = p.phone || '';
  }
  if (currentUser?.email) {
    const em = document.getElementById('chkEmail');
    if (em) em.value = currentUser.email;
  }
  // Show order summary in checkout modal
  renderCheckoutSummary();
  openModal('checkoutModal');
}

function renderCheckoutSummary() {
  const disc  = appliedPromo?.discount || 0;
  const t     = calcCartTotals(disc);
  const el    = document.getElementById('checkoutSummary');
  if (!el) return;
  el.innerHTML = `
    <h4>Order Summary</h4>
    <div class="chk-items">
      ${cartItems.map(c => `<div class="chk-item"><span>${c.name} ×${c.qty}</span><span>₹${Number(c.price * c.qty).toLocaleString('en-IN')}</span></div>`).join('')}
    </div>
    <div class="chk-totals">
      <div class="ct-row"><span>Subtotal</span><span>₹${Number(t.subtotal).toLocaleString('en-IN')}</span></div>
      ${t.promoDiscount > 0 ? `<div class="ct-row discount"><span>Promo Discount</span><span>-₹${Number(t.promoDiscount).toLocaleString('en-IN')}</span></div>` : ''}
      <div class="ct-row ${t.shipping === 0 ? 'success' : ''}"><span>Shipping</span><span>${t.shipping === 0 ? 'FREE' : '₹' + Number(t.shipping).toLocaleString('en-IN')}</span></div>
      ${t.taxAmount > 0 ? `<div class="ct-row"><span>Tax (${storeSettings.tax_percent}%)</span><span>₹${Number(t.taxAmount).toLocaleString('en-IN')}</span></div>` : ''}
      <div class="ct-row total"><span>Total</span><span>₹${Number(t.total).toLocaleString('en-IN')}</span></div>
    </div>`;
}

async function placeOrder() {
  // Validate fields
  const name    = (document.getElementById('chkName')?.value || '').trim();
  const phone   = (document.getElementById('chkPhone')?.value || '').trim();
  const email   = (document.getElementById('chkEmail')?.value || '').trim();
  const pincode = (document.getElementById('chkPin')?.value || '').trim();
  const address = (document.getElementById('chkAddress')?.value || '').trim();

  clearId('chkNameErr','chkPhoneErr','chkEmailErr','chkPinErr','chkAddressErr');

  let ok = true;
  if (!name)               { setText('chkNameErr', 'Full name is required'); ok = false; }
  if (!phone || phone.length < 10) { setText('chkPhoneErr', 'Valid phone number required'); ok = false; }
  if (!email.includes('@')) { setText('chkEmailErr', 'Valid email required'); ok = false; }
  if (!pincode || pincode.length < 6) { setText('chkPinErr', '6-digit PIN code required'); ok = false; }
  if (!address)            { setText('chkAddressErr', 'Full delivery address required'); ok = false; }
  if (!ok) return;

  const disc    = appliedPromo?.discount || 0;
  const t       = calcCartTotals(disc);
  const orderId = generateOrderId();

  // Build WhatsApp message
  const itemLines = cartItems.map(c => `• ${c.name} ×${c.qty} = ₹${Number(c.price * c.qty).toLocaleString('en-IN')}`).join('\n');
  const waMsg = encodeURIComponent(
    `*New Order from Giftess Website!*\n` +
    `*Order ID:* ${orderId}\n\n` +
    `*Customer Details:*\n` +
    `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\n\n` +
    `*Delivery Address:*\n${address}\nPIN: ${pincode}\n\n` +
    `*Items Ordered:*\n${itemLines}\n\n` +
    `Subtotal: ₹${Number(t.subtotal).toLocaleString('en-IN')}\n` +
    (disc > 0 ? `Promo (${appliedPromo?.code}): -₹${Number(disc).toLocaleString('en-IN')}\n` : '') +
    `Shipping: ${t.shipping === 0 ? 'FREE' : '₹' + Number(t.shipping).toLocaleString('en-IN')}\n` +
    (t.taxAmount > 0 ? `Tax: ₹${Number(t.taxAmount).toLocaleString('en-IN')}\n` : '') +
    `*TOTAL: ₹${Number(t.total).toLocaleString('en-IN')}*`
  );

  // Save to Supabase
  const { error } = await sb.from('orders').insert({
    order_id:        orderId,
    customer_name:   name,
    customer_email:  email,
    customer_phone:  phone,
    delivery_address: address,
    pincode:         pincode,
    user_id:         currentUser?.id || null,
    items:           cartItems,
    subtotal:        t.subtotal,
    shipping_fee:    t.shipping,
    discount:        disc,
    tax_amount:      t.taxAmount,
    total:           t.total,
    promo_code:      appliedPromo?.code || null,
    status:          'pending',
  });

  if (error) {
    toast('Failed to save order. Please try again.', 'error');
    console.error(error);
    return;
  }

  // Open WhatsApp
  window.open(`https://wa.me/${getWaNum()}?text=${waMsg}`, '_blank');

  // Reset
  cartItems = []; appliedPromo = null;
  saveCart(); updateCartBadge();
  closeModal('checkoutModal');
  showOrderSuccess(orderId, t.total);
}

function showOrderSuccess(orderId, total) {
  const el = document.getElementById('orderSuccessId');
  if (el) el.textContent = orderId;
  const tel = document.getElementById('orderSuccessTotal');
  if (tel) tel.textContent = '₹' + Number(total).toLocaleString('en-IN');
  openModal('orderSuccessModal');
}

/* ════════════════════════════════════
   MY ORDERS
════════════════════════════════════ */
async function loadMyOrders() {
  if (!currentUser) {
    document.getElementById('myOrdersList').innerHTML =
      '<p style="text-align:center;color:var(--gray)">Please login to view your orders.</p>';
    return;
  }
  const list = document.getElementById('myOrdersList');
  list.innerHTML = '<p style="color:var(--gray);text-align:center;">Loading…</p>';
  const { data, error } = await sb.from('orders')
    .select('*').eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error || !data || !data.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--gray)">No orders found.</p>';
    return;
  }

  const statusColors = { pending:'#856404', processing:'#0c5460', shipped:'#004085', delivered:'#155724', cancelled:'#721c24' };
  const statusBg     = { pending:'#fff3cd', processing:'#d1ecf1', shipped:'#cce5ff', delivered:'#d4edda', cancelled:'#f8d7da' };

  list.innerHTML = data.map(o => {
    const items    = Array.isArray(o.items) ? o.items.map(i => `${i.name} ×${i.qty}`).join(', ') : (o.items || '—');
    const color    = statusColors[o.status] || '#333';
    const bg       = statusBg[o.status] || '#eee';
    const tracking = (o.status === 'shipped' || o.status === 'delivered') && o.tracking_link
      ? `<a href="${o.tracking_link}" target="_blank" class="tracking-link-btn">🚚 Track Order</a>`
      : (o.status === 'shipped' ? '<span style="font-size:.8rem;color:var(--gray)">Tracking coming soon…</span>' : '');
    return `
    <div class="my-order-card">
      <div class="my-order-header">
        <div>
          <div class="my-order-id">${o.order_id || '#' + o.id}</div>
          <div class="my-order-date">${o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : ''}</div>
        </div>
        <span class="my-order-status" style="background:${bg};color:${color};">${o.status}</span>
      </div>
      <div class="my-order-items">${items}</div>
      <div class="my-order-footer">
        <strong>Total: ₹${Number(o.total || 0).toLocaleString('en-IN')}</strong>
        ${tracking}
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════
   MODAL HELPERS
════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (id === 'myOrdersModal') loadMyOrders();
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); });
  });
});

/* ════════════════════════════════════
   AUTH
════════════════════════════════════ */
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('loginPane').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('registerPane').style.display = tab === 'register' ? 'block' : 'none';
  clearId('loginEmailErr','loginErr','regFirstErr','regEmailErr','regPwErr','regPw2Err');
}

async function doLogin() {
  clearId('loginEmailErr','loginErr');
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPw').value;
  if (!email) { setText('loginEmailErr','Email required'); return; }
  if (!pw)    { setText('loginErr','Password required'); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) { setText('loginErr', error.message); return; }
  closeModal('authModal');
  toast('Welcome back!', 'success');
}

async function doRegister() {
  clearId('regFirstErr','regEmailErr','regPwErr','regPw2Err');
  const first = document.getElementById('regFirst').value.trim();
  const last  = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pw    = document.getElementById('regPw').value;
  const pw2   = document.getElementById('regPw2').value;
  let ok = true;
  if (!first)               { setText('regFirstErr','First name required'); ok = false; }
  if (!email.includes('@')) { setText('regEmailErr','Valid email required'); ok = false; }
  if (pw.length < 6)        { setText('regPwErr','Min 6 characters'); ok = false; }
  if (pw !== pw2)           { setText('regPw2Err','Passwords do not match'); ok = false; }
  if (!ok) return;
  const { data, error } = await sb.auth.signUp({ email, password: pw });
  if (error) { setText('regEmailErr', error.message); return; }
  if (data.user) await sb.from('profiles').insert({ id: data.user.id, first_name: first, last_name: last, phone, role: 'user' });
  closeModal('authModal');
  toast(`Account created! Welcome, ${first}!`, 'success');
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  renderNavUser();
  toast('Logged out successfully', 'info');
}

function renderNavUser() {
  const btnLogin    = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const chip        = document.getElementById('userChip');
  const chipName    = document.getElementById('chipName');
  if (currentUser) {
    if (btnLogin)    btnLogin.style.display    = 'none';
    if (btnRegister) btnRegister.style.display = 'none';
    if (chip)        chip.style.display        = 'flex';
    const p = currentUser.profile;
    if (chipName) chipName.textContent = p ? `${p.first_name} ${p.last_name || ''}`.trim() : currentUser.email;
  } else {
    if (btnLogin)    btnLogin.style.display    = '';
    if (btnRegister) btnRegister.style.display = '';
    if (chip)        chip.style.display        = 'none';
  }
}

/* ════════════════════════════════════
   CUSTOMISER
════════════════════════════════════ */
async function openCustomModal() {
  openModal('customModal');
  await loadCsProducts();
}
async function loadCsProducts() {
  const grid = document.getElementById('csProductsGrid');
  if (!grid) return;
  const pool = (typeof allPageProducts !== 'undefined' && allPageProducts.length) ? allPageProducts : allProducts;
  if (pool.length) { renderCsProducts(pool); return; }
  const { data } = await sb.from('products').select('*').eq('status', 'active').order('name');
  allProducts = data || [];
  renderCsProducts(allProducts);
}
function renderCsProducts(prods) {
  const grid = document.getElementById('csProductsGrid');
  if (!grid) return;
  if (!prods.length) { grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray);">No products available.</div>'; return; }
  grid.innerHTML = prods.map((p, i) => {
    const thumb = p.photos && p.photos.length
      ? `<img src="${p.photos[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`
      : `<div style="font-size:1.6rem;background:${GRADS[i%GRADS.length]};width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${EMOJIS[i%EMOJIS.length]}</div>`;
    return `
    <div class="cs-product-item" id="csp-${p.id}" onclick="toggleCsProduct('${p.id}', '${p.name.replace(/'/g,"\\'")}', ${p.price_sale})">
      <div class="cs-prod-thumb">${thumb}</div>
      <div class="cs-prod-name">${p.name}</div>
      <div class="cs-prod-price">₹${Number(p.price_sale).toLocaleString('en-IN')}</div>
      <div class="cs-check">✓</div>
    </div>`;
  }).join('');
}
function toggleCsProduct(id, name, price) {
  const el  = document.getElementById('csp-' + id);
  const idx = custSel.products.findIndex(p => p.id === id);
  if (idx === -1) { custSel.products.push({ id, name, price }); el.classList.add('sel'); }
  else            { custSel.products.splice(idx, 1); el.classList.remove('sel'); }
  const countEl = document.getElementById('csProductCount');
  if (countEl) {
    const n = custSel.products.length;
    countEl.textContent = `${n} product${n !== 1 ? 's' : ''} selected${n < 5 ? ` (need ${5 - n} more)` : ' ✓'}`;
    countEl.style.color = n >= 5 ? '#27ae60' : 'var(--gray)';
  }
}
function csGoStep3() {
  if (custSel.products.length < 5) { toast(`Please select at least 5 products (${custSel.products.length} selected)`, 'error'); return; }
  csGo(3);
}
function csGo(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('cs' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  }
  document.querySelectorAll('.prog-dot').forEach((d, i) => d.classList.toggle('active', i < n));
  if (n === 4) buildCsSummary();
}
function selOpt(el, key, val) {
  el.closest('.modal-opts').querySelectorAll('.modal-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel'); custSel[key] = val;
}
function buildCsSummary() {
  custSel.msg = document.getElementById('csMsg')?.value || '';
  const prodsList = custSel.products.map(p => `• ${p.name} (₹${Number(p.price).toLocaleString('en-IN')})`).join('<br>');
  const total = custSel.products.reduce((a, p) => a + p.price, 0);
  const el    = document.getElementById('csSummary');
  if (el) el.innerHTML =
    `<b>Box:</b> ${custSel.box || 'Not selected'}<br>
     <b>Products (${custSel.products.length}):</b><br>${prodsList || 'None'}<br><br>
     <b>Message:</b> ${custSel.msg || 'No message'}<br><br>
     <b>Estimated Total:</b> ₹${Number(total).toLocaleString('en-IN')} + box charge`;
}
async function csOrder() {
  const orderId  = generateOrderId();
  const prodList = custSel.products.map(p => p.name).join(', ');
  const total    = custSel.products.reduce((a, p) => a + p.price, 0);
  const msg = encodeURIComponent(
    `*Custom Hamper Order – Giftess*\nOrder ID: ${orderId}\nBox: ${custSel.box||'TBD'}\nProducts: ${prodList}\n${custSel.msg ? 'Message: '+custSel.msg : ''}\nEst. Total: ₹${Number(total).toLocaleString('en-IN')}`
  );
  window.open(`https://wa.me/${getWaNum()}?text=${msg}`, '_blank');
  const name = currentUser?.profile?.first_name
    ? `${currentUser.profile.first_name} ${currentUser.profile.last_name || ''}`
    : 'Guest';
  await sb.from('orders').insert({
    order_id: orderId, customer_name: name,
    customer_email: currentUser?.email || 'guest',
    user_id: currentUser?.id || null,
    items: custSel.products, total, status: 'pending',
    notes: `Custom Hamper. Box: ${custSel.box}. Message: ${custSel.msg}`,
  });
  closeModal('customModal');
  toast(`Custom hamper order ${orderId} placed!`, 'success');
  custSel.box = ''; custSel.products = []; custSel.msg = '';
}

/* ════════════════════════════════════
   NAV
════════════════════════════════════ */
function toggleNav() { document.getElementById('navLinks').classList.toggle('open'); }

/* ════════════════════════════════════
   TOAST
════════════════════════════════════ */
function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = `show ${type}`;
  clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 2600);
}

/* ════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════ */
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.vis)');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
}

/* ── Utils ── */
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function clearId(...ids)  { ids.forEach(id => setText(id, '')); }
