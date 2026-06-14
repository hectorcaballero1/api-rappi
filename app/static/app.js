const API = '';
const TOKEN_KEY = 'rappi_token';

/* ─── Auth ─── */
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

/* ─── Router ─── */
function navigate(hash) {
  history.pushState(null, '', hash || '#/login');
  render();
}

window.addEventListener('popstate', render);

/* ─── Toast ─── */
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

/* ─── Render ─── */
function render() {
  const hash = location.hash || '#/login';
  const app = document.getElementById('app');

  if (!isLoggedIn() && hash !== '#/login') {
    navigate('#/login');
    return;
  }

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

/* ─── Layout ─── */
function layout(body) {
  const user = JSON.parse(atob(getToken().split('.')[1]));
  return `
    <div class="app-layout">
      <nav class="sidebar">
        <div class="sidebar-logo"><span>R</span> appi</div>
        <a href="#/dashboard" data-nav>Dashboard</a>
        <a href="#/orders" data-nav>Pedidos</a>
        <a href="#/orders/new" data-nav>Nuevo Pedido</a>
        <div class="sidebar-actions">
          <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${user.username}</div>
          <a href="#" id="logout-btn" style="font-size:13px">Cerrar sesión</a>
        </div>
      </nav>
      <main class="main-content">${body}</main>
    </div>`;
}

/* ─── Dashboard ─── */
async function renderDashboard(app) {
  app.innerHTML = layout('<div class="loading">Cargando…</div>');
  try {
    const orders = await api('GET', '/orders?limit=500');
    const sorted = orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const inProcess = orders.filter(o => o.status !== 'entregado' && o.status !== 'pendiente');
    const pending = orders.filter(o => o.status === 'pendiente');
    const delivered = orders.filter(o => o.status === 'entregado');
    const recent = sorted.slice(0, 10);

    app.innerHTML = layout(`
      <div class="page-header"><h2>Dashboard</h2></div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-value blue">${orders.length}</div></div>
        <div class="stat-card"><div class="stat-label">En proceso</div><div class="stat-value orange">${inProcess.length}</div></div>
        <div class="stat-card"><div class="stat-label">Pendientes</div><div class="stat-value red">${pending.length}</div></div>
        <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value green">${delivered.length}</div></div>
      </div>
      <div class="page-header"><h3 style="font-size:18px">Últimos pedidos</h3></div>
      ${recent.length ? tableHtml(recent) : '<div class="empty-state"><p>No hay pedidos aún</p></div>'}
    `);
    bindNav();
  } catch(e) { app.innerHTML = layout(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── Orders List ─── */
let ordersOffset = 0;
const PAGE_SIZE = 20;

async function renderOrders(app) {
  app.innerHTML = layout('<div class="loading">Cargando…</div>');
  try {
    const filter = document.getElementById('status-filter');
    const status = filter ? filter.value : '';
    const url = `/orders?limit=${PAGE_SIZE}&offset=${ordersOffset}${status ? `&status=${status}` : ''}`;
    const orders = await api('GET', url);
    const all = await api('GET', `/orders?limit=500${status ? `&status=${status}` : ''}`);
    const total = all.length;

    app.innerHTML = layout(`
      <div class="page-header">
        <h2>Pedidos</h2>
        <div style="display:flex;gap:10px;align-items:center">
          <select id="status-filter" style="width:auto">
            <option value="">Todos</option>
            <option value="pendiente" ${status==='pendiente'?'selected':''}>Pendiente</option>
            <option value="cocinando" ${status==='cocinando'?'selected':''}>Cocinando</option>
            <option value="empacando" ${status==='empacando'?'selected':''}>Empacando</option>
            <option value="en_camino" ${status==='en_camino'?'selected':''}>En camino</option>
            <option value="entregado" ${status==='entregado'?'selected':''}>Entregado</option>
          </select>
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

  } catch(e) { app.innerHTML = layout(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── Order Detail ─── */
async function renderOrderDetail(app, ref) {
  app.innerHTML = layout('<div class="loading">Cargando…</div>');
  try {
    const [order, history] = await Promise.all([
      api('GET', `/orders/${encodeURIComponent(ref)}`),
      api('GET', `/orders/${encodeURIComponent(ref)}/history`),
    ]);

    const statusBadge = { 'pendiente':'badge-gray','cocinando':'badge-orange','empacando':'badge-blue','en_camino':'badge-orange','entregado':'badge-green' };
    const badgeClass = statusBadge[order.status] || 'badge-gray';

    app.innerHTML = layout(`
      <div class="page-header">
        <h2>${order.external_ref}</h2>
        <div style="display:flex;gap:10px">
          <span class="badge ${badgeClass}">${order.status}</span>
          ${order.status !== 'entregado' ? `<button class="btn btn-primary btn-sm" id="deliver-btn">Marcar entregado</button>` : ''}
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-field"><div class="label">Origen</div><div class="value">${order.source || 'rappi'}</div></div>
        <div class="detail-field"><div class="label">Sede</div><div class="value">${order.tenant_id}</div></div>
        <div class="detail-field"><div class="label">Cliente</div><div class="value">${order.customer_name || '—'}</div></div>
        <div class="detail-field"><div class="label">Dirección</div><div class="value">${order.customer_address || '—'}</div></div>
        <div class="detail-field"><div class="label">Total</div><div class="value">S/ ${order.total || '—'}</div></div>
        <div class="detail-field"><div class="label">Creado</div><div class="value" style="font-family:'JetBrains Mono',monospace;font-size:13px">${formatDate(order.created_at)}</div></div>
        <div class="detail-field full"><div class="label">Items</div><div class="value"><pre style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text2);white-space:pre-wrap">${JSON.stringify(order.items || [], null, 2)}</pre></div></div>
      </div>
      <h3 style="font-size:16px;margin-bottom:12px">Historial de estados</h3>
      ${history.length ? `
      <div class="timeline">
        ${history.map(h => `
          <div class="timeline-item">
            <div class="ts-status">${h.status}</div>
            <div class="ts-source">${h.source}</div>
            <div class="ts-time">${formatDate(h.created_at)}</div>
          </div>
        `).join('')}
      </div>` : '<div class="empty-state"><p>Sin historial</p></div>'}
    `);
    bindNav();

    if (order.status !== 'entregado') {
      document.getElementById('deliver-btn').onclick = async () => {
        const btn = document.getElementById('deliver-btn');
        btn.disabled = true; btn.textContent = 'Entregando…';
        try {
          await api('POST', `/orders/${encodeURIComponent(ref)}/deliver`);
          toast('Pedido entregado');
          renderOrderDetail(app, ref);
        } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Marcar entregado'; }
      };
    }
  } catch(e) { app.innerHTML = layout(`<div class="alert alert-error">${e.message}</div>`); bindNav(); }
}

/* ─── New Order ─── */
function renderNewOrder(app) {
  app.innerHTML = layout(`
    <div class="page-header"><h2>Nuevo Pedido</h2></div>
    <form id="new-order-form" style="max-width:500px">
      <div class="form-group"><label>External Ref</label><input type="text" id="form-ref" required placeholder="ej: pedido-001"></div>
      <div class="form-group"><label>Sede (tenant ID)</label><input type="text" id="form-tenant" value="mrsushi-lamarina" required></div>
      <div class="form-group"><label>Cliente</label><input type="text" id="form-name" placeholder="Nombre del cliente"></div>
      <div class="form-group"><label>Dirección</label><textarea id="form-address" placeholder="Dirección de entrega"></textarea></div>
      <div class="form-group"><label>Total (S/)</label><input type="number" id="form-total" step="0.01" value="0"></div>
      <div class="form-group"><label>Items (JSON)</label><textarea id="form-items" placeholder='[{"name":"Box 25 Makis","qty":1,"price":89.9}]'></textarea></div>
      <button type="submit" class="btn btn-primary">Crear pedido</button>
    </form>
  `);
  bindNav();

  document.getElementById('new-order-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Creando…';
    try {
      await api('POST', '/orders', {
        external_ref: document.getElementById('form-ref').value,
        tenant_id: document.getElementById('form-tenant').value,
        customer_name: document.getElementById('form-name').value || '',
        customer_address: document.getElementById('form-address').value || '',
        total: parseFloat(document.getElementById('form-total').value) || 0,
        items: JSON.parse(document.getElementById('form-items').value || '[]'),
      });
      toast('Pedido creado');
      navigate('#/orders');
    } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Crear pedido'; }
  };
}

/* ─── Helpers ─── */
function tableHtml(orders) {
  const statusBadge = { 'pendiente':'badge-gray','cocinando':'badge-orange','empacando':'badge-blue','en_camino':'badge-orange','entregado':'badge-green' };
  return `
  <div class="table-container">
    <table>
      <thead><tr>
        <th>External Ref</th><th>Sede</th><th>Estado</th><th>Cliente</th><th>Total</th><th>Creado</th><th></th>
      </tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><a href="#/orders/${o.external_ref}">${o.external_ref}</a></td>
            <td>${o.tenant_id}</td>
            <td><span class="badge ${statusBadge[o.status]||'badge-gray'}">${o.status}</span></td>
            <td>${o.customer_name || '—'}</td>
            <td>S/ ${o.total || '—'}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${formatDate(o.created_at)}</td>
            <td><a href="#/orders/${o.external_ref}" class="btn btn-secondary btn-sm">Ver</a></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function bindNav() {
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === location.hash);
  });
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.onclick = (e) => { e.preventDefault(); clearToken(); navigate('#/login'); };
}

/* ─── Init ─── */
render();
