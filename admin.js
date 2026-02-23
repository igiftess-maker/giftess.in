/* ═══════════════════════════════════════
   GIFTESS – ADMIN PANEL LOGIC v2.0
   admin.js  (requires config.js + Supabase CDN)
═══════════════════════════════════════ */

/* ── Init Supabase ── */
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── State ── */
let adminUser      = null;
let allProducts    = [];
let allOrders      = [];
let allUsers       = [];
let allCategories  = [];
let editingPhotos  = [];
let editingCatPhoto = null;
let editingOrderId = null;
let _statusFilter  = '';

/* ════════════════════════════════════
   BOOT
════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  sb.auth.getSession().then(async ({ data: { session } }) => {
    if (session) {
      adminUser = session.user;
      const { data: profile } = await sb.from('profiles').select('*').eq('id', adminUser.id).single();
      if (profile && profile.role === 'admin') showAdminApp();
    }
  });
});

/* ════════════════════════════════════
   LOGIN GATE
════════════════════════════════════ */
async function gateLogin() {
  clearErrs('gateEmailErr', 'gatePwErr');
  const email = document.getElementById('gateEmail').value.trim();
  const pw    = document.getElementById('gatePw').value;
  if (!email) { document.getElementById('gateEmailErr').textContent = 'Email required'; return; }
  if (!pw)    { document.getElementById('gatePwErr').textContent    = 'Password required'; return; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) { document.getElementById('gatePwErr').textContent = 'Invalid credentials'; return; }

  const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
  if (!profile || profile.role !== 'admin') {
    await sb.auth.signOut();
    document.getElementById('gatePwErr').textContent = 'Access denied. Admin accounts only.';
    return;
  }
  adminUser = data.user;
  showAdminApp();
}

function showAdminApp() {
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('adminApp').style.display  = 'flex';
  document.getElementById('adminEmail').textContent  = adminUser.email;
  goPanel('dashboard', document.querySelector('.nav-item'));
}

async function adminLogout() {
  await sb.auth.signOut();
  adminUser = null;
  document.getElementById('adminApp').style.display  = 'none';
  document.getElementById('loginGate').style.display = 'flex';
}

