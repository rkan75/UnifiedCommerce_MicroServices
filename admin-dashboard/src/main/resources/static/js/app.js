(function() {
  var content = document.getElementById('content');
  var pageTitle = document.getElementById('pageTitle');

  function getPage() {
    var path = window.location.pathname.replace(/\/$/, '') || '/app/products';
    if (path === '/app') path = '/app/products';
    var match = path.match(/\/app\/([^/]+)/);
    return match ? match[1] : 'products';
  }

  function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('data-page') === page);
    });
  }

  function setTitle(title) {
    if (pageTitle) pageTitle.textContent = title;
  }

  function renderTable(headers, rows, emptyMsg) {
    if (!rows || rows.length === 0) {
      return '<div class="card"><p class="empty">' + (emptyMsg || 'No data') + '</p></div>';
    }
    var keys = headers.map(function(h) { return h.key; });
    var thead = '<tr>' + headers.map(function(h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr>';
    var tbody = rows.map(function(row) {
      return '<tr>' + keys.map(function(k) {
        var v = row[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) v = v.title || v.name || JSON.stringify(v);
        return '<td>' + (v != null ? escapeHtml(String(v)) : '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="card"><div class="table-wrap"><table><thead>' + thead + '</tbody>' + tbody + '</table></div></div>';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function api(path) {
    return fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
  }

  function showLoading() {
    content.innerHTML = '<div class="card"><p class="loading">Loading…</p></div>';
  }

  function showError(msg) {
    content.innerHTML = '<div class="card"><p class="error-msg">' + escapeHtml(msg) + '</p></div>';
  }

  function renderProducts() {
    setTitle('Products');
    showLoading();
    api('/admin/products?limit=50').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.products) ? data.products : [];
        content.innerHTML = renderTable(
          [{ key: 'title', label: 'Title' }, { key: 'handle', label: 'Handle' }, { key: 'id', label: 'ID' }],
          list.map(function(p) { return { title: p.title, handle: p.handle, id: (p.id || '').substring(0, 8) }; }),
          'No products. Configure PRODUCTS_SERVICE_URL.'
        );
      })
      .catch(function() { showError('Failed to load products.'); });
  }

  function renderRegions() {
    setTitle('Regions');
    showLoading();
    api('/admin/regions').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.regions) ? data.regions : [];
        content.innerHTML = renderTable(
          [{ key: 'name', label: 'Name' }, { key: 'currency_code', label: 'Currency' }, { key: 'id', label: 'ID' }],
          list.map(function(r) { return { name: r.name, currency_code: r.currency_code, id: (r.id || '').substring(0, 8) }; }),
          'No regions. Configure REGIONS_SERVICE_URL.'
        );
      })
      .catch(function() { showError('Failed to load regions.'); });
  }

  function renderUsers() {
    setTitle('Users');
    showLoading();
    api('/admin/users').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.users) ? data.users : [];
        content.innerHTML = renderTable(
          [{ key: 'email', label: 'Email' }, { key: 'id', label: 'ID' }],
          list.map(function(u) { return { email: u.email || u.user_metadata?.email || '-', id: (u.id || '').substring(0, 8) }; }),
          'No users.'
        );
      })
      .catch(function() { showError('Failed to load users.'); });
  }

  function renderInvites() {
    setTitle('Invites');
    showLoading();
    api('/admin/invites').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.invites) ? data.invites : [];
        content.innerHTML = renderTable(
          [{ key: 'email', label: 'Email' }, { key: 'accepted', label: 'Accepted' }, { key: 'id', label: 'ID' }],
          list.map(function(i) { return { email: i.email, accepted: i.accepted != null ? (i.accepted ? 'Yes' : 'No') : '-', id: (i.id || '').substring(0, 8) }; }),
          'No invites.'
        );
      })
      .catch(function() { showError('Failed to load invites.'); });
  }

  function renderOrders() {
    setTitle('Orders');
    content.innerHTML = '<div class="card"><p class="empty">Orders list will be available when order service is connected.</p></div>';
  }

  function renderSettings() {
    setTitle('Settings');
    content.innerHTML = '<div class="card"><p class="empty">Settings and configuration.</p></div>';
  }

  var pages = {
    products: renderProducts,
    orders: renderOrders,
    regions: renderRegions,
    users: renderUsers,
    invites: renderInvites,
    settings: renderSettings
  };

  function init() {
    var page = getPage();
    setActiveNav(page);
    var fn = pages[page] || renderProducts;
    fn();
  }

  document.querySelectorAll('.sidebar-nav a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      window.history.pushState({}, '', this.getAttribute('href'));
      init();
    });
  });
  window.addEventListener('popstate', init);
  init();
})();
