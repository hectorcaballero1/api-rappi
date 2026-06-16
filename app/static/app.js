const API = '';
const TOKEN_KEY = 'rappi_token';
let catalogCache = null;

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn() { return !!getToken(); }

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

async function api(method, path, body) {
  const opts = { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || 'Error');
  return data;
}

function navigate(hash) {
  history.pushState(null, '', hash || '#/login');
  render();
}

window.addEventListener('popstate', render);

function toast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function render() {
  const hash = location.hash || '#/login';
  const app = document.getElementById('app');
  if (!isLoggedIn() && hash !== '#/login') { navigate('#/login'); return; }
  if (hash === '#/login') { renderLogin(app); return; }
  if (hash === '#/orders') { renderOrders(app); return; }
  if (hash.startsWith('#/orders/')) {
    const ref = hash.replace('#/orders/', '');
    if (ref === 'new') { renderNewOrder(app); return; }
    renderOrderDetail(app, ref);
    return;
  }
  renderDashboard(app);
}

/* ─── Login ─── */
function renderLogin(app) {
  if (isLoggedIn()) { navigate('#/dashboard'); return; }
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <img src="/logo.svg" alt="Rappi" height="120" style="margin-bottom:24px">
        <p>Simulador de pedidos</p>
        <form id="login-form">
          <div class="form-group">
            <label>Usuario</label>
            <input type="text" id="login-user" value="admin" autocomplete="username">
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="login-pass" value="admin123" autocomplete="current-password">
          </div>
          <div id="login-error" class="alert alert-error" style="display:none"></div>
          <button type="submit" class="btn btn-primary btn-block">Ingresar</button>
        </form>
      </div>
    </div>`;

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      const data = await api('POST', '/auth/login', {
        username: document.getElementById('login-user').value,
        password: document.getElementById('login-pass').value,
      });
      setToken(data.token);
      navigate('#/dashboard');
    } catch (err) {
      const el = document.getElementById('login-error');
      el.textContent = err.message;
      el.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Ingresar';
    }
  };
}

/* ─── Shell ─── */
function shell(body) {
  const user = JSON.parse(atob(getToken().split('.')[1]));
  const nav = [
    { href: '#/dashboard', label: 'Dashboard' },
    { href: '#/orders', label: 'Pedidos' },
    { href: '#/orders/new', label: 'Nuevo' },
  ];
  return `
    <div class="topbar">
      <div class="topbar-logo"><img src="/logo.svg" alt="Rappi" height="32"></div>
      <div class="topbar-nav">
        ${nav.map(n => `<a href="${n.href}" data-nav>${n.label}</a>`).join('')}
      </div>
      <div class="topbar-right">
        <span class="user-name">${user.username}</span>
        <a href="#" id="logout-btn">Salir</a>
      </div>
    </div>
    <main class="main-content">${body}</main>`;
}

function bindNav() {
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === location.hash);
  });
  const lo = document.getElementById('logout-btn');
  if (lo) lo.onclick = (e) => { e.preventDefault(); clearToken(); navigate('#/login'); };
}

/* ─── Dashboard ─── */
async function renderDashboard(app) {
  app.innerHTML = shell('<div class="loading">Cargando…</div>');
  try {
    const orders = await api('GET', '/orders?limit=500');
    const sorted = orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const inProcess = orders.filter(o => o.status !== 'entregado' && o.status !== 'pendiente');
    const pending = orders.filter(o => o.status === 'pendiente');
    const delivered = orders.filter(o => o.status === 'entregado');
    const recent = sorted.slice(0, 12);

    app.innerHTML = shell(`
      <div class="page-header"><h2>Dashboard</h2></div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value blue">${orders.length}</div></div>
        <div class="stat-card"><div class="stat-label">En proceso</div><div class="stat-value orange">${inProcess.length}</div></div>
        <div class="stat-card"><div class="stat-label">Pendientes</div><div class="stat-value accent">${pending.length}</div></div>
        <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value green">${delivered.length}</div></div>
      </div>
      <div class="section-heading">Últimos pedidos</div>
      ${recent.length ? tableHtml(recent) : '<div class="empty-state"><p>No hay pedidos aún</p></div>'}
    `);
    bindNav();
  } catch(e) { app.innerHTML = shell(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── Orders list ─── */
let ordersOffset = 0;
const PAGE_SIZE = 20;

async function renderOrders(app) {
  app.innerHTML = shell('<div class="loading">Cargando…</div>');
  try {
    const fe = document.getElementById('status-filter');
    const status = fe ? fe.value : '';
    const url = `/orders?limit=${PAGE_SIZE}&offset=${ordersOffset}${status ? `&status=${status}` : ''}`;
    const orders = await api('GET', url);
    const all = await api('GET', `/orders?limit=500${status ? `&status=${status}` : ''}`);
    const total = all.length;

    app.innerHTML = shell(`
      <div class="page-header">
        <h2>Pedidos</h2>
        <div class="page-header-actions">
          <select id="status-filter" class="filter-select">
            <option value="">Todos</option>
            <option value="pendiente" ${status==='pendiente'?'selected':''}>Pendiente</option>
            <option value="cocinando" ${status==='cocinando'?'selected':''}>Cocinando</option>
            <option value="empacando" ${status==='empacando'?'selected':''}>Empacando</option>
            <option value="en_camino" ${status==='en_camino'?'selected':''}>En camino</option>
            <option value="entregado" ${status==='entregado'?'selected':''}>Entregado</option>
          </select>
          <a href="#/orders/new" class="btn btn-primary btn-sm">Nuevo</a>
        </div>
      </div>
      ${orders.length ? tableHtml(orders) : '<div class="empty-state"><p>No hay pedidos</p></div>'}
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" id="prev-page" ${ordersOffset===0?'disabled':''}>← Anterior</button>
        <span>${ordersOffset+1}–${Math.min(ordersOffset+orders.length, total)} de ${total}</span>
        <button class="btn btn-secondary btn-sm" id="next-page" ${ordersOffset+orders.length>=total?'disabled':''}>Siguiente →</button>
      </div>
    `);
    bindNav();
    document.getElementById('status-filter').onchange = () => { ordersOffset = 0; renderOrders(app); };
    document.getElementById('prev-page').onclick = () => { ordersOffset = Math.max(0, ordersOffset - PAGE_SIZE); renderOrders(app); };
    document.getElementById('next-page').onclick = () => { ordersOffset += PAGE_SIZE; renderOrders(app); };
  } catch(e) { app.innerHTML = shell(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── Order detail ─── */
async function renderOrderDetail(app, ref) {
  app.innerHTML = shell('<div class="loading">Cargando…</div>');
  try {
    const [order, history] = await Promise.all([
      api('GET', `/orders/${encodeURIComponent(ref)}`),
      api('GET', `/orders/${encodeURIComponent(ref)}/history`),
    ]);
    const b = { 'pendiente':'','cocinando':'badge-orange','empacando':'badge-blue','en_camino':'badge-orange','entregado':'badge-green' };
    const bc = b[order.status] || '';

    app.innerHTML = shell(`
      <div class="page-header">
        <h2>${order.external_ref}</h2>
        <div class="page-header-actions">
          <span class="badge ${bc}">${order.status}</span>
          ${order.status === 'entregando_a_rappi' ? `<button class="btn btn-primary btn-sm" id="deliver-btn">Marcar entregado</button>` :
            order.status !== 'entregado' ? `<span style="color:var(--text2);font-size:.875rem">Esperando que Mr. Sushi prepare el pedido</span>` : ''}
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-field"><div class="label">Sede</div><div class="value">${order.tenant_id}</div></div>
        <div class="detail-field"><div class="label">Cliente</div><div class="value">${order.customer_name || '—'}</div></div>
        <div class="detail-field"><div class="label">Dirección</div><div class="value">${order.customer_address || '—'}</div></div>
        <div class="detail-field"><div class="label">Total</div><div class="value">S/ ${order.total || '—'}</div></div>
        <div class="detail-field"><div class="label">Creado</div><div class="value" style="font-family:'JetBrains Mono',monospace;font-size:13px">${formatDate(order.created_at)}</div></div>
        ${order.delivered_at ? `<div class="detail-field"><div class="label">Entregado</div><div class="value mono-sm">${formatDate(order.delivered_at)}</div></div>` : ''}
        <div class="detail-field full"><div class="label">Items</div><div class="value"><pre>${JSON.stringify(order.items || [], null, 2)}</pre></div></div>
      </div>
      <div class="section-heading" style="font-size:17px">Historial</div>
      ${history.length ? `
      <div class="timeline">
        ${history.map(h => `
          <div class="timeline-item">
            <div class="ts-status">${h.status}</div>
            <div class="ts-source">${h.source}</div>
            <div class="ts-time">${formatDate(h.created_at)}</div>
          </div>
        `).join('')}
      </div>` : '<div class="empty-state" style="margin-top:0"><p>Sin historial</p></div>'}
    `);
    bindNav();

    if (order.status === 'entregando_a_rappi') {
      document.getElementById('deliver-btn').onclick = async () => {
        const btn = document.getElementById('deliver-btn');
        btn.disabled = true; btn.textContent = 'Entregando…';
        try {
          await api('POST', `/orders/${encodeURIComponent(ref)}/deliver`);
          toast('Pedido marcado como entregado');
          renderOrderDetail(app, ref);
        } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Marcar entregado'; }
      };
    }
  } catch(e) { app.innerHTML = shell(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── New order ─── */
const NOMBRES = ['Luis García','María Quispe','Carlos Ramos','Ana Torres','José Flores','Lucía Mendoza','Diego Vargas','Sofía Castro'];
const CALLES  = ['Av. Larco 450','Jr. Miraflores 123','Av. Brasil 890','Calle Lima 34','Av. Javier Prado 2100','Jr. Cusco 88','Av. Arequipa 560','Calle Libertad 77'];
const PLATOS  = ['Acevichado Maki','Ebi Furai','Arma tu Poke','Alitas BBQ','Maki Box','Temaki Acevichado','California Maki','Gyoza de Pescado','Yakimeshi','Ramen Mr Sushi'];

function randomOrder(tenants) {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const qty  = () => Math.floor(Math.random() * 3) + 1;
  const ref  = 'rappi-' + Date.now();
  const items = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => {
    const price = +(Math.random() * 30 + 15).toFixed(2);
    const q = qty();
    return { name: rand(PLATOS), qty: q, price };
  });
  const total = +(items.reduce((s, i) => s + i.price * i.qty, 0)).toFixed(2);
  return { ref, tenant: rand(tenants), name: rand(NOMBRES), address: rand(CALLES), total, items };
}

function fillRandom(tenants) {
  const o = randomOrder(tenants);
  document.getElementById('form-tenant').value  = o.tenant;
  document.getElementById('form-name').value    = o.name;
  document.getElementById('form-address').value = o.address;
  document.getElementById('form-total').value   = o.total;
}

function renderNewOrder(app) {
  const TENANTS = ['mrsushi-lamarina', 'mrsushi-espinar', 'mrsushi-malldelsur', 'mrsushi-megaplaza'];
  app.innerHTML = shell(`
    <div class="page-header">
      <h2>Nuevo pedido</h2>
      <div class="page-header-actions">
        <button class="btn btn-secondary btn-sm" id="random-btn">🎲 Aleatorio</button>
      </div>
    </div>
    <form id="new-order-form">
      <div class="form-group">
        <label>Sede</label>
        <select id="form-tenant">${TENANTS.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Cliente</label>
        <input type="text" id="form-name" required placeholder="Nombre del cliente">
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input type="text" id="form-address" required placeholder="Av. Ejemplo 123">
      </div>
      <div class="form-group">
        <label>Productos</label>
        <div id="catalog-loading" style="color:var(--text2);font-size:.875rem">Cargando catálogo…</div>
        <div id="catalog-items" style="display:none;max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px"></div>
      </div>
      <div class="form-group">
        <label>Total</label>
        <div id="form-total-display" style="font-size:1.25rem;font-weight:700;color:var(--accent)">S/ 0.00</div>
      </div>
      <button type="submit" class="btn btn-primary" id="submit-btn" disabled>Crear pedido</button>
    </form>
  `);
  bindNav();

  // Estado del carrito: { productId -> { product, qty } }
  const cart = {};

  function recalc() {
    let total = 0;
    Object.values(cart).forEach(({ product, qty }) => { total += product.price * qty; });
    document.getElementById('form-total-display').textContent = `S/ ${total.toFixed(2)}`;
    document.getElementById('submit-btn').disabled = total === 0;
  }

  // Expande alitas individuales (6 / 12 piezas) con precios hardcodeados
  function expandProducts(products) {
    const ALITAS_PRICES = { '6 alitas': 16.90, '12 alitas': 29.90 };
    const out = [];
    for (const p of products) {
      const key = p.productId || p.name || p.SK || String(out.length);
      const alitasOpt = (p.options || []).find(o =>
        Array.isArray(o.choices) && o.choices.includes('6 alitas')
      );
      if (alitasOpt) {
        for (const choice of ['6 alitas', '12 alitas']) {
          out.push({ ...p, productId: key + '--' + choice.replace(' ', ''), name: `${p.name} · ${choice}`, price: ALITAS_PRICES[choice] });
        }
      } else {
        out.push({ ...p, productId: key });
      }
    }
    return out;
  }

  function renderCatalog(rawProducts) {
    const products = expandProducts(rawProducts);
    const container = document.getElementById('catalog-items');
    document.getElementById('catalog-loading').style.display = 'none';
    container.style.display = 'flex';

    // Map de productos por id para acceso rápido (construido antes del HTML)
    const productMap = {};
    products.forEach(p => { productMap[p.productId] = p; });

    // Agrupar por categoría
    const byCategory = {};
    products.forEach(p => {
      const cat = p.category || 'Otros';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    });

    const safeId = id => String(id).replace(/[^a-zA-Z0-9_-]/g, '_');

    container.innerHTML = Object.entries(byCategory).map(([cat, prods]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:.7rem;font-weight:700;color:var(--text2);text-transform:uppercase;padding:4px 0">${cat}</div>
        ${prods.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-bottom:1px solid var(--border)">
            <span style="font-size:.875rem">${p.name} <span style="color:var(--text2)">${parseFloat(p.price) > 0 ? `S/${parseFloat(p.price).toFixed(2)}` : ''}</span></span>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="btn btn-secondary btn-sm" data-dec="${p.productId}" style="padding:2px 8px">−</button>
              <span id="qty-${safeId(p.productId)}" style="min-width:20px;text-align:center">0</span>
              <button type="button" class="btn btn-secondary btn-sm" data-inc="${p.productId}" style="padding:2px 8px">+</button>
            </div>
          </div>`).join('')}
      </div>`).join('');

    container.addEventListener('click', e => {
      const inc = e.target.dataset.inc;
      const dec = e.target.dataset.dec;
      if (inc && productMap[inc]) {
        cart[inc] = cart[inc] || { product: productMap[inc], qty: 0 };
        cart[inc].qty++;
        const el = document.getElementById(`qty-${safeId(inc)}`);
        if (el) el.textContent = cart[inc].qty;
        recalc();
      }
      if (dec && cart[dec] && cart[dec].qty > 0) {
        cart[dec].qty--;
        const el = document.getElementById(`qty-${safeId(dec)}`);
        if (el) el.textContent = cart[dec].qty;
        if (cart[dec].qty === 0) delete cart[dec];
        recalc();
      }
    });
  }

  // Cargar catálogo (usa cache si ya fue fetcheado en esta sesión)
  if (catalogCache) {
    renderCatalog(catalogCache);
  } else {
    api('GET', '/catalog').then(data => {
      catalogCache = Array.isArray(data) ? data : (data.body ? JSON.parse(data.body) : []);
      renderCatalog(catalogCache);
    }).catch(() => {
      document.getElementById('catalog-loading').textContent = 'Error al cargar catálogo';
    });
  }

  document.getElementById('random-btn').onclick = () => {
    const o = randomOrder(TENANTS);
    document.getElementById('form-tenant').value  = o.tenant;
    document.getElementById('form-name').value    = o.name;
    document.getElementById('form-address').value = o.address;
  };

  document.getElementById('new-order-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Creando…';
    const items = Object.values(cart).map(({ product, qty }) => ({
      productId: product.productId,
      name: product.name,
      category: product.category,
      price: parseFloat(product.price),
      qty,
    }));
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    try {
      const created = await api('POST', '/orders', {
        tenant_id: document.getElementById('form-tenant').value,
        customer_name: document.getElementById('form-name').value,
        customer_address: document.getElementById('form-address').value,
        total: parseFloat(total.toFixed(2)),
        items,
      });
      toast(`Pedido ${created.external_ref} creado`);
      navigate('#/orders');
    } catch(err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Crear pedido'; }
  };
}

/* ─── Helpers ─── */
function tableHtml(orders) {
  const b = { 'pendiente':'','cocinando':'badge-orange','empacando':'badge-blue','en_camino':'badge-orange','entregado':'badge-green' };
  return `
  <div class="table-container">
    <table>
      <thead><tr><th>Ref</th><th>Sede</th><th>Estado</th><th>Cliente</th><th>Total</th><th></th></tr></thead>
      <tbody>${orders.map(o => `
        <tr>
          <td><a href="#/orders/${o.external_ref}">${o.external_ref}</a></td>
          <td style="color:var(--text2)">${o.tenant_id}</td>
          <td><span class="badge ${b[o.status]||''}">${o.status}</span></td>
          <td>${o.customer_name || '—'}</td>
          <td>S/ ${o.total || '—'}</td>
          <td><a href="#/orders/${o.external_ref}" class="btn btn-secondary btn-sm">Ver</a></td>
        </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

render();