/* ════════════════════════════════════
   NAVIGATION
════════════════════════════════════ */
function goPanel(name, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  const titles = { dashboard:'Dashboard', products:'Products', categories:'Categories', orders:'Orders', users:'Users', hero:'Hero Banner', settings:'Settings' };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  if (name === 'dashboard')  loadDashboard();
  if (name === 'products')   loadProductsTable();
  if (name === 'categories') loadCategoriesTable();
  if (name === 'orders')     loadOrdersTable();
  if (name === 'users')      loadUsersTable();
  if (name === 'hero')       loadHeroEditor();
  if (name === 'settings')   loadSettings();
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

/* ════════════════════════════════════
   DASHBOARD
════════════════════════════════════ */
async function loadDashboard() {
  const [{ data: prods }, { data: orders }, { data: users }] = await Promise.all([
    sb.from('products').select('id, status'),
    sb.from('orders').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('id'),
  ]);
  const revenue = (orders || []).filter(o => o.status === 'delivered').reduce((a, o) => a + (o.total || 0), 0);
  const pendingCount = (orders || []).filter(o => o.status === 'pending').length;
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><div class="stat-icon si1">🎁</div><div><div class="stat-val">${(prods||[]).length}</div><div class="stat-label">Total Products</div></div></div>
    <div class="stat-card"><div class="stat-icon si2">📦</div><div><div class="stat-val">${(orders||[]).length}</div><div class="stat-label">Total Orders</div></div></div>
    <div class="stat-card"><div class="stat-icon si3">⏳</div><div><div class="stat-val">${pendingCount}</div><div class="stat-label">Pending Orders</div></div></div>
    <div class="stat-card"><div class="stat-icon si4">💰</div><div><div class="stat-val">₹${Number(revenue).toLocaleString('en-IN')}</div><div class="stat-label">Revenue (Delivered)</div></div></div>
  `;
  const recent = (orders || []).slice(0, 8);
  document.getElementById('dashOrdersTbody').innerHTML = recent.map(o => `
    <tr>
      <td><strong>${o.order_id || '#' + o.id}</strong></td>
      <td>${o.customer_name || 'Guest'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Array.isArray(o.items) ? o.items.map(i=>i.name).join(', ') : o.items}</td>
      <td>₹${Number(o.total||0).toLocaleString('en-IN')}</td>
      <td><span class="badge b-${o.status}">${o.status}</span></td>
      <td>${o.created_at ? o.created_at.slice(0,10) : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray)">No orders yet</td></tr>';
}

/* ════════════════════════════════════
   PRODUCTS
════════════════════════════════════ */
async function loadProductsTable(filter = '') {
  const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
  if (error) { toast('Failed to load products', 'error'); return; }
  allProducts = data || [];
  const filtered = filter ? allProducts.filter(p => p.name.toLowerCase().includes(filter) || (p.category||'').toLowerCase().includes(filter)) : allProducts;
  renderProductsTable(filtered);
  await populateCategorySelect();
}

async function populateCategorySelect() {
  const { data } = await sb.from('categories').select('name, slug').eq('status', 'active').order('display_order');
  const sel = document.getElementById('pCat');
  if (!sel || !data) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Select…</option>' + (data || []).map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
  if (current) sel.value = current;
}

function renderProductsTable(prods) {
  document.getElementById('productsTbody').innerHTML = prods.map(p => {
    const thumb = p.photos && p.photos.length
      ? `<img src="${p.photos[0]}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;" alt="${p.name}" onerror="this.outerHTML='<div style=\\'width:54px;height:54px;background:var(--pink-soft);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;\\'>🎁</div>'"/>`
      : `<div style="width:54px;height:54px;background:var(--pink-soft);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🎁</div>`;
    return `
    <tr>
      <td>${thumb}</td>
      <td><strong>${p.name}</strong>${p.featured ? ' <span class="badge b-active" style="font-size:.65rem;">FEATURED</span>' : ''}</td>
      <td>${p.category || '—'}</td>
      <td>₹${Number(p.price_old||0).toLocaleString('en-IN')}</td>
      <td>₹${Number(p.price_sale||0).toLocaleString('en-IN')}</td>
      <td>${(p.photos||[]).length} photo(s)</td>
      <td><span class="badge ${p.status === 'active' ? 'b-active' : 'b-inactive'}">${p.status}</span></td>
      <td>
        <button class="btn-sm btn-edit" onclick="editProduct('${p.id}')">✏️ Edit</button>
        <button class="btn-sm btn-del"  onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray)">No products found</td></tr>';
}

function searchProducts(v) { loadProductsTable(v.toLowerCase()); }

/* ── Product Form ── */
async function openProductForm() {
  editingPhotos = [];
  clearErrs('pNameErr','pCatErr','pPriceErr');
  document.getElementById('editId').value       = '';
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('pName').value    = '';
  document.getElementById('pCat').value     = '';
  document.getElementById('pOld').value     = '';
  document.getElementById('pSale').value    = '';
  document.getElementById('pDesc').value    = '';
  document.getElementById('pStatus').value  = 'active';
  document.getElementById('pWa').value      = '';
  document.getElementById('pFeatured').checked = false;
  document.getElementById('photoPreviews').innerHTML = '';
  await populateCategorySelect();
  openModal('productModal');
}

async function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingPhotos = p.photos ? [...p.photos] : [];
  clearErrs('pNameErr','pCatErr','pPriceErr');
  document.getElementById('editId').value       = id;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('pName').value    = p.name;
  document.getElementById('pOld').value     = p.price_old;
  document.getElementById('pSale').value    = p.price_sale;
  document.getElementById('pDesc').value    = p.description || '';
  document.getElementById('pStatus').value  = p.status;
  document.getElementById('pWa').value      = p.wa_message || '';
  document.getElementById('pFeatured').checked = !!p.featured;
  await populateCategorySelect();
  document.getElementById('pCat').value = p.category || '';
  renderPhotoPreviews();
  openModal('productModal');
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  toast('Product deleted', 'error');
  loadProductsTable();
}

/* ── Photo upload with Supabase Storage ── */
function handlePhotoFiles(input) {
  const files     = Array.from(input.files);
  const remaining = 6 - editingPhotos.length;
  const toAdd     = files.slice(0, remaining);
  if (files.length > remaining) toast(`Max 6 photos. Only ${remaining} more allowed.`, 'warn');
  toAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { editingPhotos.push(e.target.result); renderPhotoPreviews(); };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderPhotoPreviews() {
  document.getElementById('photoPreviews').innerHTML = editingPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="photo ${i+1}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'60\\'><rect fill=\\'%23f9e8e8\\'/><text x=\\'30\\' y=\\'35\\' text-anchor=\\'middle\\' font-size=\\'20\\'>🎁</text></svg>'"/>
      ${i === 0 ? '<span class="thumb-main">MAIN</span>' : ''}
      <button class="thumb-del" onclick="removePhoto(${i})">×</button>
    </div>`).join('');
}
function removePhoto(i) { editingPhotos.splice(i, 1); renderPhotoPreviews(); }

/* ── Upload photo to Supabase Storage ── */
async function uploadPhotoToStorage(base64OrUrl) {
  if (base64OrUrl.startsWith('http')) return base64OrUrl; // already uploaded
  try {
    const resp = await fetch(base64OrUrl);
    const blob = await resp.blob();
    const ext  = blob.type.split('/')[1] || 'jpg';
    const fileName = `product_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;

    const { data: uploadData, error: upErr } = await sb.storage
      .from('product-photos')
      .upload(fileName, blob, { contentType: blob.type, upsert: false });

    if (upErr) {
      console.error('Upload error:', upErr);
      toast('Photo upload failed: ' + upErr.message, 'error');
      return null;
    }
    const { data: urlData } = sb.storage.from('product-photos').getPublicUrl(uploadData.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error('Upload exception:', e);
    toast('Photo upload error', 'error');
    return null;
  }
}

async function saveProduct() {
  clearErrs('pNameErr','pCatErr','pPriceErr');
  const name  = document.getElementById('pName').value.trim();
  const cat   = document.getElementById('pCat').value;
  const po    = +document.getElementById('pOld').value;
  const ps    = +document.getElementById('pSale').value;
  let ok = true;
  if (!name)    { document.getElementById('pNameErr').textContent  = 'Name required'; ok = false; }
  if (!cat)     { document.getElementById('pCatErr').textContent   = 'Category required'; ok = false; }
  if (!po||!ps) { document.getElementById('pPriceErr').textContent = 'Both prices required'; ok = false; }
  if (!ok) return;

  // Show loading
  const btn = document.querySelector('#productModal .btn-full');
  const origText = btn.textContent;
  btn.textContent = 'Uploading photos…'; btn.disabled = true;

  const uploadedUrls = [];
  for (const photo of editingPhotos) {
    const url = await uploadPhotoToStorage(photo);
    if (url) uploadedUrls.push(url);
  }

  btn.textContent = origText; btn.disabled = false;

  const payload = {
    name,
    category:    cat,
    price_old:   po,
    price_sale:  ps,
    description: document.getElementById('pDesc').value.trim(),
    status:      document.getElementById('pStatus').value,
    wa_message:  document.getElementById('pWa').value.trim() || `Hi! I want to order ${name}`,
    photos:      uploadedUrls,
    featured:    document.getElementById('pFeatured').checked,
  };

  const editId = document.getElementById('editId').value;
  let error;
  if (editId) {
    ({ error } = await sb.from('products').update(payload).eq('id', editId));
    if (!error) toast('Product updated!', 'success');
  } else {
    ({ error } = await sb.from('products').insert(payload));
    if (!error) toast('Product added!', 'success');
  }
  if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  closeModal('productModal');
  loadProductsTable();
}

/* ════════════════════════════════════
   CATEGORIES
════════════════════════════════════ */
async function loadCategoriesTable(filter = '') {
  const { data, error } = await sb.from('categories').select('*').order('display_order');
  if (error) { toast('Failed to load categories', 'error'); return; }
  allCategories = data || [];
  const filtered = filter ? allCategories.filter(c => c.name.toLowerCase().includes(filter)) : allCategories;
  renderCategoriesTable(filtered);
}

function renderCategoriesTable(cats) {
  document.getElementById('categoriesTbody').innerHTML = cats.map(c => {
    const thumb = c.photo
      ? `<img src="${c.photo}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;" alt="${c.name}" onerror="this.outerHTML='<div style=\\'width:54px;height:54px;background:var(--pink-soft);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;\\'>${c.emoji||'🎁'}</div>'"/>`
      : `<div style="width:54px;height:54px;background:var(--pink-soft);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;">${c.emoji || '🎁'}</div>`;
    return `
    <tr>
      <td>${thumb}</td>
      <td><strong>${c.name}</strong></td>
      <td><code style="font-size:.78rem;background:#f5f5f5;padding:.15rem .4rem;border-radius:4px;">${c.slug}</code></td>
      <td>${c.display_order || 1}</td>
      <td><span class="badge ${c.status === 'active' ? 'b-active' : 'b-inactive'}">${c.status}</span></td>
      <td>
        <button class="btn-sm btn-edit" onclick="editCategory('${c.id}')">✏️ Edit</button>
        <button class="btn-sm btn-del"  onclick="deleteCategory('${c.id}')">🗑️ Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray)">No categories found</td></tr>';
}

function searchCategories(v) { loadCategoriesTable(v.toLowerCase()); }

function openCategoryForm() {
  editingCatPhoto = null;
  clearErrs('cNameErr','cSlugErr');
  document.getElementById('editCatId').value = '';
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('cName').value   = '';
  document.getElementById('cSlug').value   = '';
  document.getElementById('cOrder').value  = '1';
  document.getElementById('cEmoji').value  = '';
  document.getElementById('cStatus').value = 'active';
  document.getElementById('catPhotoPreview').innerHTML = '';
  document.getElementById('cName').oninput = () => {
    const slug = document.getElementById('cName').value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
    if (!document.getElementById('editCatId').value) document.getElementById('cSlug').value = slug;
  };
  openModal('categoryModal');
}

function editCategory(id) {
  const c = allCategories.find(x => x.id === id);
  if (!c) return;
  editingCatPhoto = c.photo || null;
  clearErrs('cNameErr','cSlugErr');
  document.getElementById('editCatId').value = id;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('cName').value   = c.name;
  document.getElementById('cSlug').value   = c.slug;
  document.getElementById('cOrder').value  = c.display_order || 1;
  document.getElementById('cEmoji').value  = c.emoji || '';
  document.getElementById('cStatus').value = c.status;
  const preview = document.getElementById('catPhotoPreview');
  if (c.photo) {
    preview.innerHTML = `<div class="photo-thumb"><img src="${c.photo}" alt="${c.name}" onerror="this.style.display='none'"/><button class="thumb-del" onclick="editingCatPhoto=null;document.getElementById('catPhotoPreview').innerHTML=''">×</button></div>`;
  } else preview.innerHTML = '';
  openModal('categoryModal');
}

function handleCatPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    editingCatPhoto = e.target.result;
    document.getElementById('catPhotoPreview').innerHTML =
      `<div class="photo-thumb"><img src="${editingCatPhoto}" alt="category"/><button class="thumb-del" onclick="editingCatPhoto=null;document.getElementById('catPhotoPreview').innerHTML=''">×</button></div>`;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function saveCategory() {
  clearErrs('cNameErr','cSlugErr');
  const name = document.getElementById('cName').value.trim();
  const slug = document.getElementById('cSlug').value.trim();
  let ok = true;
  if (!name) { document.getElementById('cNameErr').textContent = 'Name required'; ok = false; }
  if (!slug) { document.getElementById('cSlugErr').textContent = 'Slug required'; ok = false; }
  if (!ok) return;

  // Upload category photo if base64
  let photoUrl = null;
  if (editingCatPhoto) {
    photoUrl = await uploadPhotoToStorage(editingCatPhoto);
    if (!photoUrl && editingCatPhoto.startsWith('http')) photoUrl = editingCatPhoto;
  }

  const payload = {
    name, slug,
    display_order: +document.getElementById('cOrder').value || 1,
    emoji:   document.getElementById('cEmoji').value.trim() || null,
    status:  document.getElementById('cStatus').value,
    photo:   photoUrl,
  };

  const editId = document.getElementById('editCatId').value;
  let error;
  if (editId) {
    ({ error } = await sb.from('categories').update(payload).eq('id', editId));
    if (!error) toast('Category updated!', 'success');
  } else {
    ({ error } = await sb.from('categories').insert(payload));
    if (!error) toast('Category added!', 'success');
  }
  if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  closeModal('categoryModal');
  loadCategoriesTable();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
  toast('Category deleted', 'error');
  loadCategoriesTable();
}

/* ════════════════════════════════════
   ORDERS
════════════════════════════════════ */
async function loadOrdersTable(filter = '') {
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
  if (error) { toast('Failed to load orders', 'error'); return; }
  allOrders = data || [];
  applyOrderFilters(filter, _statusFilter);
}

function applyOrderFilters(search = '', status = '') {
  let filtered = allOrders;
  if (search) filtered = filtered.filter(o =>
    (o.order_id||'').toLowerCase().includes(search) ||
    (o.customer_name||'').toLowerCase().includes(search) ||
    (o.customer_phone||'').includes(search) ||
    String(o.id).includes(search)
  );
  if (status) filtered = filtered.filter(o => o.status === status);
  renderOrdersTable(filtered);
}

function filterOrdersByStatus(status) { _statusFilter = status; applyOrderFilters('', status); }
function searchOrders(v) { applyOrderFilters(v.toLowerCase(), _statusFilter); }

function renderOrdersTable(orders) {
  document.getElementById('ordersTbody').innerHTML = orders.map(o => {
    const itemsStr = Array.isArray(o.items) ? o.items.map(i => `${i.name} ×${i.qty||1}`).join(', ') : (o.items || '—');
    const trackingCell = o.tracking_link
      ? `<a href="${o.tracking_link}" target="_blank" style="font-size:.78rem;color:#004085;">🚚 Link</a>`
      : '<span style="font-size:.75rem;color:#bbb;">—</span>';
    return `
    <tr>
      <td><strong style="font-family:monospace;font-size:.82rem;">${o.order_id || '#' + o.id}</strong></td>
      <td>${o.customer_name || 'Guest'}</td>
      <td>${o.customer_phone || o.customer_email || '—'}</td>
      <td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${itemsStr}">${itemsStr}</td>
      <td>₹${Number(o.total||0).toLocaleString('en-IN')}</td>
      <td><span class="badge b-${o.status}">${o.status}</span></td>
      <td>${trackingCell}</td>
      <td>${o.created_at ? o.created_at.slice(0,10) : '—'}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="openOrderDetail('${o.id}')">✏️ Edit</button>
        <button class="btn-sm btn-del"  onclick="deleteOrder('${o.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--gray)">No orders yet</td></tr>';
}

function openOrderDetail(id) {
  const o = allOrders.find(x => x.id === id);
  if (!o) return;
  editingOrderId = id;
  document.getElementById('orderDetailTitle').textContent = `Order: ${o.order_id || '#' + o.id}`;
  const items = Array.isArray(o.items)
    ? o.items.map(i => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #f5f5f5;"><span>${i.name} ×${i.qty || 1}</span><span>₹${Number((i.price||0)*(i.qty||1)).toLocaleString('en-IN')}</span></div>`).join('')
    : `<div>${o.items}</div>`;

  document.getElementById('orderDetailBody').innerHTML = `
    <div style="background:#f9f9f9;border-radius:8px;padding:1rem;margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;margin-bottom:.5rem;">
        <strong>${o.customer_name || 'Guest'}</strong>
        <span style="font-size:.82rem;color:var(--gray)">${o.created_at ? o.created_at.slice(0,10) : ''}</span>
      </div>
      <div style="font-size:.85rem;color:var(--gray);margin-bottom:.3rem;">${o.customer_email || ''}</div>
      ${o.customer_phone ? `<div style="font-size:.85rem;color:var(--gray);margin-bottom:.3rem;">📱 ${o.customer_phone}</div>` : ''}
      ${o.delivery_address ? `<div style="font-size:.85rem;color:var(--gray);margin-bottom:.3rem;">📍 ${o.delivery_address}${o.pincode ? ', PIN: ' + o.pincode : ''}</div>` : ''}
      ${items}
      <div style="margin-top:.5rem;font-size:.85rem;">
        ${o.subtotal ? `<div>Subtotal: ₹${Number(o.subtotal).toLocaleString('en-IN')}</div>` : ''}
        ${o.discount > 0 ? `<div style="color:#27ae60;">Discount: -₹${Number(o.discount).toLocaleString('en-IN')} ${o.promo_code ? '(' + o.promo_code + ')' : ''}</div>` : ''}
        ${o.shipping_fee > 0 ? `<div>Shipping: ₹${Number(o.shipping_fee).toLocaleString('en-IN')}</div>` : '<div style="color:#27ae60;">Shipping: FREE</div>'}
        ${o.tax_amount > 0 ? `<div>Tax: ₹${Number(o.tax_amount).toLocaleString('en-IN')}</div>` : ''}
      </div>
      <div style="text-align:right;font-weight:700;padding-top:.5rem;font-size:1rem;">Total: ₹${Number(o.total||0).toLocaleString('en-IN')}</div>
      ${o.notes ? `<div style="margin-top:.5rem;font-size:.82rem;color:var(--gray);">Notes: ${o.notes}</div>` : ''}
    </div>`;

  document.getElementById('trackingLinkInput').value  = o.tracking_link || '';
  document.getElementById('orderStatusSelect').value  = o.status || 'pending';
  document.getElementById('orderNotesInput').value    = o.notes || '';
  openModal('orderDetailModal');
}

async function saveOrderUpdate() {
  if (!editingOrderId) return;
  const status       = document.getElementById('orderStatusSelect').value;
  const trackingLink = document.getElementById('trackingLinkInput').value.trim() || null;
  const notes        = document.getElementById('orderNotesInput')?.value.trim() || null;

  const { error } = await sb.from('orders').update({ status, tracking_link: trackingLink, notes }).eq('id', editingOrderId);
  if (error) { toast('Update failed: ' + error.message, 'error'); return; }

  // Update in allOrders array too
  const idx = allOrders.findIndex(o => o.id === editingOrderId);
  if (idx !== -1) { allOrders[idx].status = status; allOrders[idx].tracking_link = trackingLink; allOrders[idx].notes = notes; }

  toast('Order updated!', 'success');
  closeModal('orderDetailModal');
  loadOrdersTable();
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { toast('Delete failed', 'error'); return; }
  toast('Order deleted', 'error');
  loadOrdersTable();
}

/* ════════════════════════════════════
   USERS
════════════════════════════════════ */
async function loadUsersTable(filter = '') {
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { toast('Failed to load users', 'error'); return; }
  allUsers = data || [];
  const filtered = filter ? allUsers.filter(u => (u.first_name||'').toLowerCase().includes(filter) || (u.id||'').includes(filter)) : allUsers;
  renderUsersTable(filtered);
}

function renderUsersTable(users) {
  document.getElementById('usersTbody').innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.first_name || ''} ${u.last_name || ''}</strong></td>
      <td style="font-size:.8rem;color:var(--gray);">${u.id}</td>
      <td>${u.phone || '—'}</td>
      <td><span class="badge ${u.role === 'admin' ? 'b-admin' : 'b-user'}">${u.role || 'user'}</span></td>
      <td>${u.created_at ? u.created_at.slice(0,10) : '—'}</td>
      <td>
        ${u.role !== 'admin'
          ? `<button class="btn-sm btn-edit" onclick="toggleAdminRole('${u.id}','${u.role}')">Make Admin</button>
             <button class="btn-sm btn-del"  onclick="deleteUser('${u.id}')">🗑️</button>`
          : '<span style="font-size:.8rem;color:var(--gray)">Protected</span>'}
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray)">No users found</td></tr>';
}

function searchUsers(v) { loadUsersTable(v.toLowerCase()); }

async function toggleAdminRole(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  if (!confirm(`Change role to "${newRole}"?`)) return;
  const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', id);
  if (error) { toast('Update failed', 'error'); return; }
  toast(`User role changed to ${newRole}`, 'success');
  loadUsersTable();
}

async function deleteUser(id) {
  if (!confirm('Remove this user profile?')) return;
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) { toast('Delete failed', 'error'); return; }
  toast('User removed', 'error');
  loadUsersTable();
}

