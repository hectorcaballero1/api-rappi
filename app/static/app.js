const API = '';
const TOKEN_KEY = 'rappi_token';

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
        <h1>Rappi</h1>
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
          ${order.status !== 'entregado' ? `<button class="btn btn-primary btn-sm" id="deliver-btn">Marcar entregado</button>` : ''}
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

    if (order.status !== 'entregado') {
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
function renderNewOrder(app) {
  const tenants = ['mrsushi-lamarina', 'mrsushi-espinar', 'mrsushi-malldelsur', 'mrsushi-megaplaza'];
  app.innerHTML = shell(`
    <div class="page-header"><h2>Nuevo pedido</h2></div>
    <form id="new-order-form">
      <div class="form-group">
        <label>External Ref</label>
        <input type="text" id="form-ref" required placeholder="pedido-001" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Sede</label>
        <select id="form-tenant">${tenants.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
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
        <label>Total (S/)</label>
        <input type="number" id="form-total" step="0.01" required placeholder="89.90">
      </div>
      <button type="submit" class="btn btn-primary">Crear pedido</button>
    </form>
  `);
  bindNav();

  document.getElementById('new-order-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Creando…';
    const ref = document.getElementById('form-ref').value;
    try {
      await api('POST', '/orders', {
        external_ref: ref,
        tenant_id: document.getElementById('form-tenant').value,
        customer_name: document.getElementById('form-name').value,
        customer_address: document.getElementById('form-address').value,
        total: parseFloat(document.getElementById('form-total').value),
        items: [{ name: 'Producto', qty: 1, price: parseFloat(document.getElementById('form-total').value) }],
      });
      toast(`Pedido ${ref} creado`);
      navigate('#/orders');
    } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Crear pedido'; }
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