/* ════════════════════════════════════
   HERO EDITOR
════════════════════════════════════ */
async function loadHeroEditor() {
  const { data } = await sb.from('hero_settings').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('hTitle').value = data.title    || '';
  document.getElementById('hSub').value   = data.subtitle || '';
  document.getElementById('hBtn1').value  = data.btn1     || '';
  document.getElementById('hBtn2').value  = data.btn2     || '';
  document.getElementById('prevTitle').textContent = data.title    || '';
  document.getElementById('prevSub').textContent   = data.subtitle || '';
}

function liveHero() {
  document.getElementById('prevTitle').textContent = document.getElementById('hTitle').value;
  document.getElementById('prevSub').textContent   = document.getElementById('hSub').value;
}

async function saveHero() {
  const payload = {
    title:    document.getElementById('hTitle').value,
    subtitle: document.getElementById('hSub').value,
    btn1:     document.getElementById('hBtn1').value,
    btn2:     document.getElementById('hBtn2').value,
  };
  const { error } = await sb.from('hero_settings').upsert({ id: 1, ...payload });
  if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  toast('Hero banner saved!', 'success');
}

/* ════════════════════════════════════
   SETTINGS (with checkout config)
════════════════════════════════════ */
async function loadSettings() {
  const { data } = await sb.from('store_settings').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('sName').value       = data.store_name    || '';
  document.getElementById('sWa').value         = data.wa_number     || '';
  document.getElementById('sEmail').value      = data.contact_email || '';
  document.getElementById('sShipping').value   = data.shipping_fee  ?? 99;
  document.getElementById('sFreeMin').value    = data.free_shipping_min ?? 999;
  document.getElementById('sTaxEnabled').checked = !!data.tax_enabled;
  document.getElementById('sTaxPercent').value = data.tax_percent   ?? 0;

  // Load promo codes
  let promos = data.promo_codes || [];
  if (typeof promos === 'string') promos = JSON.parse(promos);
  renderPromoCodesAdmin(promos);
}

async function saveSettings() {
  const promos = getPromoCodesFromAdmin();
  const payload = {
    store_name:        document.getElementById('sName').value,
    wa_number:         document.getElementById('sWa').value,
    contact_email:     document.getElementById('sEmail').value,
    shipping_fee:      +document.getElementById('sShipping').value || 0,
    free_shipping_min: +document.getElementById('sFreeMin').value  || 0,
    tax_enabled:       document.getElementById('sTaxEnabled').checked,
    tax_percent:       +document.getElementById('sTaxPercent').value || 0,
    promo_codes:       promos,
  };
  const { error } = await sb.from('store_settings').upsert({ id: 1, ...payload });
  if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  toast('Settings saved!', 'success');
}

/* ── Promo Codes Admin ── */
let _adminPromos = [];

function renderPromoCodesAdmin(promos) {
  _adminPromos = promos;
  const el = document.getElementById('promoCodesList');
  if (!el) return;
  if (!promos.length) {
    el.innerHTML = '<p style="color:var(--gray);font-size:.85rem;padding:.5rem 0;">No promo codes yet. Add one below.</p>';
    return;
  }
  el.innerHTML = promos.map((p, i) => `
    <div class="promo-admin-row">
      <span class="promo-code-badge">${p.code}</span>
      <span class="promo-type-badge">${p.type === 'percent' ? p.value + '%' : '₹' + p.value} off</span>
      <span class="badge ${p.active !== false ? 'b-active' : 'b-inactive'}">${p.active !== false ? 'Active' : 'Inactive'}</span>
      <button class="btn-sm btn-del" onclick="removePromo(${i})">Remove</button>
    </div>`).join('');
}

function addPromoCode() {
  const code  = (document.getElementById('newPromoCode')?.value || '').trim().toUpperCase();
  const type  = document.getElementById('newPromoType')?.value || 'percent';
  const value = +document.getElementById('newPromoValue')?.value || 0;
  if (!code || !value) { toast('Enter a code and discount value', 'error'); return; }
  if (_adminPromos.find(p => p.code === code)) { toast('Code already exists', 'error'); return; }
  _adminPromos.push({ code, type, value, active: true });
  renderPromoCodesAdmin(_adminPromos);
  document.getElementById('newPromoCode').value  = '';
  document.getElementById('newPromoValue').value = '';
  toast(`Promo code ${code} added (save settings to apply)`, 'success');
}

function removePromo(i) {
  _adminPromos.splice(i, 1);
  renderPromoCodesAdmin(_adminPromos);
}

function getPromoCodesFromAdmin() { return _adminPromos; }

function applyColor(varName, value) {
  document.documentElement.style.setProperty(varName, value);
}

/* ════════════════════════════════════
   MODAL HELPERS
════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
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
   TOAST
════════════════════════════════════ */
function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = `show ${type}`;
  clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 2800);
}

/* ════════════════════════════════════
   UTILS
════════════════════════════════════ */
function clearErrs(...ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}
