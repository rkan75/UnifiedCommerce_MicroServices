(function() {
  var content = document.getElementById('content');
  var pageTitle = document.getElementById('pageTitle');
  var accountMenuTrigger = document.getElementById('accountMenuTrigger');
  var accountMenu = document.getElementById('accountMenu');
  var commandModal = document.getElementById('commandModal');
  var commandInput = document.getElementById('commandInput');
  var commandClear = document.getElementById('commandClear');
  var commandSections = document.getElementById('commandSections');
  var activeCommandIndex = 0;
  var visibleCommands = [];
  var commandTimer = null;
  var shortcutSeqBuffer = [];
  var shortcutSeqTimer = null;
  var SHORTCUT_SEQ_MS = 900;
  var PALETTE_PREVIEW_PER_TYPE = 3;

  var SEARCH_TYPE_TO_PATH = {
    products: '/app/products',
    campaigns: '/app/promotions',
    categories: '/app/product-categories',
    'customer-groups': '/app/customers',
    customers: '/app/customers',
    inventory: '/app/inventory',
    orders: '/app/orders',
    'price-lists': '/app/price-lists',
    promotions: '/app/promotions',
    reservations: '/app/orders',
    'product-types': '/app/products',
    profile: '/app/users',
    'publishable-api-keys': '/app/settings/publishable-api-keys',
    regions: '/app/regions',
    'return-reasons': '/app/orders',
    'sales-channels': '/app/settings/sales-channels',
    'secret-api-keys': '/app/settings/secret-api-keys',
    store: '/app/settings/store',
    'tax-regions': '/app/settings/tax-regions',
    users: '/app/users',
    workflows: '/app/settings/workflows'
  };

  var jumpCommands = [
    { label: 'Campaigns', path: '/app/promotions', shortcut: ['G', 'K'] },
    { label: 'Categories', path: '/app/product-categories', shortcut: ['G', 'A'] },
    { label: 'Collections', path: '/app/product-collections', shortcut: ['G', 'C'] },
    { label: 'Customer Groups', path: '/app/customers', shortcut: ['G', 'G'] },
    { label: 'Customers', path: '/app/customers', shortcut: ['G', 'U'] },
    { label: 'Inventory', path: '/app/inventory', shortcut: ['G', 'I'] },
    { label: 'Orders', path: '/app/orders', shortcut: ['G', 'O'] },
    { label: 'Price Lists', path: '/app/price-lists', shortcut: ['G', 'L'] },
    { label: 'Products', path: '/app/products', shortcut: ['G', 'P'] },
    { label: 'Promotions', path: '/app/promotions', shortcut: ['G', 'M'] },
    { label: 'Reservations', path: '/app/orders', shortcut: ['G', 'R'] },
    { label: 'Settings', path: '/app/settings/store', shortcut: ['G', ','] },
    { label: 'Locations', path: '/app/regions', shortcut: ['G', ',', 'L'] },
    { label: 'Product Types', path: '/app/products', shortcut: ['G', ',', 'P'] },
    { label: 'Profile', path: '/app/users', shortcut: ['G', ',', 'M'] },
    { label: 'Publishable API Keys', path: '/app/settings/publishable-api-keys', shortcut: ['G', ',', 'J'] },
    { label: 'Regions', path: '/app/regions', shortcut: ['G', ',', 'R'] },
    { label: 'Return reasons', path: '/app/orders', shortcut: ['G', ',', 'M'] },
    { label: 'Sales Channels', path: '/app/settings/sales-channels', shortcut: ['G', ',', 'A'] },
    { label: 'Secret API Keys', path: '/app/settings/secret-api-keys', shortcut: ['G', ',', 'K'] },
    { label: 'Store', path: '/app/settings/store', shortcut: ['G', ',', 'S'] },
    { label: 'Tax Regions', path: '/app/settings/tax-regions', shortcut: ['G', ',', 'T'] },
    { label: 'Users', path: '/app/users', shortcut: ['G', ',', 'U'] },
    { label: 'Workflows', path: '/app/settings/workflows', shortcut: ['G', ',', 'W'] }
  ];

  function getProductDetailId() {
    var path = (window.location.pathname || '').replace(/\/$/, '');
    var m = path.match(/^\/app\/products\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isPdpEditPath() {
    return /\/app\/products\/[^/]+\/edit$/.test((window.location.pathname || '').replace(/\/$/, ''));
  }

  function isPdpOptionsCreatePath() {
    return /\/app\/products\/[^/]+\/options\/create$/.test((window.location.pathname || '').replace(/\/$/, ''));
  }

  function getPdpOptionEditIdFromPath() {
    var path = (window.location.pathname || '').replace(/\/$/, '');
    var m = path.match(/^\/app\/products\/[^/]+\/options\/([^/]+)\/edit$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isPdpOptionsEditPath() {
    return !!getPdpOptionEditIdFromPath();
  }

  function isPdpOptionsDrawerPath() {
    return isPdpOptionsCreatePath() || isPdpOptionsEditPath();
  }

  function getPage() {
    if (getProductDetailId()) return 'product-detail';
    var path = window.location.pathname.replace(/\/$/, '') || '/app/products';
    if (path === '/app') path = '/app/products';
    if (path === '/app/settings') {
      return 'settings-store';
    }
    var match = path.match(/\/app\/(.+)$/);
    return match ? match[1].replace(/\//g, '-') : 'products';
  }

  function isSettingsPageKey(page) {
    return page === 'settings' || (page && String(page).indexOf('settings-') === 0);
  }

  function getSettingsSectionKey() {
    var p = getPage();
    if (p === 'settings' || p === 'settings-store') return 'store';
    if (p.indexOf('settings-') === 0) return p.replace(/^settings-/, '');
    return 'store';
  }

  function setActiveNav(page) {
    document.querySelectorAll('.nav-item, .nav-sub-item').forEach(function(a) {
      a.classList.remove('active', 'active-trail');
    });
    if (page === 'product-detail') {
      var prodNav = document.querySelector('.nav-item[data-page="products"]');
      if (prodNav) prodNav.classList.add('active', 'active-trail');
      return;
    }
    var el = document.querySelector('.nav-item[data-page="' + page + '"], .nav-sub-item[data-page="' + page + '"]');
    if (el) el.classList.add('active');
    if (page === 'product-categories' || page === 'product-collections') {
      var parent = document.querySelector('.nav-item[data-page="products"]');
      if (parent) parent.classList.add('active-trail');
    }
    if (isSettingsPageKey(page)) {
      var st = document.querySelector('.nav-item[data-page="settings"]');
      if (st) st.classList.add('active');
    }
  }

  function clearPageActions() {
    var pa = document.getElementById('pageActions');
    if (pa) pa.innerHTML = '';
  }

  function blankProductFilters() {
    return {
      type_id: '',
      type_label: '',
      tag: '',
      sales_channel_id: '',
      sales_channel_label: '',
      status: '',
      status_label: '',
      created_after: '',
      created_before: '',
      updated_after: '',
      updated_before: ''
    };
  }

  /** GET /store/product-tags → { tags: string[] | { value }[] } */
  function normalizeProductTagStrings(data) {
    var raw = data && data.tags;
    if (!Array.isArray(raw)) return [];
    var seen = {};
    var out = [];
    raw.forEach(function(t) {
      var s = '';
      if (t == null) return;
      if (typeof t === 'string') s = t;
      else if (typeof t === 'object' && t.value != null) s = String(t.value);
      else s = String(t);
      s = s.trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  var productListKeyHandler = null;
  var exportToastTimer = null;
  var productFilterDocClick = null;
  var productUi = {
    page: 1,
    pageSize: 20,
    q: '',
    order: '-created_at',
    selectedIndex: 0,
    rows: [],
    total: 0,
    /** When set, product table is filled from an imported CSV (Medusa format) instead of the API. */
    localCatalog: null,
    searchTimer: null,
    addFilterOpen: false,
    pendingAttribute: null,
    f: blankProductFilters(),
    popoverMode: '',
    suggestRows: [],
    suggestTimer: null,
    suggestLoadSeq: 0,
    suggestHighlight: -1
  };
  var collectionLabelById = {};

  function parseProductOrder(order) {
    var o = order || '-created_at';
    var desc = o.charAt(0) === '-';
    var col = desc ? o.slice(1) : o;
    col = String(col || '').toLowerCase();
    if (col === 'handle') col = 'title';
    if (col !== 'title' && col !== 'created_at' && col !== 'updated_at') {
      col = 'created_at';
      desc = true;
    }
    return { field: col, desc: desc };
  }

  function formatProductOrder(field, desc) {
    if (field === 'title') return desc ? '-title' : 'title';
    if (field === 'created_at') return desc ? '-created_at' : 'created_at';
    if (field === 'updated_at') return desc ? '-updated_at' : 'updated_at';
    return '-created_at';
  }

  function ensureProductSortState() {
    var p = parseProductOrder(productUi.order);
    productUi.sortField = p.field;
    productUi.sortDir = p.desc ? 'desc' : 'asc';
  }

  function closeProductSortMenu() {
    var sortMenu = document.getElementById('productSortMenu');
    var sortTrigger = document.getElementById('productSortTrigger');
    if (sortMenu) sortMenu.classList.add('hidden');
    if (sortTrigger) sortTrigger.setAttribute('aria-expanded', 'false');
  }

  function hideProductSearchSuggest() {
    var box = document.getElementById('productSearchSuggest');
    if (box) {
      box.classList.add('hidden');
      box.innerHTML = '';
    }
    productUi.suggestRows = [];
    productUi.suggestHighlight = -1;
  }

  function detachProductListKeys() {
    if (productListKeyHandler) {
      document.removeEventListener('keydown', productListKeyHandler, true);
      productListKeyHandler = null;
    }
    if (productUi._addMenuCloser) {
      document.removeEventListener('mousedown', productUi._addMenuCloser, true);
      productUi._addMenuCloser = null;
    }
    if (productUi._sortMenuCloser) {
      document.removeEventListener('mousedown', productUi._sortMenuCloser, true);
      productUi._sortMenuCloser = null;
    }
    if (productUi._suggestCloser) {
      document.removeEventListener('mousedown', productUi._suggestCloser, true);
      productUi._suggestCloser = null;
    }
    closeProductFilterPopover();
    closeProductSortMenu();
    hideProductSearchSuggest();
    closeProductExportDrawer();
    closeProductImportModal();
    if (window.ProductCreateUI && typeof ProductCreateUI.close === 'function') ProductCreateUI.close();
  }

  function thumbUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var t = url.trim();
    return t;
  }

  function statusClass(status) {
    var s = (status || '').toLowerCase();
    if (s === 'published') return 'published';
    if (s === 'draft' || s === 'proposed') return 'draft';
    return '';
  }

  function statusLabel(status) {
    if (!status) return '—';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  /**
   * Product export: POST /admin/products/export starts an async job on products-service; UI polls job status then downloads CSV.
   * GET /admin/notifications lists export-complete entries (in-memory; poll for a future bell UI).
   */
  function dismissExportToast() {
    if (exportToastTimer) {
      clearTimeout(exportToastTimer);
      exportToastTimer = null;
    }
    var host = document.getElementById('exportToastHost');
    if (host) host.innerHTML = '';
  }

  function showExportProcessingToast() {
    dismissExportToast();
    var host = document.getElementById('exportToastHost');
    if (!host) return;
    host.innerHTML =
      '<div class="export-toast export-toast--processing" role="status">' +
      '<span class="export-toast-icon" aria-hidden="true">i</span>' +
      '<div class="export-toast-text">' +
      '<div class="export-toast-title">We are processing your export</div>' +
      '<div class="export-toast-body">Exporting data may take a few minutes. We will notify you when we are done.</div>' +
      '</div>' +
      '<button type="button" class="export-toast-dismiss" aria-label="Dismiss">×</button></div>';
    var btn = host.querySelector('.export-toast-dismiss');
    if (btn) btn.addEventListener('click', dismissExportToast);
  }

  function showExportDoneToast() {
    dismissExportToast();
    var host = document.getElementById('exportToastHost');
    if (!host) return;
    host.innerHTML =
      '<div class="export-toast export-toast--done" role="status">' +
      '<span class="export-toast-icon" aria-hidden="true">i</span>' +
      '<div class="export-toast-text">' +
      '<div class="export-toast-title">Export ready</div>' +
      '<div class="export-toast-body">Your CSV download should begin shortly.</div>' +
      '</div>' +
      '<button type="button" class="export-toast-dismiss" aria-label="Dismiss">×</button></div>';
    var btn = host.querySelector('.export-toast-dismiss');
    if (btn) btn.addEventListener('click', dismissExportToast);
    exportToastTimer = setTimeout(dismissExportToast, 6000);
  }

  function closeProductExportDrawer() {
    var drawer = document.getElementById('productExportDrawer');
    var backdrop = document.getElementById('productExportBackdrop');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('export-drawer-open');
  }

  function describeProductOrderForExport() {
    var p = parseProductOrder(productUi.order);
    var title = { asc: 'Title (A–Z)', desc: 'Title (Z–A)' };
    var created = { asc: 'Created (oldest first)', desc: 'Created (newest first)' };
    var updated = { asc: 'Updated (oldest first)', desc: 'Updated (newest first)' };
    if (p.field === 'title') return p.desc ? title.desc : title.asc;
    if (p.field === 'updated_at') return p.desc ? updated.desc : updated.asc;
    return p.desc ? created.desc : created.asc;
  }

  function getProductExportFilterLines() {
    var lines = [];
    var f = productUi.f;
    if (productUi.q && String(productUi.q).trim()) {
      lines.push({ label: 'Search', value: String(productUi.q).trim() });
    }
    if (f.type_id) lines.push({ label: 'Type', value: f.type_label || f.type_id });
    if (f.tag) lines.push({ label: 'Tag', value: f.tag });
    if (f.sales_channel_id) {
      lines.push({ label: 'Sales channel', value: f.sales_channel_label || f.sales_channel_id });
    }
    if (f.status) lines.push({ label: 'Status', value: f.status_label || f.status });
    if (f.created_after || f.created_before) {
      lines.push({
        label: 'Created',
        value: (f.created_after || '…') + ' – ' + (f.created_before || '…')
      });
    }
    if (f.updated_after || f.updated_before) {
      lines.push({
        label: 'Updated',
        value: (f.updated_after || '…') + ' – ' + (f.updated_before || '…')
      });
    }
    lines.push({ label: 'Sort', value: describeProductOrderForExport() });
    return lines;
  }

  function renderProductExportFilterList() {
    var ul = document.getElementById('productExportFilterList');
    if (!ul) return;
    var lines = getProductExportFilterLines();
    ul.innerHTML = lines
      .map(function(line) {
        return (
          '<li class="export-drawer-filter-item">' +
          '<span class="export-drawer-filter-label">' +
          escapeHtml(line.label) +
          '</span> ' +
          '<span class="export-drawer-filter-value">' +
          escapeHtml(line.value) +
          '</span></li>'
        );
      })
      .join('');
  }

  function openProductExportDrawer() {
    renderProductExportFilterList();
    var drawer = document.getElementById('productExportDrawer');
    var backdrop = document.getElementById('productExportBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('export-drawer-open');
    var confirmBtn = document.getElementById('productExportConfirm');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.focus();
    }
  }

  function buildProductExportRequestBody() {
    var f = productUi.f;
    var o = {};
    if (productUi.q && String(productUi.q).trim()) o.q = String(productUi.q).trim();
    if (productUi.order) o.order = productUi.order;
    if (f.type_id) o.type_id = f.type_id;
    if (f.tag) o.tag = f.tag;
    if (f.sales_channel_id) o.sales_channel_id = f.sales_channel_id;
    if (f.status) o.status = f.status;
    if (f.created_after) o.created_after = f.created_after;
    if (f.created_before) o.created_before = f.created_before;
    if (f.updated_after) o.updated_after = f.updated_after;
    if (f.updated_before) o.updated_before = f.updated_before;
    return o;
  }

  function pollExportJobUntilDone(jobId) {
    var delayMs = 450;
    var maxAttempts = 800;
    function attempt(n) {
      return api('/admin/products/export/' + encodeURIComponent(jobId))
        .then(function(r) {
          if (r.status === 404) throw new Error('Export job not found.');
          if (!r.ok) throw new Error('Status HTTP ' + r.status);
          return r.json();
        })
        .then(function(job) {
          var st = String(job.status || '').toLowerCase();
          if (st === 'completed') return job;
          if (st === 'failed') {
            var msg = job.error_message || 'Export failed.';
            throw new Error(msg);
          }
          if (n >= maxAttempts) throw new Error('Export is taking longer than expected. Check notifications and try again.');
          return new Promise(function(resolve) { setTimeout(resolve, delayMs); }).then(function() { return attempt(n + 1); });
        });
    }
    return attempt(0);
  }

  function runProductExportFromDrawer() {
    var confirmBtn = document.getElementById('productExportConfirm');
    if (confirmBtn) confirmBtn.disabled = true;
    closeProductExportDrawer();
    showExportProcessingToast();
    var payload = buildProductExportRequestBody();
    fetch('/admin/products/export', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        if (!r.ok) throw new Error('Could not start export (HTTP ' + r.status + ').');
        return r.json();
      })
      .then(function(data) {
        var jobId = data.job_id;
        if (!jobId) throw new Error('No job id returned.');
        return pollExportJobUntilDone(jobId);
      })
      .then(function(job) {
        dismissExportToast();
        var url = job.file_url;
        if (!url) throw new Error('Export completed but no file URL.');
        return fetch(url, { credentials: 'include' }).then(function(r) {
          if (r.status === 409) {
            throw new Error('Export file is not ready yet.');
          }
          if (!r.ok) throw new Error('Download failed (HTTP ' + r.status + ').');
          return r.blob();
        }).then(function(blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob || new Blob());
          a.download = 'products-export.csv';
          a.click();
          URL.revokeObjectURL(a.href);
          showExportDoneToast();
        });
      })
      .catch(function(err) {
        dismissExportToast();
        alert(err && err.message ? err.message : 'Export failed.');
      })
      .then(function() {
        if (confirmBtn) confirmBtn.disabled = false;
      });
  }

  var exportDrawerWired = false;
  function wireProductExportDrawer() {
    if (exportDrawerWired) return;
    var backdrop = document.getElementById('productExportBackdrop');
    var drawer = document.getElementById('productExportDrawer');
    var closeBtn = document.getElementById('productExportClose');
    var cancelBtn = document.getElementById('productExportCancel');
    var confirmBtn = document.getElementById('productExportConfirm');
    if (!drawer) return;
    exportDrawerWired = true;
    function close() {
      closeProductExportDrawer();
    }
    if (backdrop) backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (confirmBtn) confirmBtn.addEventListener('click', runProductExportFromDrawer);
  }

  function closeProductImportModal() {
    var backdrop = document.getElementById('productImportBackdrop');
    var modal = document.getElementById('productImportModal');
    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('import-modal-open');
  }

  function openProductImportModal() {
    var backdrop = document.getElementById('productImportBackdrop');
    var modal = document.getElementById('productImportModal');
    if (!backdrop || !modal) return;
    resetProductImportModalForm();
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('import-modal-open');
    var dz = document.getElementById('productImportDropzone');
    if (dz) dz.focus();
  }

  function resetProductImportModalForm() {
    var input = document.getElementById('productImportFileInput');
    var label = document.getElementById('productImportFileLabel');
    var confirmBtn = document.getElementById('productImportConfirm');
    if (input) input.value = '';
    if (label) {
      label.textContent = '';
      label.classList.add('hidden');
    }
    if (confirmBtn) confirmBtn.disabled = true;
  }

  function syncProductImportFileUi(file) {
    var label = document.getElementById('productImportFileLabel');
    var confirmBtn = document.getElementById('productImportConfirm');
    if (label) {
      if (file && file.name) {
        label.textContent = file.name;
        label.classList.remove('hidden');
      } else {
        label.textContent = '';
        label.classList.add('hidden');
      }
    }
    if (confirmBtn) confirmBtn.disabled = !file;
  }

  /**
   * RFC 4180-style CSV rows (handles quoted fields and newlines inside quotes).
   */
  function parseCsvToRows(text) {
    var rows = [];
    var field = '';
    var row = [];
    var inQuotes = false;
    var i = 0;
    var t = text == null ? '' : String(text);
    while (i < t.length) {
      var c = t.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (t.charAt(i + 1) === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (c === '\r') {
        i++;
        continue;
      }
      if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      field += c;
      i++;
    }
    row.push(field);
    rows.push(row);
    return rows;
  }

  function parseMedusaImportBoolean(cell) {
    var s = String(cell == null ? '' : cell).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'YES';
  }

  function normalizeImportProductStatus(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!s) return 'draft';
    return s;
  }

  /**
   * Medusa product import CSV: one row per variant; repeated product columns on each row.
   * @returns {Array<Object>} list compatible with product table rows (id, title, handle, thumbnail, status, collection_id, variants)
   */
  function medusaCsvTextToProducts(text) {
    var rows = parseCsvToRows(text);
    while (rows.length && rows[rows.length - 1].every(function(c) { return !String(c || '').trim(); })) {
      rows.pop();
    }
    if (rows.length < 2) {
      throw new Error('The file needs a header row and at least one product row.');
    }
    var headers = rows[0].map(function(h) { return String(h).trim(); });
    var col = {};
    headers.forEach(function(h, idx) {
      col[h] = idx;
    });
    function idxOf(name) {
      return col[name] !== undefined ? col[name] : -1;
    }
    function getCell(cells, name) {
      var i = idxOf(name);
      if (i < 0) return '';
      return cells[i] != null ? String(cells[i]) : '';
    }
    if (idxOf('Product Handle') < 0 || idxOf('Product Title') < 0) {
      throw new Error('Missing required columns (need Product Handle and Product Title). Download the template for the correct format.');
    }
    var products = [];
    var current = null;
    for (var ri = 1; ri < rows.length; ri++) {
      var cells = rows[ri];
      if (!cells || !cells.length) continue;
      if (cells.every(function(c) { return !String(c || '').trim(); })) continue;
      var handle = getCell(cells, 'Product Handle').trim();
      var title = getCell(cells, 'Product Title').trim();
      if (!handle && !title) continue;
      if (!current || current.handle !== handle) {
        if (current) products.push(current);
        var pid = getCell(cells, 'Product Id').trim();
        current = {
          id: pid || 'import:' + handle + ':' + ri,
          handle: handle,
          title: title || handle,
          description: getCell(cells, 'Product Description'),
          thumbnail: getCell(cells, 'Product Thumbnail').trim(),
          status: normalizeImportProductStatus(getCell(cells, 'Product Status')),
          collection_id: getCell(cells, 'Product Collection Id').trim() || null,
          type_id: getCell(cells, 'Product Type Id').trim() || null,
          discountable: (function() {
            var c = getCell(cells, 'Product Discountable').trim();
            if (!c) return true;
            return parseMedusaImportBoolean(c);
          })(),
          variants: []
        };
      }
      var vid = getCell(cells, 'Variant Id').trim();
      var vtitle = getCell(cells, 'Variant Title').trim() || 'Default';
      var pu = getCell(cells, 'Variant Price USD').trim();
      var pe = getCell(cells, 'Variant Price EUR').trim();
      current.variants.push({
        id: vid || 'import-v:' + handle + ':' + current.variants.length,
        title: vtitle,
        sku: getCell(cells, 'Variant SKU').trim() || null,
        calculated_price: null,
        priceUsd: pu,
        priceEur: pe,
        manage_inventory: parseMedusaImportBoolean(getCell(cells, 'Variant Manage Inventory')),
        allow_backorder: parseMedusaImportBoolean(getCell(cells, 'Variant Allow Backorder'))
      });
    }
    if (current) products.push(current);
    if (!products.length) {
      throw new Error('No product rows found. Check the file matches the Medusa import template.');
    }
    return products;
  }

  /** Maps parsed CSV product rows to POST /admin/products JSON (Medusa create shape). */
  function importedProductToCreatePayload(p) {
    var variants = (p.variants || []).map(function(v) {
      var prices = [];
      if (v.priceUsd != null && v.priceUsd !== '' && !isNaN(Number(v.priceUsd))) {
        prices.push({ calculated_amount: Math.round(Number(v.priceUsd) * 100), currency_code: 'usd' });
      }
      if (v.priceEur != null && v.priceEur !== '' && !isNaN(Number(v.priceEur))) {
        prices.push({ calculated_amount: Math.round(Number(v.priceEur) * 100), currency_code: 'eur' });
      }
      var cp = prices.length ? prices[0] : null;
      var meta = {};
      if (prices.length > 1) {
        meta.extra_prices = prices.slice(1);
      }
      var o = {
        title: v.title,
        sku: v.sku || null,
        manage_inventory: !!v.manage_inventory,
        allow_backorder: !!v.allow_backorder,
        calculated_price: cp
      };
      if (Object.keys(meta).length) {
        o.metadata = meta;
      }
      return o;
    });
    return {
      title: p.title,
      handle: p.handle,
      description: p.description || '',
      thumbnail: p.thumbnail || '',
      status: p.status || 'draft',
      type: p.type_id ? { id: p.type_id } : null,
      collection_id: p.collection_id,
      variants: variants,
      metadata: {
        discountable: p.discountable !== false
      }
    };
  }

  function discardProductImportPreview() {
    productUi.localCatalog = null;
    productUi.page = 1;
    productUi.selectedIndex = 0;
    refreshProductImportBanner();
    loadProductsTable();
  }

  function refreshProductImportBanner() {
    var el = document.getElementById('productImportBanner');
    if (!el) return;
    if (productUi.localCatalog != null) {
      el.classList.remove('hidden');
      el.innerHTML =
        '<span>Showing <strong>' +
        productUi.localCatalog.length +
        '</strong> product' +
        (productUi.localCatalog.length === 1 ? '' : 's') +
        ' in a local preview only. Use “Reload from server” to see the live catalog.</span>' +
        '<button type="button" id="productImportDiscard">Reload from server</button>';
      var btn = el.querySelector('#productImportDiscard');
      if (btn) {
        btn.addEventListener('click', function() {
          discardProductImportPreview();
        });
      }
    } else {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }

  function runProductImportFromModal() {
    var input = document.getElementById('productImportFileInput');
    var confirmBtn = document.getElementById('productImportConfirm');
    if (!input || !input.files || !input.files[0]) {
      alert('Choose a CSV file first.');
      return;
    }
    var file = input.files[0];
    var name = (file.name || '').toLowerCase();
    if (!name.endsWith('.csv')) {
      alert('Please upload a CSV file (use Save As CSV in Excel, or the downloaded template).');
      return;
    }
    if (confirmBtn) confirmBtn.disabled = true;
    var reader = new FileReader();
    reader.onload = function() {
      try {
        var text = String(reader.result || '');
        var products = medusaCsvTextToProducts(text);
        var vcount = products.reduce(function(n, p) {
          return n + ((p.variants && p.variants.length) ? p.variants.length : 0);
        }, 0);
        var msg =
          'Create ' +
          products.length +
          ' product' +
          (products.length === 1 ? '' : 's') +
          ' (' +
          vcount +
          ' variant row' +
          (vcount === 1 ? '' : 's') +
          ') in the database from this file? Duplicate handles will fail for those rows. Continue?';
        if (!window.confirm(msg)) {
          if (confirmBtn) confirmBtn.disabled = false;
          return;
        }
        var payloads = products.map(importedProductToCreatePayload);
        fetch('/admin/products/batch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ products: payloads })
        })
          .then(function(r) {
            return r.json().then(function(j) {
              return { ok: r.ok, status: r.status, j: j };
            });
          })
          .then(function(pair) {
            if (!pair.ok) {
              var em = (pair.j && (pair.j.message || pair.j.error)) || 'Batch import failed (HTTP ' + pair.status + ').';
              throw new Error(em);
            }
            var created = pair.j.created != null ? pair.j.created : 0;
            var errs = pair.j.errors || [];
            if (errs.length && created === 0) {
              alert(
                'No products were created. ' +
                  errs
                    .map(function(e) {
                      return (e.message || '') + ' (index ' + e.index + ')';
                    })
                    .join('; ')
              );
              return;
            }
            if (errs.length) {
              alert(
                'Created ' +
                  created +
                  ' product(s). Some rows failed: ' +
                  errs
                    .map(function(e) {
                      return (e.message || '') + ' (index ' + e.index + ')';
                    })
                    .join('; ')
              );
            }
            productUi.localCatalog = null;
            refreshProductImportBanner();
            closeProductImportModal();
            resetProductImportModalForm();
            loadProductsTable();
          })
          .catch(function(err) {
            alert(err && err.message ? err.message : 'Import failed.');
          })
          .then(function() {
            if (confirmBtn) confirmBtn.disabled = false;
          });
        return;
      } catch (err) {
        alert(err && err.message ? err.message : 'Could not read that CSV file.');
      }
      if (confirmBtn) confirmBtn.disabled = false;
    };
    reader.onerror = function() {
      alert('Could not read the file.');
      if (confirmBtn) confirmBtn.disabled = false;
    };
    reader.readAsText(file, 'UTF-8');
  }

  var importModalWired = false;
  function wireProductImportModal() {
    if (importModalWired) return;
    var backdrop = document.getElementById('productImportBackdrop');
    var modal = document.getElementById('productImportModal');
    var closeBtn = document.getElementById('productImportClose');
    var cancelBtn = document.getElementById('productImportCancel');
    var confirmBtn = document.getElementById('productImportConfirm');
    var dropzone = document.getElementById('productImportDropzone');
    var fileInput = document.getElementById('productImportFileInput');
    if (!backdrop || !modal) return;
    importModalWired = true;
    function close() {
      closeProductImportModal();
    }
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (confirmBtn) confirmBtn.addEventListener('click', runProductImportFromModal);
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', function() {
        fileInput.click();
      });
      dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('import-dropzone--drag');
      });
      dropzone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropzone.classList.remove('import-dropzone--drag');
      });
      dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('import-dropzone--drag');
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
          try {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            fileInput.files = dt.files;
          } catch (err) {
            alert('Could not attach the dropped file; use click to upload instead.');
            return;
          }
          syncProductImportFileUi(files[0]);
        }
      });
      fileInput.addEventListener('change', function() {
        var f = fileInput.files && fileInput.files[0];
        syncProductImportFileUi(f || null);
      });
    }
  }

  function activeFilterKeys() {
    var f = productUi.f;
    var keys = [];
    if (f.type_id) keys.push('type');
    if (f.tag) keys.push('tag');
    if (f.sales_channel_id) keys.push('sales_channel');
    if (f.status) keys.push('status');
    if (f.created_after || f.created_before) keys.push('created');
    if (f.updated_after || f.updated_before) keys.push('updated');
    return keys;
  }

  function filterKeyHasValue(key) {
    var f = productUi.f;
    if (key === 'type') return !!f.type_id;
    if (key === 'tag') return !!f.tag;
    if (key === 'sales_channel') return !!f.sales_channel_id;
    if (key === 'status') return !!f.status;
    if (key === 'created') return !!(f.created_after || f.created_before);
    if (key === 'updated') return !!(f.updated_after || f.updated_before);
    return false;
  }

  function clearPendingIfPopoverDismissedWithoutValue() {
    var p = productUi.pendingAttribute;
    if (!p) return;
    if (!filterKeyHasValue(p)) productUi.pendingAttribute = null;
  }

  function renderProductFilterPills() {
    var el = document.getElementById('filterPills');
    if (!el) return;
    var f = productUi.f;
    var pa = productUi.pendingAttribute;
    var parts = [];
    var pendingLabels = { type: 'Type', tag: 'Tag', sales_channel: 'Sales Channel', status: 'Status', created: 'Created', updated: 'Updated' };

    if (pa && !filterKeyHasValue(pa)) {
      parts.push(
        '<div class="filter-pill" data-pill-key="' + escapeHtml(pa) + '" data-pill-pending="1">' +
        '<span class="filter-pill-single">' + escapeHtml(pendingLabels[pa] || pa) + '</span>' +
        '<button type="button" class="filter-pill-remove" data-remove-filter="' + escapeHtml(pa) + '" aria-label="Dismiss">×</button></div>'
      );
    }

    function pill(key, label, value, display) {
      if (!value) return;
      parts.push(
        '<div class="filter-pill" data-pill-key="' + key + '">' +
        '<span class="filter-pill-label">' + escapeHtml(label) + '</span>' +
        '<span class="filter-pill-value">' + escapeHtml(display || String(value)) + '</span>' +
        '<button type="button" class="filter-pill-remove" data-remove-filter="' + escapeHtml(key) + '" aria-label="Remove">×</button></div>'
      );
    }
    pill('type', 'Type', f.type_id, f.type_label || f.type_id);
    pill('tag', 'Tag', f.tag, f.tag);
    pill('sales_channel', 'Sales Channel', f.sales_channel_id, f.sales_channel_label || f.sales_channel_id);
    pill('status', 'Status', f.status, f.status_label || f.status);
    if (f.created_after || f.created_before) {
      var dcr = (f.created_after || '…') + ' – ' + (f.created_before || '…');
      parts.push('<div class="filter-pill" data-pill-key="created"><span class="filter-pill-label">Created</span><span class="filter-pill-value">' + escapeHtml(dcr) + '</span><button type="button" class="filter-pill-remove" data-remove-filter="created" aria-label="Remove">×</button></div>');
    }
    if (f.updated_after || f.updated_before) {
      var dup = (f.updated_after || '…') + ' – ' + (f.updated_before || '…');
      parts.push('<div class="filter-pill" data-pill-key="updated"><span class="filter-pill-label">Updated</span><span class="filter-pill-value">' + escapeHtml(dup) + '</span><button type="button" class="filter-pill-remove" data-remove-filter="updated" aria-label="Remove">×</button></div>');
    }
    el.innerHTML = parts.join('');
    el.querySelectorAll('.filter-pill[data-pill-key]').forEach(function(node) {
      node.addEventListener('click', function(e) {
        if (e.target.getAttribute('data-remove-filter')) return;
        productUi.pendingAttribute = null;
        openProductFilterPopoverForMode(node.getAttribute('data-pill-key'), node);
      });
    });
    el.querySelectorAll('[data-remove-filter]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeProductFilter(btn.getAttribute('data-remove-filter'));
      });
    });

    var clr = document.getElementById('filterClearAll');
    if (clr) {
      var showClear = activeFilterKeys().length > 0 || !!productUi.pendingAttribute;
      clr.classList.toggle('hidden', !showClear);
    }
  }

  function removeProductFilter(key) {
    if (productUi.pendingAttribute === key && !filterKeyHasValue(key)) {
      productUi.pendingAttribute = null;
      closeProductFilterPopover();
      return;
    }
    var f = productUi.f;
    if (key === 'type') { f.type_id = ''; f.type_label = ''; }
    if (key === 'tag') f.tag = '';
    if (key === 'sales_channel') { f.sales_channel_id = ''; f.sales_channel_label = ''; }
    if (key === 'status') { f.status = ''; f.status_label = ''; }
    if (key === 'created') { f.created_after = ''; f.created_before = ''; }
    if (key === 'updated') { f.updated_after = ''; f.updated_before = ''; }
    if (productUi.pendingAttribute === key) productUi.pendingAttribute = null;
    closeProductFilterPopover();
    productUi.page = 1;
    productUi.selectedIndex = 0;
    loadProductsTable();
  }

  function clearAllProductFiltersAndReload() {
    productUi.f = blankProductFilters();
    productUi.pendingAttribute = null;
    closeProductFilterPopover();
    hideProductSearchSuggest();
    var menu = document.getElementById('addFilterMenu');
    if (menu) menu.classList.add('hidden');
    productUi.addFilterOpen = false;
    productUi.page = 1;
    productUi.selectedIndex = 0;
    loadProductsTable();
  }

  function syncAddFilterMenuDisabled() {
    var active = activeFilterKeys();
    var pend = productUi.pendingAttribute;
    document.querySelectorAll('#addFilterMenu .filter-menu-item').forEach(function(btn) {
      var k = btn.getAttribute('data-add-filter');
      if (!k) return;
      btn.disabled = active.indexOf(k) >= 0 || pend === k;
    });
  }

  /**
   * @param {object} opts - preservePending: true = only tear down popover UI (e.g. before opening another); omit to clear dismissed pending + refresh pills/Clear all.
   */
  function closeProductFilterPopover(opts) {
    opts = opts || {};
    var pop = document.getElementById('filterValuePopover');
    if (pop) {
      pop.classList.add('hidden');
      pop.innerHTML = '';
    }
    productUi.popoverMode = '';
    if (productFilterDocClick) {
      document.removeEventListener('mousedown', productFilterDocClick, true);
      productFilterDocClick = null;
    }
    if (!opts.preservePending) {
      clearPendingIfPopoverDismissedWithoutValue();
      if (document.getElementById('filterPills')) {
        renderProductFilterPills();
        syncAddFilterMenuDisabled();
      }
    }
    productUi._filterPopoverAnchor = null;
  }

  /** Menu rows live under display:none when closed — their getBoundingClientRect is 0×0; never anchor to those. */
  function resolveProductFilterPopoverAnchor(mode, hintEl) {
    function usable(el) {
      if (!el || typeof el.getBoundingClientRect !== 'function') return null;
      var r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return null;
      return el;
    }
    var u = usable(hintEl);
    if (u) return u;
    if (mode) {
      var pill = document.querySelector('#filterPills .filter-pill[data-pill-key="' + mode + '"]');
      u = usable(pill);
      if (u) return u;
    }
    return usable(document.getElementById('productFilterToggle')) || document.getElementById('productFilterToggle');
  }

  function positionProductPopover(anchorEl) {
    var pop = document.getElementById('filterValuePopover');
    var container = document.querySelector('.filter-toolbar-left');
    if (!pop || !container) return;
    var mode = productUi.popoverMode;
    var el = anchorEl || resolveProductFilterPopoverAnchor(mode, null);
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) {
      el = resolveProductFilterPopoverAnchor(mode, null);
      productUi._filterPopoverAnchor = el;
      if (!el) return;
      r = el.getBoundingClientRect();
    }
    var cr = container.getBoundingClientRect();
    var top = r.bottom - cr.top + 6;
    var left = r.left - cr.left;
    var cw = container.getBoundingClientRect().width;
    var maxLeft = Math.max(0, cw - 372);
    left = Math.max(0, Math.min(left, maxLeft));
    pop.style.position = 'absolute';
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    pop.style.right = 'auto';
  }

  function scheduleProductFilterPopoverPosition() {
    requestAnimationFrame(function() {
      if (!productUi.popoverMode) return;
      positionProductPopover(productUi._filterPopoverAnchor);
    });
  }

  function openProductFilterPopoverForMode(mode, anchorEl) {
    closeProductFilterPopover({ preservePending: true });
    productUi.popoverMode = mode;
    productUi._filterPopoverAnchor = resolveProductFilterPopoverAnchor(mode, anchorEl);
    var pop = document.getElementById('filterValuePopover');
    if (!pop) return;

    if (mode === 'type') {
      pop.innerHTML = '<input type="search" class="filter-popover-search" id="filterPopoverSearch" placeholder="Search" /><div class="filter-popover-list" id="filterPopoverList"></div>';
      pop.classList.remove('hidden');
      positionProductPopover(productUi._filterPopoverAnchor);
      scheduleProductFilterPopoverPosition();
      api('/admin/product-types').then(function(r) { return r.json(); }).then(function(data) {
        var types = (data && data.product_types) ? data.product_types : [];
        function renderTypeList(filterTxt) {
          var ft = (filterTxt || '').toLowerCase();
          var items = types.filter(function(t) {
            var v = (t.value || '') + ' ' + (t.id || '');
            return !ft || v.toLowerCase().indexOf(ft) >= 0;
          });
          var listEl = document.getElementById('filterPopoverList');
          if (!listEl) return;
          listEl.innerHTML = items.map(function(t) {
            return '<button type="button" class="filter-popover-item" data-type-id="' + escapeHtml(t.id || '') + '" data-type-label="' + escapeHtml(t.value || t.id || '') + '">' + escapeHtml(t.value || t.id || '') + '</button>';
          }).join('') || '<p style="padding:12px;color:#64748b;font-size:0.9rem;">No types.</p>';
          listEl.querySelectorAll('.filter-popover-item').forEach(function(b) {
            b.addEventListener('click', function() {
              productUi.pendingAttribute = null;
              productUi.f.type_id = b.getAttribute('data-type-id');
              productUi.f.type_label = b.getAttribute('data-type-label');
              closeProductFilterPopover();
              productUi.page = 1;
              loadProductsTable();
            });
          });
        }
        renderTypeList('');
        var si = document.getElementById('filterPopoverSearch');
        if (si) {
          si.addEventListener('input', function() { renderTypeList(si.value); });
          si.focus();
        }
        scheduleProductFilterPopoverPosition();
      });
    } else if (mode === 'tag') {
      pop.innerHTML = '<input type="search" class="filter-popover-search" id="filterPopoverSearch" placeholder="Search" /><div class="filter-popover-list" id="filterPopoverList"></div>';
      pop.classList.remove('hidden');
      positionProductPopover(productUi._filterPopoverAnchor);
      scheduleProductFilterPopoverPosition();
      api('/admin/product-tags').then(function(r) {
        if (!r.ok) throw new Error('tags');
        return r.json();
      }).then(function(data) {
        var tags = normalizeProductTagStrings(data);
        function renderTagList(filterTxt) {
          var ft = (filterTxt || '').toLowerCase().trim();
          var listEl = document.getElementById('filterPopoverList');
          if (!listEl) return;
          var items = tags.filter(function(t) { return !ft || t.toLowerCase().indexOf(ft) >= 0; });
          var html = items.map(function(t) {
            return '<button type="button" class="filter-popover-item" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
          }).join('');
          if (!html && ft) {
            html = '<button type="button" class="filter-popover-item" data-tag="' + escapeHtml(ft) + '">Use “' + escapeHtml(ft) + '”</button>';
          } else if (!html) {
            html = '<p style="padding:12px;color:#64748b;font-size:0.9rem;">No tags found. Type a term and press Enter.</p>';
          }
          listEl.innerHTML = html;
          listEl.querySelectorAll('[data-tag]').forEach(function(b) {
            b.addEventListener('click', function() {
              productUi.pendingAttribute = null;
              productUi.f.tag = b.getAttribute('data-tag');
              closeProductFilterPopover();
              productUi.page = 1;
              loadProductsTable();
            });
          });
        }
        renderTagList('');
        var si = document.getElementById('filterPopoverSearch');
        if (si) {
          si.addEventListener('input', function() { renderTagList(si.value); });
          si.addEventListener('keydown', function(ev) {
            if (ev.key === 'Enter' && si.value.trim()) {
              productUi.pendingAttribute = null;
              productUi.f.tag = si.value.trim();
              closeProductFilterPopover();
              productUi.page = 1;
              loadProductsTable();
            }
          });
          si.focus();
        }
        scheduleProductFilterPopoverPosition();
      }).catch(function() {
        var listEl = document.getElementById('filterPopoverList');
        if (listEl) {
          listEl.innerHTML = '<p style="padding:12px;color:#64748b;font-size:0.9rem;">Could not load tags. Ensure products-service is running and the DB has <code>product.metadata.tags</code> or set relational tag tables (see <code>CATALOG_PRODUCT_TAG_LINK_TABLE</code>).</p>';
        }
        scheduleProductFilterPopoverPosition();
      });
    } else if (mode === 'sales_channel') {
      pop.innerHTML = '<input type="search" class="filter-popover-search" id="filterPopoverSearch" placeholder="Search" /><div class="filter-popover-list" id="filterPopoverList"></div>';
      pop.classList.remove('hidden');
      positionProductPopover(productUi._filterPopoverAnchor);
      scheduleProductFilterPopoverPosition();
      api('/admin/sales-channels').then(function(r) { return r.json(); }).then(function(data) {
        var ch = (data && data.sales_channels) ? data.sales_channels : [];
        function renderChList(filterTxt) {
          var ft = (filterTxt || '').toLowerCase();
          var items = ch.filter(function(c) {
            var n = (c.name || '') + ' ' + (c.id || '');
            return !ft || n.toLowerCase().indexOf(ft) >= 0;
          });
          var listEl = document.getElementById('filterPopoverList');
          if (!listEl) return;
          listEl.innerHTML = items.map(function(c) {
            return '<button type="button" class="filter-popover-item" data-sc-id="' + escapeHtml(c.id || '') + '" data-sc-name="' + escapeHtml(c.name || c.id || '') + '">' + escapeHtml(c.name || c.id || '') + '</button>';
          }).join('') || '<p style="padding:12px;color:#64748b;font-size:0.875rem;">No sales channels. Set <code>CATALOG_PRODUCT_SALES_CHANNEL_LINK_TABLE=product_sales_channel</code> on products-service to filter by channel.</p>';
          listEl.querySelectorAll('.filter-popover-item').forEach(function(b) {
            b.addEventListener('click', function() {
              productUi.pendingAttribute = null;
              productUi.f.sales_channel_id = b.getAttribute('data-sc-id');
              productUi.f.sales_channel_label = b.getAttribute('data-sc-name');
              closeProductFilterPopover();
              productUi.page = 1;
              loadProductsTable();
            });
          });
        }
        renderChList('');
        var gsi = document.getElementById('filterPopoverSearch');
        if (gsi) {
          gsi.addEventListener('input', function() { renderChList(gsi.value); });
          gsi.focus();
        }
        scheduleProductFilterPopoverPosition();
      });
    } else if (mode === 'status') {
      pop.innerHTML = '<div class="filter-popover-list" id="filterPopoverList"></div>';
      pop.classList.remove('hidden');
      positionProductPopover(productUi._filterPopoverAnchor);
      scheduleProductFilterPopoverPosition();
      var listEl = document.getElementById('filterPopoverList');
      var opts = [{ id: 'published', label: 'Published' }, { id: 'draft', label: 'Draft' }];
      listEl.innerHTML = opts.map(function(o) {
        return '<button type="button" class="filter-popover-item" data-st="' + escapeHtml(o.id) + '">' + escapeHtml(o.label) + '</button>';
      }).join('');
      listEl.querySelectorAll('.filter-popover-item').forEach(function(b) {
        b.addEventListener('click', function() {
          productUi.pendingAttribute = null;
          productUi.f.status = b.getAttribute('data-st');
          productUi.f.status_label = b.textContent.trim();
          closeProductFilterPopover();
          productUi.page = 1;
          loadProductsTable();
        });
      });
    } else if (mode === 'created' || mode === 'updated') {
      var prefix = mode === 'created' ? 'created' : 'updated';
      pop.innerHTML = '<div class="filter-popover-dates"><div><label>From</label><input type="date" id="fDateFrom" /></div><div><label>To</label><input type="date" id="fDateTo" /></div></div><div class="filter-popover-footer"><button type="button" class="btn-outline" id="fDateCancel">Cancel</button><button type="button" class="btn-solid" id="fDateApply">Apply</button></div>';
      pop.classList.remove('hidden');
      positionProductPopover(productUi._filterPopoverAnchor);
      scheduleProductFilterPopoverPosition();
      document.getElementById('fDateFrom').value = productUi.f[prefix + '_after'] || '';
      document.getElementById('fDateTo').value = productUi.f[prefix + '_before'] || '';
      document.getElementById('fDateCancel').addEventListener('click', closeProductFilterPopover);
      document.getElementById('fDateApply').addEventListener('click', function() {
        productUi.pendingAttribute = null;
        productUi.f[prefix + '_after'] = document.getElementById('fDateFrom').value || '';
        productUi.f[prefix + '_before'] = document.getElementById('fDateTo').value || '';
        closeProductFilterPopover();
        productUi.page = 1;
        loadProductsTable();
      });
    }

    productFilterDocClick = function(ev) {
      var pnode = document.getElementById('filterValuePopover');
      if (pnode && pnode.contains(ev.target)) return;
      var wrap = document.querySelector('.add-filter-wrap');
      if (wrap && wrap.contains(ev.target)) return;
      var fp = document.getElementById('filterPills');
      if (fp && fp.contains(ev.target)) return;
      closeProductFilterPopover();
    };
    setTimeout(function() { document.addEventListener('mousedown', productFilterDocClick, true); }, 0);
  }

  function wireProductsPage() {
    var filterToggle = document.getElementById('productFilterToggle');
    var addMenu = document.getElementById('addFilterMenu');
    var clearAllBtn = document.getElementById('filterClearAll');
    var searchInp = document.getElementById('productSearchInput');
    var sortTrigger = document.getElementById('productSortTrigger');
    var sortMenu = document.getElementById('productSortMenu');
    var prevBtn = document.getElementById('productPagePrev');
    var nextBtn = document.getElementById('productPageNext');
    var exportBtn = document.getElementById('productExportBtn');
    var importBtn = document.getElementById('productImportBtn');
    var createBtn = document.getElementById('productCreateBtn');

    function applyFiltersAndReload() {
      if (productUi.localCatalog && activeFilterKeys().length > 0) {
        productUi.localCatalog = null;
        refreshProductImportBanner();
      }
      productUi.page = 1;
      productUi.selectedIndex = 0;
      loadProductsTable();
    }

    if (filterToggle && addMenu) {
      filterToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        if (productUi.addFilterOpen) {
          addMenu.classList.add('hidden');
          productUi.addFilterOpen = false;
          clearAllProductFiltersAndReload();
          return;
        }
        closeProductFilterPopover();
        addMenu.classList.remove('hidden');
        productUi.addFilterOpen = true;
        syncAddFilterMenuDisabled();
      });
    }
    if (addMenu) {
      addMenu.querySelectorAll('.filter-menu-item').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (btn.disabled) return;
          var k = btn.getAttribute('data-add-filter');
          addMenu.classList.add('hidden');
          productUi.addFilterOpen = false;
          productUi.pendingAttribute = k;
          renderProductFilterPills();
          syncAddFilterMenuDisabled();
          var pillEl = document.querySelector('#filterPills .filter-pill[data-pill-key="' + k + '"]');
          openProductFilterPopoverForMode(k, pillEl || btn);
        });
      });
    }
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function(e) {
        e.preventDefault();
        clearAllProductFiltersAndReload();
      });
    }
    if (productUi._addMenuCloser) {
      document.removeEventListener('mousedown', productUi._addMenuCloser, true);
    }
    productUi._addMenuCloser = function(ev) {
      if (!productUi.addFilterOpen || !addMenu) return;
      if (addMenu.contains(ev.target)) return;
      if (filterToggle && filterToggle.contains(ev.target)) return;
      addMenu.classList.add('hidden');
      productUi.addFilterOpen = false;
    };
    document.addEventListener('mousedown', productUi._addMenuCloser, true);

    ensureProductSortState();
    if (sortMenu) {
      sortMenu.querySelectorAll('[data-sort-field]').forEach(function(b) {
        b.classList.toggle('is-active', b.getAttribute('data-sort-field') === productUi.sortField);
      });
      sortMenu.querySelectorAll('[data-sort-dir]').forEach(function(b) {
        b.classList.toggle('is-active', b.getAttribute('data-sort-dir') === productUi.sortDir);
      });
    }
    function openProductSortMenu() {
      if (sortMenu) sortMenu.classList.remove('hidden');
      if (sortTrigger) sortTrigger.setAttribute('aria-expanded', 'true');
    }
    function toggleProductSortMenu(ev) {
      if (ev) ev.stopPropagation();
      if (!sortMenu) return;
      if (sortMenu.classList.contains('hidden')) openProductSortMenu();
      else closeProductSortMenu();
    }
    if (sortTrigger && sortMenu) {
      sortTrigger.addEventListener('click', function(e) {
        e.stopPropagation();
        closeProductFilterPopover();
        hideProductSearchSuggest();
        if (addMenu) addMenu.classList.add('hidden');
        productUi.addFilterOpen = false;
        toggleProductSortMenu(e);
      });
      sortMenu.querySelectorAll('[data-sort-field]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var f = btn.getAttribute('data-sort-field');
          if (!f) return;
          productUi.sortField = f;
          productUi.order = formatProductOrder(productUi.sortField, productUi.sortDir === 'desc');
          sortMenu.querySelectorAll('[data-sort-field]').forEach(function(b) {
            b.classList.toggle('is-active', b.getAttribute('data-sort-field') === f);
          });
          applyFiltersAndReload();
          closeProductSortMenu();
        });
      });
      sortMenu.querySelectorAll('[data-sort-dir]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var d = btn.getAttribute('data-sort-dir');
          productUi.sortDir = d === 'asc' ? 'asc' : 'desc';
          // A–Z / Z–A always sort by product title (not Created/Updated).
          productUi.sortField = 'title';
          productUi.order = formatProductOrder('title', productUi.sortDir === 'desc');
          sortMenu.querySelectorAll('[data-sort-field]').forEach(function(b) {
            b.classList.toggle('is-active', b.getAttribute('data-sort-field') === 'title');
          });
          sortMenu.querySelectorAll('[data-sort-dir]').forEach(function(b) {
            b.classList.toggle('is-active', b.getAttribute('data-sort-dir') === productUi.sortDir);
          });
          applyFiltersAndReload();
          closeProductSortMenu();
        });
      });
    }
    if (productUi._sortMenuCloser) document.removeEventListener('mousedown', productUi._sortMenuCloser, true);
    productUi._sortMenuCloser = function(ev) {
      if (!sortMenu || sortMenu.classList.contains('hidden')) return;
      if (sortMenu.contains(ev.target)) return;
      if (sortTrigger && sortTrigger.contains(ev.target)) return;
      closeProductSortMenu();
    };
    document.addEventListener('mousedown', productUi._sortMenuCloser, true);

    var suggestBox = document.getElementById('productSearchSuggest');
    if (suggestBox && !suggestBox._delegateWired) {
      suggestBox._delegateWired = true;
      suggestBox.addEventListener('mousedown', function(e) {
        if (e.target.closest('.product-search-suggest-item')) e.preventDefault();
      });
      suggestBox.addEventListener('click', function(e) {
        var btn = e.target.closest('.product-search-suggest-item');
        if (!btn) return;
        e.preventDefault();
        var idx = Number(btn.getAttribute('data-suggest-idx'));
        selectSuggestedProductAt(idx);
      });
    }
    if (productUi._suggestCloser) document.removeEventListener('mousedown', productUi._suggestCloser, true);
    productUi._suggestCloser = function(ev) {
      var wrap = document.querySelector('.product-search-field-wrap');
      if (wrap && wrap.contains(ev.target)) return;
      hideProductSearchSuggest();
    };
    document.addEventListener('mousedown', productUi._suggestCloser, true);

    if (searchInp) {
      searchInp.setAttribute('autocomplete', 'off');
      searchInp.setAttribute('spellcheck', 'false');
      searchInp.addEventListener('keydown', function(e) {
        var box = document.getElementById('productSearchSuggest');
        var open = box && !box.classList.contains('hidden') && productUi.suggestRows && productUi.suggestRows.length;
        if (e.key === 'Escape') {
          if (box && !box.classList.contains('hidden')) {
            e.stopPropagation();
            hideProductSearchSuggest();
          }
          return;
        }
        if (!open) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          productUi.suggestHighlight = Math.min(productUi.suggestRows.length - 1, productUi.suggestHighlight + 1);
          if (productUi.suggestHighlight < 0) productUi.suggestHighlight = 0;
          applySuggestHighlight();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          productUi.suggestHighlight = Math.max(0, productUi.suggestHighlight - 1);
          applySuggestHighlight();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          var pick = productUi.suggestHighlight >= 0 ? productUi.suggestHighlight : 0;
          selectSuggestedProductAt(pick);
        }
      });
      searchInp.addEventListener('input', function() {
        clearTimeout(productUi.searchTimer);
        clearTimeout(productUi.suggestTimer);
        var raw = searchInp.value;
        productUi.suggestTimer = setTimeout(function() {
          loadProductSearchSuggestions(raw.trim());
        }, 200);
        productUi.searchTimer = setTimeout(function() {
          productUi.q = raw.trim();
          applyFiltersAndReload();
        }, 320);
      });
      searchInp.addEventListener('focus', function() {
        var t = searchInp.value.trim();
        if (t) loadProductSearchSuggestions(t);
      });
    }
    if (prevBtn) prevBtn.addEventListener('click', function() {
      if (productUi.page > 1) { productUi.page--; productUi.selectedIndex = 0; loadProductsTable(); }
    });
    if (nextBtn) nextBtn.addEventListener('click', function() {
      var maxPage = Math.max(1, Math.ceil(productUi.total / productUi.pageSize));
      if (productUi.page < maxPage) { productUi.page++; productUi.selectedIndex = 0; loadProductsTable(); }
    });
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        openProductExportDrawer();
      });
    }
    if (importBtn) {
      importBtn.addEventListener('click', function() {
        wireProductImportModal();
        openProductImportModal();
      });
    }
    if (createBtn) {
      createBtn.addEventListener('click', function() {
        if (window.ProductCreateUI && typeof ProductCreateUI.open === 'function') ProductCreateUI.open();
      });
    }

    productListKeyHandler = function(e) {
      if (getPage() !== 'products') return;
      if (e.key === 'Escape') {
        if (window.ProductCreateUI && typeof ProductCreateUI.handleEscape === 'function' && ProductCreateUI.handleEscape()) {
          e.preventDefault();
          return;
        }
        var imb = document.getElementById('productImportBackdrop');
        if (imb && !imb.classList.contains('hidden')) {
          e.preventDefault();
          closeProductImportModal();
          return;
        }
        var ex = document.getElementById('productExportDrawer');
        if (ex && !ex.classList.contains('hidden')) {
          e.preventDefault();
          closeProductExportDrawer();
          return;
        }
        var sb = document.getElementById('productSearchSuggest');
        if (sb && !sb.classList.contains('hidden')) {
          hideProductSearchSuggest();
          return;
        }
        closeProductFilterPopover();
        closeProductSortMenu();
        var am = document.getElementById('addFilterMenu');
        if (am) am.classList.add('hidden');
        productUi.addFilterOpen = false;
        return;
      }
      var tag = (e.target && e.target.tagName) ? String(e.target.tagName).toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      if (!productUi.rows.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        productUi.selectedIndex = Math.min(productUi.rows.length - 1, productUi.selectedIndex + 1);
        updateProductRowHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        productUi.selectedIndex = Math.max(0, productUi.selectedIndex - 1);
        updateProductRowHighlight();
      }
    };
    document.addEventListener('keydown', productListKeyHandler, true);
  }

  function updateProductRowHighlight() {
    content.querySelectorAll('#productsTableBody tr[data-row-index]').forEach(function(tr) {
      tr.classList.toggle('row-selected', Number(tr.getAttribute('data-row-index')) === productUi.selectedIndex);
    });
    var row = content.querySelector('#productsTableBody tr.row-selected');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }

  function buildProductsQuery(limit, offset, qOverride) {
    var qEff = productUi.q;
    if (arguments.length >= 3) {
      qEff = qOverride == null ? '' : String(qOverride);
    }
    var p = [];
    var f = productUi.f;
    p.push('limit=' + encodeURIComponent(String(limit)));
    p.push('offset=' + encodeURIComponent(String(offset)));
    if (qEff) p.push('q=' + encodeURIComponent(qEff));
    if (productUi.order) p.push('order=' + encodeURIComponent(productUi.order));
    if (f.type_id) p.push('type_id=' + encodeURIComponent(f.type_id));
    if (f.tag) p.push('tag=' + encodeURIComponent(f.tag));
    if (f.sales_channel_id) p.push('sales_channel_id=' + encodeURIComponent(f.sales_channel_id));
    if (f.status) p.push('status=' + encodeURIComponent(f.status));
    if (f.created_after) p.push('created_after=' + encodeURIComponent(f.created_after));
    if (f.created_before) p.push('created_before=' + encodeURIComponent(f.created_before));
    if (f.updated_after) p.push('updated_after=' + encodeURIComponent(f.updated_after));
    if (f.updated_before) p.push('updated_before=' + encodeURIComponent(f.updated_before));
    p.push('admin_catalog=1');
    return p.join('&');
  }

  function filterLocalCatalogByQuery(list, forQuery) {
    var t = (forQuery == null ? '' : String(forQuery)).trim().toLowerCase();
    if (!t) return list.slice();
    return list.filter(function(p) {
      var title = (p.title || '').toLowerCase();
      var handle = (p.handle || '').toLowerCase();
      return title.indexOf(t) >= 0 || handle.indexOf(t) >= 0;
    });
  }

  function loadProductSearchSuggestions(forQuery) {
    var box = document.getElementById('productSearchSuggest');
    var inp = document.getElementById('productSearchInput');
    if (!box || !inp) return;
    var trimmed = (forQuery == null ? '' : String(forQuery)).trim();
    if (!trimmed) {
      hideProductSearchSuggest();
      return;
    }
    var seq = ++productUi.suggestLoadSeq;
    if (productUi.localCatalog != null) {
      var list = filterLocalCatalogByQuery(productUi.localCatalog, trimmed).slice(0, 10);
      if (seq !== productUi.suggestLoadSeq) return;
      if (!inp || inp.value.trim() !== trimmed) return;
      productUi.suggestRows = list;
      productUi.suggestHighlight = -1;
      if (!list.length) {
        box.innerHTML = '<div class="product-search-suggest-empty" role="status">No matching products</div>';
        box.classList.remove('hidden');
        return;
      }
      box.innerHTML = list.map(function(p, i) {
        return '<button type="button" class="product-search-suggest-item" role="option" tabindex="-1" data-suggest-idx="' + i + '">' +
          '<span class="pss-title">' + escapeHtml(p.title || '—') + '</span>' +
          '<span class="pss-meta">' + escapeHtml(p.handle || '') + '</span></button>';
      }).join('');
      box.classList.remove('hidden');
      return;
    }
    var qs = buildProductsQuery(10, 0, trimmed);
    api('/admin/products?' + qs).then(jsonFromResponse)
      .then(function(data) {
        if (seq !== productUi.suggestLoadSeq) return;
        if (!inp || inp.value.trim() !== trimmed) return;
        var list = data && Array.isArray(data.products) ? data.products : [];
        productUi.suggestRows = list;
        productUi.suggestHighlight = -1;
        if (!list.length) {
          box.innerHTML = '<div class="product-search-suggest-empty" role="status">No matching products</div>';
          box.classList.remove('hidden');
          return;
        }
        box.innerHTML = list.map(function(p, i) {
          return '<button type="button" class="product-search-suggest-item" role="option" tabindex="-1" data-suggest-idx="' + i + '">' +
            '<span class="pss-title">' + escapeHtml(p.title || '—') + '</span>' +
            '<span class="pss-meta">' + escapeHtml(p.handle || '') + '</span></button>';
        }).join('');
        box.classList.remove('hidden');
      })
      .catch(function() {
        if (seq !== productUi.suggestLoadSeq) return;
        hideProductSearchSuggest();
      });
  }

  function applySuggestHighlight() {
    var box = document.getElementById('productSearchSuggest');
    if (!box) return;
    box.querySelectorAll('.product-search-suggest-item').forEach(function(el, i) {
      el.classList.toggle('is-highlighted', i === productUi.suggestHighlight);
    });
  }

  function selectSuggestedProductAt(idx) {
    var rows = productUi.suggestRows;
    if (!rows || !rows.length) return;
    var i = idx;
    if (typeof i !== 'number' || i < 0 || i >= rows.length) return;
    var row = rows[i];
    if (!row) return;
    var inp = document.getElementById('productSearchInput');
    if (inp) inp.value = row.title || row.handle || '';
    productUi.q = (inp && inp.value) ? inp.value.trim() : '';
    hideProductSearchSuggest();
    productUi.page = 1;
    productUi.selectedIndex = 0;
    loadProductsTable();
  }

  function loadProductsTable() {
    if (productUi.localCatalog != null) {
      var offset = (productUi.page - 1) * productUi.pageSize;
      var filtered = filterLocalCatalogByQuery(productUi.localCatalog, productUi.q);
      productUi.total = filtered.length;
      productUi.rows = filtered.slice(offset, offset + productUi.pageSize);
      if (productUi.selectedIndex >= productUi.rows.length) {
        productUi.selectedIndex = Math.max(0, productUi.rows.length - 1);
      }
      renderProductsTableBody();
      renderProductsFooter();
      updateProductRowHighlight();
      refreshProductImportBanner();
      return;
    }
    var offset = (productUi.page - 1) * productUi.pageSize;
    var qs = buildProductsQuery(productUi.pageSize, offset);
    api('/admin/products?' + qs + '&_listTs=' + Date.now()).then(jsonFromResponse)
      .then(function(data) {
        productUi.rows = data && Array.isArray(data.products) ? data.products : [];
        productUi.total =
          data && data.count != null && !isNaN(Number(data.count)) ? Number(data.count) : 0;
        if (productUi.selectedIndex >= productUi.rows.length) productUi.selectedIndex = Math.max(0, productUi.rows.length - 1);
        renderProductsTableBody();
        renderProductsFooter();
        updateProductRowHighlight();
        refreshProductImportBanner();
      })
      .catch(function(err) {
        var tb = content.querySelector('#productsTableBody');
        var detail = err && err.message ? escapeHtml(err.message) : '';
        var msg = detail
          ? 'Could not load products: ' + detail
          : 'Could not load products. Check PRODUCTS_SERVICE_URL and network.';
        if (tb) tb.innerHTML = '<tr><td colspan="6" class="error-msg">' + msg + '</td></tr>';
        refreshProductImportBanner();
      });
  }

  function renderProductsTableBody() {
    var tbody = content.querySelector('#productsTableBody');
    if (!tbody) return;
    if (!productUi.rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#64748b;text-align:center;padding:2rem;">No products match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = productUi.rows.map(function(p, idx) {
      var vcount = (p.variants && p.variants.length) ? p.variants.length : 0;
      var coll = p.collection_id ? (collectionLabelById[p.collection_id] || p.collection_id.substring(0, 8) + '…') : '—';
      var thumb = thumbUrl(p.thumbnail);
      var st = statusClass(p.status);
      var pdpHref = '/app/products/' + encodeURIComponent(p.id || '');
      return '<tr data-row-index="' + idx + '" class="' + (idx === productUi.selectedIndex ? 'row-selected' : '') + '">' +
        '<td><div class="product-cell">' +
        (thumb ? '<img class="product-thumb" src="' + escapeHtml(thumb) + '" alt="" loading="lazy" />' : '<span class="product-thumb"></span>') +
        '<a class="product-title-link" href="' + escapeHtml(pdpHref) + '">' + escapeHtml(p.title || '—') + '</a></div></td>' +
        '<td>' + escapeHtml(coll) + '</td>' +
        '<td>Default Sales Channel</td>' +
        '<td>' + (vcount ? vcount + ' variant' + (vcount === 1 ? '' : 's') : '—') + '</td>' +
        '<td><span class="status-pill"><span class="status-dot ' + escapeHtml(st) + '"></span> ' + escapeHtml(statusLabel(p.status)) + '</span></td>' +
        '<td class="row-actions">⋯</td></tr>';
    }).join('');
    content.querySelectorAll('#productsTableBody tr[data-row-index]').forEach(function(tr) {
      tr.addEventListener('click', function(e) {
        if (e.target.closest && e.target.closest('.product-title-link')) return;
        productUi.selectedIndex = Number(tr.getAttribute('data-row-index'));
        updateProductRowHighlight();
      });
      tr.addEventListener('dblclick', function(e) {
        if (e.target.closest && e.target.closest('.product-title-link')) return;
        var i = Number(tr.getAttribute('data-row-index'));
        var row = productUi.rows[i];
        if (row && row.id) navigate('/app/products/' + encodeURIComponent(row.id));
      });
    });
    content.querySelectorAll('#productsTableBody .product-title-link').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        navigate(a.getAttribute('href'));
      });
    });
  }

  function renderProductsFooter() {
    var foot = content.querySelector('#productsFooter');
    var prev = content.querySelector('#productPagePrev');
    var next = content.querySelector('#productPageNext');
    var label = content.querySelector('#productsRangeLabel');
    if (!foot || !label) return;
    var total = productUi.total;
    var from = total === 0 ? 0 : (productUi.page - 1) * productUi.pageSize + 1;
    var to = Math.min(total, productUi.page * productUi.pageSize);
    var pages = Math.max(1, Math.ceil(total / productUi.pageSize));
    label.textContent = from + ' – ' + to + ' of ' + total + ' results';
    var pageLabel = content.querySelector('#productsPageLabel');
    if (pageLabel) pageLabel.textContent = productUi.page + ' of ' + pages + ' pages';
    if (prev) prev.disabled = productUi.page <= 1;
    if (next) next.disabled = productUi.page >= pages;
  }

  function renderProducts() {
    setTitle('Products');
    clearPageActions();
    var pageActions = document.getElementById('pageActions');
    if (pageActions) {
      pageActions.innerHTML =
        '<button type="button" id="productExportBtn" class="btn-outline">Export</button>' +
        '<button type="button" id="productImportBtn" class="btn-outline">Import</button>' +
        '<button type="button" id="productCreateBtn" class="btn-solid">Create</button>';
    }

    detachProductListKeys();
    productUi.page = productUi.page || 1;
    showLoading();

    api('/admin/product-collections?limit=500').then(function(r) { return r.json(); }).catch(function() { return {}; })
      .then(function(data) {
        var cols = (data.collections) ? data.collections : [];
        collectionLabelById = {};
        cols.forEach(function(c) { if (c.id) collectionLabelById[c.id] = c.title || c.handle || c.id; });

        ensureProductSortState();
        var sf = productUi.sortField;
        var sd = productUi.sortDir;

        content.innerHTML =
          '<div class="card" style="padding:0;">' +
          '<div id="productImportBanner" class="product-import-banner hidden" role="status"></div>' +
          '<div style="padding:1rem 1.25rem 0;">' +
          '<div class="products-toolbar">' +
          '<div class="filter-toolbar-left">' +
          '<div id="filterPills" class="filter-pills"></div>' +
          '<div class="add-filter-wrap">' +
          '<button type="button" id="productFilterToggle" class="btn-outline">Add filter</button>' +
          '<div id="addFilterMenu" class="filter-dropdown hidden" role="menu">' +
          '<button type="button" class="filter-menu-item" data-add-filter="type" role="menuitem">Type</button>' +
          '<button type="button" class="filter-menu-item" data-add-filter="tag" role="menuitem">Tag</button>' +
          '<button type="button" class="filter-menu-item" data-add-filter="sales_channel" role="menuitem">Sales Channel</button>' +
          '<button type="button" class="filter-menu-item" data-add-filter="status" role="menuitem">Status</button>' +
          '<button type="button" class="filter-menu-item" data-add-filter="created" role="menuitem">Created</button>' +
          '<button type="button" class="filter-menu-item" data-add-filter="updated" role="menuitem">Updated</button>' +
          '</div></div>' +
          '<div id="filterValuePopover" class="filter-popover hidden" aria-hidden="true"></div>' +
          '<button type="button" id="filterClearAll" class="filter-clear-all">Clear all</button>' +
          '</div>' +
          '<div class="products-search-row">' +
          '<div class="product-search-field-wrap">' +
          '<div class="products-search-wrap">' +
          '<span class="products-search-icon" aria-hidden="true">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
          '</span>' +
          '<input type="search" id="productSearchInput" placeholder="Search" autocomplete="off" spellcheck="false" value="' + escapeHtml(productUi.q) + '" />' +
          '</div>' +
          '<div id="productSearchSuggest" class="product-search-suggest hidden" role="listbox" aria-label="Suggestions"></div>' +
          '</div>' +
          '<div class="product-sort-wrap">' +
          '<button type="button" id="productSortTrigger" class="product-sort-trigger" title="Sort" aria-label="Sort" aria-expanded="false" aria-haspopup="true">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">' +
          '<path d="M4 6h14M7 12h8M10 18h4"/><path d="M19 8l2 2 2-2M19 16l2-2 2 2"/></svg>' +
          '</button>' +
          '<div id="productSortMenu" class="product-sort-menu hidden" role="menu">' +
          '<button type="button" class="product-sort-menu-item' + (sf === 'title' ? ' is-active' : '') + '" data-sort-field="title" role="menuitem">Title</button>' +
          '<button type="button" class="product-sort-menu-item' + (sf === 'created_at' ? ' is-active' : '') + '" data-sort-field="created_at" role="menuitem">Created</button>' +
          '<button type="button" class="product-sort-menu-item' + (sf === 'updated_at' ? ' is-active' : '') + '" data-sort-field="updated_at" role="menuitem">Updated</button>' +
          '<hr class="product-sort-menu-sep" />' +
          '<button type="button" class="product-sort-menu-item' + (sd === 'asc' ? ' is-active' : '') + '" data-sort-dir="asc" role="menuitem" title="Sort products by title A–Z">' +
          '<span class="product-sort-menu-label"><span class="product-sort-bullet" aria-hidden="true"></span>A–Z</span></button>' +
          '<button type="button" class="product-sort-menu-item' + (sd === 'desc' ? ' is-active' : '') + '" data-sort-dir="desc" role="menuitem" title="Sort products by title Z–A">' +
          '<span class="product-sort-menu-label"><span class="product-sort-bullet" aria-hidden="true"></span>Z–A</span></button>' +
          '</div></div></div></div></div>' +
          '<div class="products-table-wrap">' +
          '<table class="products-table"><thead><tr>' +
          '<th>Product</th><th>Collection</th><th>Sales channels</th><th>Variants</th><th>Status</th><th></th>' +
          '</tr></thead><tbody id="productsTableBody"></tbody></table></div>' +
          '<div id="productsFooter" class="products-footer" style="padding:0 1.25rem 1rem;">' +
          '<span id="productsRangeLabel">—</span>' +
          '<div class="products-footer-nav">' +
          '<span id="productsPageLabel">—</span>' +
          '<button type="button" id="productPagePrev" class="btn-outline">Prev</button>' +
          '<button type="button" id="productPageNext" class="btn-outline">Next</button>' +
          '</div></div></div>';

        wireProductsPage();
        renderProductFilterPills();
        syncAddFilterMenuDisabled();
        document.getElementById('productSearchInput').value = productUi.q || '';
        loadProductsTable();
      });
  }

  function renderProductCategories() {
    setTitle('Categories');
    clearPageActions();
    detachProductListKeys();
    showLoading();
    api('/admin/product-categories?limit=500').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.product_categories) ? data.product_categories : [];
        var rows = list.map(function(c) {
          return '<tr><td>' + escapeHtml(c.name || '—') + '</td><td>' + escapeHtml(c.handle || '—') + '</td><td>' + escapeHtml(c.is_active === false ? 'No' : 'Yes') + '</td><td>' + escapeHtml((c.id || '').substring(0, 12)) + '</td></tr>';
        }).join('');
        var body = list.length
          ? '<div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th>Name</th><th>Handle</th><th>Active</th><th>ID</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<p class="empty" style="padding:1rem;">No categories.</p>';
        content.innerHTML =
          '<div class="card"><p style="margin:0 0 1rem;font-size:0.9rem;color:#64748b;">Product categories from <strong>categories-service</strong> (<code>/store/product-categories</code>).</p>' + body + '</div>';
      })
      .catch(function() { showError('Failed to load categories.'); });
  }

  var collectionListState = { page: 1, pageSize: 20, hasMore: false };

  function renderProductCollections() {
    setTitle('Collections');
    clearPageActions();
    detachProductListKeys();
    showLoading();
    var offset = (collectionListState.page - 1) * collectionListState.pageSize;
    var lim = collectionListState.pageSize + 1;
    api('/admin/product-collections?limit=' + lim + '&offset=' + offset).then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.collections) ? data.collections : [];
        collectionListState.hasMore = list.length > collectionListState.pageSize;
        var show = collectionListState.hasMore ? list.slice(0, collectionListState.pageSize) : list;
        var footer = '<div class="products-footer" style="margin-top:1rem;padding-top:1rem;border-top:1px solid #e5e7eb;">' +
          '<span>Page ' + collectionListState.page + '</span>' +
          '<div class="products-footer-nav">' +
          '<button type="button" id="collPagePrev" class="btn-outline"' + (collectionListState.page <= 1 ? ' disabled' : '') + '>Prev</button>' +
          '<button type="button" id="collPageNext" class="btn-outline"' + (!collectionListState.hasMore ? ' disabled' : '') + '>Next</button>' +
          '</div></div>';
        if (!show.length) {
          content.innerHTML = '<div class="card"><p class="empty">No collections. Check COLLECTIONS_SERVICE_URL.</p></div>';
          return;
        }
        var rows = show.map(function(c) {
          return '<tr><td>' + escapeHtml(c.title || '—') + '</td><td>' + escapeHtml(c.handle || '—') + '</td><td>' + escapeHtml((c.id || '').substring(0, 12)) + '</td></tr>';
        }).join('');
        content.innerHTML =
          '<div class="card"><p style="margin:0 0 1rem;font-size:0.9rem;color:#64748b;">Collections from <strong>collections-service</strong> (<code>/store/collections</code>).</p>' +
          '<div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th>Title</th><th>Handle</th><th>ID</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          footer + '</div>';
        document.getElementById('collPagePrev').addEventListener('click', function() {
          if (collectionListState.page > 1) { collectionListState.page--; renderProductCollections(); }
        });
        document.getElementById('collPageNext').addEventListener('click', function() {
          if (collectionListState.hasMore) { collectionListState.page++; renderProductCollections(); }
        });
      })
      .catch(function() { showError('Failed to load collections.'); });
  }

  function setTitle(title) {
    if (pageTitle) pageTitle.textContent = title;
  }

  function navigate(path) {
    var url = path || '/app/products';
    var wasProducts = getPage() === 'products';
    window.history.pushState({}, '', url);
    closeCommandModal();
    if (wasProducts && getPage() !== 'products') {
      productUi.localCatalog = null;
    }
    if (window.ProductCreateUI && typeof ProductCreateUI.close === 'function') ProductCreateUI.close();
    init();
  }

  function normShortcutKey(s) {
    if (s === ',') return ',';
    return String(s || '').toUpperCase();
  }

  function humanizeSearchType(type) {
    if (!type) return 'Results';
    return String(type).split(/[-_]/).map(function(w) {
      if (!w.length) return '';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  function primaryItemLabel(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.title) return String(item.title);
    if (item.name) return String(item.name);
    if (item.email) {
      var d = item.display_id;
      if (d != null && d !== '') return '#' + d + ' · ' + String(item.email);
      return String(item.email);
    }
    if (item.handle) return String(item.handle);
    if (item.id) return String(item.id);
    return '';
  }

  function itemThumbUrl(item) {
    if (!item || typeof item !== 'object') return '';
    var t = item.thumbnail;
    if (t && typeof t === 'string' && t.indexOf('http') === 0) return t;
    if (t && typeof t === 'string' && t.length) return t;
    return '';
  }

  function itemMetaRight(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.sku != null && item.sku !== '') return String(item.sku);
    if (item.handle != null && item.handle !== '') return String(item.handle);
    if (item.id != null) return String(item.id);
    return '';
  }

  function pathForSearchResult(type, item) {
    var base = SEARCH_TYPE_TO_PATH[type] || '/app/search';
    var id = item && (item.id || item.product_id);
    if (id && type === 'products') return '/app/products/' + encodeURIComponent(String(id));
    if (id && base.indexOf('/app/') === 0) return base + '#id=' + encodeURIComponent(String(id));
    return base;
  }

  function clearShortcutSequence() {
    shortcutSeqBuffer = [];
    if (shortcutSeqTimer) clearTimeout(shortcutSeqTimer);
    shortcutSeqTimer = null;
  }

  function scheduleShortcutSequenceEnd() {
    if (shortcutSeqTimer) clearTimeout(shortcutSeqTimer);
    shortcutSeqTimer = setTimeout(function() {
      tryMatchShortcutSequence();
      clearShortcutSequence();
    }, SHORTCUT_SEQ_MS);
  }

  function keyFromEvent(e) {
    if (e.key === ',') return ',';
    if (e.key && e.key.length === 1) return e.key.toUpperCase();
    return null;
  }

  function tryMatchShortcutSequence() {
    if (shortcutSeqBuffer.length === 0) return false;
    for (var i = 0; i < jumpCommands.length; i++) {
      var sc = jumpCommands[i].shortcut;
      if (sc.length !== shortcutSeqBuffer.length) continue;
      var ok = true;
      for (var j = 0; j < sc.length; j++) {
        if (normShortcutKey(sc[j]) !== shortcutSeqBuffer[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        navigate(jumpCommands[i].path);
        return true;
      }
    }
    return false;
  }

  function jumpCommandMatches(c, q) {
    if (!q) return true;
    var lower = q.toLowerCase().trim();
    var label = (c.label || '').toLowerCase();
    if (label.indexOf(lower) >= 0) return true;
    var keys = (c.shortcut || []).map(normShortcutKey);
    var spaced = keys.join(' ').toLowerCase();
    if (spaced.indexOf(lower) >= 0) return true;
    var compact = keys.join('').toLowerCase().replace(/,/g, '');
    var qcompact = lower.replace(/[\s,]+/g, '');
    if (compact.indexOf(qcompact) >= 0 || qcompact.indexOf(compact) >= 0) return true;
    return false;
  }

  function closeAccountMenu() {
    if (!accountMenu) return;
    accountMenu.classList.add('hidden');
    if (accountMenuTrigger) accountMenuTrigger.setAttribute('aria-expanded', 'false');
  }

  function openAccountMenu() {
    if (!accountMenu) return;
    accountMenu.classList.remove('hidden');
    if (accountMenuTrigger) accountMenuTrigger.setAttribute('aria-expanded', 'true');
  }

  function renderTable(headers, rows, emptyMsg) {
    if (!rows || rows.length === 0) return '<div class="card"><p class="empty">' + (emptyMsg || 'No data') + '</p></div>';
    var keys = headers.map(function(h) { return h.key; });
    var thead = '<tr>' + headers.map(function(h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr>';
    var tbody = rows.map(function(row) {
      return '<tr>' + keys.map(function(k) {
        var v = row[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) v = v.title || v.name || JSON.stringify(v);
        return '<td>' + (v != null ? escapeHtml(String(v)) : '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="card"><div class="table-wrap"><table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div></div>';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function api(path) {
    return fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
  }

  /** Parse JSON and reject when HTTP status is not OK so error bodies are not shown as an empty list. */
  function jsonFromResponse(r) {
    return r.json().then(function(data) {
      if (!r.ok) {
        var msg =
          data && (data.message || data.error)
            ? String(data.message || data.error)
            : 'Request failed (' + r.status + ')';
        throw new Error(msg);
      }
      return data;
    });
  }

  function showLoading() { content.innerHTML = '<div class="card"><p class="loading">Loading…</p></div>'; }
  function showError(msg) { content.innerHTML = '<div class="card"><p class="error-msg">' + escapeHtml(msg) + '</p></div>'; }

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
    Promise.all([api('/admin/users').then(function(r) { return r.json(); }), api('/admin/roles').then(function(r) { return r.json(); })])
      .then(function(pair) {
        var data = pair[0];
        var rolesData = pair[1];
        var list = (data && data.users) ? data.users : [];
        var allRoles = (rolesData && rolesData.roles) ? rolesData.roles : [];
        if (list.length === 0) {
          content.innerHTML = '<div class="card"><p class="empty">No users.</p></div>';
          return;
        }
        var rows = list.map(function(u) {
          var roleNames = (u.rbac_roles || []).map(function(r) { return r.name || r.id; }).join(', ') || '—';
          return '<tr data-user-id="' + escapeHtml(u.id || '') + '">' +
            '<td>' + escapeHtml(u.email || '-') + '</td>' +
            '<td style="font-size:0.85rem;color:#64748b;">' + escapeHtml(roleNames) + '</td>' +
            '<td><button type="button" class="btn-edit-roles" style="padding:0.35rem 0.75rem;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">Edit roles</button></td></tr>';
        }).join('');
        content.innerHTML =
          '<div class="card"><p class="hint" style="margin:0 0 1rem 0;font-size:0.875rem;color:#64748b;">Assign RBAC roles per user (same API as Medusa Admin user management).</p>' +
          '<div class="table-wrap"><table><thead><tr><th>Email</th><th>Roles</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<div id="roleEditor" style="display:none;margin-top:1.5rem;padding:1rem;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">' +
          '<h3 style="margin:0 0 0.75rem 0;font-size:1rem;">Roles for <span id="roleEditorEmail"></span></h3>' +
          '<div id="roleCheckboxes"></div>' +
          '<button type="button" id="roleSaveBtn" style="margin-top:0.75rem;padding:0.5rem 1rem;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Save roles</button> ' +
          '<button type="button" id="roleCancelBtn" style="margin-top:0.75rem;padding:0.5rem 1rem;background:#e2e8f0;color:#334155;border:none;border-radius:6px;cursor:pointer;">Cancel</button>' +
          '<p id="roleSaveMsg" style="display:none;margin-top:0.75rem;font-size:0.875rem;"></p></div></div>';
        var editor = document.getElementById('roleEditor');
        var editingUserId = null;
        function openEditor(userId, email, currentRoleIds) {
          editingUserId = userId;
          document.getElementById('roleEditorEmail').textContent = email || userId;
          var cb = document.getElementById('roleCheckboxes');
          cb.innerHTML = allRoles.map(function(r) {
            var checked = currentRoleIds.indexOf(r.id) >= 0 ? ' checked' : '';
            return '<label style="display:block;margin:0.35rem 0;"><input type="checkbox" value="' + escapeHtml(r.id) + '"' + checked + ' /> ' +
              escapeHtml(r.name || r.id) + '</label>';
          }).join('') || '<p>No roles in database. Seed RBAC roles (e.g. Medusa seed-rbac-roles).</p>';
          document.getElementById('roleSaveMsg').style.display = 'none';
          editor.style.display = 'block';
        }
        content.querySelectorAll('.btn-edit-roles').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var tr = btn.closest('tr');
            var uid = tr.getAttribute('data-user-id');
            var u = list.filter(function(x) { return x.id === uid; })[0];
            var cur = (u && u.rbac_roles) ? u.rbac_roles.map(function(r) { return r.id; }) : [];
            openEditor(uid, u && u.email, cur);
          });
        });
        document.getElementById('roleCancelBtn').addEventListener('click', function() {
          editor.style.display = 'none';
          editingUserId = null;
        });
        document.getElementById('roleSaveBtn').addEventListener('click', function() {
          if (!editingUserId) return;
          var ids = [];
          document.querySelectorAll('#roleCheckboxes input[type=checkbox]:checked').forEach(function(inp) { ids.push(inp.value); });
          var msg = document.getElementById('roleSaveMsg');
          msg.style.display = 'none';
          fetch('/admin/users/' + encodeURIComponent(editingUserId) + '/roles', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ role_ids: ids })
          })
            .then(function(res) { return res.json().then(function(j) { return { res: res, j: j }; }); })
            .then(function(x) {
              msg.style.display = 'block';
              if (x.res.ok) {
                msg.style.color = '#15803d';
                msg.textContent = 'Roles updated.';
                setTimeout(function() { renderUsers(); }, 400);
                return;
              }
              msg.style.color = '#dc2626';
              msg.textContent = (x.j && x.j.message) ? x.j.message : 'Save failed';
            })
            .catch(function() {
              msg.style.display = 'block';
              msg.style.color = '#dc2626';
              msg.textContent = 'Request failed.';
            });
        });
      })
      .catch(function() { showError('Failed to load users or roles.'); });
  }

  function renderInvites() {
    setTitle('Invites');
    showLoading();
    var formHtml = '<div class="card" style="margin-bottom:1rem;"><h2 style="margin:0 0 0.75rem 0;font-size:1rem;">Send invite</h2>' +
      '<form id="inviteForm" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end;">' +
      '<div style="flex:1;min-width:200px;"><label for="inviteEmail" style="display:block;font-size:0.75rem;margin-bottom:0.25rem;">Email</label>' +
      '<input id="inviteEmail" type="email" required placeholder="colleague@example.com" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:6px;" /></div>' +
      '<button type="submit" id="inviteBtn" style="padding:0.5rem 1rem;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Send</button></form>' +
      '<p id="inviteMsg" style="display:none;margin-top:0.75rem;font-size:0.875rem;"></p></div>';
    api('/admin/invites').then(function(r) { return r.json(); })
      .then(function(data) {
        var list = (data && data.invites) ? data.invites : [];
        var table = renderTable(
          [{ key: 'email', label: 'Email' }, { key: 'accepted', label: 'Accepted' }, { key: 'id', label: 'ID' }],
          list.map(function(i) { return { email: i.email, accepted: i.accepted != null ? (i.accepted ? 'Yes' : 'No') : '-', id: (i.id || '').substring(0, 8) }; }),
          'No invites.'
        );
        content.innerHTML = formHtml + table;
        var form = document.getElementById('inviteForm');
        var inviteMsg = document.getElementById('inviteMsg');
        var inviteBtn = document.getElementById('inviteBtn');
        if (form) {
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            inviteMsg.style.display = 'none';
            inviteBtn.disabled = true;
            var email = document.getElementById('inviteEmail').value.trim();
            fetch('/admin/invites', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ email: email })
            })
              .then(function(res) { return res.json().then(function(j) { return { res: res, j: j }; }); })
              .then(function(x) {
                if (x.res.ok) {
                  var extra = (x.j && x.j.registration_url) ? ' Registration link: ' + x.j.registration_url : '';
                  inviteMsg.textContent = 'Invite sent.' + extra + ' Reload the page to refresh the list.';
                  inviteMsg.style.display = 'block';
                  inviteMsg.style.color = '#15803d';
                  document.getElementById('inviteEmail').value = '';
                  return;
                }
                inviteMsg.textContent = (x.j && x.j.message) ? x.j.message : 'Could not create invite.';
                inviteMsg.style.display = 'block';
                inviteMsg.style.color = '#dc2626';
              })
              .catch(function() {
                inviteMsg.textContent = 'Request failed.';
                inviteMsg.style.display = 'block';
                inviteMsg.style.color = '#dc2626';
              })
              .finally(function() { inviteBtn.disabled = false; });
          });
        }
      })
      .catch(function() { showError('Failed to load invites.'); });
  }

  function renderOrders() {
    setTitle('Orders');
    content.innerHTML = '<div class="card"><p class="empty">Orders list will be available when order service is connected.</p></div>';
  }

  var storeEditEscHandler = null;

  function closeStoreEditDrawer() {
    var bd = document.getElementById('storeEditBackdrop');
    var dr = document.getElementById('storeEditDrawer');
    if (bd) bd.classList.add('hidden');
    if (dr) dr.classList.add('hidden');
    document.body.classList.remove('store-edit-open');
    if (storeEditEscHandler) {
      document.removeEventListener('keydown', storeEditEscHandler);
      storeEditEscHandler = null;
    }
    var saveBtn = document.getElementById('seSave');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.onclick = null;
    }
  }

  function ensureStoreEditShell() {
    if (document.getElementById('storeEditBackdrop')) return;
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="storeEditBackdrop" class="store-edit-backdrop hidden" aria-hidden="true"></div>' +
        '<div id="storeEditDrawer" class="store-edit-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="storeEditTitle">' +
        '<div class="store-edit-inner">' +
        '<div class="store-edit-head">' +
        '<h2 id="storeEditTitle" class="store-edit-title">Edit Store</h2>' +
        '<div class="store-edit-head-actions">' +
        '<span class="store-edit-kbd">Esc</span>' +
        '<button type="button" class="store-edit-x" id="storeEditClose" aria-label="Close">×</button></div></div>' +
        '<div class="store-edit-body">' +
        '<div class="store-edit-field"><label class="store-edit-label" for="seName">Name</label><input id="seName" type="text" class="store-edit-input" autocomplete="organization" /></div>' +
        '<div class="store-edit-field"><label class="store-edit-label" for="seCur">Default currency</label><select id="seCur" class="store-edit-input"></select></div>' +
        '<div class="store-edit-field"><label class="store-edit-label" for="seReg">Default region</label><select id="seReg" class="store-edit-input"></select></div>' +
        '<div class="store-edit-field"><label class="store-edit-label" for="seCh">Default sales channel</label><select id="seCh" class="store-edit-input"></select></div>' +
        '<div class="store-edit-field"><label class="store-edit-label" for="seLoc">Default location</label><select id="seLoc" class="store-edit-input"></select></div>' +
        '<p class="store-edit-err hidden" id="seErr" role="alert"></p></div>' +
        '<div class="store-edit-foot">' +
        '<button type="button" class="btn-outline" id="seCancel">Cancel</button>' +
        '<button type="button" class="btn-solid" id="seSave">Save</button></div></div></div>'
    );
    document.getElementById('storeEditBackdrop').addEventListener('click', closeStoreEditDrawer);
    document.getElementById('storeEditClose').addEventListener('click', closeStoreEditDrawer);
    document.getElementById('seCancel').addEventListener('click', closeStoreEditDrawer);
  }

  function settingsNavItem(href, label, sectionKey) {
    return (
      '<a href="' +
      href +
      '" class="settings-nav-item' +
      (getSettingsSectionKey() === sectionKey ? ' is-active' : '') +
      '" data-settings-section="' +
      escapeHtml(sectionKey) +
      '">' +
      escapeHtml(label) +
      '</a>'
    );
  }

  function settingsLayoutHtml(sidebarHtml, mainHtml) {
    return (
      '<div class="settings-layout">' +
      '<aside class="settings-sidebar" aria-label="Settings navigation">' +
      '<div class="settings-sidebar-head">' +
      '<button type="button" class="settings-back" id="settingsBackApp" aria-label="Back to app">←</button>' +
      '<span class="settings-sidebar-title">Settings</span></div>' +
      '<nav class="settings-nav">' +
      '<div class="settings-nav-group-label">General</div>' +
      settingsNavItem('/app/settings/store', 'Store', 'store') +
      settingsNavItem('/app/settings/users', 'Users', 'users') +
      settingsNavItem('/app/settings/regions', 'Regions', 'regions') +
      settingsNavItem('/app/settings/tax-regions', 'Tax Regions', 'tax-regions') +
      settingsNavItem('/app/settings/return-reasons', 'Return Reasons', 'return-reasons') +
      settingsNavItem('/app/settings/refund-reasons', 'Refund Reasons', 'refund-reasons') +
      settingsNavItem('/app/settings/sales-channels', 'Sales Channels', 'sales-channels') +
      settingsNavItem('/app/settings/product-types', 'Product Types', 'product-types') +
      settingsNavItem('/app/settings/product-tags', 'Product Tags', 'product-tags') +
      settingsNavItem('/app/settings/locations-shipping', 'Locations & Shipping', 'locations-shipping') +
      '<div class="settings-nav-dots" aria-hidden="true"></div>' +
      '<div class="settings-nav-group-label">Developer</div>' +
      settingsNavItem('/app/settings/publishable-api-keys', 'Publishable API Keys', 'publishable-api-keys') +
      settingsNavItem('/app/settings/secret-api-keys', 'Secret API Keys', 'secret-api-keys') +
      settingsNavItem('/app/settings/workflows', 'Workflows', 'workflows') +
      '<div class="settings-nav-dots" aria-hidden="true"></div>' +
      '<div class="settings-nav-group-label">My Account</div>' +
      settingsNavItem('/app/settings/profile', 'Profile', 'profile') +
      '<div class="settings-nav-dots" aria-hidden="true"></div>' +
      '<div class="settings-nav-group-label">Extensions</div>' +
      settingsNavItem('/app/settings/user-role-management', 'User & Role Management', 'user-role-management') +
      '</nav></aside>' +
      '<div class="settings-main">' +
      mainHtml +
      '</div></div>'
    );
  }

  function wireSettingsNav(root) {
    if (!root) return;
    root.querySelectorAll('.settings-nav-item').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        navigate(a.getAttribute('href'));
      });
    });
    var back = root.querySelector('#settingsBackApp');
    if (back) {
      back.addEventListener('click', function() {
        navigate('/app/products');
      });
    }
  }

  function renderSettingsPlaceholderMain(title, hint) {
    return (
      '<div class="settings-breadcrumb"><span class="settings-crumb-muted">Settings</span>' +
      '<span class="settings-crumb-sep"> / </span>' +
      '<span class="settings-crumb-current">' +
      escapeHtml(title) +
      '</span></div>' +
      '<section class="settings-card">' +
      '<p class="settings-placeholder-hint">' +
      escapeHtml(hint || 'This section will be connected to the API next.') +
      '</p></section>'
    );
  }

  function renderSettingsPage() {
    var section = getSettingsSectionKey();
    var titles = {
      store: 'Store',
      users: 'Users',
      regions: 'Regions',
      'tax-regions': 'Tax Regions',
      'return-reasons': 'Return Reasons',
      'refund-reasons': 'Refund Reasons',
      'sales-channels': 'Sales Channels',
      'product-types': 'Product Types',
      'product-tags': 'Product Tags',
      'locations-shipping': 'Locations & Shipping',
      'publishable-api-keys': 'Publishable API Keys',
      'secret-api-keys': 'Secret API Keys',
      workflows: 'Workflows',
      profile: 'Profile',
      'user-role-management': 'User & Role Management'
    };
    var crumbTitle = titles[section] || section;
    setTitle(crumbTitle);

    if (section !== 'store') {
      var hints = {
        users: 'Open the full directory under Users in the main sidebar, or manage invites from Invites.',
        regions: 'Use Regions in the main sidebar for the region list API.',
        profile: 'Use Profile in the footer or Users for account details.',
        'user-role-management': 'Manage users and RBAC roles from the Users and Invites pages in the main navigation.'
      };
      content.innerHTML = settingsLayoutHtml(
        '',
        renderSettingsPlaceholderMain(crumbTitle, hints[section] || null)
      );
      wireSettingsNav(content.querySelector('.settings-layout'));
      return;
    }

    setTitle('Store');
    content.innerHTML = settingsLayoutHtml(
      '',
      '<div class="settings-breadcrumb"><span class="settings-crumb-muted">Settings</span>' +
        '<span class="settings-crumb-sep"> / </span>' +
        '<span class="settings-crumb-current">Store</span></div>' +
        '<div class="settings-main-stack">' +
        '<section class="settings-card">' +
        '<div class="settings-card-head">' +
        '<div><h2 class="settings-card-title">Store</h2>' +
        '<p class="settings-card-sub">Manage your store\'s details.</p></div>' +
        '<div class="settings-card-menu-wrap">' +
        '<button type="button" class="settings-card-menu" id="settingsStoreMenuBtn" aria-label="More options" aria-haspopup="true" aria-expanded="false">⋯</button>' +
        '<div class="settings-store-dropdown hidden" id="settingsStoreDropdown" role="menu">' +
        '<button type="button" class="settings-store-dropdown-item" role="menuitem" id="settingsStoreEditBtn">Edit</button>' +
        '</div></div></div>' +
        '<p class="settings-store-api-err hidden" id="settingsStoreApiErr" role="alert"></p>' +
        '<div class="settings-card-body settings-dl" id="settingsStoreDl">' +
        '<div class="settings-dl-row"><span class="settings-dl-k">Name</span><span class="settings-dl-v" id="stName">—</span></div>' +
        '<div class="settings-dl-row"><span class="settings-dl-k">Default currency</span><span class="settings-dl-v" id="stCur">—</span></div>' +
        '<div class="settings-dl-row"><span class="settings-dl-k">Default region</span><span class="settings-dl-v" id="stReg">—</span></div>' +
        '<div class="settings-dl-row"><span class="settings-dl-k">Default sales channel</span><span class="settings-dl-v" id="stCh">—</span></div>' +
        '<div class="settings-dl-row"><span class="settings-dl-k">Default location</span><span class="settings-dl-v" id="stLoc">—</span></div>' +
        '</div></section>' +
        '<section class="settings-card">' +
        '<div class="settings-card-head">' +
        '<h2 class="settings-card-title">Currencies</h2>' +
        '<div class="settings-card-menu-wrap">' +
        '<button type="button" class="settings-card-menu" id="settingsCurHeadMenuBtn" aria-label="More options" aria-haspopup="true" aria-expanded="false">⋯</button>' +
        '<div class="settings-store-dropdown hidden" id="settingsCurHeadDropdown" role="menu">' +
        '<button type="button" class="settings-store-dropdown-item" id="settingsCurBulkEnableTax" role="menuitem">Enable tax inclusive pricing (selected)</button>' +
        '<button type="button" class="settings-store-dropdown-item" id="settingsCurBulkDisableTax" role="menuitem">Disable tax inclusive pricing (selected)</button>' +
        '</div></div></div>' +
        '<p class="settings-cur-api-err hidden" id="settingsCurApiErr" role="alert"></p>' +
        '<div class="settings-card-body">' +
        '<div class="settings-cur-toolbar">' +
        '<div class="settings-cur-search">' +
        '<svg class="settings-cur-search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.75" />' +
        '<path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>' +
        '<input type="search" id="settingsCurFilter" class="settings-cur-input" placeholder="Search" autocomplete="off" />' +
        '</div>' +
        '<div class="settings-cur-sort-wrap">' +
        '<button type="button" class="settings-cur-filter-btn settings-cur-sort-open" id="settingsCurSortBtn" aria-label="Sort" aria-haspopup="true" aria-expanded="false">☰</button>' +
        '<div class="settings-store-dropdown hidden settings-cur-sort-dropdown" id="settingsCurSortDropdown" role="menu">' +
        '<div class="settings-cur-sort-heading">Sort by</div>' +
        '<button type="button" class="settings-store-dropdown-item settings-cur-sort-opt" data-sort-key="name" data-sort-dir="asc" role="menuitem">Name · Ascending</button>' +
        '<button type="button" class="settings-store-dropdown-item settings-cur-sort-opt" data-sort-key="name" data-sort-dir="desc" role="menuitem">Name · Descending</button>' +
        '<button type="button" class="settings-store-dropdown-item settings-cur-sort-opt" data-sort-key="code" data-sort-dir="asc" role="menuitem">Code · Ascending</button>' +
        '<button type="button" class="settings-store-dropdown-item settings-cur-sort-opt" data-sort-key="code" data-sort-dir="desc" role="menuitem">Code · Descending</button>' +
        '</div></div></div>' +
        '<div class="settings-table-wrap" id="settingsCurTableWrap">' +
        '<table class="settings-table settings-table-currencies">' +
        '<thead><tr>' +
        '<th class="settings-th-check"><input type="checkbox" id="settingsCurSelectAll" aria-label="Select all rows" /></th>' +
        '<th>Code</th><th>Name</th><th>Tax inclusive pricing</th>' +
        '<th class="settings-th-actions"></th></tr></thead>' +
        '<tbody id="settingsCurBody"></tbody></table></div>' +
        '<div class="settings-table-foot">' +
        '<span id="settingsCurFoot">0 – 0 of 0 results</span>' +
        '<span id="settingsCurPageLabel">1 of 1 pages</span>' +
        '<span class="settings-table-nav">' +
        '<button type="button" class="btn-outline" id="settingsCurPrev">Prev</button> ' +
        '<button type="button" class="btn-outline" id="settingsCurNext">Next</button></span></div></div></section>' +
        '<section class="settings-card settings-fold-card">' +
        '<div class="settings-card-head">' +
        '<h2 class="settings-card-title">Metadata <span class="settings-key-badge" id="stMetaCount">0 keys</span></h2>' +
        '<button type="button" class="settings-icon-btn" id="stMetaPop" title="Open" aria-label="Open metadata">↗</button></div>' +
        '<div class="settings-card-body"><pre class="settings-pre" id="stMetaPre">{}</pre></div></section>' +
        '<section class="settings-card settings-fold-card">' +
        '<div class="settings-card-head">' +
        '<h2 class="settings-card-title">JSON <span class="settings-key-badge" id="stJsonCount">0 keys</span></h2>' +
        '<button type="button" class="settings-icon-btn" id="stJsonPop" title="Open" aria-label="Open JSON">↗</button></div>' +
        '<div class="settings-card-body"><pre class="settings-pre settings-pre-tall" id="stJsonPre">{}</pre></div></section>' +
        '</div>'
    );

    wireSettingsNav(content.querySelector('.settings-layout'));

    var stName = document.getElementById('stName');
    var stCur = document.getElementById('stCur');
    var stReg = document.getElementById('stReg');
    var stCh = document.getElementById('stCh');
    var stLoc = document.getElementById('stLoc');
    var tbody = document.getElementById('settingsCurBody');
    var foot = document.getElementById('settingsCurFoot');
    var pageLabel = document.getElementById('settingsCurPageLabel');
    var curPrev = document.getElementById('settingsCurPrev');
    var curNext = document.getElementById('settingsCurNext');
    var curApiErr = document.getElementById('settingsCurApiErr');
    var metaPre = document.getElementById('stMetaPre');
    var jsonPre = document.getElementById('stJsonPre');
    var metaCount = document.getElementById('stMetaCount');
    var jsonCount = document.getElementById('stJsonCount');
    var storeApiErr = document.getElementById('settingsStoreApiErr');
    var storePagePayload = null;
    var storeCurrencyRows = [];
    var currencySortKey = 'code';
    var currencySortDir = 'asc';
    var currencyPage = 1;
    var currencyPageSize = 15;

    /** Table rows: only store-backed currencies from API ({@code store_currencies}); empty when none configured. */
    function storeCurrenciesToRows(currencies) {
      var rows = [];
      (currencies || []).forEach(function(c) {
        var code = (c && c.code ? String(c.code) : '').trim().toLowerCase();
        if (!code) return;
        var taxRaw = c && c.tax_inclusive_pricing;
        var taxInc = taxRaw === true || taxRaw === 'true' || taxRaw === 1;
        var sid = c && c.store_currency_id != null && c.store_currency_id !== '' ? String(c.store_currency_id) : '';
        rows.push({
          code: code.toUpperCase(),
          name: (c && c.name ? String(c.name) : code.toUpperCase()),
          taxInc: taxInc,
          storeCurrencyId: sid
        });
      });
      return rows;
    }

    function sortCurrencyRows(arr) {
      var key = currencySortKey;
      var dir = currencySortDir === 'desc' ? -1 : 1;
      return arr.slice().sort(function(a, b) {
        var va = (key === 'code' ? a.code : a.name || '').toLowerCase();
        var vb = (key === 'code' ? b.code : b.name || '').toLowerCase();
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }

    function renderCurRows(rows, filter) {
      filter = (filter || '').toLowerCase().trim();
      var frows = rows.filter(function(r) {
        if (!filter) return true;
        return (
          (r.code && r.code.toLowerCase().indexOf(filter) >= 0) ||
          (r.name && r.name.toLowerCase().indexOf(filter) >= 0)
        );
      });
      frows = sortCurrencyRows(frows);
      var total = frows.length;
      var pages = Math.max(1, Math.ceil(total / currencyPageSize) || 1);
      if (currencyPage > pages) currencyPage = pages;
      if (currencyPage < 1) currencyPage = 1;
      var startIdx = (currencyPage - 1) * currencyPageSize;
      var pageRows = frows.slice(startIdx, startIdx + currencyPageSize);
      if (!tbody) return;
      tbody.innerHTML = pageRows
        .map(function(r) {
          var taxOn = Boolean(r.taxInc);
          var taxCell =
            '<span class="settings-tax-cell">' +
            '<span class="settings-tax-dot ' +
            (taxOn ? 'settings-tax-dot--on' : 'settings-tax-dot--off') +
            '" aria-hidden="true"></span>' +
            '<span>' +
            (taxOn ? 'True' : 'False') +
            '</span></span>';
          var canRemove = r.storeCurrencyId && String(r.storeCurrencyId).length > 0;
          var menuTaxLabel = taxOn ? 'Disable tax inclusive pricing' : 'Enable tax inclusive pricing';
          var menuTaxEnable = taxOn ? 'false' : 'true';
          return (
            '<tr data-code="' +
            escapeHtml(r.code) +
            '"><td class="settings-td-check"><input type="checkbox" class="settings-cur-row-check" data-code="' +
            escapeHtml(r.code) +
            '" aria-label="Select ' +
            escapeHtml(r.code) +
            '" /></td><td>' +
            escapeHtml(r.code) +
            '</td><td>' +
            escapeHtml(r.name) +
            '</td><td>' +
            taxCell +
            '</td><td class="settings-td-actions"><div class="settings-cur-actions-wrap">' +
            '<button type="button" class="settings-cur-row-menu-btn" data-code="' +
            escapeHtml(r.code) +
            '" aria-haspopup="true" aria-expanded="false" aria-label="Row actions">⋯</button>' +
            '<div class="settings-store-dropdown hidden settings-cur-row-dropdown" role="menu">' +
            '<button type="button" class="settings-store-dropdown-item settings-cur-row-tax" data-code="' +
            escapeHtml(r.code) +
            '" data-enable="' +
            menuTaxEnable +
            '" role="menuitem">' +
            escapeHtml(menuTaxLabel) +
            '</button>' +
            (canRemove
              ? '<button type="button" class="settings-store-dropdown-item settings-cur-row-remove danger" data-code="' +
                escapeHtml(r.code) +
                '" role="menuitem">Remove</button>'
              : '') +
            '</div></div></td></tr>'
          );
        })
        .join('');
      if (foot) {
        if (!total) {
          foot.textContent = '0 – 0 of 0 results';
        } else {
          var endIdx = Math.min(startIdx + pageRows.length, total);
          foot.textContent = startIdx + 1 + ' – ' + endIdx + ' of ' + total + ' results';
        }
      }
      if (pageLabel) {
        pageLabel.textContent = pages ? currencyPage + ' of ' + pages + ' pages' : '1 of 1 pages';
      }
      if (curPrev) {
        curPrev.disabled = currencyPage <= 1;
      }
      if (curNext) {
        curNext.disabled = currencyPage >= pages || pages <= 1;
      }
      var selAll = document.getElementById('settingsCurSelectAll');
      if (selAll) {
        selAll.checked = false;
        selAll.indeterminate = false;
      }
    }

    function showCurApiErr(msg) {
      if (!curApiErr) return;
      curApiErr.textContent = msg || '';
      if (msg) curApiErr.classList.remove('hidden');
      else curApiErr.classList.add('hidden');
    }

    function closeAllCurrencyDropdowns() {
      document.querySelectorAll('.settings-cur-row-dropdown').forEach(function(el) {
        el.classList.add('hidden');
      });
      var hd = document.getElementById('settingsCurHeadDropdown');
      if (hd) hd.classList.add('hidden');
      var sd = document.getElementById('settingsCurSortDropdown');
      if (sd) sd.classList.add('hidden');
      var hb = document.getElementById('settingsCurHeadMenuBtn');
      if (hb) hb.setAttribute('aria-expanded', 'false');
      var sb = document.getElementById('settingsCurSortBtn');
      if (sb) sb.setAttribute('aria-expanded', 'false');
      document.querySelectorAll('.settings-cur-row-menu-btn').forEach(function(b) {
        b.setAttribute('aria-expanded', 'false');
      });
    }

    function applyStorePayload(data) {
      showCurApiErr('');
      storePagePayload = data;
      applyStoreAdminToCard(data);
      storeCurrencyRows = storeCurrenciesToRows((data.options && data.options.store_currencies) || []);
      currencyPage = 1;
      var filtEl = document.getElementById('settingsCurFilter');
      renderCurRows(storeCurrencyRows, filtEl ? filtEl.value : '');
      wireStoreCardMenu();
    }

    function fetchStoreAndApply() {
      return api('/admin/store')
        .then(function(r) {
          return r.json().then(function(d) {
            return { ok: r.ok, data: d };
          });
        })
        .then(function(res) {
          if (!res.ok) {
            var d = res.data || {};
            showCurApiErr(String(d.message || d.detail || d.error || 'Could not refresh store'));
            return;
          }
          applyStorePayload(res.data);
        })
        .catch(function() {
          showCurApiErr('Network error refreshing currencies.');
        });
    }

    function patchCurrencyTax(code, enabled, skipRefresh) {
      var low = (code || '').toLowerCase().trim();
      if (!low) return Promise.resolve();
      return fetch('/admin/currencies/' + encodeURIComponent(low), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tax_inclusive_pricing: Boolean(enabled) })
      })
        .then(function(r) {
          return r.json().then(function(data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function(res) {
          if (!res.ok) {
            var d = res.data || {};
            showCurApiErr(String(d.message || d.detail || d.error || 'Update failed'));
            throw new Error('cur-patch-fail');
          }
          closeAllCurrencyDropdowns();
          if (!skipRefresh) return fetchStoreAndApply();
        })
        .catch(function(err) {
          if (err && err.message === 'cur-patch-fail') return Promise.reject(err);
          showCurApiErr('Network error.');
          return Promise.reject(err);
        });
    }

    function removeCurrencyLink(code) {
      var low = (code || '').toLowerCase().trim();
      if (!low) return Promise.resolve();
      return fetch('/admin/currencies/' + encodeURIComponent(low), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
        .then(function(r) {
          return r.json().then(function(data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function(res) {
          if (!res.ok) {
            var d = res.data || {};
            showCurApiErr(String(d.message || d.detail || d.error || 'Remove failed'));
            return;
          }
          closeAllCurrencyDropdowns();
          return fetchStoreAndApply();
        })
        .catch(function() {
          showCurApiErr('Network error.');
        });
    }

    function getSelectedCurrencyCodes() {
      var out = [];
      document.querySelectorAll('.settings-cur-row-check:checked').forEach(function(cb) {
        var c = cb.getAttribute('data-code');
        if (c) out.push(c);
      });
      return out;
    }

    function wireCurrencyChromeOnce() {
      var wrap = document.getElementById('settingsCurTableWrap');
      if (!wrap || wrap.dataset.currencyChromeWired === '1') return;
      wrap.dataset.currencyChromeWired = '1';

      wrap.addEventListener('click', function(ev) {
        var taxBtn = ev.target.closest('.settings-cur-row-tax');
        if (taxBtn) {
          ev.preventDefault();
          ev.stopPropagation();
          var c = taxBtn.getAttribute('data-code');
          var en = taxBtn.getAttribute('data-enable') === 'true';
          patchCurrencyTax(c, en).catch(function() {});
          return;
        }
        var rm = ev.target.closest('.settings-cur-row-remove');
        if (rm) {
          ev.preventDefault();
          ev.stopPropagation();
          var c2 = rm.getAttribute('data-code');
          if (window.confirm('Remove ' + c2 + ' from this store’s supported currencies?')) {
            removeCurrencyLink(c2);
          }
          return;
        }
        var menuBtn = ev.target.closest('.settings-cur-row-menu-btn');
        if (menuBtn) {
          ev.preventDefault();
          ev.stopPropagation();
          closeAllCurrencyDropdowns();
          var rowDrop = menuBtn.parentElement && menuBtn.parentElement.querySelector('.settings-cur-row-dropdown');
          if (rowDrop) {
            rowDrop.classList.remove('hidden');
            menuBtn.setAttribute('aria-expanded', 'true');
          }
          setTimeout(function() {
            document.addEventListener(
              'click',
              function docC() {
                closeAllCurrencyDropdowns();
                document.removeEventListener('click', docC);
              },
              { once: true }
            );
          }, 0);
          return;
        }
      });

      var headBtn = document.getElementById('settingsCurHeadMenuBtn');
      var headDrop = document.getElementById('settingsCurHeadDropdown');
      if (headBtn && headDrop) {
        headBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var hidden = headDrop.classList.contains('hidden');
          closeAllCurrencyDropdowns();
          if (!hidden) return;
          headDrop.classList.remove('hidden');
          headBtn.setAttribute('aria-expanded', 'true');
          setTimeout(function() {
            document.addEventListener(
              'click',
              function h() {
                closeAllCurrencyDropdowns();
                document.removeEventListener('click', h);
              },
              { once: true }
            );
          }, 0);
        });
      }

      var bulkEn = document.getElementById('settingsCurBulkEnableTax');
      var bulkDis = document.getElementById('settingsCurBulkDisableTax');
      if (bulkEn) {
        bulkEn.addEventListener('click', function(e) {
          e.stopPropagation();
          var sel = getSelectedCurrencyCodes();
          if (!sel.length) {
            showCurApiErr('Select one or more currencies first.');
            return;
          }
          closeAllCurrencyDropdowns();
          showCurApiErr('');
          var chain = Promise.resolve();
          sel.forEach(function(c) {
            chain = chain.then(function() {
              return patchCurrencyTax(c, true, true);
            });
          });
          chain
            .then(function() {
              return fetchStoreAndApply();
            })
            .catch(function() {});
        });
      }
      if (bulkDis) {
        bulkDis.addEventListener('click', function(e) {
          e.stopPropagation();
          var sel = getSelectedCurrencyCodes();
          if (!sel.length) {
            showCurApiErr('Select one or more currencies first.');
            return;
          }
          closeAllCurrencyDropdowns();
          showCurApiErr('');
          var chain = Promise.resolve();
          sel.forEach(function(c) {
            chain = chain.then(function() {
              return patchCurrencyTax(c, false, true);
            });
          });
          chain
            .then(function() {
              return fetchStoreAndApply();
            })
            .catch(function() {});
        });
      }

      var sortBtn = document.getElementById('settingsCurSortBtn');
      var sortDrop = document.getElementById('settingsCurSortDropdown');
      if (sortBtn && sortDrop) {
        sortBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var hid = sortDrop.classList.contains('hidden');
          closeAllCurrencyDropdowns();
          if (!hid) return;
          sortDrop.classList.remove('hidden');
          sortBtn.setAttribute('aria-expanded', 'true');
          setTimeout(function() {
            document.addEventListener(
              'click',
              function s() {
                sortDrop.classList.add('hidden');
                sortBtn.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', s);
              },
              { once: true }
            );
          }, 0);
        });
        sortDrop.querySelectorAll('.settings-cur-sort-opt').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            currencySortKey = btn.getAttribute('data-sort-key') || 'code';
            currencySortDir = btn.getAttribute('data-sort-dir') || 'asc';
            currencyPage = 1;
            sortDrop.classList.add('hidden');
            sortBtn.setAttribute('aria-expanded', 'false');
            var filtEl = document.getElementById('settingsCurFilter');
            renderCurRows(storeCurrencyRows, filtEl ? filtEl.value : '');
          });
        });
      }

      var selAll = document.getElementById('settingsCurSelectAll');
      if (selAll) {
        selAll.addEventListener('change', function() {
          var on = selAll.checked;
          document.querySelectorAll('.settings-cur-row-check').forEach(function(cb) {
            cb.checked = on;
          });
        });
      }

      if (curPrev) {
        curPrev.addEventListener('click', function() {
          if (currencyPage > 1) {
            currencyPage--;
            var filtEl = document.getElementById('settingsCurFilter');
            renderCurRows(storeCurrencyRows, filtEl ? filtEl.value : '');
          }
        });
      }
      if (curNext) {
        curNext.addEventListener('click', function() {
          currencyPage++;
          var filtEl = document.getElementById('settingsCurFilter');
          renderCurRows(storeCurrencyRows, filtEl ? filtEl.value : '');
        });
      }
    }

    function bindCurrencyFilter() {
      var filt = document.getElementById('settingsCurFilter');
      if (!filt || filt.dataset.currencyFiltWired === '1') return;
      filt.dataset.currencyFiltWired = '1';
      filt.addEventListener('input', function() {
        currencyPage = 1;
        renderCurRows(storeCurrencyRows, filt.value);
      });
    }

    function applyStoreAdminToCard(payload) {
      var st = payload && payload.store;
      if (!st) return;
      function pill(t) {
        return '<span class="settings-pill">' + escapeHtml(t) + '</span>';
      }
      if (stName) stName.textContent = st.name || '—';
      var cc = (st.default_currency_code || '').trim();
      var cname = st.default_currency_name || '';
      if (stCur) {
        if (cc) {
          stCur.innerHTML = pill(cc.toUpperCase()) + '<span class="settings-pill-text">' + escapeHtml(cname || cc.toUpperCase()) + '</span>';
        } else {
          stCur.textContent = '—';
        }
      }
      if (stReg) stReg.textContent = st.default_region_name || '—';
      if (stCh) {
        if (st.default_sales_channel_name) {
          stCh.innerHTML = pill(st.default_sales_channel_name);
        } else {
          stCh.textContent = '—';
        }
      }
      if (stLoc) {
        if (st.default_location_name) {
          stLoc.innerHTML = pill(st.default_location_name);
        } else {
          stLoc.textContent = '—';
        }
      }
      var metaObj = st.metadata;
      if (metaObj == null || typeof metaObj !== 'object') metaObj = {};
      var jsonObj = {
        id: st.id,
        name: st.name,
        default_currency_code: st.default_currency_code,
        default_region_id: st.default_region_id,
        default_region_name: st.default_region_name,
        default_sales_channel_id: st.default_sales_channel_id,
        default_sales_channel_name: st.default_sales_channel_name,
        default_location_id: st.default_location_id,
        default_location_name: st.default_location_name,
        metadata: metaObj
      };
      try {
        if (metaPre) metaPre.textContent = JSON.stringify(metaObj, null, 2);
        if (jsonPre) jsonPre.textContent = JSON.stringify(jsonObj, null, 2);
        if (metaCount) metaCount.textContent = Object.keys(metaObj).length + ' keys';
        if (jsonCount) jsonCount.textContent = Object.keys(jsonObj).length + ' keys';
      } catch (e) {}
    }

    function fillSelectOptions(sel, rows, getVal, getLabel, current) {
      if (!sel) return;
      sel.innerHTML = '<option value="">—</option>';
      (rows || []).forEach(function(row) {
        var v = getVal(row);
        var opt = document.createElement('option');
        opt.value = v != null && v !== '' ? String(v) : '';
        opt.textContent = getLabel(row);
        if (current != null && v != null && String(v) === String(current)) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    function openStoreEditDrawerFromPayload() {
      if (!storePagePayload || !storePagePayload.store || !storePagePayload.options) return;
      ensureStoreEditShell();
      var st = storePagePayload.store;
      var opt = storePagePayload.options;
      var seName = document.getElementById('seName');
      var seCur = document.getElementById('seCur');
      var seReg = document.getElementById('seReg');
      var seCh = document.getElementById('seCh');
      var seLoc = document.getElementById('seLoc');
      var seErr = document.getElementById('seErr');
      if (seErr) {
        seErr.classList.add('hidden');
        seErr.textContent = '';
      }
      if (seName) seName.value = st.name || '';
      fillSelectOptions(
        seCur,
        opt.currencies || [],
        function(r) {
          return r.code;
        },
        function(r) {
          var c = (r.code || '').toUpperCase();
          return r.name ? c + ' — ' + r.name : c;
        },
        st.default_currency_code
      );
      fillSelectOptions(
        seReg,
        opt.regions || [],
        function(r) {
          return r.id;
        },
        function(r) {
          return r.name || r.id || '';
        },
        st.default_region_id
      );
      fillSelectOptions(
        seCh,
        opt.sales_channels || [],
        function(r) {
          return r.id;
        },
        function(r) {
          return r.name || r.id || '';
        },
        st.default_sales_channel_id
      );
      fillSelectOptions(
        seLoc,
        opt.stock_locations || [],
        function(r) {
          return r.id;
        },
        function(r) {
          return r.name || r.id || '';
        },
        st.default_location_id
      );
      document.getElementById('storeEditBackdrop').classList.remove('hidden');
      document.getElementById('storeEditDrawer').classList.remove('hidden');
      document.body.classList.add('store-edit-open');
      storeEditEscHandler = function(ev) {
        if (ev.key === 'Escape') closeStoreEditDrawer();
      };
      document.addEventListener('keydown', storeEditEscHandler);
      document.getElementById('seSave').onclick = function() {
        var body = {
          name: seName ? seName.value.trim() : '',
          default_currency_code: seCur && seCur.value ? seCur.value : null,
          default_region_id: seReg && seReg.value ? seReg.value : null,
          default_sales_channel_id: seCh && seCh.value ? seCh.value : null,
          default_location_id: seLoc && seLoc.value ? seLoc.value : null
        };
        if (!body.name) {
          if (seErr) {
            seErr.textContent = 'Name is required.';
            seErr.classList.remove('hidden');
          }
          return;
        }
        var saveBtn = document.getElementById('seSave');
        if (saveBtn) saveBtn.disabled = true;
        fetch('/admin/store', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body)
        })
          .then(function(r) {
            return r.json().then(function(data) {
              return { ok: r.ok, data: data };
            });
          })
          .then(function(res) {
            if (saveBtn) saveBtn.disabled = false;
            if (!res.ok) {
              var msg =
                res.data && (res.data.message || res.data.error)
                  ? String(res.data.message || res.data.error)
                  : 'Save failed';
              if (seErr) {
                seErr.textContent = msg;
                seErr.classList.remove('hidden');
              }
              return;
            }
            applyStorePayload(res.data);
            closeStoreEditDrawer();
          })
          .catch(function() {
            if (saveBtn) saveBtn.disabled = false;
            if (seErr) {
              seErr.textContent = 'Network error.';
              seErr.classList.remove('hidden');
            }
          });
      };
    }

    function wireStoreCardMenu() {
      var menuBtn = document.getElementById('settingsStoreMenuBtn');
      var dropdown = document.getElementById('settingsStoreDropdown');
      var editBtn = document.getElementById('settingsStoreEditBtn');
      if (!menuBtn || !dropdown) return;
      function closeMenu() {
        dropdown.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var hidden = dropdown.classList.contains('hidden');
        if (!hidden) {
          closeMenu();
          return;
        }
        dropdown.classList.remove('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
        setTimeout(function() {
          document.addEventListener(
            'click',
            function docClose() {
              closeMenu();
              document.removeEventListener('click', docClose);
            },
            { once: true }
          );
        }, 0);
      });
      if (editBtn) {
        editBtn.disabled = !storePagePayload;
        editBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          openStoreEditDrawerFromPayload();
        });
      }
    }

    api('/admin/store')
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, data: data, status: r.status };
        });
      })
      .then(function(res) {
        if (storeApiErr) {
          storeApiErr.classList.add('hidden');
          storeApiErr.textContent = '';
        }
        if (!res.ok) {
          var d = res.data || {};
          var piece = d.message || d.detail || d.title || d.error;
          var msg = piece
            ? String(piece)
            : 'Could not load store (HTTP ' + (res.status != null ? res.status : '?') + ')';
          if (storeApiErr) {
            storeApiErr.textContent = msg;
            storeApiErr.classList.remove('hidden');
          }
          return Promise.reject(new Error('store'));
        }
        applyStorePayload(res.data);
        bindCurrencyFilter();
        wireCurrencyChromeOnce();
      })
      .catch(function() {
        return Promise.all([
          api('/admin/regions').then(function(r) {
            return r.json();
          }),
          api('/admin/sales-channels').then(function(r) {
            return r.json();
          })
        ]).then(function(pair) {
          storeCurrencyRows = [];
          currencyPage = 1;
          var filtEl = document.getElementById('settingsCurFilter');
          renderCurRows(storeCurrencyRows, filtEl ? filtEl.value : '');
          bindCurrencyFilter();
          wireCurrencyChromeOnce();
          wireStoreCardMenu();
        });
      })
      .catch(function() {
        storeCurrencyRows = [];
        currencyPage = 1;
        var filtEl2 = document.getElementById('settingsCurFilter');
        renderCurRows(storeCurrencyRows, filtEl2 ? filtEl2.value : '');
        bindCurrencyFilter();
        wireCurrencyChromeOnce();
        wireStoreCardMenu();
      });

    function openTabJson(txt) {
      try {
        var w = window.open('', '_blank');
        if (w) {
          w.document.write('<pre style="font:12px/1.4 monospace;padding:1rem">' + escapeHtml(txt) + '</pre>');
        }
      } catch (e) {}
    }
    var mp = document.getElementById('stMetaPop');
    var jp = document.getElementById('stJsonPop');
    if (mp) {
      mp.addEventListener('click', function() {
        openTabJson(metaPre ? metaPre.textContent : '{}');
      });
    }
    if (jp) {
      jp.addEventListener('click', function() {
        openTabJson(jsonPre ? jsonPre.textContent : '{}');
      });
    }
  }

  function renderPlaceholder(title, help) {
    setTitle(title);
    content.innerHTML = '<div class="card"><p class="empty">' + escapeHtml(help || 'This page is available in the menu shell and can be wired to API next.') + '</p></div>';
  }

  var pdpOutsideClose = null;
  var pdpEditProductRef = null;
  var pdpEditEscapeHandler = null;
  var pdpEditDrawerWired = false;
  var pdpMediaGalleryState = [];
  var pdpMediaSelectedIdx = 0;
  var pdpMediaMode = 'edit';
  var pdpMediaEscapeHandler = null;
  var pdpMediaOverlayWired = false;
  var pdpCreateOptionEscapeHandler = null;
  var pdpCreateOptionDrawerWired = false;
  /** Tag strings for Create Option drawer (variations). */
  var pdpCreateOptionVariations = [];
  /** Set when drawer edits an existing option (stable id from catalog / metadata). */
  var pdpCoEditOptionId = null;
  var pdpVoEscapeHandler = null;
  var pdpVoDrawerWired = false;
  var pdpVoProductRef = null;
  var pdpVoVariantRef = null;
  /** Selected indices in media edit grid (string keys for simpler pruning). */
  var pdpMediaEditSel = {};
  var pdpMediaCardSel = {};
  var pdpMediaCardUrlsRef = [];
  var pdpMediaCardProductRef = null;
  var pdpMetadataProductRef = null;
  var pdpMetadataEscapeHandler = null;
  var pdpMetadataDrawerWired = false;
  /** Editable metadata keys when the drawer was opened (for PATCH null removals). */
  var pdpMetadataOrigEditableKeys = [];
  var pdpJsonProductRef = null;
  var pdpJsonEscapeHandler = null;
  var pdpJsonDrawerWired = false;
  var pdpJsonViewerProductRef = null;
  var pdpJsonViewerEscapeHandler = null;
  var pdpJsonViewerWired = false;
  var pdpCvProductRef = null;
  var pdpCvEscapeHandler = null;
  var pdpCvWired = false;
  var pdpCvStep = 1;
  var pdpCvCurrencies = [];
  var pdpCvInventoryItems = [];
  /** Sibling-variant inventory lines with option axes (from GET …/inventory-kit-candidates). */
  var pdpCvKitComponents = [];

  function pdpMetaKeyCount(obj) {
    if (obj == null || typeof obj !== 'object') return 0;
    try {
      return Object.keys(obj).length;
    } catch (e) {
      return 0;
    }
  }

  function pdpFormatPrice(cp) {
    if (!cp || cp.calculated_amount == null) return '—';
    var cur = (cp.currency_code || 'usd').toUpperCase();
    var amt = Number(cp.calculated_amount) / 100;
    return amt.toFixed(2) + ' ' + cur;
  }

  function pdpFormatInventory(v) {
    if (!v) return '—';
    var q = v.inventory_quantity;
    if (q != null && typeof q === 'number') return q + ' available at 2 locations';
    if (v.manage_inventory) return 'Managed inventory';
    return '—';
  }

  function pdpVariantOptionValueById(v, optionId) {
    if (!v || !optionId) return '';
    var opts = v.options;
    if (!opts || !opts.length) return '';
    var want = String(optionId).toLowerCase();
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (!o) continue;
      var oid =
        o.option_id != null
          ? String(o.option_id).toLowerCase()
          : o.optionId != null
            ? String(o.optionId).toLowerCase()
            : '';
      if (oid === want && o.value != null && String(o.value).trim() !== '') return String(o.value);
    }
    return '';
  }

  /** Resolved display value for selectors (matches table cells / API). */
  function pdpVariantCurrentOptionValue(v, optionId, columnIndex) {
    var val = pdpVariantOptionValueById(v, optionId);
    if (
      (!val || val === '—') &&
      columnIndex != null &&
      typeof columnIndex === 'number' &&
      /^option_col_\d+$/.test(String(optionId))
    ) {
      var vo = v && v.options;
      if (vo && vo[columnIndex] && vo[columnIndex].value != null && String(vo[columnIndex].value).trim() !== '') {
        val = String(vo[columnIndex].value);
      }
    }
    if (val === '—') return '';
    return val ? String(val) : '';
  }

  /** One cell per product option: match by option_id, or by options[] index when id was missing on the product. */
  function pdpVariantOptionPillCell(v, optionId, columnIndex) {
    var val = pdpVariantOptionValueById(v, optionId);
    if (
      (!val || val === '—') &&
      columnIndex != null &&
      typeof columnIndex === 'number' &&
      /^option_col_\d+$/.test(String(optionId))
    ) {
      var vo = v && v.options;
      if (vo && vo[columnIndex] && vo[columnIndex].value != null && String(vo[columnIndex].value).trim() !== '') {
        val = String(vo[columnIndex].value);
      }
    }
    if (!val || val === '—') return '<span class="pdp-muted">—</span>';
    return '<span class="pdp-option-chip pdp-option-chip--table">' + escapeHtml(val) + '</span>';
  }

  function pdpVariantThumbCell(v) {
    var u = v && v.thumbnail;
    if (u != null && String(u).trim()) {
      return (
        '<td class="pdp-var-thumb-cell">' +
        '<img class="pdp-var-thumb" src="' +
        escapeHtml(String(u)) +
        '" alt="" loading="lazy" /></td>'
      );
    }
    return '<td class="pdp-var-thumb-cell"><span class="pdp-var-thumb-ph" aria-hidden="true">▣</span></td>';
  }

  function pdpSectionDropdown(sectionKey, optionalMiddleHtml) {
    optionalMiddleHtml = optionalMiddleHtml || '';
    return (
      '<div class="pdp-card-actions">' +
      '<button type="button" class="pdp-icon-btn pdp-menu-trigger" data-pdp-menu-trigger aria-label="Section actions" aria-haspopup="true" aria-expanded="false">⋯</button>' +
      '<div class="pdp-menu-dropdown" role="menu" data-pdp-section="' +
      escapeHtml(sectionKey) +
      '">' +
      '<button type="button" class="pdp-menu-item" data-pdp-edit="' +
      escapeHtml(sectionKey) +
      '"><span class="pdp-menu-ico" aria-hidden="true">✎</span> Edit</button>' +
      optionalMiddleHtml +
      '<button type="button" class="pdp-menu-item pdp-menu-danger" data-pdp-delete="' +
      escapeHtml(sectionKey) +
      '"><span class="pdp-menu-ico" aria-hidden="true">🗑</span> Delete</button>' +
      '</div></div>'
    );
  }

  /** Same menu as {@link pdpSectionDropdown} but ⋮ control matches Variants toolbar (pdp-tool-btn + dots SVG). */
  function pdpSectionDropdownMedusaTools(sectionKey, optionalMiddleHtml) {
    optionalMiddleHtml = optionalMiddleHtml || '';
    return (
      '<div class="pdp-card-actions">' +
      '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-menu-trigger" data-pdp-menu-trigger aria-label="Section actions" aria-haspopup="true" aria-expanded="false" title="More">' +
      '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg></button>' +
      '<div class="pdp-menu-dropdown" role="menu" data-pdp-section="' +
      escapeHtml(sectionKey) +
      '">' +
      '<button type="button" class="pdp-menu-item" data-pdp-edit="' +
      escapeHtml(sectionKey) +
      '"><span class="pdp-menu-ico" aria-hidden="true">✎</span> Edit</button>' +
      optionalMiddleHtml +
      '<button type="button" class="pdp-menu-item pdp-menu-danger" data-pdp-delete="' +
      escapeHtml(sectionKey) +
      '"><span class="pdp-menu-ico" aria-hidden="true">🗑</span> Delete</button>' +
      '</div></div>'
    );
  }

  function pdpOptionsSectionMenu() {
    return (
      '<div class="pdp-card-actions">' +
      '<button type="button" class="pdp-icon-btn pdp-menu-trigger" data-pdp-menu-trigger aria-label="Options menu" aria-haspopup="true" aria-expanded="false">⋯</button>' +
      '<div class="pdp-menu-dropdown" role="menu" data-pdp-section="options">' +
      '<button type="button" class="pdp-menu-item" data-pdp-create-option>' +
      '<span class="pdp-menu-ico" aria-hidden="true">+</span> Create</button>' +
      '</div></div>'
    );
  }

  /** Options card: label + value chips + row menu (Medusa-style). */
  function pdpOptionsRowsHtml(opts) {
    opts = opts || [];
    if (!opts.length) {
      return '<p class="pdp-muted pdp-options-empty">No options</p>';
    }
    return (
      '<div class="pdp-options-list">' +
      opts
        .map(function(o) {
          var vals = o.values || [];
          var chips =
            vals.length > 0
              ? vals
                  .map(function(v) {
                    return '<span class="pdp-option-chip">' + escapeHtml(String(v)) + '</span>';
                  })
                  .join('')
              : '<span class="pdp-option-chip pdp-option-chip--empty">—</span>';
          return (
            '<div class="pdp-option-row">' +
            '<span class="pdp-option-row-label">' +
            escapeHtml(o.title || o.id || 'Option') +
            '</span>' +
            '<div class="pdp-option-row-values">' +
            chips +
            '</div>' +
            '<div class="pdp-card-actions pdp-option-row-actions">' +
            '<button type="button" class="pdp-icon-btn pdp-menu-trigger" data-pdp-menu-trigger aria-label="Option actions" aria-haspopup="true" aria-expanded="false">⋯</button>' +
            '<div class="pdp-menu-dropdown" role="menu" data-pdp-option-row="1">' +
            '<button type="button" class="pdp-menu-item" data-pdp-edit-option="' +
            escapeHtml(String(o.id || '').trim() || pdpCoSlugId(o.title || 'option')) +
            '"><span class="pdp-menu-ico" aria-hidden="true">✎</span> Edit</button>' +
            '<button type="button" class="pdp-menu-item pdp-menu-danger" data-pdp-delete-option="' +
            escapeHtml(String(o.id || '').trim() || pdpCoSlugId(o.title || 'option')) +
            '"><span class="pdp-menu-ico" aria-hidden="true">🗑</span> Delete</button>' +
            '</div></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function readAdminProductOptions(p) {
    var meta = readProductMetadata(p);
    var raw = meta.admin_product_options;
    var fromMeta = [];
    if (Array.isArray(raw)) {
      fromMeta = raw
        .filter(function(x) {
          return x && typeof x === 'object';
        })
        .map(function(x) {
          return {
            id: String(x.id || '').trim(),
            title: String(x.title || '').trim(),
            values: Array.isArray(x.values) ? x.values.map(String) : []
          };
        })
        .filter(function(x) {
          return x.title;
        });
    }
    if (fromMeta.length) return fromMeta;
    /** Fallback: recover admin-only options from API if metadata was missing on the client (avoids wiping DB on save). */
    var opts = (p && p.options) || [];
    return opts
      .filter(function(o) {
        if (!o || typeof o !== 'object') return false;
        var id = String(o.id || '').toLowerCase();
        return id && id !== 'type';
      })
      .map(function(o) {
        return {
          id: String(o.id || '').trim(),
          title: String(o.title || o.id || '').trim(),
          values: Array.isArray(o.values) ? o.values.map(String) : []
        };
      })
      .filter(function(x) {
        return x.title;
      });
  }

  function pdpCoSlugId(title) {
    var s = String(title || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!s) return 'option';
    if (s === 'type') return 'option_type';
    return s;
  }

  function pdpCoRenderChips() {
    var el = document.getElementById('pdpCoTagsChips');
    if (!el) return;
    el.innerHTML = pdpCreateOptionVariations
      .map(function(tag, idx) {
        return (
          '<span class="pdp-co-chip">' +
          escapeHtml(tag) +
          '<button type="button" class="pdp-co-chip-remove" data-pdp-co-remove="' +
          idx +
          '" aria-label="Remove">&times;</button></span>'
        );
      })
      .join('');
    el.querySelectorAll('[data-pdp-co-remove]').forEach(function(btn) {
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        var i = Number(btn.getAttribute('data-pdp-co-remove'));
        if (!Number.isNaN(i)) {
          pdpCreateOptionVariations.splice(i, 1);
          pdpCoRenderChips();
        }
      });
    });
  }

  function pdpCoCommitInputTokens(raw) {
    String(raw || '')
      .split(',')
      .map(function(s) {
        return s.trim();
      })
      .filter(Boolean)
      .forEach(function(p) {
        if (pdpCreateOptionVariations.indexOf(p) < 0) pdpCreateOptionVariations.push(p);
      });
  }

  function pdpHideCreateOptionDrawerUi() {
    var root = document.getElementById('pdpCoDrawer');
    var bd = document.getElementById('pdpCoBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('pdp-co-drawer-open');
  }

  function pdpTeardownCreateOptionDrawerKeys() {
    if (pdpCreateOptionEscapeHandler) {
      document.removeEventListener('keydown', pdpCreateOptionEscapeHandler, true);
      pdpCreateOptionEscapeHandler = null;
    }
  }

  function closePdpCreateOptionDrawer() {
    pdpHideCreateOptionDrawerUi();
    pdpTeardownCreateOptionDrawerKeys();
    pdpCoEditOptionId = null;
    if (!isPdpOptionsDrawerPath()) return;
    var pid = getProductDetailId();
    if (pid) {
      history.replaceState({}, '', '/app/products/' + encodeURIComponent(pid));
    }
  }

  function ensurePdpCreateOptionDrawerDom() {
    if (document.getElementById('pdpCoDrawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpCoBackdrop" class="pdp-co-backdrop pdp-edit-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpCoDrawer" class="pdp-co-drawer pdp-edit-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpCoTitleHeading">' +
      '<header class="pdp-edit-head">' +
      '<h2 id="pdpCoTitleHeading" class="pdp-edit-title">Create Option</h2>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpCoClose" aria-label="Close">×</button>' +
      '</div></header>' +
      '<div class="pdp-edit-body">' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Option title</span>' +
      '<input type="text" id="pdpCoTitle" class="pdp-edit-input" autocomplete="off" /></label>' +
      '<div class="pdp-edit-field">' +
      '<span class="pdp-edit-label">Variations <span class="pdp-edit-opt">(comma-separated)</span></span>' +
      '<div id="pdpCoTagsWrap" class="pdp-co-tags-wrap">' +
      '<div id="pdpCoTagsChips" class="pdp-co-tags-chips"></div>' +
      '<input type="text" id="pdpCoTagsInput" class="pdp-co-tags-input pdp-edit-input" autocomplete="off" placeholder="Type and press Enter" />' +
      '</div></div></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpCoCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpCoSave">Save</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openPdpCreateOptionDrawer(product, opts) {
    opts = opts || {};
    if (!product || !product.id) return;
    closePdpVariantOptDrawer();
    pdpEditProductRef = product;
    ensurePdpCreateOptionDrawerDom();
    var editFromOpts = opts.editOptionId != null ? String(opts.editOptionId).trim() : '';
    pdpCoEditOptionId = editFromOpts || null;
    var headEl = document.getElementById('pdpCoTitleHeading');
    if (headEl) headEl.textContent = pdpCoEditOptionId ? 'Edit Option' : 'Create Option';
    pdpCreateOptionVariations = [];
    var ti = document.getElementById('pdpCoTitle');
    if (pdpCoEditOptionId) {
      var ao = readAdminProductOptions(product);
      var found = ao.find(function(o) {
        return o.id === pdpCoEditOptionId;
      });
      if (ti) ti.value = found && found.title ? found.title : '';
      if (found && Array.isArray(found.values)) {
        pdpCreateOptionVariations = found.values.slice();
      }
    } else {
      if (ti) ti.value = '';
    }
    var inp = document.getElementById('pdpCoTagsInput');
    if (inp) inp.value = '';
    pdpCoRenderChips();
    var root = document.getElementById('pdpCoDrawer');
    var bd = document.getElementById('pdpCoBackdrop');
    if (root) {
      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
    if (bd) {
      bd.classList.remove('hidden');
      bd.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('pdp-co-drawer-open');
    if (!opts.skipUrl && pdpCoEditOptionId && !isPdpOptionsEditPath()) {
      history.pushState(
        { pdpEditOption: true },
        '',
        '/app/products/' + encodeURIComponent(product.id) + '/options/' + encodeURIComponent(pdpCoEditOptionId) + '/edit'
      );
    } else if (!opts.skipUrl && !pdpCoEditOptionId && !isPdpOptionsCreatePath()) {
      history.pushState({ pdpCreateOption: true }, '', '/app/products/' + encodeURIComponent(product.id) + '/options/create');
    }
    pdpTeardownCreateOptionDrawerKeys();
    pdpCreateOptionEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpCreateOptionDrawer();
      }
    };
    document.addEventListener('keydown', pdpCreateOptionEscapeHandler, true);
    if (ti) ti.focus();

    if (!pdpCreateOptionDrawerWired) {
      pdpCreateOptionDrawerWired = true;
      document.getElementById('pdpCoBackdrop').addEventListener('click', closePdpCreateOptionDrawer);
      document.getElementById('pdpCoClose').addEventListener('click', closePdpCreateOptionDrawer);
      document.getElementById('pdpCoCancel').addEventListener('click', closePdpCreateOptionDrawer);
      document.getElementById('pdpCoSave').addEventListener('click', submitPdpCreateOptionForm);
      var tagIn = document.getElementById('pdpCoTagsInput');
      if (tagIn) {
        tagIn.addEventListener('keydown', function(ke) {
          if (ke.key === 'Enter' || ke.key === ',') {
            ke.preventDefault();
            pdpCoCommitInputTokens(tagIn.value);
            tagIn.value = '';
            pdpCoRenderChips();
          } else if (ke.key === 'Backspace' && !tagIn.value && pdpCreateOptionVariations.length) {
            pdpCreateOptionVariations.pop();
            pdpCoRenderChips();
          }
        });
        tagIn.addEventListener('blur', function() {
          if (tagIn.value.trim()) {
            pdpCoCommitInputTokens(tagIn.value);
            tagIn.value = '';
            pdpCoRenderChips();
          }
        });
      }
    }
  }

  function submitPdpCreateOptionForm() {
    var p = pdpEditProductRef;
    if (!p || !p.id) return;
    var ti = document.getElementById('pdpCoTitle');
    var title = ti && ti.value ? ti.value.trim() : '';
    if (!title) {
      window.alert('Option title is required.');
      return;
    }
    if (!pdpCreateOptionVariations.length) {
      window.alert('Add at least one variation.');
      return;
    }
    var existing = readAdminProductOptions(p);
    var next;
    if (pdpCoEditOptionId) {
      var matched = false;
      next = existing.map(function(o) {
        if (o.id === pdpCoEditOptionId) {
          matched = true;
          return { id: o.id, title: title, values: pdpCreateOptionVariations.slice() };
        }
        return o;
      });
      if (!matched) {
        window.alert('This option no longer exists. Refresh the page.');
        return;
      }
    } else {
      var baseId = pdpCoSlugId(title);
      var id = baseId;
      var n = 1;
      while (existing.some(function(o) {
        return o.id === id;
      })) {
        id = baseId + '_' + n;
        n++;
      }
      next = existing.concat([{ id: id, title: title, values: pdpCreateOptionVariations.slice() }]);
    }
    var saveBtn = document.getElementById('pdpCoSave');
    if (saveBtn) saveBtn.disabled = true;
    var payload = Object.assign({}, buildPdpPatchPayload(p), { admin_options: next });
    fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error) ? String(x.data.message || x.data.error) : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        closePdpCreateOptionDrawer();
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save option.');
      })
      .finally(function() {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function pdpDeleteProductOption(product, optionId) {
    if (!product || !product.id || !optionId) return;
    if (
      !window.confirm(
        'Delete this option? Value rows and variant links for removed values will be removed from the catalog when using native option tables.'
      )
    ) {
      return;
    }
    var existing = readAdminProductOptions(product);
    var next = existing.filter(function(o) {
      return o.id !== optionId;
    });
    if (next.length === existing.length) {
      window.alert('Option not found.');
      return;
    }
    fetch('/admin/products/' + encodeURIComponent(product.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({}, buildPdpPatchPayload(product), { admin_options: next }))
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error)
              ? String(x.data.message || x.data.error)
              : 'Delete failed (' + x.status + ')';
          throw new Error(msg);
        }
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not delete option.');
      });
  }

  function pdpHideVariantOptDrawerUi() {
    var root = document.getElementById('pdpVoDrawer');
    var bd = document.getElementById('pdpVoBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('pdp-vo-drawer-open');
  }

  function pdpTeardownVariantOptDrawerKeys() {
    if (pdpVoEscapeHandler) {
      document.removeEventListener('keydown', pdpVoEscapeHandler, true);
      pdpVoEscapeHandler = null;
    }
  }

  function closePdpVariantOptDrawer() {
    pdpHideVariantOptDrawerUi();
    pdpTeardownVariantOptDrawerKeys();
    pdpVoProductRef = null;
    pdpVoVariantRef = null;
  }

  function ensurePdpVariantOptDrawerDom() {
    if (document.getElementById('pdpVoDrawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpVoBackdrop" class="pdp-vo-backdrop pdp-edit-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpVoDrawer" class="pdp-vo-drawer pdp-edit-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpVoHeading">' +
      '<header class="pdp-edit-head">' +
      '<h2 id="pdpVoHeading" class="pdp-edit-title">Variant options</h2>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpVoClose" aria-label="Close">×</button>' +
      '</div></header>' +
      '<div class="pdp-edit-body">' +
      '<p class="pdp-muted pdp-vo-sub" id="pdpVoSubtitle"></p>' +
      '<p class="pdp-muted pdp-vo-hint">Choose one value per product option for this variant. Use “None” to clear a link (native tables).</p>' +
      '<div id="pdpVoFields"></div></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpVoCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpVoSave">Save</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openPdpVariantOptDrawer(product, variantObj, productOptionColumns) {
    if (!product || !product.id || !variantObj || !variantObj.id) return;
    closePdpCreateOptionDrawer();
    pdpVoProductRef = product;
    pdpVoVariantRef = variantObj;
    ensurePdpVariantOptDrawerDom();
    var sub = document.getElementById('pdpVoSubtitle');
    if (sub) {
      sub.textContent =
        (variantObj.title || 'Variant') +
        (variantObj.sku ? ' · SKU ' + variantObj.sku : '') +
        ' · ' +
        variantObj.id;
    }
    var opts = product.options || [];
    var fieldsEl = document.getElementById('pdpVoFields');
    if (!fieldsEl) return;
    if (!opts.length) {
      fieldsEl.innerHTML =
        '<p class="pdp-muted">Add product options in the Options section first.</p>';
    } else {
      fieldsEl.innerHTML = opts
        .map(function(o, idx) {
          var col = (productOptionColumns && productOptionColumns[idx]) || {};
          var oid = String(o.id != null ? o.id : '').trim() || String(col.id || '').trim() || 'option_col_' + idx;
          var vals = Array.isArray(o.values) ? o.values : [];
          var cur = pdpVariantCurrentOptionValue(variantObj, oid, idx);
          var label = String(o.title || col.title || 'Option').trim() || 'Option';
          var optHtml =
            '<option value="">— None —</option>' +
            vals
              .map(function(v) {
                var vs = String(v);
                var sel = cur && cur.trim() === vs.trim() ? ' selected' : '';
                return '<option value="' + escapeHtml(vs) + '"' + sel + '>' + escapeHtml(vs) + '</option>';
              })
              .join('');
          return (
            '<label class="pdp-edit-field pdp-vo-field"><span class="pdp-edit-label">' +
            escapeHtml(label) +
            '</span><select class="pdp-edit-input pdp-vo-select" id="pdpVoSel-' +
            idx +
            '" data-option-id="' +
            escapeHtml(oid) +
            '">' +
            optHtml +
            '</select></label>'
          );
        })
        .join('');
    }
    var root = document.getElementById('pdpVoDrawer');
    var bd = document.getElementById('pdpVoBackdrop');
    if (root) {
      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
    if (bd) {
      bd.classList.remove('hidden');
      bd.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('pdp-vo-drawer-open');
    pdpTeardownVariantOptDrawerKeys();
    pdpVoEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpVariantOptDrawer();
      }
    };
    document.addEventListener('keydown', pdpVoEscapeHandler, true);

    if (!pdpVoDrawerWired) {
      pdpVoDrawerWired = true;
      document.getElementById('pdpVoBackdrop').addEventListener('click', closePdpVariantOptDrawer);
      document.getElementById('pdpVoClose').addEventListener('click', closePdpVariantOptDrawer);
      document.getElementById('pdpVoCancel').addEventListener('click', closePdpVariantOptDrawer);
      document.getElementById('pdpVoSave').addEventListener('click', submitPdpVariantOptForm);
    }
  }

  function submitPdpVariantOptForm() {
    var p = pdpVoProductRef;
    var v = pdpVoVariantRef;
    if (!p || !p.id || !v || !v.id) return;
    var assigns = [];
    var optList = p.options || [];
    for (var idx = 0; idx < optList.length; idx++) {
      var sel = document.getElementById('pdpVoSel-' + idx);
      if (!sel) continue;
      var oid = sel.getAttribute('data-option-id') || '';
      if (!oid) continue;
      var val = sel.value;
      assigns.push({
        variant_id: v.id,
        option_id: oid,
        value: val === '' ? null : val
      });
    }
    var saveBtn = document.getElementById('pdpVoSave');
    if (saveBtn) saveBtn.disabled = true;
    var payload = Object.assign({}, buildPdpPatchPayload(p), { variant_option_assignments: assigns });
    fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error)
              ? String(x.data.message || x.data.error)
              : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        closePdpVariantOptDrawer();
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save variant options.');
      })
      .finally(function() {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function pdpNotImplemented(action) {
    window.alert(action + ' will connect to the catalog API when update/delete endpoints are available.');
  }

  function pdpOpenJsonTab(text) {
    try {
      var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      var u = URL.createObjectURL(blob);
      window.open(u, '_blank', 'noopener');
      setTimeout(function() {
        URL.revokeObjectURL(u);
      }, 60000);
    } catch (e) {
      window.alert('Could not open JSON in a new tab.');
    }
  }

  function pdpJsonCopyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard'));
  }

  function pdpJsonTreePrimitiveText(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return JSON.stringify(String(value));
  }

  /** @param {HTMLElement} host @param {string|null} keyName @param {*} value @param {number} depth */
  function pdpJsonTreeAppendNode(host, keyName, value, depth) {
    var indent = depth * 16;
    if (value !== null && typeof value === 'object') {
      var isArr = Array.isArray(value);
      var entries = [];
      if (isArr) {
        for (var ii = 0; ii < value.length; ii++) entries.push([String(ii), value[ii]]);
      } else {
        Object.keys(value).forEach(function(k) {
          entries.push([k, value[k]]);
        });
      }
      var n = entries.length;
      var startExpanded = depth === 0;

      var line = document.createElement('div');
      line.className = 'pdp-json-tree-line';
      line.style.paddingLeft = indent + 'px';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'pdp-json-tree-toggle';
      var expanded = startExpanded;
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.textContent = expanded ? '▼' : '▶';
      line.appendChild(toggle);

      if (keyName != null) {
        var ks = document.createElement('span');
        ks.className = 'pdp-json-tree-key';
        ks.textContent = keyName + ': ';
        line.appendChild(ks);
      }

      var braceOpen = document.createElement('span');
      braceOpen.className = 'pdp-json-tree-brace';
      braceOpen.textContent = isArr ? '[' : '{';
      line.appendChild(braceOpen);

      var cnt = document.createElement('span');
      cnt.className = 'pdp-json-tree-count';
      cnt.textContent = ' ' + n + ' items';
      line.appendChild(cnt);

      var copyB = document.createElement('button');
      copyB.type = 'button';
      copyB.className = 'pdp-json-tree-copy';
      copyB.setAttribute('aria-label', 'Copy this JSON');
      copyB.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyB.addEventListener('click', function(e) {
        e.stopPropagation();
        try {
          pdpJsonCopyToClipboard(JSON.stringify(value)).catch(function() {
            window.alert('Could not copy.');
          });
        } catch (err) {
          window.alert('Could not copy.');
        }
      });
      line.appendChild(copyB);

      var inlineClose = document.createElement('span');
      inlineClose.className = 'pdp-json-tree-inline-close';
      inlineClose.textContent = isArr ? ' ]' : ' }';
      if (expanded) inlineClose.classList.add('hidden');
      line.appendChild(inlineClose);

      var block = document.createElement('div');
      block.className = 'pdp-json-tree-block';
      if (!expanded) block.classList.add('hidden');

      entries.forEach(function(pair) {
        pdpJsonTreeAppendNode(block, pair[0], pair[1], depth + 1);
      });

      var closeLine = document.createElement('div');
      closeLine.className = 'pdp-json-tree-line pdp-json-tree-close-line';
      closeLine.style.paddingLeft = indent + 16 + 'px';
      var closeBrace = document.createElement('span');
      closeBrace.className = 'pdp-json-tree-brace';
      closeBrace.textContent = isArr ? ']' : '}';
      closeLine.appendChild(closeBrace);
      if (!expanded) closeLine.classList.add('hidden');

      toggle.addEventListener('click', function() {
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        var next = !isOpen;
        toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
        toggle.textContent = next ? '▼' : '▶';
        block.classList.toggle('hidden', !next);
        closeLine.classList.toggle('hidden', !next);
        inlineClose.classList.toggle('hidden', next);
      });

      host.appendChild(line);
      host.appendChild(block);
      host.appendChild(closeLine);
      return;
    }

    var pline = document.createElement('div');
    pline.className = 'pdp-json-tree-line';
    pline.style.paddingLeft = indent + 'px';
    var pk = document.createElement('span');
    pk.className = 'pdp-json-tree-key';
    pk.textContent = keyName != null ? keyName + ': ' : '';
    var pv = document.createElement('span');
    if (value === null) {
      pv.className = 'pdp-json-tree-val pdp-json-null';
      pv.textContent = 'null';
    } else if (typeof value === 'boolean') {
      pv.className = 'pdp-json-tree-val pdp-json-bool';
      pv.textContent = String(value);
    } else if (typeof value === 'number') {
      pv.className = 'pdp-json-tree-val pdp-json-num';
      pv.textContent = String(value);
    } else {
      pv.className = 'pdp-json-tree-val pdp-json-str';
      pv.textContent = pdpJsonTreePrimitiveText(value);
    }
    pline.appendChild(pk);
    pline.appendChild(pv);
    var copyP = document.createElement('button');
    copyP.type = 'button';
    copyP.className = 'pdp-json-tree-copy pdp-json-tree-copy-sm';
    copyP.setAttribute('aria-label', 'Copy value');
    copyP.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyP.addEventListener('click', function(e) {
      e.stopPropagation();
      var t =
        value === null
          ? 'null'
          : typeof value === 'boolean' || typeof value === 'number'
            ? String(value)
            : String(value);
      pdpJsonCopyToClipboard(t).catch(function() {
        window.alert('Could not copy.');
      });
    });
    pline.appendChild(copyP);
    host.appendChild(pline);
  }

  function pdpHideJsonViewerUi() {
    var root = document.getElementById('pdpJsonViewerModal');
    var bd = document.getElementById('pdpJsonViewerBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function pdpTeardownJsonViewerKeys() {
    if (pdpJsonViewerEscapeHandler) {
      document.removeEventListener('keydown', pdpJsonViewerEscapeHandler, true);
      pdpJsonViewerEscapeHandler = null;
    }
  }

  function closePdpJsonViewer() {
    pdpHideJsonViewerUi();
    pdpTeardownJsonViewerKeys();
    pdpJsonViewerProductRef = null;
  }

  function ensurePdpJsonViewerDom() {
    if (document.getElementById('pdpJsonViewerModal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpJsonViewerBackdrop" class="pdp-edit-backdrop pdp-meta-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpJsonViewerModal" class="pdp-edit-drawer pdp-meta-drawer pdp-json-view-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpJsonViewerTitle">' +
      '<header class="pdp-edit-head">' +
      '<div class="pdp-json-view-drawer-head">' +
      '<h2 id="pdpJsonViewerTitle" class="pdp-edit-title">JSON</h2>' +
      '<p id="pdpJsonViewerKeyCount" class="pdp-json-view-keycount-line">0 keys</p></div>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpJsonViewerClose" aria-label="Close">×</button></div></header>' +
      '<div class="pdp-edit-body pdp-meta-drawer-body">' +
      '<div id="pdpJsonViewerTree"></div></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpJsonViewerOpenEditor">Edit as text…</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openPdpJsonViewer(p) {
    if (!p || typeof p !== 'object') return;
    closePdpMetadataDrawer();
    closePdpJsonDrawer();
    ensurePdpJsonViewerDom();
    var modal = document.getElementById('pdpJsonViewerModal');
    var bd = document.getElementById('pdpJsonViewerBackdrop');
    var tree = document.getElementById('pdpJsonViewerTree');
    var kc = document.getElementById('pdpJsonViewerKeyCount');
    if (!modal || !bd || !tree) return;
    pdpJsonViewerProductRef = p;
    var nKeys = pdpMetaKeyCount(p);
    if (kc) kc.textContent = nKeys + ' keys';
    tree.innerHTML = '';
    pdpJsonTreeAppendNode(tree, null, p, 0);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    bd.classList.remove('hidden');
    bd.setAttribute('aria-hidden', 'false');
    pdpTeardownJsonViewerKeys();
    pdpJsonViewerEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (modal && !modal.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpJsonViewer();
      }
    };
    document.addEventListener('keydown', pdpJsonViewerEscapeHandler, true);

    if (!pdpJsonViewerWired) {
      pdpJsonViewerWired = true;
      document.getElementById('pdpJsonViewerBackdrop').addEventListener('click', function() {
        closePdpJsonViewer();
      });
      document.getElementById('pdpJsonViewerClose').addEventListener('click', function() {
        closePdpJsonViewer();
      });
      document.getElementById('pdpJsonViewerOpenEditor').addEventListener('click', function() {
        var ref = pdpJsonViewerProductRef;
        closePdpJsonViewer();
        if (ref) openPdpJsonDrawer(ref);
      });
    }
  }

  function pdpHideJsonDrawerUi() {
    var root = document.getElementById('pdpJsonDrawer');
    var bd = document.getElementById('pdpJsonBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function pdpTeardownJsonDrawerKeys() {
    if (pdpJsonEscapeHandler) {
      document.removeEventListener('keydown', pdpJsonEscapeHandler, true);
      pdpJsonEscapeHandler = null;
    }
  }

  function closePdpJsonDrawer() {
    pdpHideJsonDrawerUi();
    pdpTeardownJsonDrawerKeys();
    pdpJsonProductRef = null;
  }

  function pdpCvTeardownKeys() {
    if (pdpCvEscapeHandler) {
      document.removeEventListener('keydown', pdpCvEscapeHandler, true);
      pdpCvEscapeHandler = null;
    }
  }

  function pdpCvHideUi() {
    var bd = document.getElementById('pdpCvBackdrop');
    var root = document.getElementById('pdpCvRoot');
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('pdp-cv-open');
  }

  function closePdpCreateVariantWizard() {
    pdpCvHideUi();
    pdpCvTeardownKeys();
    pdpCvProductRef = null;
    pdpCvStep = 1;
    pdpCvKitComponents = [];
  }

  function ensurePdpCreateVariantWizardDom() {
    if (document.getElementById('pdpCvRoot')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpCvBackdrop" class="pdp-cv-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpCvRoot" class="pdp-cv-root hidden" role="dialog" aria-modal="true" aria-labelledby="pdpCvAriaTitle">' +
      '<div class="pdp-cv-inner">' +
      '<header class="pdp-cv-top">' +
      '<div class="pdp-cv-top-row">' +
      '<button type="button" class="pdp-cv-close-wrap" id="pdpCvClose" aria-label="Close">' +
      '<span class="pdp-cv-x" aria-hidden="true">×</span><span class="pdp-cv-esc">esc</span></button>' +
      '<h2 id="pdpCvAriaTitle" class="pdp-cv-screen-title">Create variant</h2>' +
      '<span class="pdp-cv-top-spacer" aria-hidden="true"></span></div>' +
      '<nav class="pdp-cv-stepper" aria-label="Steps">' +
      '<div class="pdp-cv-step-nav is-active" data-pdp-cv-step-dot="1"><span class="pdp-cv-step-dot">1</span><span class="pdp-cv-step-lbl">Details</span></div>' +
      '<span class="pdp-cv-step-line" aria-hidden="true"></span>' +
      '<div class="pdp-cv-step-nav" data-pdp-cv-step-dot="2"><span class="pdp-cv-step-dot">2</span><span class="pdp-cv-step-lbl">Prices</span></div>' +
      '<span class="pdp-cv-step-line pdp-cv-step-line-kit" aria-hidden="true"></span>' +
      '<div class="pdp-cv-step-nav pdp-cv-step-nav-kit" data-pdp-cv-step-dot="3"><span class="pdp-cv-step-dot">3</span><span class="pdp-cv-step-lbl">Inventory kits</span></div>' +
      '</nav></header>' +
      '<div class="pdp-cv-main">' +
      '<section id="pdpCvPanel1" class="pdp-cv-panel">' +
      '<h3 class="pdp-cv-h3">Variant details</h3>' +
      '<div class="pdp-cv-grid2">' +
      '<label class="pdp-cv-field"><span class="pdp-cv-lbl">Title <span class="pdp-cv-req">*</span></span><input type="text" id="pdpCvTitle" class="pdp-cv-input" autocomplete="off" /></label>' +
      '<label class="pdp-cv-field"><span class="pdp-cv-lbl">SKU <span class="pdp-cv-opt">(Optional)</span></span><input type="text" id="pdpCvSku" class="pdp-cv-input" autocomplete="off" /></label></div>' +
      '<div id="pdpCvTypeMount" class="pdp-cv-type-mount"></div>' +
      '<div class="pdp-cv-toggle-list">' +
      '<div class="pdp-cv-toggle-card">' +
      '<label class="pdp-cv-toggle"><input type="checkbox" id="pdpCvManageInv" /><span class="pdp-cv-switch-ui" aria-hidden="true"></span></label>' +
      '<div class="pdp-cv-toggle-txt"><strong>Manage inventory</strong><p class="pdp-cv-muted">When enabled, we will adjust inventory when orders and returns are created.</p></div></div>' +
      '<div class="pdp-cv-toggle-card">' +
      '<label class="pdp-cv-toggle"><input type="checkbox" id="pdpCvAllowBo" /><span class="pdp-cv-switch-ui" aria-hidden="true"></span></label>' +
      '<div class="pdp-cv-toggle-txt"><strong>Allow backorders</strong><p class="pdp-cv-muted">When enabled, customers can purchase even if quantity is zero.</p></div></div>' +
      '<div class="pdp-cv-toggle-card">' +
      '<label class="pdp-cv-toggle"><input type="checkbox" id="pdpCvInvKit" /><span class="pdp-cv-switch-ui" aria-hidden="true"></span></label>' +
      '<div class="pdp-cv-toggle-txt"><strong>Inventory kit</strong><p class="pdp-cv-muted">Does this variant consist of several inventory items?</p></div></div>' +
      '</div></section>' +
      '<section id="pdpCvPanel2" class="pdp-cv-panel hidden">' +
      '<div class="pdp-cv-price-toolbar"><span class="pdp-cv-muted">Prices</span></div>' +
      '<div class="pdp-cv-table-wrap"><table class="pdp-cv-price-table"><thead><tr id="pdpCvPriceHeadRow"></tr></thead><tbody><tr id="pdpCvPriceDataRow"></tr></tbody></table></div></section>' +
      '<section id="pdpCvPanel3" class="pdp-cv-panel hidden">' +
      '<h3 class="pdp-cv-h3">Inventory kits</h3>' +
      '<p class="pdp-cv-muted" id="pdpCvKitIntro">Pick a <strong>stock line</strong> from another variant of this product. When that variant uses options (e.g. Color, Size), they are shown under the row. Set how many units of that line go into this bundle.</p>' +
      '<p class="pdp-cv-muted" id="pdpCvKitHint"></p>' +
      '<div class="pdp-cv-kit-head"><span></span><button type="button" class="btn-outline pdp-cv-kit-add" id="pdpCvKitAdd">Add</button></div>' +
      '<div id="pdpCvKitRows" class="pdp-cv-kit-rows"></div></section>' +
      '</div>' +
      '<footer class="pdp-cv-foot">' +
      '<button type="button" class="btn-outline" id="pdpCvCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpCvPrimary">Continue</button></footer></div></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function pdpCvRenderTypeSelectors(p) {
    var mount = document.getElementById('pdpCvTypeMount');
    if (!mount) return;
    var opts = readAdminProductOptions(p);
    mount.innerHTML = '';
    if (!opts.length) {
      mount.innerHTML =
        '<p class="pdp-cv-muted">No product options yet. Define options on the product first, or create the variant without option links.</p>';
      return;
    }
    mount.innerHTML = opts
      .map(function(o, idx) {
        var oid = String(o.id || '').trim() || 'opt-' + idx;
        var vals = o.values || [];
        var optsHtml =
          '<option value="">Select…</option>' +
          vals
            .map(function(v) {
              return '<option value="' + escapeHtml(String(v)) + '">' + escapeHtml(String(v)) + '</option>';
            })
            .join('');
        return (
          '<label class="pdp-cv-field pdp-cv-field-block"><span class="pdp-cv-lbl">' +
          escapeHtml(o.title || 'Option') +
          '</span><select class="pdp-cv-input" data-pdp-cv-option-id="' +
          escapeHtml(oid) +
          '">' +
          optsHtml +
          '</select></label>'
        );
      })
      .join('');
  }

  function pdpCvLoadCurrencies() {
    return api('/admin/regions')
      .then(function(r) {
        return r.json();
      })
      .then(function(data) {
        var regs = data && data.regions ? data.regions : [];
        var seen = {};
        var cur = [];
        regs.forEach(function(x) {
          var c = (x.currency_code || '').toLowerCase().trim();
          if (!c || seen[c]) return;
          seen[c] = true;
          cur.push({ code: c, label: (x.name || c).toString() });
        });
        if (!cur.length) {
          cur.push({ code: 'usd', label: 'USD' }, { code: 'eur', label: 'EUR' });
        }
        pdpCvCurrencies = cur;
        return cur;
      })
      .catch(function() {
        pdpCvCurrencies = [{ code: 'usd', label: 'USD' }, { code: 'eur', label: 'EUR' }];
        return pdpCvCurrencies;
      });
  }

  function pdpCvLoadInventoryItems() {
    return api('/admin/inventory-items')
      .then(function(r) {
        return r.json().then(function(data) {
          if (!r.ok) {
            pdpCvInventoryItems = [];
            return pdpCvInventoryItems;
          }
          pdpCvInventoryItems = data && Array.isArray(data.items) ? data.items : [];
          return pdpCvInventoryItems;
        });
      })
      .catch(function() {
        pdpCvInventoryItems = [];
        return pdpCvInventoryItems;
      });
  }

  function pdpCvLoadKitComponents(productId) {
    if (!productId) {
      pdpCvKitComponents = [];
      return Promise.resolve([]);
    }
    return api('/admin/products/' + encodeURIComponent(productId) + '/inventory-kit-candidates')
      .then(function(r) {
        return r.json().then(function(data) {
          if (!r.ok) {
            pdpCvKitComponents = [];
            return pdpCvKitComponents;
          }
          pdpCvKitComponents = data && Array.isArray(data.components) ? data.components : [];
          return pdpCvKitComponents;
        });
      })
      .catch(function() {
        pdpCvKitComponents = [];
        return pdpCvKitComponents;
      });
  }

  function pdpCvBuildPriceGrid() {
    var head = document.getElementById('pdpCvPriceHeadRow');
    var row = document.getElementById('pdpCvPriceDataRow');
    if (!head || !row) return;
    var title = (document.getElementById('pdpCvTitle') && document.getElementById('pdpCvTitle').value.trim()) || '—';
    head.innerHTML =
      '<th scope="col">Title</th>' +
      pdpCvCurrencies
        .map(function(c) {
          return (
            '<th scope="col">Price ' +
            escapeHtml(c.code.toUpperCase()) +
            '</th>'
          );
        })
        .join('');
    row.innerHTML =
      '<td>' +
      escapeHtml(title) +
      '</td>' +
      pdpCvCurrencies
        .map(function(c) {
          return (
            '<td><div class="pdp-cv-money-wrap"><span class="pdp-cv-cur" aria-hidden="true">' +
            escapeHtml(c.code.toUpperCase().substring(0, 1)) +
            '</span>' +
            '<input type="number" class="pdp-cv-input pdp-cv-price-inp" step="0.01" min="0" data-currency="' +
            escapeHtml(c.code) +
            '" placeholder="0.00" /></div></td>'
          );
        })
        .join('');
  }

  function pdpCvKitSelectOptionsHtml() {
    var list = [];
    if (pdpCvKitComponents.length) {
      list = pdpCvKitComponents.map(function(c) {
        return {
          id: String(c.inventory_item_id || '').trim(),
          label: (c.label || c.inventory_item_id || '').toString()
        };
      });
    } else if (pdpCvInventoryItems.length) {
      list = pdpCvInventoryItems.map(function(it) {
        return {
          id: String(it.id || '').trim(),
          label: (it.title || it.sku || it.id || '').toString()
        };
      });
    }
    if (!list.length) {
      return '<option value="">No stock lines available</option>';
    }
    return (
      '<option value="">Select stock line…</option>' +
      list
        .filter(function(x) {
          return x.id;
        })
        .map(function(x) {
          return '<option value="' + escapeHtml(x.id) + '">' + escapeHtml(x.label) + '</option>';
        })
        .join('')
    );
  }

  function pdpCvFindKitComponent(inventoryItemId) {
    var id = String(inventoryItemId || '').trim();
    if (!id) return null;
    for (var i = 0; i < pdpCvKitComponents.length; i++) {
      var c = pdpCvKitComponents[i];
      if (c && String(c.inventory_item_id || '').trim() === id) return c;
    }
    return null;
  }

  function pdpCvRenderKitRowChips(row, inventoryItemId) {
    var host = row && row.querySelector('.pdp-cv-kit-opt-chips');
    if (!host) return;
    host.classList.remove('pdp-cv-kit-opt-chips--empty');
    var id = String(inventoryItemId || '').trim();
    if (!id) {
      host.innerHTML = '';
      host.classList.add('pdp-cv-kit-opt-chips--empty');
      return;
    }
    var c = pdpCvFindKitComponent(id);
    if (!c || !c.options || !c.options.length) {
      host.classList.add('pdp-cv-kit-opt-chips--empty');
      host.innerHTML =
        '<span class="pdp-cv-muted pdp-cv-kit-opt-fallback">No Color/Size labels for this line yet. Link inventory to a sibling variant that uses product options, or pick from the global catalog.</span>';
      return;
    }
    host.innerHTML = c.options
      .map(function(o) {
        return (
          '<span class="pdp-cv-opt-chip"><span class="pdp-cv-opt-chip-k">' +
          escapeHtml(o.option_title || '') +
          '</span><span class="pdp-cv-opt-chip-v">' +
          escapeHtml(o.value || '') +
          '</span></span>'
        );
      })
      .join('');
  }

  function pdpCvWireKitRow(div) {
    var sel = div.querySelector('.pdp-cv-kit-item');
    if (sel) {
      sel.addEventListener('change', function() {
        pdpCvRenderKitRowChips(div, sel.value);
      });
      pdpCvRenderKitRowChips(div, sel.value);
    }
    var rm = div.querySelector('.pdp-cv-kit-rm');
    if (rm) {
      rm.addEventListener('click', function() {
        div.remove();
      });
    }
  }

  function pdpCvAddKitRow() {
    var host = document.getElementById('pdpCvKitRows');
    if (!host) return;
    var div = document.createElement('div');
    div.className = 'pdp-cv-kit-row';
    div.innerHTML =
      '<div class="pdp-cv-kit-line">' +
      '<label class="pdp-cv-kit-cell pdp-cv-kit-cell-wide"><span class="pdp-cv-lbl">Stock line</span><select class="pdp-cv-input pdp-cv-kit-item">' +
      pdpCvKitSelectOptionsHtml() +
      '</select></label>' +
      '<label class="pdp-cv-kit-cell"><span class="pdp-cv-lbl">Quantity</span><input type="number" class="pdp-cv-input pdp-cv-kit-qty" min="1" step="1" value="" /></label>' +
      '<button type="button" class="pdp-cv-kit-rm" aria-label="Remove row">×</button></div>' +
      '<div class="pdp-cv-kit-opt-chips pdp-cv-kit-opt-chips--empty" aria-label="Options for this line"></div>';
    host.appendChild(div);
    pdpCvWireKitRow(div);
  }

  function pdpCvSyncKitStepVisibility() {
    var kit = document.getElementById('pdpCvInvKit');
    var on = kit && kit.checked;
    var nav3 = document.querySelector('[data-pdp-cv-step-dot="3"]');
    var lineKit = document.querySelector('.pdp-cv-step-line-kit');
    if (nav3) nav3.classList.toggle('is-disabled', !on);
    if (lineKit) lineKit.classList.toggle('is-disabled', !on);
  }

  function pdpCvSetStep(n) {
    pdpCvStep = n;
    var p1 = document.getElementById('pdpCvPanel1');
    var p2 = document.getElementById('pdpCvPanel2');
    var p3 = document.getElementById('pdpCvPanel3');
    if (p1) p1.classList.toggle('hidden', n !== 1);
    if (p2) p2.classList.toggle('hidden', n !== 2);
    if (p3) p3.classList.toggle('hidden', n !== 3);
    document.querySelectorAll('[data-pdp-cv-step-dot]').forEach(function(el) {
      var sn = parseInt(el.getAttribute('data-pdp-cv-step-dot'), 10);
      el.classList.toggle('is-active', sn === n);
      el.classList.toggle('is-done', sn < n);
    });
    var prim = document.getElementById('pdpCvPrimary');
    var kit = document.getElementById('pdpCvInvKit');
    var kitOn = kit && kit.checked;
    if (prim) {
      if (n === 1) prim.textContent = 'Continue';
      else if (n === 2) prim.textContent = kitOn ? 'Continue' : 'Save';
      else prim.textContent = 'Save';
    }
  }

  function pdpCvCollectOptionAssignments() {
    var out = [];
    document.querySelectorAll('#pdpCvTypeMount select[data-pdp-cv-option-id]').forEach(function(sel) {
      var oid = sel.getAttribute('data-pdp-cv-option-id');
      var v = sel.value.trim();
      if (oid && v) out.push({ option_id: oid, value: v });
    });
    return out;
  }

  function pdpCvCollectPricesMinor() {
    var prices = [];
    document.querySelectorAll('.pdp-cv-price-inp').forEach(function(inp) {
      var cc = (inp.getAttribute('data-currency') || '').toLowerCase().trim();
      if (!cc) return;
      var raw = parseFloat(String(inp.value || '').replace(',', '.'), 10);
      if (isNaN(raw) || raw < 0) return;
      var minor = Math.round(raw * 100);
      prices.push({ currency_code: cc, amount: minor });
    });
    return prices;
  }

  function pdpCvCollectKitItems() {
    var out = [];
    document.querySelectorAll('.pdp-cv-kit-row').forEach(function(row) {
      var sel = row.querySelector('.pdp-cv-kit-item');
      var q = row.querySelector('.pdp-cv-kit-qty');
      var id = sel && sel.value ? String(sel.value).trim() : '';
      var n = q ? parseInt(String(q.value || '').trim(), 10) : 0;
      if (id && n > 0) out.push({ inventory_item_id: id, quantity: n });
    });
    return out;
  }

  function pdpCvSubmit() {
    var p = pdpCvProductRef;
    if (!p || !p.id) return;
    var titleEl = document.getElementById('pdpCvTitle');
    var title = titleEl && titleEl.value.trim();
    if (!title) {
      window.alert('Title is required.');
      pdpCvSetStep(1);
      return;
    }
    var skuEl = document.getElementById('pdpCvSku');
    var sku = skuEl && skuEl.value.trim();
    var manageInv = !!(document.getElementById('pdpCvManageInv') && document.getElementById('pdpCvManageInv').checked);
    var allowBo = !!(document.getElementById('pdpCvAllowBo') && document.getElementById('pdpCvAllowBo').checked);
    var kit = !!(document.getElementById('pdpCvInvKit') && document.getElementById('pdpCvInvKit').checked);
    var prices = pdpCvCollectPricesMinor();
    var assigns = pdpCvCollectOptionAssignments();
    var kitItems = kit ? pdpCvCollectKitItems() : [];
    if (kit && !kitItems.length) {
      window.alert('Add at least one inventory item and quantity for the kit.');
      return;
    }
    var payload = {
      title: title,
      sku: sku || null,
      manage_inventory: manageInv,
      allow_backorder: allowBo,
      inventory_kit: kit,
      prices: prices,
      option_assignments: assigns
    };
    if (kit) payload.inventory_kit_items = kitItems;

    fetch('/admin/products/' + encodeURIComponent(p.id) + '/variants', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(jsonFromResponse)
      .then(function() {
        closePdpCreateVariantWizard();
        renderProductDetail();
      })
      .catch(function(e) {
        window.alert(e && e.message ? e.message : 'Could not create variant.');
      });
  }

  function openPdpCreateVariantWizard(p) {
    if (!p || !p.id) return;
    closePdpMetadataDrawer();
    closePdpJsonDrawer();
    closePdpJsonViewer();
    closePdpCreateOptionDrawer();
    closePdpVariantOptDrawer();
    ensurePdpCreateVariantWizardDom();
    pdpCvProductRef = p;
    pdpCvStep = 1;
    pdpCvRenderTypeSelectors(p);
    var t = document.getElementById('pdpCvTitle');
    var s = document.getElementById('pdpCvSku');
    if (t) t.value = '';
    if (s) s.value = '';
    var mi = document.getElementById('pdpCvManageInv');
    var bo = document.getElementById('pdpCvAllowBo');
    var ik = document.getElementById('pdpCvInvKit');
    if (mi) mi.checked = false;
    if (bo) bo.checked = false;
    if (ik) ik.checked = false;
    var kr = document.getElementById('pdpCvKitRows');
    if (kr) kr.innerHTML = '';
    var hint = document.getElementById('pdpCvKitHint');
    if (hint) hint.textContent = '';
    pdpCvSyncKitStepVisibility();
    pdpCvSetStep(1);
    var bd = document.getElementById('pdpCvBackdrop');
    var root = document.getElementById('pdpCvRoot');
    if (bd) {
      bd.classList.remove('hidden');
      bd.setAttribute('aria-hidden', 'false');
    }
    if (root) {
      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('pdp-cv-open');
    pdpCvTeardownKeys();
    pdpCvEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpCreateVariantWizard();
      }
    };
    document.addEventListener('keydown', pdpCvEscapeHandler, true);

    Promise.all([pdpCvLoadCurrencies(), pdpCvLoadInventoryItems(), pdpCvLoadKitComponents(p.id)]).then(function() {
      pdpCvBuildPriceGrid();
      if (hint) {
        if (pdpCvKitComponents.length) {
          hint.textContent =
            pdpCvKitComponents.length +
            ' stock line(s) on this product include option labels (e.g. Color, Size). Add rows and set quantities for this bundle.';
        } else {
          hint.textContent =
            'No sibling variant inventory links found for "' +
            (p.title || 'this product') +
            '". Link inventory items to existing variants first to see options here; otherwise the dropdown falls back to the global inventory list.';
        }
      }
    });

    if (!pdpCvWired) {
      pdpCvWired = true;
      document.getElementById('pdpCvBackdrop').addEventListener('click', closePdpCreateVariantWizard);
      document.getElementById('pdpCvClose').addEventListener('click', closePdpCreateVariantWizard);
      document.getElementById('pdpCvCancel').addEventListener('click', closePdpCreateVariantWizard);
      document.getElementById('pdpCvPrimary').addEventListener('click', function() {
        var kitOn = document.getElementById('pdpCvInvKit') && document.getElementById('pdpCvInvKit').checked;
        if (pdpCvStep === 1) {
          var tt = document.getElementById('pdpCvTitle');
          if (!tt || !tt.value.trim()) {
            window.alert('Title is required.');
            return;
          }
          pdpCvBuildPriceGrid();
          pdpCvSetStep(2);
          return;
        }
        if (pdpCvStep === 2) {
          if (kitOn) {
            var krh = document.getElementById('pdpCvKitRows');
            if (krh && !krh.children.length) pdpCvAddKitRow();
            var h = document.getElementById('pdpCvKitHint');
            var tt2 = document.getElementById('pdpCvTitle');
            if (h && tt2) {
              h.textContent =
                'Bundle for "' +
                (tt2.value.trim() || 'variant') +
                '": choose each component line (with Color/Size when available) and quantity.';
            }
            pdpCvSetStep(3);
          } else {
            pdpCvSubmit();
          }
          return;
        }
        if (pdpCvStep === 3) {
          pdpCvSubmit();
        }
      });
      document.getElementById('pdpCvKitAdd').addEventListener('click', function() {
        pdpCvAddKitRow();
      });
      document.getElementById('pdpCvInvKit').addEventListener('change', function() {
        pdpCvSyncKitStepVisibility();
        if (pdpCvStep === 2) {
          var prim = document.getElementById('pdpCvPrimary');
          var on = document.getElementById('pdpCvInvKit').checked;
          if (prim) prim.textContent = on ? 'Continue' : 'Save';
        }
      });
    }
  }

  /**
   * Shallow metadata patch for PATCH /admin/products/:id — same rules as the metadata KV drawer (no admin_* from editor).
   * Keys removed from userMeta (non-admin) become JSON null in the patch.
   */
  function pdpMetadataPatchFromUserJsonObject(userMeta, origMeta) {
    userMeta = userMeta && typeof userMeta === 'object' && !Array.isArray(userMeta) ? userMeta : {};
    origMeta = origMeta || {};
    var patch = {};
    var k;
    for (k in userMeta) {
      if (!Object.prototype.hasOwnProperty.call(userMeta, k)) continue;
      if (!k || k.indexOf('admin_') === 0) continue;
      patch[k] = userMeta[k];
    }
    for (k in origMeta) {
      if (!Object.prototype.hasOwnProperty.call(origMeta, k)) continue;
      if (k.indexOf('admin_') === 0) continue;
      if (!Object.prototype.hasOwnProperty.call(userMeta, k)) {
        patch[k] = null;
      }
    }
    return patch;
  }

  function pdpTextFromProductField(v) {
    if (v == null) return '';
    if (typeof v === 'object' && v !== null && v.value != null) return String(v.value).trim();
    return String(v).trim();
  }

  function buildPdpJsonSavePayload(parsed, p) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON must be a single object.');
    }
    var metaNow = readProductMetadata(p);
    var title = pdpTextFromProductField(parsed.title) || pdpTextFromProductField(p.title);
    if (!title) throw new Error('title is required.');
    var status = pdpProductStatusForPatch({ status: parsed.status != null ? parsed.status : p.status });
    var desc =
      parsed.description != null ? String(parsed.description).trim() : p.description != null ? String(p.description).trim() : '';
    var hx = parsed.handle != null ? String(parsed.handle).trim().replace(/^\/+/, '') : '';
    var hxP = p.handle != null ? String(p.handle).trim().replace(/^\/+/, '') : '';
    var handle = hx || hxP;
    var userMeta =
      parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata) ? parsed.metadata : {};

    var sub;
    if (Object.prototype.hasOwnProperty.call(userMeta, 'subtitle')) {
      sub =
        userMeta.subtitle != null && String(userMeta.subtitle).trim() !== ''
          ? String(userMeta.subtitle).trim()
          : null;
    } else {
      sub =
        metaNow.subtitle != null && String(metaNow.subtitle).trim() !== ''
          ? String(metaNow.subtitle).trim()
          : null;
    }
    var mat;
    if (Object.prototype.hasOwnProperty.call(userMeta, 'material')) {
      mat =
        userMeta.material != null && String(userMeta.material).trim() !== ''
          ? String(userMeta.material).trim()
          : null;
    } else {
      mat =
        metaNow.material != null && String(metaNow.material).trim() !== ''
          ? String(metaNow.material).trim()
          : null;
    }
    var discountable;
    if (Object.prototype.hasOwnProperty.call(userMeta, 'discountable')) {
      discountable = userMeta.discountable !== false;
    } else {
      discountable = metaNow.discountable !== false;
    }

    var patch = pdpMetadataPatchFromUserJsonObject(userMeta, metaNow);
    var payload = {
      title: title,
      status: status,
      subtitle: sub,
      material: mat,
      description: desc || null,
      discountable: discountable,
      metadata: patch
    };
    if (handle) payload.handle = handle;
    if (Object.prototype.hasOwnProperty.call(parsed, 'thumbnail')) {
      var th = parsed.thumbnail == null ? null : String(parsed.thumbnail).trim();
      payload.thumbnail = th || null;
    }
    return payload;
  }

  function ensurePdpJsonDrawerDom() {
    if (document.getElementById('pdpJsonDrawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpJsonBackdrop" class="pdp-edit-backdrop pdp-meta-backdrop pdp-json-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpJsonDrawer" class="pdp-edit-drawer pdp-meta-drawer pdp-json-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpJsonDrawerTitle">' +
      '<header class="pdp-edit-head">' +
      '<h2 id="pdpJsonDrawerTitle" class="pdp-edit-title">Edit raw JSON</h2>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpJsonClose" aria-label="Close">×</button>' +
      '</div></header>' +
      '<div class="pdp-edit-body pdp-meta-drawer-body">' +
      '<p class="pdp-meta-drawer-hint">Same save contract as <strong>Edit metadata</strong>: title, status, handle, description, subtitle, material, discountable, thumbnail, and <code>metadata</code> (keys starting with <code>admin_</code> are not sent from this editor and stay on the server). Variants and relations are not updated here.</p>' +
      '<textarea id="pdpJsonTextarea" class="pdp-edit-input pdp-json-textarea" spellcheck="false" autocomplete="off" aria-label="Product JSON"></textarea></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpJsonCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpJsonSave">Save</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openPdpJsonDrawer(p) {
    if (!p || !p.id) return;
    closePdpMetadataDrawer();
    closePdpJsonViewer();
    ensurePdpJsonDrawerDom();
    var root = document.getElementById('pdpJsonDrawer');
    var bd = document.getElementById('pdpJsonBackdrop');
    var ta = document.getElementById('pdpJsonTextarea');
    if (!root || !bd || !ta) return;
    pdpJsonProductRef = p;
    try {
      ta.value = JSON.stringify(p, null, 2);
    } catch (e) {
      ta.value = '{}';
    }
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    bd.classList.remove('hidden');
    bd.setAttribute('aria-hidden', 'false');
    pdpTeardownJsonDrawerKeys();
    pdpJsonEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpJsonDrawer();
      }
    };
    document.addEventListener('keydown', pdpJsonEscapeHandler, true);
    ta.focus();

    if (!pdpJsonDrawerWired) {
      pdpJsonDrawerWired = true;
      document.getElementById('pdpJsonBackdrop').addEventListener('click', function() {
        closePdpJsonDrawer();
      });
      document.getElementById('pdpJsonClose').addEventListener('click', function() {
        closePdpJsonDrawer();
      });
      document.getElementById('pdpJsonCancel').addEventListener('click', function() {
        closePdpJsonDrawer();
      });
      document.getElementById('pdpJsonSave').addEventListener('click', function() {
        submitPdpJsonForm();
      });
    }
  }

  function submitPdpJsonForm() {
    var p = pdpJsonProductRef;
    var ta = document.getElementById('pdpJsonTextarea');
    if (!p || !p.id || !ta) return;
    var parsed;
    try {
      parsed = JSON.parse(ta.value);
    } catch (e) {
      window.alert('Invalid JSON: ' + (e && e.message ? e.message : 'parse error'));
      return;
    }
    var payload;
    try {
      payload = buildPdpJsonSavePayload(parsed, p);
    } catch (err) {
      window.alert(err && err.message ? err.message : 'Could not build save payload.');
      return;
    }
    var saveBtn = document.getElementById('pdpJsonSave');
    if (saveBtn) saveBtn.disabled = true;
    fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error) ? String(x.data.message || x.data.error) : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        closePdpJsonDrawer();
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save.');
      })
      .then(function() {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function pdpHideEditDrawerUi() {
    var root = document.getElementById('pdpEditDrawer');
    var bd = document.getElementById('pdpEditBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function pdpTeardownEditDrawerKeys() {
    if (pdpEditEscapeHandler) {
      document.removeEventListener('keydown', pdpEditEscapeHandler, true);
      pdpEditEscapeHandler = null;
    }
  }

  function closePdpEditDrawer() {
    pdpHideEditDrawerUi();
    pdpTeardownEditDrawerKeys();
    if (!isPdpEditPath()) return;
    if (history.state && history.state.pdpEdit) {
      history.back();
      return;
    }
    var pid = getProductDetailId();
    if (pid) {
      history.replaceState({}, '', '/app/products/' + encodeURIComponent(pid));
    }
  }

  function ensurePdpEditDrawerDom() {
    if (document.getElementById('pdpEditDrawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpEditBackdrop" class="pdp-edit-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpEditDrawer" class="pdp-edit-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpEditDrawerTitle">' +
      '<header class="pdp-edit-head">' +
      '<h2 id="pdpEditDrawerTitle" class="pdp-edit-title">Edit Product</h2>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpEditClose" aria-label="Close">×</button>' +
      '</div></header>' +
      '<div class="pdp-edit-body">' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Status</span>' +
      '<select id="pdpEditStatus" class="pdp-edit-input">' +
      '<option value="published">Published</option><option value="draft">Draft</option>' +
      '<option value="proposed">Proposed</option><option value="rejected">Rejected</option></select></label>' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Title</span>' +
      '<input type="text" id="pdpEditTitle" class="pdp-edit-input" autocomplete="off" /></label>' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Subtitle <span class="pdp-edit-opt">(Optional)</span></span>' +
      '<input type="text" id="pdpEditSubtitle" class="pdp-edit-input" autocomplete="off" /></label>' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Handle</span>' +
      '<div class="pdp-edit-handle-wrap">' +
      '<span class="pdp-edit-handle-prefix" aria-hidden="true">/</span>' +
      '<input type="text" id="pdpEditHandle" class="pdp-edit-input pdp-edit-handle-input" autocomplete="off" /></div></label>' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Material <span class="pdp-edit-opt">(Optional)</span></span>' +
      '<input type="text" id="pdpEditMaterial" class="pdp-edit-input" autocomplete="off" /></label>' +
      '<label class="pdp-edit-field"><span class="pdp-edit-label">Description <span class="pdp-edit-opt">(Optional)</span></span>' +
      '<textarea id="pdpEditDescription" class="pdp-edit-input pdp-edit-textarea" rows="5"></textarea></label>' +
      '<div class="pdp-edit-field pdp-edit-toggle-field">' +
      '<label class="pdp-edit-toggle-label">' +
      '<input type="checkbox" id="pdpEditDiscountable" />' +
      '<span>Discountable</span></label>' +
      '<p class="pdp-edit-hint">When unchecked, discounts will not be applied to this product.</p></div></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpEditCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpEditSave">Save</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function pdpHideMetadataDrawerUi() {
    var root = document.getElementById('pdpMetadataDrawer');
    var bd = document.getElementById('pdpMetadataBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
  }

  function pdpTeardownMetadataDrawerKeys() {
    if (pdpMetadataEscapeHandler) {
      document.removeEventListener('keydown', pdpMetadataEscapeHandler, true);
      pdpMetadataEscapeHandler = null;
    }
  }

  function closePdpMetadataDrawer() {
    pdpHideMetadataDrawerUi();
    pdpTeardownMetadataDrawerKeys();
    pdpMetadataProductRef = null;
    pdpMetadataOrigEditableKeys = [];
  }

  function pdpMetaCellValueToString(v) {
    if (v == null) return '';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch (e) {
        return '';
      }
    }
    return String(v);
  }

  function pdpParseMetaCellValue(s) {
    if (s == null) return null;
    var t = String(s).trim();
    if (t === '') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
      var n = Number(t);
      if (!isNaN(n)) return n;
    }
    var c0 = t.charAt(0);
    var cL = t.charAt(t.length - 1);
    if ((c0 === '{' && cL === '}') || (c0 === '[' && cL === ']')) {
      try {
        return JSON.parse(t);
      } catch (e) {
        return t;
      }
    }
    try {
      var j = JSON.parse(t);
      if (j === null) return null;
      if (typeof j === 'object' || typeof j === 'number' || typeof j === 'boolean') return j;
    } catch (e2) {
      /* keep string */
    }
    return t;
  }

  function pdpMetadataNonAdminKeys(meta) {
    return Object.keys(meta || {}).filter(function(k) {
      return k && k.indexOf('admin_') !== 0;
    });
  }

  function ensurePdpMetadataDrawerDom() {
    if (document.getElementById('pdpMetadataDrawer')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpMetadataBackdrop" class="pdp-edit-backdrop pdp-meta-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpMetadataDrawer" class="pdp-edit-drawer pdp-meta-drawer hidden" role="dialog" aria-modal="true" aria-labelledby="pdpMetadataDrawerTitle">' +
      '<header class="pdp-edit-head">' +
      '<h2 id="pdpMetadataDrawerTitle" class="pdp-edit-title">Edit Metadata</h2>' +
      '<div class="pdp-edit-head-right">' +
      '<span class="pdp-edit-esc-hint">esc</span>' +
      '<button type="button" class="pdp-edit-close" id="pdpMetadataClose" aria-label="Close">×</button>' +
      '</div></header>' +
      '<div class="pdp-edit-body pdp-meta-drawer-body">' +
      '<p class="pdp-meta-drawer-hint">Keys starting with <code>admin_</code> are managed elsewhere (media, options) and are not listed here.</p>' +
      '<div class="pdp-meta-kv-wrap">' +
      '<table class="pdp-meta-kv-table" aria-label="Metadata key value pairs">' +
      '<thead><tr><th scope="col">Key</th><th scope="col">Value</th><th class="pdp-meta-kv-actions" scope="col"><span class="sr-only">Remove</span></th></tr></thead>' +
      '<tbody id="pdpMetaKvBody"></tbody></table></div>' +
      '<button type="button" class="btn-outline pdp-meta-add-row" id="pdpMetaAddRow">Add row</button></div>' +
      '<footer class="pdp-edit-foot">' +
      '<button type="button" class="btn-outline" id="pdpMetadataCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpMetadataSave">Save</button></footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
    var tbody = document.getElementById('pdpMetaKvBody');
    if (tbody && !tbody.dataset.pdpMetaKvWired) {
      tbody.dataset.pdpMetaKvWired = '1';
      tbody.addEventListener('click', function(ev) {
        var b = ev.target.closest('.pdp-meta-rm');
        if (!b || !tbody.contains(b)) return;
        var tr = b.closest('tr');
        if (tr) tr.remove();
      });
    }
  }

  function pdpMetaAppendKvRow(tbody, key, valueStr) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="pdp-edit-input pdp-meta-k" autocomplete="off" spellcheck="false" /></td>' +
      '<td><input type="text" class="pdp-edit-input pdp-meta-v" autocomplete="off" spellcheck="false" /></td>' +
      '<td class="pdp-meta-kv-actions"><button type="button" class="pdp-meta-rm" aria-label="Remove row">×</button></td>';
    var ki = tr.querySelector('.pdp-meta-k');
    var vi = tr.querySelector('.pdp-meta-v');
    if (ki) ki.value = key != null ? String(key) : '';
    if (vi) vi.value = valueStr != null ? String(valueStr) : '';
    tbody.appendChild(tr);
  }

  function openPdpMetadataDrawer(p) {
    if (!p || !p.id) return;
    closePdpJsonDrawer();
    closePdpJsonViewer();
    ensurePdpMetadataDrawerDom();
    var root = document.getElementById('pdpMetadataDrawer');
    var bd = document.getElementById('pdpMetadataBackdrop');
    if (!root || !bd) return;
    pdpMetadataProductRef = p;
    var meta = readProductMetadata(p);
    var keys = pdpMetadataNonAdminKeys(meta);
    keys.sort();
    pdpMetadataOrigEditableKeys = keys.slice();
    var tbody = document.getElementById('pdpMetaKvBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (keys.length) {
        keys.forEach(function(k) {
          pdpMetaAppendKvRow(tbody, k, pdpMetaCellValueToString(meta[k]));
        });
      } else {
        pdpMetaAppendKvRow(tbody, '', '');
      }
    }
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    bd.classList.remove('hidden');
    bd.setAttribute('aria-hidden', 'false');
    pdpTeardownMetadataDrawerKeys();
    pdpMetadataEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpMetadataDrawer();
      }
    };
    document.addEventListener('keydown', pdpMetadataEscapeHandler, true);
    var firstIn = tbody && tbody.querySelector('.pdp-meta-k');
    if (firstIn) firstIn.focus();

    if (!pdpMetadataDrawerWired) {
      pdpMetadataDrawerWired = true;
      document.getElementById('pdpMetadataBackdrop').addEventListener('click', function() {
        closePdpMetadataDrawer();
      });
      document.getElementById('pdpMetadataClose').addEventListener('click', function() {
        closePdpMetadataDrawer();
      });
      document.getElementById('pdpMetadataCancel').addEventListener('click', function() {
        closePdpMetadataDrawer();
      });
      document.getElementById('pdpMetadataSave').addEventListener('click', function() {
        submitPdpMetadataForm();
      });
      document.getElementById('pdpMetaAddRow').addEventListener('click', function() {
        var tb = document.getElementById('pdpMetaKvBody');
        if (tb) pdpMetaAppendKvRow(tb, '', '');
      });
    }
  }

  function pdpProductStatusForPatch(p) {
    if (!p) return 'draft';
    var s = p.status;
    if (s && typeof s === 'object' && s.value != null) {
      return String(s.value)
        .toLowerCase()
        .trim() || 'draft';
    }
    return String(s || 'draft')
      .toLowerCase()
      .trim() || 'draft';
  }

  function submitPdpMetadataForm() {
    var p = pdpMetadataProductRef;
    if (!p || !p.id) return;
    var title = p.title != null ? String(p.title).trim() : '';
    if (!title) {
      window.alert('Title is required to save.');
      return;
    }
    var tbody = document.getElementById('pdpMetaKvBody');
    if (!tbody) return;
    var nextMap = {};
    var rowList = tbody.querySelectorAll('tr');
    var ri;
    for (ri = 0; ri < rowList.length; ri++) {
      var tr = rowList[ri];
      var ki = tr.querySelector('.pdp-meta-k');
      var vi = tr.querySelector('.pdp-meta-v');
      var k = ki && ki.value ? ki.value.trim() : '';
      if (!k) continue;
      if (k.indexOf('admin_') === 0) {
        window.alert('Keys cannot start with admin_ (those fields are managed elsewhere).');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(nextMap, k)) {
        window.alert('Duplicate key: ' + k + '. Remove duplicates before saving.');
        return;
      }
      var parsed = pdpParseMetaCellValue(vi ? vi.value : '');
      nextMap[k] = parsed === null ? null : parsed;
    }
    var patch = {};
    var i;
    for (i = 0; i < pdpMetadataOrigEditableKeys.length; i++) {
      var ok = pdpMetadataOrigEditableKeys[i];
      if (!Object.prototype.hasOwnProperty.call(nextMap, ok)) {
        patch[ok] = null;
      }
    }
    var nk;
    for (nk in nextMap) {
      if (Object.prototype.hasOwnProperty.call(nextMap, nk)) {
        patch[nk] = nextMap[nk];
      }
    }
    var saveBtn = document.getElementById('pdpMetadataSave');
    if (saveBtn) saveBtn.disabled = true;
    var metaNow = readProductMetadata(p);
    var hx = p.handle != null ? String(p.handle).trim().replace(/^\/+/, '') : '';
    var sub =
      metaNow.subtitle != null && String(metaNow.subtitle).trim() !== ''
        ? String(metaNow.subtitle).trim()
        : null;
    var mat =
      metaNow.material != null && String(metaNow.material).trim() !== ''
        ? String(metaNow.material).trim()
        : null;
    var descRaw = p.description != null ? String(p.description).trim() : '';
    var payload = {
      title: title,
      status: pdpProductStatusForPatch(p),
      subtitle: sub,
      material: mat,
      description: descRaw || null,
      discountable: metaNow.discountable !== false,
      metadata: patch
    };
    if (hx) payload.handle = hx;
    fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error) ? String(x.data.message || x.data.error) : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        closePdpMetadataDrawer();
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save metadata.');
      })
      .then(function() {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function readProductMetadata(p) {
    var raw = p && p.metadata;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (e) {
        return {};
      }
    }
    if (typeof raw === 'object') {
      // Some JDBC drivers expose jsonb as { type: "jsonb", value: "{...}" }.
      if (typeof raw.value === 'string') {
        try {
          var parsedValue = JSON.parse(raw.value);
          if (parsedValue && typeof parsedValue === 'object') return parsedValue;
        } catch (e2) {
          return {};
        }
      }
      return raw;
    }
    return {};
  }

  function pdpGalleryUrlsFromProduct(p) {
    var meta = readProductMetadata(p);
    var urls = [];
    var seen = {};
    function add(v) {
      if (v == null) return;
      var s = String(v).trim();
      if (!s || seen[s]) return;
      seen[s] = true;
      urls.push(s);
    }
    function pushUrlMaybe(v) {
      if (v == null) return;
      var s = String(v).trim();
      if (!s) return;
      if (/^data:image\//i.test(s) || /^https?:\/\//i.test(s) || s.indexOf('/') >= 0) {
        add(s);
      }
    }
    function collectImageUrls(node, keyHint) {
      if (node == null) return;
      if (typeof node === 'string') {
        if (keyHint && /(image|img|thumb|thumbnail|photo|picture|gallery|media)/i.test(keyHint)) {
          pushUrlMaybe(node);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(function(item) {
          collectImageUrls(item, keyHint);
        });
        return;
      }
      if (typeof node === 'object') {
        Object.keys(node).forEach(function(k) {
          collectImageUrls(node[k], k);
        });
      }
    }

    // Medusa-native gallery from products-service (product_image + image + variant links).
    if (p && Array.isArray(p.images) && p.images.length) {
      p.images.forEach(function(img) {
        if (img && img.url != null) add(img.url);
      });
    }

    // Explicit variant thumbnails returned by API.
    (p && Array.isArray(p.variants) ? p.variants : []).forEach(function(v) {
      if (v && v.thumbnail) add(v.thumbnail);
    });

    if (p && p.thumbnail) add(thumbUrl(p.thumbnail));

    // Product-level media in metadata (dashboard saves, legacy).
    collectImageUrls(meta.admin_gallery, 'admin_gallery');
    collectImageUrls(meta.gallery, 'gallery');
    collectImageUrls(meta.images, 'images');
    collectImageUrls(meta.media, 'media');

    // Variant-level metadata / nested image hints.
    (p && Array.isArray(p.variants) ? p.variants : []).forEach(function(v) {
      collectImageUrls(v, 'variant');
      if (v && typeof v.metadata === 'object') {
        collectImageUrls(v.metadata, 'variant_metadata');
      }
    });

    return urls;
  }

  function pdpMediaSectionActions() {
    return (
      '<div class="pdp-card-actions">' +
      '<button type="button" class="pdp-icon-btn pdp-menu-trigger" data-pdp-menu-trigger aria-label="Media actions" aria-haspopup="true" aria-expanded="false">⋯</button>' +
      '<div class="pdp-menu-dropdown" role="menu" data-pdp-section="media">' +
      '<button type="button" class="pdp-menu-item" data-pdp-open-media>' +
      '<span class="pdp-menu-ico" aria-hidden="true">✎</span> Edit images</button>' +
      '</div></div>'
    );
  }

  function pdpNormalizeMediaUrl(u) {
    if (u == null) return '';
    return String(u)
      .trim()
      .split('?')[0]
      .replace(/\/+$/, '');
  }

  function pdpIsThumbnailTile(url, idx, urls, p) {
    var pn = p && p.thumbnail ? pdpNormalizeMediaUrl(thumbUrl(p.thumbnail)) : '';
    var un = pdpNormalizeMediaUrl(url);
    if (pn && un === pn) return true;
    if (!pn && idx === 0 && urls && urls.length) return true;
    return false;
  }

  function pdpMediaStackedThumbIcon() {
    return (
      '<span class="pdp-media-thumb-stack" title="Thumbnail" aria-label="Thumbnail">' +
      '<svg class="pdp-media-stack-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
      '<rect x="1" y="7" width="9" height="7" rx="0.8" fill="currentColor" />' +
      '<rect x="3" y="4" width="9" height="7" rx="0.8" fill="currentColor" opacity="0.9" />' +
      '<rect x="5" y="1" width="9" height="7" rx="0.8" fill="currentColor" opacity="0.75" />' +
      '</svg></span>'
    );
  }

  function pdpMediaTilesHtml(urls, p) {
    p = p || {};
    if (!urls.length) {
      return '<span class="pdp-muted">No media</span>';
    }
    return (
      '<div id="pdpMediaCardRow" class="pdp-media-row">' +
      urls
        .map(function(u, idx) {
          var isThumb = pdpIsThumbnailTile(u, idx, urls, p);
          return (
            '<div class="pdp-media-tile" data-pdp-card-media-idx="' +
            idx +
            '">' +
            (isThumb ? pdpMediaStackedThumbIcon() : '') +
            '<label class="pdp-media-tile-cb-label">' +
            '<input type="checkbox" class="pdp-media-tile-cb" data-pdp-card-media-cb="' +
            idx +
            '" aria-label="Select image" />' +
            '</label>' +
            '<img src="' +
            escapeHtml(u) +
            '" alt="" />' +
            '</div>'
          );
        })
        .join('') +
      '</div>' +
      '<div id="pdpMediaCardBulkBar" class="pdp-media-bulk-bar pdp-media-bulk-bar--card hidden" role="toolbar" aria-label="Selected images">' +
      '<span class="pdp-media-bulk-count" id="pdpMediaCardBulkCount">0 selected</span>' +
      '<button type="button" class="pdp-media-bulk-btn" id="pdpMediaCardMakeThumb">Make thumbnail <kbd class="pdp-media-kbd">T</kbd></button>' +
      '<button type="button" class="pdp-media-bulk-btn pdp-media-bulk-danger" id="pdpMediaCardDelete">' +
      'Delete <kbd class="pdp-media-kbd">D</kbd></button></div>'
    );
  }

  function pdpMediaEditSelectionCount() {
    var n = 0;
    Object.keys(pdpMediaEditSel).forEach(function(k) {
      if (pdpMediaEditSel[k]) n++;
    });
    return n;
  }

  function pdpMediaCardSelectionCount() {
    var n = 0;
    Object.keys(pdpMediaCardSel).forEach(function(k) {
      if (pdpMediaCardSel[k]) n++;
    });
    return n;
  }

  function pdpMediaPruneEditSelection() {
    var next = {};
    Object.keys(pdpMediaEditSel).forEach(function(k) {
      var i = Number(k);
      if (!Number.isNaN(i) && i >= 0 && i < pdpMediaGalleryState.length && pdpMediaEditSel[k]) next[k] = true;
    });
    pdpMediaEditSel = next;
  }

  function updatePdpMediaOverlayBulkBar() {
    pdpMediaPruneEditSelection();
    var bar = document.getElementById('pdpMediaOverlayBulkBar');
    var count = document.getElementById('pdpMediaOverlayBulkCount');
    var n = pdpMediaEditSelectionCount();
    if (bar) bar.classList.toggle('hidden', n === 0 || pdpMediaMode !== 'edit');
    if (count) count.textContent = n + ' selected';
  }

  function updatePdpMediaCardBulkBar() {
    var bar = document.getElementById('pdpMediaCardBulkBar');
    var count = document.getElementById('pdpMediaCardBulkCount');
    var n = pdpMediaCardSelectionCount();
    if (bar) bar.classList.toggle('hidden', n === 0);
    if (count) count.textContent = n + ' selected';
  }

  function wirePdpMediaCardBulkActions(p, urls) {
    pdpMediaCardUrlsRef = urls.slice();
    pdpMediaCardProductRef = p;
    pdpMediaCardSel = {};
    updatePdpMediaCardBulkBar();
    var row = document.getElementById('pdpMediaCardRow');
    if (!row || !p || !p.id) return;
    row.querySelectorAll('[data-pdp-card-media-cb]').forEach(function(cb) {
      cb.addEventListener('change', function(ev) {
        ev.stopPropagation();
        var idx = cb.getAttribute('data-pdp-card-media-cb');
        if (cb.checked) pdpMediaCardSel[idx] = true;
        else delete pdpMediaCardSel[idx];
        updatePdpMediaCardBulkBar();
      });
    });
    var mk = document.getElementById('pdpMediaCardMakeThumb');
    var del = document.getElementById('pdpMediaCardDelete');
    if (mk) {
      mk.onclick = function() {
        pdpMediaCardApplyMakeThumbnail();
      };
    }
    if (del) {
      del.onclick = function() {
        pdpMediaCardApplyDelete();
      };
    }
  }

  function pdpMediaCardSelectedIndicesSorted() {
    var ix = Object.keys(pdpMediaCardSel)
      .filter(function(k) {
        return pdpMediaCardSel[k];
      })
      .map(function(k) {
        return Number(k);
      })
      .filter(function(i) {
        return !Number.isNaN(i);
      })
      .sort(function(a, b) {
        return a - b;
      });
    return ix;
  }

  function pdpMediaCardApplyMakeThumbnail() {
    var p = pdpMediaCardProductRef;
    var urls = pdpMediaCardUrlsRef.slice();
    var sel = pdpMediaCardSelectedIndicesSorted();
    if (!p || !p.id || !sel.length) return;
    var pick = sel[0];
    if (pick < 0 || pick >= urls.length) return;
    var u = urls[pick];
    var rest = urls.filter(function(_, i) {
      return i !== pick;
    });
    var next = [u].concat(rest);
    pdpPatchProductMediaGallery(p, next, function() {
      pdpMediaCardSel = {};
      renderProductDetail();
    });
  }

  function pdpMediaCardApplyDelete() {
    var p = pdpMediaCardProductRef;
    var urls = pdpMediaCardUrlsRef.slice();
    var sel = pdpMediaCardSelectedIndicesSorted();
    if (!p || !p.id || !sel.length) return;
    var removeSet = {};
    sel.forEach(function(i) {
      removeSet[i] = true;
    });
    var next = urls.filter(function(_, i) {
      return !removeSet[i];
    });
    if (!next.length && !window.confirm('Remove all images? Thumbnail will be cleared.')) return;
    pdpPatchProductMediaGallery(p, next, function() {
      pdpMediaCardSel = {};
      renderProductDetail();
    });
  }

  function pdpMediaOverlaySelectedIndicesSorted() {
    pdpMediaPruneEditSelection();
    return Object.keys(pdpMediaEditSel)
      .filter(function(k) {
        return pdpMediaEditSel[k];
      })
      .map(function(k) {
        return Number(k);
      })
      .filter(function(i) {
        return !Number.isNaN(i);
      })
      .sort(function(a, b) {
        return a - b;
      });
  }

  function pdpMediaOverlayApplyMakeThumbnail() {
    var sel = pdpMediaOverlaySelectedIndicesSorted();
    if (!sel.length) return;
    var pick = sel[0];
    if (pick < 0 || pick >= pdpMediaGalleryState.length) return;
    var u = pdpMediaGalleryState[pick];
    var rest = pdpMediaGalleryState.filter(function(_, i) {
      return i !== pick;
    });
    pdpMediaGalleryState = [u].concat(rest);
    pdpMediaEditSel = {};
    pdpMediaSelectedIdx = 0;
    renderPdpMediaOverlayGrid();
  }

  function pdpMediaOverlayApplyBulkDelete() {
    var sel = pdpMediaOverlaySelectedIndicesSorted();
    if (!sel.length) return;
    if (
      sel.length === pdpMediaGalleryState.length &&
      !window.confirm('Remove all images? Thumbnail will be cleared.')
    )
      return;
    sel
      .sort(function(a, b) {
        return b - a;
      })
      .forEach(function(i) {
        pdpMediaGalleryState.splice(i, 1);
      });
    pdpMediaEditSel = {};
    pdpMediaSelectedIdx = Math.max(0, Math.min(pdpMediaSelectedIdx, pdpMediaGalleryState.length - 1));
    renderPdpMediaOverlayGrid();
  }

  function pdpPatchProductMediaGallery(p, gallery, onOk) {
    if (!p || !p.id) return Promise.resolve();
    var base = buildPdpPatchPayload(p);
    if (!base.title) {
      window.alert('Title is required.');
      return Promise.resolve();
    }
    var payload = Object.assign({}, base, {
      thumbnail: gallery.length ? gallery[0] : null,
      gallery: gallery
    });
    return fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error) ? String(x.data.message || x.data.error) : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        if (onOk) onOk();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save media.');
      });
  }

  var pdpMediaBulkKeysWired = false;
  function pdpMediaHandleBulkKeys(ke) {
    var t = ke.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    var overlay = document.getElementById('pdpMediaOverlay');
    var inOverlay = overlay && !overlay.classList.contains('hidden');
    var k = ke.key;
    if (inOverlay && pdpMediaMode === 'edit' && pdpMediaEditSelectionCount() > 0) {
      if (k === 't' || k === 'T') {
        ke.preventDefault();
        pdpMediaOverlayApplyMakeThumbnail();
      }
      if (k === 'd' || k === 'D') {
        ke.preventDefault();
        pdpMediaOverlayApplyBulkDelete();
      }
      return;
    }
    if (!inOverlay && pdpMediaCardSelectionCount() > 0) {
      if (k === 't' || k === 'T') {
        ke.preventDefault();
        pdpMediaCardApplyMakeThumbnail();
      }
      if (k === 'd' || k === 'D') {
        ke.preventDefault();
        pdpMediaCardApplyDelete();
      }
    }
  }
  function ensurePdpMediaBulkKeyHandler() {
    if (pdpMediaBulkKeysWired) return;
    pdpMediaBulkKeysWired = true;
    document.addEventListener('keydown', pdpMediaHandleBulkKeys, true);
  }

  function ensurePdpMediaOverlayDom() {
    if (document.getElementById('pdpMediaOverlay')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pdpMediaOverlayBackdrop" class="pdp-media-overlay-backdrop hidden" aria-hidden="true"></div>' +
      '<div id="pdpMediaOverlay" class="pdp-media-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="pdpMediaOverlayTitle">' +
      '<header class="pdp-media-overlay-head">' +
      '<div class="pdp-media-overlay-head-left">' +
      '<button type="button" class="pdp-media-overlay-x" id="pdpMediaOverlayClose" aria-label="Close">×</button>' +
      '<span class="pdp-media-overlay-esc">esc</span>' +
      '</div>' +
      '<h2 id="pdpMediaOverlayTitle" class="sr-only">Edit product media</h2>' +
      '<div class="pdp-media-overlay-head-right">' +
      '<button type="button" class="pdp-media-overlay-icon-btn hidden" id="pdpMediaOverlayDelete" title="Delete selected image" aria-label="Delete selected image">🗑</button>' +
      '<button type="button" class="pdp-media-overlay-icon-btn hidden" id="pdpMediaOverlayDownload" title="Download selected image" aria-label="Download selected image">⇩</button>' +
      '<button type="button" class="pdp-media-overlay-icon-btn hidden" id="pdpMediaOverlayEdit" title="Edit images" aria-label="Edit images">✎</button>' +
      '</div>' +
      '</header>' +
      '<div class="pdp-media-overlay-body">' +
      '<div id="pdpMediaOverlayEditPane" class="pdp-media-pane">' +
      '<div class="pdp-media-overlay-grid-wrap">' +
      '<div id="pdpMediaOverlayGrid" class="pdp-media-overlay-grid"></div>' +
      '</div>' +
      '<div class="pdp-media-overlay-upload-col">' +
      '<p class="pdp-media-overlay-upload-title">Media <span class="pdp-media-overlay-opt">(Optional)</span></p>' +
      '<p class="pdp-media-overlay-upload-desc">Add media to the product to showcase it in your storefront.</p>' +
      '<div id="pdpMediaDropZone" class="pdp-media-drop-zone" tabindex="0">' +
      '<input type="file" id="pdpMediaFileInput" class="sr-only" accept="image/*" multiple />' +
      '<span class="pdp-media-drop-ico" aria-hidden="true">↑</span>' +
      '<p class="pdp-media-drop-title">Upload images</p>' +
      '<p class="pdp-media-drop-hint">Drag and drop images here or click to upload.</p>' +
      '</div></div></div>' +
      '<div id="pdpMediaOverlayViewerPane" class="pdp-media-pane hidden">' +
      '<div class="pdp-media-viewer-main"><img id="pdpMediaViewerMainImg" src="" alt="" /></div>' +
      '<div class="pdp-media-viewer-thumbs" id="pdpMediaViewerThumbs"></div>' +
      '</div></div>' +
      '<div id="pdpMediaOverlayBulkBar" class="pdp-media-bulk-bar pdp-media-bulk-bar--overlay hidden" role="toolbar" aria-label="Selected images">' +
      '<span class="pdp-media-bulk-count" id="pdpMediaOverlayBulkCount">0 selected</span>' +
      '<button type="button" class="pdp-media-bulk-btn" id="pdpMediaOverlayMakeThumb">Make thumbnail <kbd class="pdp-media-kbd">T</kbd></button>' +
      '<button type="button" class="pdp-media-bulk-btn pdp-media-bulk-danger" id="pdpMediaOverlayBulkDelete">' +
      'Delete <kbd class="pdp-media-kbd">D</kbd></button></div>' +
      '<footer class="pdp-media-overlay-foot">' +
      '<button type="button" class="btn-outline" id="pdpMediaOverlayCancel">Cancel</button>' +
      '<button type="button" class="btn-solid" id="pdpMediaOverlaySave">Save</button>' +
      '</footer></div>';
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function renderPdpMediaOverlayGrid() {
    pdpMediaSelectedIdx = Math.max(0, Math.min(pdpMediaSelectedIdx, Math.max(0, pdpMediaGalleryState.length - 1)));
    pdpMediaPruneEditSelection();
    var grid = document.getElementById('pdpMediaOverlayGrid');
    if (!grid) return;
    if (!pdpMediaGalleryState.length) {
      pdpMediaEditSel = {};
      grid.innerHTML = '<p class="pdp-muted pdp-media-overlay-empty">No images yet. Upload or drag files on the right.</p>';
    } else {
      grid.innerHTML = pdpMediaGalleryState
        .map(function(url, idx) {
          var isThumb = idx === 0;
          return (
            '<div class="pdp-media-overlay-cell" data-media-idx="' +
            idx +
            '">' +
            (isThumb ? pdpMediaStackedThumbIcon() : '') +
            '<label class="pdp-media-overlay-cb-label">' +
            '<input type="checkbox" class="pdp-media-overlay-cb" data-media-edit-cb="' +
            idx +
            '" aria-label="Select image"' +
            (pdpMediaEditSel[String(idx)] ? ' checked' : '') +
            ' />' +
            '</label>' +
            '<img src="' +
            escapeHtml(url) +
            '" alt="" />' +
            '</div>'
          );
        })
        .join('');
      grid.querySelectorAll('[data-media-edit-cb]').forEach(function(cb) {
        cb.addEventListener('click', function(ev) {
          ev.stopPropagation();
        });
        cb.addEventListener('change', function() {
          var idx = cb.getAttribute('data-media-edit-cb');
          if (cb.checked) pdpMediaEditSel[idx] = true;
          else delete pdpMediaEditSel[idx];
          updatePdpMediaOverlayBulkBar();
        });
      });
    }
    renderPdpMediaViewer();
    updatePdpMediaOverlayModeUi();
    updatePdpMediaOverlayBulkBar();
  }

  function renderPdpMediaViewer() {
    var main = document.getElementById('pdpMediaViewerMainImg');
    var thumbs = document.getElementById('pdpMediaViewerThumbs');
    if (!main || !thumbs) return;
    if (!pdpMediaGalleryState.length) {
      main.removeAttribute('src');
      thumbs.innerHTML = '<p class="pdp-muted pdp-media-overlay-empty">No images available.</p>';
      return;
    }
    var selected = pdpMediaGalleryState[pdpMediaSelectedIdx] || pdpMediaGalleryState[0];
    main.src = selected;
    thumbs.innerHTML = pdpMediaGalleryState
      .map(function(url, idx) {
        return (
          '<button type="button" class="pdp-media-viewer-thumb' +
          (idx === pdpMediaSelectedIdx ? ' is-active' : '') +
          '" data-media-thumb-idx="' +
          idx +
          '">' +
          '<img src="' +
          escapeHtml(url) +
          '" alt="" />' +
          '</button>'
        );
      })
      .join('');
    thumbs.querySelectorAll('[data-media-thumb-idx]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = Number(btn.getAttribute('data-media-thumb-idx'));
        if (!Number.isNaN(idx)) {
          pdpMediaSelectedIdx = idx;
          renderPdpMediaViewer();
        }
      });
    });
  }

  function updatePdpMediaOverlayModeUi() {
    var viewer = document.getElementById('pdpMediaOverlayViewerPane');
    var edit = document.getElementById('pdpMediaOverlayEditPane');
    var del = document.getElementById('pdpMediaOverlayDelete');
    var dl = document.getElementById('pdpMediaOverlayDownload');
    var editBtn = document.getElementById('pdpMediaOverlayEdit');
    var foot = document.querySelector('#pdpMediaOverlay .pdp-media-overlay-foot');
    var isViewer = pdpMediaMode === 'viewer';
    if (viewer) viewer.classList.toggle('hidden', !isViewer);
    if (edit) edit.classList.toggle('hidden', isViewer);
    if (foot) foot.classList.toggle('hidden', isViewer);
    if (del) del.classList.toggle('hidden', !isViewer);
    if (dl) dl.classList.toggle('hidden', !isViewer);
    if (editBtn) editBtn.classList.toggle('hidden', !isViewer);
    updatePdpMediaOverlayBulkBar();
  }

  function setPdpMediaMode(mode) {
    pdpMediaMode = mode === 'viewer' ? 'viewer' : 'edit';
    renderPdpMediaOverlayGrid();
  }

  function pdpDownloadSelectedMedia() {
    if (!pdpMediaGalleryState.length) return;
    var url = pdpMediaGalleryState[pdpMediaSelectedIdx];
    if (!url) return;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'product-image-' + (pdpMediaSelectedIdx + 1);
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 0);
  }

  function pdpDeleteSelectedMedia() {
    if (!pdpMediaGalleryState.length) return;
    pdpMediaGalleryState.splice(pdpMediaSelectedIdx, 1);
    if (pdpMediaSelectedIdx >= pdpMediaGalleryState.length) {
      pdpMediaSelectedIdx = Math.max(0, pdpMediaGalleryState.length - 1);
    }
    renderPdpMediaOverlayGrid();
  }

  function pdpMediaAddFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var maxTotal = 32;
    var remaining = maxTotal - pdpMediaGalleryState.length;
    if (remaining <= 0) {
      window.alert('Maximum ' + maxTotal + ' images in this gallery.');
      return;
    }
    var files = Array.prototype.slice.call(fileList, 0).filter(function(f) {
      return f && f.type && f.type.indexOf('image/') === 0;
    });
    var n = Math.min(files.length, remaining);
    if (!n) return;
    var pending = n;
    for (var i = 0; i < n; i++) {
      (function(file) {
        var r = new FileReader();
        r.onload = function() {
          var dataUrl = r.result;
          if (typeof dataUrl === 'string') pdpMediaGalleryState.push(dataUrl);
          pending--;
          if (pending === 0) renderPdpMediaOverlayGrid();
        };
        r.readAsDataURL(file);
      })(files[i]);
    }
  }

  function pdpHideMediaOverlayUi() {
    var root = document.getElementById('pdpMediaOverlay');
    var bd = document.getElementById('pdpMediaOverlayBackdrop');
    if (root) {
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
    }
    if (bd) {
      bd.classList.add('hidden');
      bd.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('pdp-media-overlay-open');
  }

  function pdpTeardownMediaOverlayKeys() {
    if (pdpMediaEscapeHandler) {
      document.removeEventListener('keydown', pdpMediaEscapeHandler, true);
      pdpMediaEscapeHandler = null;
    }
  }

  function closePdpMediaOverlay() {
    pdpHideMediaOverlayUi();
    pdpTeardownMediaOverlayKeys();
  }

  function openPdpMediaOverlay(p) {
    if (!p || !p.id) return;
    ensurePdpMediaOverlayDom();
    ensurePdpMediaBulkKeyHandler();
    pdpMediaGalleryState = pdpGalleryUrlsFromProduct(p).slice();
    pdpMediaSelectedIdx = 0;
    pdpMediaEditSel = {};
    pdpMediaMode = 'edit';
    var root = document.getElementById('pdpMediaOverlay');
    var bd = document.getElementById('pdpMediaOverlayBackdrop');
    renderPdpMediaOverlayGrid();
    if (root) {
      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
    if (bd) {
      bd.classList.remove('hidden');
      bd.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('pdp-media-overlay-open');

    pdpTeardownMediaOverlayKeys();
    pdpMediaEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpMediaOverlay();
      }
    };
    document.addEventListener('keydown', pdpMediaEscapeHandler, true);

    if (!pdpMediaOverlayWired) {
      pdpMediaOverlayWired = true;
      document.getElementById('pdpMediaOverlayClose').addEventListener('click', closePdpMediaOverlay);
      document.getElementById('pdpMediaOverlayCancel').addEventListener('click', closePdpMediaOverlay);
      document.getElementById('pdpMediaOverlayBackdrop').addEventListener('click', closePdpMediaOverlay);
      document.getElementById('pdpMediaOverlayEdit').addEventListener('click', function() {
        setPdpMediaMode('edit');
      });
      document.getElementById('pdpMediaOverlayDownload').addEventListener('click', pdpDownloadSelectedMedia);
      document.getElementById('pdpMediaOverlayDelete').addEventListener('click', pdpDeleteSelectedMedia);
      document.getElementById('pdpMediaOverlayMakeThumb').addEventListener('click', pdpMediaOverlayApplyMakeThumbnail);
      document.getElementById('pdpMediaOverlayBulkDelete').addEventListener('click', pdpMediaOverlayApplyBulkDelete);
      var dz = document.getElementById('pdpMediaDropZone');
      var fin = document.getElementById('pdpMediaFileInput');
      if (dz && fin) {
        dz.addEventListener('click', function() {
          fin.click();
        });
        dz.addEventListener('keydown', function(ke) {
          if (ke.key === 'Enter' || ke.key === ' ') {
            ke.preventDefault();
            fin.click();
          }
        });
        fin.addEventListener('change', function() {
          pdpMediaAddFiles(fin.files);
          fin.value = '';
        });
        dz.addEventListener('dragover', function(e) {
          e.preventDefault();
          dz.classList.add('is-dragover');
        });
        dz.addEventListener('dragleave', function() {
          dz.classList.remove('is-dragover');
        });
        dz.addEventListener('drop', function(e) {
          e.preventDefault();
          dz.classList.remove('is-dragover');
          if (e.dataTransfer && e.dataTransfer.files) pdpMediaAddFiles(e.dataTransfer.files);
        });
      }
      document.getElementById('pdpMediaOverlaySave').addEventListener('click', submitPdpMediaOverlay);
    }
  }

  function buildPdpPatchPayload(p) {
    var meta = readProductMetadata(p);
    var handleRaw = p.handle != null ? String(p.handle) : '';
    var handle = handleRaw.trim() ? handleRaw.trim().replace(/^\/+/, '') : null;
    return {
      title: (p.title || '').trim(),
      status: p.status || 'draft',
      subtitle: meta.subtitle != null && String(meta.subtitle).trim() ? String(meta.subtitle).trim() : null,
      handle: handle,
      material: meta.material != null && String(meta.material).trim() ? String(meta.material).trim() : null,
      description: p.description != null ? String(p.description) : null,
      discountable: meta.discountable !== false
    };
  }

  function submitPdpMediaOverlay() {
    var p = pdpEditProductRef;
    if (!p || !p.id) return;
    var saveBtn = document.getElementById('pdpMediaOverlaySave');
    if (saveBtn) saveBtn.disabled = true;
    pdpPatchProductMediaGallery(p, pdpMediaGalleryState.slice(), function() {
      closePdpMediaOverlay();
      renderProductDetail();
    }).finally(function() {
      if (saveBtn) saveBtn.disabled = false;
    });
  }

  function fillPdpEditForm(p) {
    var meta = readProductMetadata(p);
    var st = String(p.status || 'draft').toLowerCase().trim();
    var sel = document.getElementById('pdpEditStatus');
    if (sel) {
      sel.value = ['published', 'draft', 'proposed', 'rejected'].indexOf(st) >= 0 ? st : 'draft';
    }
    var ti = document.getElementById('pdpEditTitle');
    if (ti) ti.value = p.title || '';
    var sub = document.getElementById('pdpEditSubtitle');
    if (sub) sub.value = meta.subtitle != null ? String(meta.subtitle) : '';
    var hn = document.getElementById('pdpEditHandle');
    if (hn) hn.value = p.handle || '';
    var mat = document.getElementById('pdpEditMaterial');
    if (mat) mat.value = meta.material != null ? String(meta.material) : '';
    var desc = document.getElementById('pdpEditDescription');
    if (desc) desc.value = p.description != null ? String(p.description) : '';
    var disc = document.getElementById('pdpEditDiscountable');
    if (disc) disc.checked = meta.discountable !== false;
  }

  function openPdpEditDrawer(product, opts) {
    opts = opts || {};
    if (!product || !product.id) return;
    pdpEditProductRef = product;
    ensurePdpEditDrawerDom();
    fillPdpEditForm(product);
    var root = document.getElementById('pdpEditDrawer');
    var bd = document.getElementById('pdpEditBackdrop');
    if (root) {
      root.classList.remove('hidden');
      root.setAttribute('aria-hidden', 'false');
    }
    if (bd) {
      bd.classList.remove('hidden');
      bd.setAttribute('aria-hidden', 'false');
    }
    if (!opts.skipUrl && !isPdpEditPath()) {
      history.pushState({ pdpEdit: true }, '', '/app/products/' + encodeURIComponent(product.id) + '/edit');
    }
    pdpTeardownEditDrawerKeys();
    pdpEditEscapeHandler = function(ke) {
      if (ke.key !== 'Escape') return;
      if (root && !root.classList.contains('hidden')) {
        ke.preventDefault();
        closePdpEditDrawer();
      }
    };
    document.addEventListener('keydown', pdpEditEscapeHandler, true);
    var ti = document.getElementById('pdpEditTitle');
    if (ti) ti.focus();

    if (!pdpEditDrawerWired) {
      pdpEditDrawerWired = true;
      document.getElementById('pdpEditBackdrop').addEventListener('click', function() {
        closePdpEditDrawer();
      });
      document.getElementById('pdpEditClose').addEventListener('click', function() {
        closePdpEditDrawer();
      });
      document.getElementById('pdpEditCancel').addEventListener('click', function() {
        closePdpEditDrawer();
      });
      document.getElementById('pdpEditSave').addEventListener('click', function() {
        submitPdpEditForm();
      });
    }
  }

  function submitPdpEditForm() {
    var p = pdpEditProductRef;
    if (!p || !p.id) return;
    var titleEl = document.getElementById('pdpEditTitle');
    var title = titleEl && titleEl.value ? titleEl.value.trim() : '';
    if (!title) {
      window.alert('Title is required.');
      return;
    }
    var saveBtn = document.getElementById('pdpEditSave');
    if (saveBtn) saveBtn.disabled = true;

    var handleVal = document.getElementById('pdpEditHandle');
    var handle = handleVal && handleVal.value ? handleVal.value.trim().replace(/^\/+/, '') : null;
    var payload = {
      title: title,
      status: (document.getElementById('pdpEditStatus') || {}).value || 'draft',
      subtitle: (function() {
        var s = document.getElementById('pdpEditSubtitle');
        var t = s && s.value ? s.value.trim() : '';
        return t || null;
      })(),
      handle: handle,
      material: (function() {
        var s = document.getElementById('pdpEditMaterial');
        var t = s && s.value ? s.value.trim() : '';
        return t || null;
      })(),
      description: (function() {
        var s = document.getElementById('pdpEditDescription');
        var t = s && s.value ? s.value.trim() : '';
        return t || null;
      })(),
      discountable: !!(document.getElementById('pdpEditDiscountable') || {}).checked
    };

    fetch('/admin/products/' + encodeURIComponent(p.id), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) {
        return r.json().then(function(data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function(x) {
        if (!x.ok) {
          var msg =
            x.data && (x.data.message || x.data.error) ? String(x.data.message || x.data.error) : 'Save failed (' + x.status + ')';
          throw new Error(msg);
        }
        pdpHideEditDrawerUi();
        pdpTeardownEditDrawerKeys();
        if (isPdpEditPath()) {
          history.replaceState({}, '', '/app/products/' + encodeURIComponent(p.id));
        }
        renderProductDetail();
      })
      .catch(function(err) {
        window.alert(err && err.message ? err.message : 'Could not save product.');
      })
      .then(function() {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function pdpStartOfDay(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function pdpEndOfDay(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(23, 59, 59, 999);
    return x;
  }

  function pdpAddDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  function pdpAddMonths(d, n) {
    var x = new Date(d.getTime());
    x.setMonth(x.getMonth() + n);
    return x;
  }

  function pdpVariantPresetRange(key) {
    var now = new Date();
    var start;
    var end = pdpEndOfDay(now);
    switch (key) {
      case 'today':
        start = pdpStartOfDay(now);
        break;
      case '7d':
        start = pdpStartOfDay(pdpAddDays(now, -6));
        break;
      case '30d':
        start = pdpStartOfDay(pdpAddDays(now, -29));
        break;
      case '90d':
        start = pdpStartOfDay(pdpAddDays(now, -89));
        break;
      case '12m':
        start = pdpStartOfDay(pdpAddMonths(now, -12));
        break;
      default:
        return null;
    }
    return { start: start, end: end };
  }

  function pdpParseUsDateMmDdYyyy(s) {
    if (!s || !String(s).trim()) return null;
    var m = String(s)
      .trim()
      .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    var mo = parseInt(m[1], 10) - 1;
    var dy = parseInt(m[2], 10);
    var yr = parseInt(m[3], 10);
    var d = new Date(yr, mo, dy);
    if (d.getFullYear() !== yr || d.getMonth() !== mo || d.getDate() !== dy) return null;
    return d;
  }

  function pdpIsoToDate(iso) {
    if (!iso) return null;
    var t = Date.parse(String(iso));
    if (isNaN(t)) return null;
    return new Date(t);
  }

  function pdpVariantResolveDateRange(spec) {
    if (!spec || !spec.kind) return null;
    if (spec.kind === 'preset') return pdpVariantPresetRange(spec.key);
    if (spec.kind === 'custom' && spec.start && spec.end) {
      return {
        start: pdpStartOfDay(spec.start),
        end: pdpEndOfDay(spec.end)
      };
    }
    return null;
  }

  function pdpVariantTimestampInFilter(iso, spec) {
    if (!spec) return true;
    var r = pdpVariantResolveDateRange(spec);
    if (!r) return true;
    var d = pdpIsoToDate(iso);
    if (!d) return false;
    return d.getTime() >= r.start.getTime() && d.getTime() <= r.end.getTime();
  }

  function pdpVariantDatePresetLabel(key) {
    switch (key) {
      case 'today':
        return 'Today';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case '90d':
        return 'Last 90 days';
      case '12m':
        return 'Last 12 months';
      default:
        return key;
    }
  }

  function pdpVariantAllFiltersActive(f) {
    return (
      f.allowBackorder !== undefined &&
      f.manageInventory !== undefined &&
      f.created != null &&
      f.updated != null
    );
  }

  function renderProductDetail() {
    clearPageActions();
    detachProductListKeys();
    pdpHideMetadataDrawerUi();
    pdpTeardownMetadataDrawerKeys();
    pdpMetadataProductRef = null;
    pdpMetadataOrigEditableKeys = [];
    pdpHideJsonDrawerUi();
    pdpTeardownJsonDrawerKeys();
    pdpJsonProductRef = null;
    pdpHideJsonViewerUi();
    pdpTeardownJsonViewerKeys();
    pdpJsonViewerProductRef = null;
    pdpHideEditDrawerUi();
    pdpTeardownEditDrawerKeys();
    pdpTeardownCreateOptionDrawerKeys();
    pdpTeardownVariantOptDrawerKeys();
    pdpHideVariantOptDrawerUi();
    if (!isPdpOptionsDrawerPath()) {
      pdpHideCreateOptionDrawerUi();
    }
    if (pdpOutsideClose) {
      document.removeEventListener('click', pdpOutsideClose, true);
      pdpOutsideClose = null;
    }
    var id = getProductDetailId();
    if (!id) {
      navigate('/app/products');
      return;
    }
    setTitle('Product');
    content.innerHTML = '<div class="card"><p class="loading">Loading product…</p></div>';

    var colPromise = api('/admin/product-collections?limit=500').then(jsonFromResponse).catch(function() {
      return {};
    });
    var prodPromise = api('/admin/products/' + encodeURIComponent(id) + '?limit=1').then(jsonFromResponse);

    Promise.all([prodPromise, colPromise])
      .then(function(pair) {
        var data = pair[0];
        var collData = pair[1];
        var colMap = {};
        (collData.collections || []).forEach(function(c) {
          if (c.id) colMap[c.id] = c.title || c.handle || c.id;
        });

        var list = data && Array.isArray(data.products) ? data.products : [];
        var p = list[0];
        if (!p) {
          content.innerHTML =
            '<div class="card"><p class="error-msg">Product not found. It may have been removed or the id is invalid.</p>' +
            '<p style="margin-top:0.75rem;"><button type="button" class="btn-outline" id="pdpBackList">Back to products</button></p></div>';
          var bb = document.getElementById('pdpBackList');
          if (bb) bb.addEventListener('click', function() { navigate('/app/products'); });
          return;
        }

        setTitle(p.title || 'Product');
        var meta = readProductMetadata(p);
        var st = statusClass(p.status);
        var typeLabel = p.type && (p.type.value || p.type.title) ? String(p.type.value || p.type.title) : '—';
        var collLabel = p.collection_id ? colMap[p.collection_id] || p.collection_id : '—';
        var tagsStr = '—';
        if (meta.tags != null) {
          if (Array.isArray(meta.tags)) tagsStr = meta.tags.map(String).join(', ');
          else tagsStr = String(meta.tags);
        }
        var subtitle = meta.subtitle != null ? String(meta.subtitle) : '—';
        var material = meta.material != null ? String(meta.material) : '—';
        var discountable = meta.discountable === false ? 'False' : 'True';
        var metaKeys = pdpMetaKeyCount(meta);
        var topKeys = pdpMetaKeyCount(p);

        var productOptionColumns = (p.options || []).map(function(o, idx) {
          var rawId = o.id != null ? String(o.id).trim() : '';
          return {
            id: rawId || 'option_col_' + idx,
            title: String(o.title || rawId || 'Option').trim() || 'Option'
          };
        });
        var pdpVariantTableColspan = 7 + productOptionColumns.length;
        var pdpVariantOptionHeadHtml = productOptionColumns
          .map(function(c) {
            return '<th class="pdp-var-opt-col">' + escapeHtml(c.title) + '</th>';
          })
          .join('');

        var variantState = { q: '', sort: 'title', dir: 'asc' };
        var variantFilterState = {
          allowBackorder: undefined,
          manageInventory: undefined,
          created: undefined,
          updated: undefined
        };

        function variantSortKey(v) {
          if (variantState.sort === 'sku') return String(v.sku || '').toLowerCase();
          return String(v.title || '').toLowerCase();
        }

        function filteredVariants() {
          var vs = p.variants || [];
          var q = variantState.q.trim().toLowerCase();
          var out = vs.filter(function(v) {
            if (variantFilterState.allowBackorder !== undefined) {
              var ab = !!v.allow_backorder;
              if (ab !== variantFilterState.allowBackorder) return false;
            }
            if (variantFilterState.manageInventory !== undefined) {
              var mi = !!v.manage_inventory;
              if (mi !== variantFilterState.manageInventory) return false;
            }
            if (variantFilterState.created) {
              if (!pdpVariantTimestampInFilter(v.created_at, variantFilterState.created)) return false;
            }
            if (variantFilterState.updated) {
              if (!pdpVariantTimestampInFilter(v.updated_at, variantFilterState.updated)) return false;
            }
            if (!q) return true;
            if (
              String(v.title || '')
                .toLowerCase()
                .indexOf(q) >= 0 ||
              String(v.sku || '')
                .toLowerCase()
                .indexOf(q) >= 0
            ) {
              return true;
            }
            var vo = v.options || [];
            for (var vi = 0; vi < vo.length; vi++) {
              var ov = vo[vi];
              if (ov && String(ov.value || '')
                .toLowerCase()
                .indexOf(q) >= 0) {
                return true;
              }
            }
            return false;
          });
          out.sort(function(a, b) {
            var ka = variantSortKey(a);
            var kb = variantSortKey(b);
            if (ka < kb) return variantState.dir === 'asc' ? -1 : 1;
            if (ka > kb) return variantState.dir === 'asc' ? 1 : -1;
            return 0;
          });
          return out;
        }

        function refreshVariantTable() {
          var tb = content.querySelector('#pdpVariantsBody');
          var footFrom = content.querySelector('#pdpVarFrom');
          var footTo = content.querySelector('#pdpVarTo');
          var footTotal = content.querySelector('#pdpVarTotal');
          var footPage = content.querySelector('#pdpVarPage');
          if (!tb) return;
          var rows = filteredVariants();
          var total = rows.length;
          if (!total) {
            tb.innerHTML =
              '<tr><td colspan="' +
              pdpVariantTableColspan +
              '" style="color:#64748b;text-align:center;padding:1.25rem;">No variants match filter / search.</td></tr>';
          } else {
            tb.innerHTML = rows
              .map(function(v) {
                var optCells = productOptionColumns
                  .map(function(c, cidx) {
                    return '<td class="pdp-var-opt-cell">' + pdpVariantOptionPillCell(v, c.id, cidx) + '</td>';
                  })
                  .join('');
                return (
                  '<tr class="pdp-variant-row" data-variant-id="' +
                  escapeHtml(v.id || '') +
                  '" title="Click to assign option values">' +
                  '<td class="pdp-drag-col"><span class="pdp-drag-h" aria-hidden="true">⋮⋮</span></td>' +
                  pdpVariantThumbCell(v) +
                  '<td>' +
                  escapeHtml(v.title || '—') +
                  '</td>' +
                  '<td>' +
                  escapeHtml(v.sku || '—') +
                  '</td>' +
                  '<td>' +
                  escapeHtml(pdpFormatPrice(v.calculated_price)) +
                  '</td>' +
                  optCells +
                  '<td>' +
                  escapeHtml(pdpFormatInventory(v)) +
                  '</td>' +
                  '<td class="pdp-row-go"><span aria-hidden="true">›</span></td></tr>'
                );
              })
              .join('');
          }
          if (footFrom) footFrom.textContent = total ? '1' : '0';
          if (footTo) footTo.textContent = String(total);
          if (footTotal) footTotal.textContent = String(total);
          if (footPage) footPage.textContent = '1 of 1 pages';
        }

        function pdpUpdateVariantFilterButtonsDisabled() {
          var dis = pdpVariantAllFiltersActive(variantFilterState);
          var b1 = content.querySelector('#pdpVarFilterBtn');
          var b2 = content.querySelector('#pdpVarSubFilterBtn');
          [b1, b2].forEach(function(b) {
            if (!b) return;
            b.disabled = dis;
            if (dis) b.setAttribute('aria-disabled', 'true');
            else b.removeAttribute('aria-disabled');
            b.classList.toggle('is-disabled', dis);
          });
        }

        function refreshVariantFilterPills() {
          var el = content.querySelector('#pdpVarFilterPills');
          if (!el) return;
          var chips = [];
          if (variantFilterState.allowBackorder !== undefined) {
            chips.push({
              key: 'allowBackorder',
              label: 'Allow backorder',
              val: variantFilterState.allowBackorder ? 'Yes' : 'No'
            });
          }
          if (variantFilterState.manageInventory !== undefined) {
            chips.push({
              key: 'manageInventory',
              label: 'Manage inventory',
              val: variantFilterState.manageInventory ? 'Yes' : 'No'
            });
          }
          if (variantFilterState.created) {
            var cspec = variantFilterState.created;
            var cval =
              cspec.kind === 'preset'
                ? pdpVariantDatePresetLabel(cspec.key)
                : 'Custom range';
            chips.push({ key: 'created', label: 'Created', val: cval });
          }
          if (variantFilterState.updated) {
            var uspec = variantFilterState.updated;
            var uval =
              uspec.kind === 'preset' ? pdpVariantDatePresetLabel(uspec.key) : 'Custom range';
            chips.push({ key: 'updated', label: 'Updated', val: uval });
          }
          el.innerHTML = chips
            .map(function(c) {
              return (
                '<span class="pdp-var-filter-pill">' +
                '<span class="pdp-var-filter-pill-label">' +
                escapeHtml(c.label) +
                '</span>' +
                '<span class="pdp-var-filter-pill-sep"> is </span>' +
                '<span class="pdp-var-filter-pill-val">' +
                escapeHtml(c.val) +
                '</span>' +
                '<button type="button" class="pdp-var-filter-pill-x" data-pdp-var-filter-remove="' +
                escapeHtml(c.key) +
                '" title="Remove filter" aria-label="Remove ' +
                escapeHtml(c.label) +
                ' filter">×</button></span>'
              );
            })
            .join('');
          el.querySelectorAll('[data-pdp-var-filter-remove]').forEach(function(btn) {
            btn.addEventListener('click', function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              var k = btn.getAttribute('data-pdp-var-filter-remove');
              if (k === 'allowBackorder') variantFilterState.allowBackorder = undefined;
              else if (k === 'manageInventory') variantFilterState.manageInventory = undefined;
              else if (k === 'created') variantFilterState.created = undefined;
              else if (k === 'updated') variantFilterState.updated = undefined;
              closeVariantFilterMenu();
              refreshVariantFilterPills();
              pdpUpdateVariantFilterButtonsDisabled();
              refreshVariantTable();
            });
          });
          pdpUpdateVariantFilterButtonsDisabled();
        }

        function syncVariantFilterRootMenu() {
          var menu = content.querySelector('#pdpVarFilterMenu');
          if (!menu) return;
          menu.querySelectorAll('[data-pdp-var-filter-goto]').forEach(function(btn) {
            var key = btn.getAttribute('data-pdp-var-filter-goto') || '';
            var taken =
              (key === 'allow_backorder' && variantFilterState.allowBackorder !== undefined) ||
              (key === 'manage_inventory' && variantFilterState.manageInventory !== undefined) ||
              (key === 'created' && variantFilterState.created != null) ||
              (key === 'updated' && variantFilterState.updated != null);
            if (taken) {
              btn.setAttribute('hidden', '');
            } else {
              btn.removeAttribute('hidden');
            }
            btn.setAttribute('aria-hidden', taken ? 'true' : 'false');
            btn.tabIndex = taken ? -1 : 0;
          });
        }

        function showVariantFilterPanel(panel) {
          content.querySelectorAll('.pdp-var-filter-panel').forEach(function(p) {
            p.classList.toggle('is-active', p.getAttribute('data-panel') === panel);
          });
          if (panel === 'root') {
            syncVariantFilterRootMenu();
          }
        }

        function closeVariantFilterMenu() {
          var menu = content.querySelector('#pdpVarFilterMenu');
          if (menu) {
            menu.classList.remove('is-open');
            menu.style.top = '';
            menu.style.left = '';
            menu.style.right = '';
            menu.style.bottom = '';
            menu.style.position = '';
          }
          showVariantFilterPanel('root');
        }

        function positionVariantFilterMenu(anchor) {
          var menu = content.querySelector('#pdpVarFilterMenu');
          var card = menu && menu.closest('.pdp-variants-card');
          if (!menu || !anchor || !card) return;
          var cardRect = card.getBoundingClientRect();
          var r = anchor.getBoundingClientRect();
          menu.style.position = 'absolute';
          var topPx = r.bottom - cardRect.top + 6;
          menu.style.top = Math.max(0, topPx) + 'px';
          var menuW = menu.offsetWidth || 240;
          var leftPx = r.left - cardRect.left;
          var maxLeft = card.clientWidth - menuW - 8;
          if (leftPx > maxLeft) leftPx = Math.max(8, maxLeft);
          if (leftPx < 8) leftPx = 8;
          menu.style.left = leftPx + 'px';
          menu.style.right = 'auto';
        }

        var variantFilterAnchorEl = null;

        function toggleVariantFilterMenu(anchor) {
          if (pdpVariantAllFiltersActive(variantFilterState)) return;
          var menu = content.querySelector('#pdpVarFilterMenu');
          if (!menu) return;
          if (menu.classList.contains('is-open')) {
            closeVariantFilterMenu();
            return;
          }
          variantFilterAnchorEl = anchor || variantFilterAnchorEl;
          content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
            d.classList.remove('is-open');
          });
          showVariantFilterPanel('root');
          menu.classList.add('is-open');
          var anch = variantFilterAnchorEl || anchor;
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              positionVariantFilterMenu(anch);
            });
          });
        }

        var mediaUrls = pdpGalleryUrlsFromProduct(p);
        var mediaRow = pdpMediaTilesHtml(mediaUrls, p);

        var optionsBlock = pdpOptionsRowsHtml(p.options || []);

        var breadcrumbTitle = p.title || 'Product';
        var pdpVarSortIconSvg =
          '<svg class="pdp-tool-svg pdp-var-sort-ico" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<rect x="4" y="5" width="16" height="3" rx="1.5" />' +
          '<rect x="7" y="10.5" width="10" height="3" rx="1.5" />' +
          '<rect x="10" y="16" width="4" height="3" rx="1.5" />' +
          '</svg>';
        var pdpVariantSortMenuHtml =
          '<div class="pdp-menu-dropdown pdp-var-sort-menu" role="menu" data-pdp-var-sort-menu>' +
          '<div class="pdp-var-sort-menu-section" role="group" aria-label="Sort by">' +
          '<button type="button" class="pdp-menu-item pdp-var-sort-choice" data-pdp-var-sort-key="title" role="menuitemradio">' +
          '<span class="pdp-var-sort-dot" aria-hidden="true"></span>Title</button>' +
          '<button type="button" class="pdp-menu-item pdp-var-sort-choice" data-pdp-var-sort-key="sku" role="menuitemradio">' +
          '<span class="pdp-var-sort-dot" aria-hidden="true"></span>SKU</button>' +
          '</div>' +
          '<div class="pdp-var-sort-menu-divider" role="separator"></div>' +
          '<div class="pdp-var-sort-menu-section" role="group" aria-label="Order">' +
          '<button type="button" class="pdp-menu-item pdp-var-sort-choice" data-pdp-var-sort-dir="asc" role="menuitemradio">' +
          '<span class="pdp-var-sort-dot" aria-hidden="true"></span>↑ A to Z</button>' +
          '<button type="button" class="pdp-menu-item pdp-var-sort-choice" data-pdp-var-sort-dir="desc" role="menuitemradio">' +
          '<span class="pdp-var-sort-dot" aria-hidden="true"></span>↓ Z to A</button>' +
          '</div></div>';
        content.innerHTML =
          '<div class="pdp-wrap">' +
          '<nav class="pdp-breadcrumb" aria-label="Breadcrumb">' +
          '<a href="#" class="pdp-crumb-link" id="pdpCrumbProducts">Products</a>' +
          '<span class="pdp-crumb-sep"> / </span>' +
          '<span class="pdp-crumb-current">' +
          escapeHtml(breadcrumbTitle) +
          '</span></nav>' +
          '<div class="pdp-hero">' +
          '<div class="pdp-hero-main">' +
          '<h1 class="pdp-title">' +
          escapeHtml(p.title || '—') +
          '</h1>' +
          '<span class="status-pill pdp-status-pill"><span class="status-dot ' +
          escapeHtml(st) +
          '"></span> ' +
          escapeHtml(statusLabel(p.status)) +
          '</span></div>' +
          '<div class="pdp-hero-actions">' +
          pdpSectionDropdown('header') +
          '</div></div>' +
          '<div class="pdp-grid">' +
          '<div class="pdp-main-col">' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">General</h2>' +
          pdpSectionDropdown('general') +
          '</div><div class="pdp-card-body pdp-dl">' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Description</span><span class="pdp-dl-v pdp-dl-multiline">' +
          escapeHtml(p.description || '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Subtitle</span><span class="pdp-dl-v">' +
          escapeHtml(subtitle) +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Handle</span><span class="pdp-dl-v"><code>' +
          escapeHtml(p.handle || '—') +
          '</code></span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Material</span><span class="pdp-dl-v">' +
          escapeHtml(material) +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Discountable</span><span class="pdp-dl-v">' +
          escapeHtml(discountable) +
          '</span></div>' +
          '</div></section>' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Media</h2>' +
          pdpMediaSectionActions() +
          '</div><div class="pdp-card-body">' +
          mediaRow +
          '</div></section>' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Options</h2>' +
          pdpOptionsSectionMenu() +
          '</div><div class="pdp-card-body">' +
          optionsBlock +
          '</div></section>' +
          '<section class="pdp-card pdp-variants-card">' +
          '<div class="pdp-card-head pdp-card-head-tools pdp-variants-head">' +
          '<h2 class="pdp-card-title pdp-variants-title">Variants</h2>' +
          '<div class="pdp-variant-tools">' +
          '<div class="pdp-card-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-var-filter-open" id="pdpVarFilterBtn" title="Filter" aria-label="Filter">' +
          '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none" /></svg></button></div>' +
          '<div class="pdp-card-actions pdp-var-sort-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-var-sort-trigger" id="pdpVarSortBtn" title="Sort" aria-label="Sort variants" aria-expanded="false" aria-haspopup="true">' +
          pdpVarSortIconSvg +
          '</button>' +
          pdpVariantSortMenuHtml +
          '</div>' +
          '<div class="pdp-var-search-wrap">' +
          '<label class="sr-only" for="pdpVarSearch">Search variants</label>' +
          '<svg class="pdp-var-search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.75" />' +
          '<path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>' +
          '<input type="search" id="pdpVarSearch" class="pdp-var-search-input" placeholder="Search" autocomplete="off" />' +
          '</div>' +
          '<div class="pdp-card-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-menu-trigger" title="More" aria-label="More actions" aria-expanded="false" aria-haspopup="true">' +
          '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg></button>' +
          '<div class="pdp-menu-dropdown" role="menu">' +
          '<button type="button" class="pdp-menu-item" id="pdpEditPrices" role="menuitem">' +
          '<span class="pdp-menu-ico" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l8.3 8.3a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8L12 2z"/><path d="M7 7h.01"/></svg></span>' +
          'Edit prices</button>' +
          '<button type="button" class="pdp-menu-item" id="pdpEditStock" role="menuitem">' +
          '<span class="pdp-menu-ico" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l9-7 9 7v11"/><path d="M3 14h18"/><path d="M9 21v-6h6v6"/></svg></span>' +
          'Edit stock levels</button>' +
          '</div></div>' +
          '<button type="button" class="btn-solid pdp-variant-create-btn" id="pdpCreateVariant">Create</button>' +
          '</div></div>' +
          '<div id="pdpVarFilterMenu" class="pdp-var-filter-menu" role="dialog" aria-label="Variant filters">' +
          '<div class="pdp-var-filter-panel is-active" data-panel="root">' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-goto="allow_backorder">Allow backorder</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-goto="manage_inventory">Manage inventory</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-goto="created">Created</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-goto="updated">Updated</button>' +
          '</div>' +
          '<div class="pdp-var-filter-panel" data-panel="allow_backorder">' +
          '<button type="button" class="pdp-menu-item pdp-var-filter-back">Back</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-bool="allowBackorder" data-bool-val="true">Yes</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-bool="allowBackorder" data-bool-val="false">No</button>' +
          '</div>' +
          '<div class="pdp-var-filter-panel" data-panel="manage_inventory">' +
          '<button type="button" class="pdp-menu-item pdp-var-filter-back">Back</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-bool="manageInventory" data-bool-val="true">Yes</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-filter-bool="manageInventory" data-bool-val="false">No</button>' +
          '</div>' +
          '<div class="pdp-var-filter-panel" data-panel="created">' +
          '<button type="button" class="pdp-menu-item pdp-var-filter-back">Back</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="created" data-preset="today">Today</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="created" data-preset="7d">Last 7 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="created" data-preset="30d">Last 30 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="created" data-preset="90d">Last 90 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="created" data-preset="12m">Last 12 months</button>' +
          '<div class="pdp-var-filter-custom">' +
          '<div class="pdp-var-filter-custom-h">Custom</div>' +
          '<label class="pdp-var-filter-date-lbl">Starting' +
          '<input type="text" id="pdpVarFilterCreatedStart" class="pdp-var-filter-date-input" placeholder="MM/DD/YYYY" autocomplete="off" />' +
          '</label>' +
          '<label class="pdp-var-filter-date-lbl">Ending' +
          '<input type="text" id="pdpVarFilterCreatedEnd" class="pdp-var-filter-date-input" placeholder="MM/DD/YYYY" autocomplete="off" />' +
          '</label>' +
          '<button type="button" class="btn-solid pdp-var-filter-apply" id="pdpVarFilterCreatedApply">Apply</button>' +
          '</div></div>' +
          '<div class="pdp-var-filter-panel" data-panel="updated">' +
          '<button type="button" class="pdp-menu-item pdp-var-filter-back">Back</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="updated" data-preset="today">Today</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="updated" data-preset="7d">Last 7 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="updated" data-preset="30d">Last 30 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="updated" data-preset="90d">Last 90 days</button>' +
          '<button type="button" class="pdp-menu-item" data-pdp-var-date="updated" data-preset="12m">Last 12 months</button>' +
          '<div class="pdp-var-filter-custom">' +
          '<div class="pdp-var-filter-custom-h">Custom</div>' +
          '<label class="pdp-var-filter-date-lbl">Starting' +
          '<input type="text" id="pdpVarFilterUpdatedStart" class="pdp-var-filter-date-input" placeholder="MM/DD/YYYY" autocomplete="off" />' +
          '</label>' +
          '<label class="pdp-var-filter-date-lbl">Ending' +
          '<input type="text" id="pdpVarFilterUpdatedEnd" class="pdp-var-filter-date-input" placeholder="MM/DD/YYYY" autocomplete="off" />' +
          '</label>' +
          '<button type="button" class="btn-solid pdp-var-filter-apply" id="pdpVarFilterUpdatedApply">Apply</button>' +
          '</div></div></div>' +
          '<div class="pdp-variants-subbar">' +
          '<div id="pdpVarFilterPills" class="pdp-var-filter-pills"></div>' +
          '<div class="pdp-var-subbar-tools">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-var-filter-open" id="pdpVarSubFilterBtn" title="Filter" aria-label="Add filter">' +
          '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" fill="none" /></svg></button>' +
          '<div class="pdp-card-actions pdp-var-sort-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon pdp-var-sort-trigger" id="pdpVarSortBtnSub" title="Sort" aria-label="Sort variants" aria-expanded="false" aria-haspopup="true">' +
          pdpVarSortIconSvg +
          '</button>' +
          pdpVariantSortMenuHtml +
          '</div></div></div>' +
          '<div class="pdp-card-body pdp-table-wrap pdp-variants-table-body">' +
          '<table class="pdp-table">' +
          '<thead><tr><th class="pdp-drag-col"></th><th class="pdp-var-thumb-col" scope="col"> </th><th>Title</th><th>SKU</th><th>Price</th>' +
          pdpVariantOptionHeadHtml +
          '<th>Inventory</th><th></th></tr></thead>' +
          '<tbody id="pdpVariantsBody"></tbody></table>' +
          '<div class="pdp-table-footer">' +
          '<span><span id="pdpVarFrom">0</span> – <span id="pdpVarTo">0</span> of <span id="pdpVarTotal">0</span> results</span>' +
          '<span id="pdpVarPage">1 of 1 pages</span>' +
          '<span class="pdp-table-nav"><button type="button" class="btn-outline" disabled>Prev</button> ' +
          '<button type="button" class="btn-outline" disabled>Next</button></span></div></div></section>' +
          '<section class="pdp-card pdp-variants-card pdp-variants-fold-section" id="pdpMetaFoldSection">' +
          '<div class="pdp-card-head pdp-card-head-tools pdp-variants-head">' +
          '<button type="button" class="pdp-variants-fold-head" id="pdpMetaFoldBtn" aria-expanded="false" aria-controls="pdpMetaFoldPanel">' +
          '<span class="pdp-fold-chev" aria-hidden="true">›</span>' +
          '<span class="pdp-variants-title">Metadata</span>' +
          '<span class="pdp-meta-json-count">' +
          escapeHtml(String(metaKeys)) +
          ' keys</span></button>' +
          '<div class="pdp-variant-tools">' +
          '<div class="pdp-card-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon" id="pdpMetaOpen" title="Edit metadata" aria-label="Edit metadata">' +
          '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M15 3h6v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 14 21 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg></button></div>' +
          pdpSectionDropdownMedusaTools(
            'metadata',
            '<button type="button" class="pdp-menu-item" data-pdp-meta-json-newtab>' +
              '<span class="pdp-menu-ico" aria-hidden="true">↗</span> Open in new tab</button>'
          ) +
          '</div></div>' +
          '<div class="pdp-variants-fold-panel" id="pdpMetaFoldPanel" hidden>' +
          '<div class="pdp-card-body pdp-meta-json-body"><pre class="pdp-pre" id="pdpMetaPre"></pre></div></div></section>' +
          '<section class="pdp-card pdp-variants-card pdp-variants-fold-section" id="pdpJsonFoldSection">' +
          '<div class="pdp-card-head pdp-card-head-tools pdp-variants-head">' +
          '<button type="button" class="pdp-variants-fold-head" id="pdpJsonFoldBtn" aria-expanded="false" aria-controls="pdpJsonFoldPanel">' +
          '<span class="pdp-fold-chev" aria-hidden="true">›</span>' +
          '<span class="pdp-variants-title">JSON</span>' +
          '<span class="pdp-meta-json-count">' +
          escapeHtml(String(topKeys)) +
          ' keys</span></button>' +
          '<div class="pdp-variant-tools">' +
          '<div class="pdp-card-actions">' +
          '<button type="button" class="pdp-tool-btn pdp-tool-btn-icon" id="pdpJsonOpen" title="View JSON" aria-label="View JSON">' +
          '<svg class="pdp-tool-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M15 3h6v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 14 21 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg></button></div>' +
          pdpSectionDropdownMedusaTools(
            'json',
            '<button type="button" class="pdp-menu-item" data-pdp-meta-json-newtab>' +
              '<span class="pdp-menu-ico" aria-hidden="true">↗</span> Open in new tab</button>'
          ) +
          '</div></div>' +
          '<div class="pdp-variants-fold-panel" id="pdpJsonFoldPanel" hidden>' +
          '<div class="pdp-card-body pdp-meta-json-body"><pre class="pdp-pre pdp-pre-tall" id="pdpJsonPre"></pre></div></div></section>' +
          '</div>' +
          '<aside class="pdp-aside-col">' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Sales channels</h2>' +
          pdpSectionDropdown('sales_channels') +
          '</div><div class="pdp-card-body pdp-aside-copy">' +
          '<p class="pdp-aside-strong">Default Sales Channel</p>' +
          '<p class="pdp-muted">Available in 1 of 1 sales channels</p></div></section>' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Shipping configuration</h2>' +
          pdpSectionDropdown('shipping') +
          '</div><div class="pdp-card-body"><div class="pdp-ship-box">' +
          '<span class="pdp-ship-lock" aria-hidden="true">🔒</span>' +
          '<div><p class="pdp-aside-strong">Default Shipping Profile</p><p class="pdp-muted">default</p></div></div></div></section>' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Organize</h2>' +
          pdpSectionDropdown('organize') +
          '</div><div class="pdp-card-body pdp-dl">' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Tags</span><span class="pdp-dl-v">' +
          escapeHtml(tagsStr) +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Type</span><span class="pdp-dl-v">' +
          escapeHtml(typeLabel) +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Collection</span><span class="pdp-dl-v">' +
          escapeHtml(collLabel) +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Categories</span><span class="pdp-dl-v">' +
          escapeHtml(meta.categories != null ? String(meta.categories) : '—') +
          '</span></div>' +
          '</div></section>' +
          '<section class="pdp-card">' +
          '<div class="pdp-card-head"><h2 class="pdp-card-title">Attributes</h2>' +
          pdpSectionDropdown('attributes') +
          '</div><div class="pdp-card-body pdp-dl">' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Height</span><span class="pdp-dl-v">' +
          escapeHtml(meta.height != null ? String(meta.height) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Width</span><span class="pdp-dl-v">' +
          escapeHtml(meta.width != null ? String(meta.width) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Length</span><span class="pdp-dl-v">' +
          escapeHtml(meta.length != null ? String(meta.length) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Weight</span><span class="pdp-dl-v">' +
          escapeHtml(meta.weight != null ? String(meta.weight) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">MID code</span><span class="pdp-dl-v">' +
          escapeHtml(meta.mid_code != null ? String(meta.mid_code) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">HS code</span><span class="pdp-dl-v">' +
          escapeHtml(meta.hs_code != null ? String(meta.hs_code) : '—') +
          '</span></div>' +
          '<div class="pdp-dl-row"><span class="pdp-dl-k">Country of origin</span><span class="pdp-dl-v">' +
          escapeHtml(meta.country_of_origin != null ? String(meta.country_of_origin) : '—') +
          '</span></div>' +
          '</div></section>' +
          '</aside></div></div>';

        var metaPre = content.querySelector('#pdpMetaPre');
        var jsonPre = content.querySelector('#pdpJsonPre');
        try {
          if (metaPre) metaPre.textContent = JSON.stringify(meta, null, 2);
        } catch (e) {
          if (metaPre) metaPre.textContent = String(meta);
        }
        try {
          if (jsonPre) jsonPre.textContent = JSON.stringify(p, null, 2);
        } catch (e) {
          if (jsonPre) jsonPre.textContent = '{}';
        }

        var crumb = content.querySelector('#pdpCrumbProducts');
        if (crumb) {
          crumb.addEventListener('click', function(e) {
            e.preventDefault();
            navigate('/app/products');
          });
        }

        function syncVariantSortMenuUi() {
          content.querySelectorAll('[data-pdp-var-sort-menu]').forEach(function(menu) {
            menu.querySelectorAll('[data-pdp-var-sort-key]').forEach(function(b) {
              var k = b.getAttribute('data-pdp-var-sort-key');
              var sel = (k === 'sku' ? 'sku' : 'title') === variantState.sort;
              b.classList.toggle('is-selected', sel);
              b.setAttribute('aria-checked', sel ? 'true' : 'false');
            });
            menu.querySelectorAll('[data-pdp-var-sort-dir]').forEach(function(b) {
              var d = b.getAttribute('data-pdp-var-sort-dir');
              var sel =
                (d === 'asc' && variantState.dir === 'asc') || (d === 'desc' && variantState.dir === 'desc');
              b.classList.toggle('is-selected', sel);
              b.setAttribute('aria-checked', sel ? 'true' : 'false');
            });
          });
        }

        content.querySelectorAll('.pdp-var-sort-trigger').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var wrap = btn.closest('.pdp-var-sort-actions') || btn.closest('.pdp-card-actions');
            var dd = wrap && wrap.querySelector('[data-pdp-var-sort-menu]');
            var wasOpen = dd && dd.classList.contains('is-open');
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            if (dd && !wasOpen) {
              dd.classList.add('is-open');
              syncVariantSortMenuUi();
            }
          });
        });

        content.querySelectorAll('[data-pdp-menu-trigger]').forEach(function(btn) {
          if (btn.classList.contains('pdp-var-sort-trigger')) return;
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var wrap = btn.closest('.pdp-card-actions') || btn.closest('.pdp-hero-actions');
            var dd = wrap && wrap.querySelector('.pdp-menu-dropdown');
            var wasOpen = dd && dd.classList.contains('is-open');
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            if (dd && !wasOpen) dd.classList.add('is-open');
          });
        });

        pdpOutsideClose = function(e) {
          var t = e.target;
          if (!t || !t.closest) return;
          if (!t.closest('.pdp-card-actions, .pdp-hero-actions')) {
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
          }
          if (!t.closest('#pdpVarFilterMenu') && !t.closest('.pdp-var-filter-open')) {
            closeVariantFilterMenu();
          }
        };
        document.addEventListener('click', pdpOutsideClose, true);

        content.querySelectorAll('[data-pdp-edit]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            var sec = btn.getAttribute('data-pdp-edit') || '';
            if (sec === 'header' || sec === 'general') {
              openPdpEditDrawer(p);
            } else if (sec === 'metadata') {
              openPdpMetadataDrawer(p);
            } else if (sec === 'json') {
              openPdpJsonDrawer(p);
            } else {
              pdpNotImplemented('Edit (' + sec + ')');
            }
          });
        });
        content.querySelectorAll('[data-pdp-create-option]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            navigate('/app/products/' + encodeURIComponent(p.id) + '/options/create');
          });
        });
        content.querySelectorAll('[data-pdp-edit-option]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            var oid = btn.getAttribute('data-pdp-edit-option') || '';
            if (!oid) return;
            navigate(
              '/app/products/' + encodeURIComponent(p.id) + '/options/' + encodeURIComponent(oid) + '/edit'
            );
          });
        });
        content.querySelectorAll('[data-pdp-delete-option]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            var oid = btn.getAttribute('data-pdp-delete-option') || '';
            if (!oid) return;
            pdpDeleteProductOption(p, oid);
          });
        });
        content.querySelectorAll('[data-pdp-open-media]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            openPdpMediaOverlay(p);
          });
        });
        content.querySelectorAll('[data-pdp-delete]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            if (window.confirm('Delete this section or product? Catalog delete API is not wired yet — this is a preview only.')) {
              pdpNotImplemented('Delete (' + btn.getAttribute('data-pdp-delete') + ')');
            }
          });
        });

        content.querySelectorAll('[data-pdp-var-sort-key]').forEach(function(sbtn) {
          sbtn.addEventListener('click', function(e) {
            e.stopPropagation();
            variantState.sort = sbtn.getAttribute('data-pdp-var-sort-key') === 'sku' ? 'sku' : 'title';
            refreshVariantTable();
            syncVariantSortMenuUi();
          });
        });
        content.querySelectorAll('[data-pdp-var-sort-dir]').forEach(function(sbtn) {
          sbtn.addEventListener('click', function(e) {
            e.stopPropagation();
            variantState.dir = sbtn.getAttribute('data-pdp-var-sort-dir') === 'desc' ? 'desc' : 'asc';
            refreshVariantTable();
            syncVariantSortMenuUi();
          });
        });
        var searchEl = content.querySelector('#pdpVarSearch');
        if (searchEl) {
          searchEl.addEventListener('input', function() {
            variantState.q = searchEl.value;
            refreshVariantTable();
          });
        }
        var fbtn = content.querySelector('#pdpVarFilterBtn');
        if (fbtn) {
          fbtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleVariantFilterMenu(fbtn);
          });
        }
        var subFbtn = content.querySelector('#pdpVarSubFilterBtn');
        if (subFbtn) {
          subFbtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleVariantFilterMenu(subFbtn);
          });
        }
        content.querySelectorAll('[data-pdp-var-filter-goto]').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var panel = btn.getAttribute('data-pdp-var-filter-goto');
            showVariantFilterPanel(panel);
            if (variantFilterAnchorEl) {
              requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                  positionVariantFilterMenu(variantFilterAnchorEl);
                });
              });
            }
          });
        });
        content.querySelectorAll('.pdp-var-filter-back').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            showVariantFilterPanel('root');
            if (variantFilterAnchorEl) {
              requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                  positionVariantFilterMenu(variantFilterAnchorEl);
                });
              });
            }
          });
        });
        content.querySelectorAll('[data-pdp-var-filter-bool]').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var k = btn.getAttribute('data-pdp-var-filter-bool');
            var val = btn.getAttribute('data-bool-val') === 'true';
            if (k === 'allowBackorder') variantFilterState.allowBackorder = val;
            else if (k === 'manageInventory') variantFilterState.manageInventory = val;
            closeVariantFilterMenu();
            refreshVariantFilterPills();
            refreshVariantTable();
          });
        });
        content.querySelectorAll('[data-pdp-var-date][data-preset]').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var field = btn.getAttribute('data-pdp-var-date');
            var preset = btn.getAttribute('data-preset');
            var spec = { kind: 'preset', key: preset };
            if (field === 'created') variantFilterState.created = spec;
            else if (field === 'updated') variantFilterState.updated = spec;
            closeVariantFilterMenu();
            refreshVariantFilterPills();
            refreshVariantTable();
          });
        });
        var pdpVarCreatedApply = content.querySelector('#pdpVarFilterCreatedApply');
        if (pdpVarCreatedApply) {
          pdpVarCreatedApply.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var s = pdpParseUsDateMmDdYyyy((content.querySelector('#pdpVarFilterCreatedStart') || {}).value);
            var endD = pdpParseUsDateMmDdYyyy((content.querySelector('#pdpVarFilterCreatedEnd') || {}).value);
            if (!s || !endD) {
              window.alert('Enter valid start and end dates as MM/DD/YYYY.');
              return;
            }
            if (s.getTime() > endD.getTime()) {
              window.alert('Starting date must be on or before ending date.');
              return;
            }
            variantFilterState.created = { kind: 'custom', start: s, end: endD };
            closeVariantFilterMenu();
            refreshVariantFilterPills();
            refreshVariantTable();
          });
        }
        var pdpVarUpdatedApply = content.querySelector('#pdpVarFilterUpdatedApply');
        if (pdpVarUpdatedApply) {
          pdpVarUpdatedApply.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var s = pdpParseUsDateMmDdYyyy((content.querySelector('#pdpVarFilterUpdatedStart') || {}).value);
            var endD = pdpParseUsDateMmDdYyyy((content.querySelector('#pdpVarFilterUpdatedEnd') || {}).value);
            if (!s || !endD) {
              window.alert('Enter valid start and end dates as MM/DD/YYYY.');
              return;
            }
            if (s.getTime() > endD.getTime()) {
              window.alert('Starting date must be on or before ending date.');
              return;
            }
            variantFilterState.updated = { kind: 'custom', start: s, end: endD };
            closeVariantFilterMenu();
            refreshVariantFilterPills();
            refreshVariantTable();
          });
        }
        var ep = content.querySelector('#pdpEditPrices');
        if (ep) {
          ep.addEventListener('click', function(ev) {
            ev.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            pdpNotImplemented('Edit prices');
          });
        }
        var es = content.querySelector('#pdpEditStock');
        if (es) {
          es.addEventListener('click', function(ev) {
            ev.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            pdpNotImplemented('Edit stock levels');
          });
        }
        var cv = content.querySelector('#pdpCreateVariant');
        if (cv) {
          cv.addEventListener('click', function() {
            openPdpCreateVariantWizard(p);
          });
        }

        var mo = content.querySelector('#pdpMetaOpen');
        if (mo) {
          mo.addEventListener('click', function(ev) {
            ev.stopPropagation();
            openPdpMetadataDrawer(p);
          });
        }
        content.querySelectorAll('[data-pdp-meta-json-newtab]').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            content.querySelectorAll('.pdp-menu-dropdown.is-open').forEach(function(d) {
              d.classList.remove('is-open');
            });
            try {
              pdpOpenJsonTab(JSON.stringify(p, null, 2));
            } catch (e) {
              pdpOpenJsonTab('{}');
            }
          });
        });
        var jo = content.querySelector('#pdpJsonOpen');
        if (jo) {
          jo.addEventListener('click', function(ev) {
            ev.stopPropagation();
            openPdpJsonViewer(p);
          });
        }

        function wirePdpVariantsFold(btnSel, panelSel, sectionSel) {
          var btn = content.querySelector(btnSel);
          var panel = content.querySelector(panelSel);
          var section = sectionSel ? content.querySelector(sectionSel) : btn && btn.closest('.pdp-variants-fold-section');
          if (!btn || !panel) return;
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            var expand = panel.hasAttribute('hidden');
            if (expand) {
              panel.removeAttribute('hidden');
              btn.setAttribute('aria-expanded', 'true');
              if (section) section.classList.add('pdp-variants-fold-open');
            } else {
              panel.setAttribute('hidden', '');
              btn.setAttribute('aria-expanded', 'false');
              if (section) section.classList.remove('pdp-variants-fold-open');
            }
          });
        }
        wirePdpVariantsFold('#pdpMetaFoldBtn', '#pdpMetaFoldPanel', '#pdpMetaFoldSection');
        wirePdpVariantsFold('#pdpJsonFoldBtn', '#pdpJsonFoldPanel', '#pdpJsonFoldSection');

        pdpEditProductRef = p;
        ensurePdpMediaBulkKeyHandler();
        wirePdpMediaCardBulkActions(p, mediaUrls);
        refreshVariantFilterPills();
        refreshVariantTable();
        syncVariantSortMenuUi();
        var wrapEl = content.querySelector('.pdp-wrap');
        if (wrapEl) {
          wrapEl.addEventListener('click', function(ev) {
            var row = ev.target.closest('.pdp-variant-row');
            if (!row || !wrapEl.contains(row)) return;
            if (ev.target.closest('button, a, input, select, textarea')) return;
            var vid = row.getAttribute('data-variant-id');
            if (!vid) return;
            var vObj = (p.variants || []).find(function(x) {
              return x && x.id === vid;
            });
            if (!vObj) return;
            openPdpVariantOptDrawer(p, vObj, productOptionColumns);
          });
        }
        if (isPdpEditPath()) {
          openPdpEditDrawer(p, { skipUrl: true });
        }
        if (isPdpOptionsCreatePath()) {
          openPdpCreateOptionDrawer(p, { skipUrl: true });
        } else if (isPdpOptionsEditPath()) {
          openPdpCreateOptionDrawer(p, { skipUrl: true, editOptionId: getPdpOptionEditIdFromPath() });
        }
      })
      .catch(function(err) {
        var msg = err && err.message ? escapeHtml(err.message) : 'Could not load product.';
        content.innerHTML = '<div class="card"><p class="error-msg">' + msg + '</p></div>';
      });
  }

  var pages = {
    products: renderProducts,
    'product-detail': renderProductDetail,
    'product-categories': renderProductCategories,
    'product-collections': renderProductCollections,
    orders: renderOrders,
    'orders-drafts': function() { renderPlaceholder('Order Drafts', 'Draft orders page shell is ready.'); },
    inventory: function() { renderPlaceholder('Inventory', 'Inventory page shell is ready.'); },
    customers: function() { renderPlaceholder('Customers', 'Customers page shell is ready.'); },
    promotions: function() { renderPlaceholder('Promotions', 'Promotions page shell is ready.'); },
    'price-lists': function() { renderPlaceholder('Price Lists', 'Price lists page shell is ready.'); },
    regions: renderRegions,
    users: renderUsers,
    invites: renderInvites,
    recipes: function() { renderPlaceholder('Recipes', 'Recipes extension shell is ready.'); },
    'price-update': function() { renderPlaceholder('Price Update', 'Price Update extension shell is ready.'); },
    search: renderSearch
  };

  function init() {
    if (pdpOutsideClose) {
      document.removeEventListener('click', pdpOutsideClose, true);
      pdpOutsideClose = null;
    }
    pdpTeardownEditDrawerKeys();
    pdpTeardownCreateOptionDrawerKeys();
    pdpTeardownVariantOptDrawerKeys();
    var pathNorm = window.location.pathname.replace(/\/$/, '') || '/app/products';
    if (pathNorm === '/app/settings') {
      try {
        window.history.replaceState({}, '', '/app/settings/store');
      } catch (e) {}
    }
    if (getPage() !== 'product-detail') {
      pdpHideEditDrawerUi();
      pdpHideCreateOptionDrawerUi();
      pdpHideVariantOptDrawerUi();
    }
    clearPageActions();
    detachProductListKeys();
    closeStoreEditDrawer();
    var page = getPage();
    setActiveNav(page);
    var fn = pages[page];
    if (!fn && isSettingsPageKey(page)) fn = renderSettingsPage;
    if (!fn) fn = renderProducts;
    fn();
  }

  document.querySelectorAll('.sidebar-nav a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      if (a.getAttribute('data-page') === 'search') {
        e.preventDefault();
        openCommandModal();
        return;
      }
      e.preventDefault();
      navigate(this.getAttribute('href'));
    });
  });

  function shortcutMarkup(shortcut) {
    if (!shortcut || !shortcut.length) return '';
    return '<span class="shortcut-hint">' + shortcut.map(function(k, idx) {
      return (idx > 0 ? ' then ' : '') + '<span class="keycap">' + escapeHtml(k) + '</span>';
    }).join('') + '</span>';
  }

  function pushJumpRows(html, localRows) {
    var out = html;
    if (localRows.length) {
      out += '<div class="command-section-title">Jump to</div>';
      localRows.forEach(function(c) {
        var idx = visibleCommands.length;
        visibleCommands.push({
          kind: 'jump',
          path: c.path,
          label: c.label,
          shortcut: c.shortcut
        });
        out += '<div class="command-row" data-idx="' + idx + '" role="option"><span class="command-label"><span class="command-label-text">' + escapeHtml(c.label) + '</span></span>' + shortcutMarkup(c.shortcut) + '</div>';
      });
    }
    return out;
  }

  function pushRemoteGroups(html, data, query) {
    var out = html;
    var q = query || '';
    (data.results || []).forEach(function(group) {
      var items = (group.items || []).slice(0, PALETTE_PREVIEW_PER_TYPE);
      if (!items.length) return;
      var type = group.type || 'result';
      var title = humanizeSearchType(type);
      var count = typeof group.count === 'number' ? group.count : items.length;
      var showMore = count > PALETTE_PREVIEW_PER_TYPE || items.length >= PALETTE_PREVIEW_PER_TYPE;

      out += '<div class="command-section-title">' + escapeHtml(title) + '</div>';
      items.forEach(function(item) {
        var idx = visibleCommands.length;
        var label = primaryItemLabel(item) || title;
        var meta = itemMetaRight(item);
        var thumb = itemThumbUrl(item);
        var path = pathForSearchResult(type, item);
        visibleCommands.push({ kind: 'result', path: path, label: label, meta: meta, type: type });
        var labelInner = (thumb ? '<img class="command-thumb" src="' + escapeHtml(thumb) + '" alt="" />' : '') +
          '<span class="command-label-text">' + escapeHtml(label) + '</span>';
        out += '<div class="command-row" data-idx="' + idx + '" role="option"><span class="command-label">' + labelInner + '</span>' +
          (meta ? '<span class="command-meta">' + escapeHtml(meta) + '</span>' : '<span class="shortcut-hint"><span class="keycap">↵</span></span>') +
          '</div>';
      });
      if (showMore) {
        var moreIdx = visibleCommands.length;
        visibleCommands.push({
          kind: 'showMore',
          searchType: type,
          q: q
        });
        out += '<div class="command-row command-row-show-more" data-idx="' + moreIdx + '" role="option"><span class="command-show-more-inner"><span aria-hidden="true">+</span> Show more</span></div>';
      }
    });
    return out;
  }

  function pushLogoutRow(html) {
    var out = html;
    out += '<div class="command-section-title">Commands</div>';
    var cmdIdx = visibleCommands.length;
    visibleCommands.push({ kind: 'logout', path: '/admin-login', shortcut: ['B', 'Y', 'E'], label: 'Logout' });
    out += '<div class="command-row" data-idx="' + cmdIdx + '" role="option"><span class="command-label"><span class="command-label-text">Logout</span></span>' + shortcutMarkup(['B', 'Y', 'E']) + '</div>';
    return out;
  }

  function renderCommandRows(localRows, remoteData, query) {
    visibleCommands = [];
    var html = '';
    html = pushJumpRows(html, localRows);
    if (remoteData && remoteData.results && remoteData.results.length) {
      html = pushRemoteGroups(html, remoteData, query);
    }
    html = pushLogoutRow(html);

    commandSections.innerHTML = html;
    activeCommandIndex = 0;
    highlightActiveRow(true);
    commandSections.querySelectorAll('.command-row').forEach(function(row) {
      row.addEventListener('click', function() {
        activeCommandIndex = Number(row.getAttribute('data-idx'));
        highlightActiveRow(true);
        activateSelectedCommand();
      });
    });
  }

  function highlightActiveRow(scroll) {
    if (!commandSections) return;
    if (visibleCommands.length === 0) return;
    if (activeCommandIndex < 0) activeCommandIndex = 0;
    if (activeCommandIndex >= visibleCommands.length) activeCommandIndex = visibleCommands.length - 1;
    var activeEl = null;
    commandSections.querySelectorAll('.command-row').forEach(function(row) {
      var isActive = Number(row.getAttribute('data-idx')) === activeCommandIndex;
      row.classList.toggle('active', isActive);
      if (isActive) activeEl = row;
    });
    if (scroll && activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function activateSelectedCommand() {
    var c = visibleCommands[activeCommandIndex];
    if (!c) return;
    if (c.kind === 'showMore') {
      var u = '/app/search?types=' + encodeURIComponent(c.searchType) + '&q=' + encodeURIComponent(c.q || '');
      navigate(u);
      return;
    }
    if (c.kind === 'logout') {
      window.location.href = c.path || '/admin-login';
      return;
    }
    navigate(c.path || '/app/products');
  }

  function renderSearch() {
    setTitle('Search');
    var params = new URLSearchParams(window.location.search || '');
    var q = (params.get('q') || '').trim();
    var types = (params.get('types') || '').trim();
    if (!q) {
      content.innerHTML = '<div class="card"><p class="empty">Enter a search from the command palette (⌘K / Ctrl+K) or add <code>?q=</code> to the URL.</p></div>';
      return;
    }
    showLoading();
    var url = '/admin/search?q=' + encodeURIComponent(q) + '&limit=25';
    if (types) url += '&types=' + encodeURIComponent(types);
    api(url).then(function(r) { return r.json(); })
      .then(function(data) {
        var groups = (data && data.results) ? data.results : [];
        var hasAny = groups.some(function(g) { return (g.items || []).length > 0; });
        if (!hasAny) {
          content.innerHTML = '<div class="card"><p class="empty">No results for “' + escapeHtml(q) + '”.</p></div>';
          return;
        }
        var parts = groups.map(function(group) {
          var items = group.items || [];
          if (!items.length) return '';
          var title = humanizeSearchType(group.type);
          var rows = items.map(function(item) {
            var label = primaryItemLabel(item);
            var meta = itemMetaRight(item);
            var path = pathForSearchResult(group.type, item);
            return '<tr style="cursor:pointer;" data-href="' + escapeHtml(path) + '"><td>' + escapeHtml(label) + '</td><td style="color:#64748b;">' + escapeHtml(group.type || '') + '</td><td style="color:#9ca3af;">' + escapeHtml(meta) + '</td></tr>';
          }).join('');
          return '<div class="card" style="margin-bottom:1rem;"><h2 style="margin:0 0 0.75rem;font-size:1rem;color:#6b7280;">' + escapeHtml(title) + '</h2>' +
            '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>ID / SKU</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
        }).join('');
        content.innerHTML = '<div class="card" style="margin-bottom:1rem;"><p style="margin:0;color:#64748b;font-size:0.9rem;">Results for <strong>' + escapeHtml(q) + '</strong>' + (types ? ' · type <strong>' + escapeHtml(types) + '</strong>' : '') + '</p></div>' + parts;
        content.querySelectorAll('tbody tr[data-href]').forEach(function(tr) {
          tr.addEventListener('click', function() {
            navigate(tr.getAttribute('data-href'));
          });
        });
      })
      .catch(function() { showError('Search request failed.'); });
  }

  function openCommandModal() {
    if (!commandModal) return;
    commandModal.classList.remove('hidden');
    commandModal.setAttribute('aria-hidden', 'false');
    commandInput.value = '';
    renderCommandRows(jumpCommands, null, '');
    setTimeout(function() { commandInput.focus(); }, 10);
  }

  function closeCommandModal() {
    if (!commandModal) return;
    commandModal.classList.add('hidden');
    commandModal.setAttribute('aria-hidden', 'true');
  }

  function loadCommandSearch(q) {
    var trimmed = (q || '').trim();
    var local = jumpCommands.filter(function(c) { return jumpCommandMatches(c, trimmed); });
    if (!trimmed) {
      renderCommandRows(jumpCommands, null, '');
      return;
    }
    if (commandTimer) clearTimeout(commandTimer);
    commandTimer = setTimeout(function() {
      api('/admin/search?q=' + encodeURIComponent(trimmed) + '&limit=' + PALETTE_PREVIEW_PER_TYPE)
        .then(function(r) { return r.json(); })
        .then(function(data) { renderCommandRows(local, data || {}, trimmed); })
        .catch(function() { renderCommandRows(local, { results: [] }, trimmed); });
    }, 200);
  }

  if (commandClear && commandInput) {
    commandClear.addEventListener('click', function() {
      commandInput.value = '';
      loadCommandSearch('');
      commandInput.focus();
    });
  }

  if (commandInput) {
    commandInput.addEventListener('input', function() { loadCommandSearch(commandInput.value); });
    commandInput.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (visibleCommands.length) {
          activeCommandIndex = Math.min(visibleCommands.length - 1, activeCommandIndex + 1);
          highlightActiveRow(true);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (visibleCommands.length) {
          activeCommandIndex = Math.max(0, activeCommandIndex - 1);
          highlightActiveRow(true);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        activateSelectedCommand();
      } else if (e.key === 'Escape') {
        closeCommandModal();
      }
    });
  }

  if (commandModal) {
    commandModal.addEventListener('click', function(e) {
      if (e.target === commandModal) closeCommandModal();
    });
  }

  document.addEventListener('keydown', function(e) {
    var isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
    if (isCmdK) {
      e.preventDefault();
      openCommandModal();
      return;
    }
    if (e.key === 'Escape') {
      closeCommandModal();
      closeAccountMenu();
      clearShortcutSequence();
      return;
    }

    if (commandModal && !commandModal.classList.contains('hidden')) return;

    var tag = e.target && e.target.tagName ? String(e.target.tagName).toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var k = keyFromEvent(e);
    if (!k) return;

    if (shortcutSeqBuffer.length === 0) {
      if (k === 'G') {
        e.preventDefault();
        shortcutSeqBuffer = ['G'];
        scheduleShortcutSequenceEnd();
      }
      return;
    }

    e.preventDefault();
    shortcutSeqBuffer.push(k);
    if (tryMatchShortcutSequence()) {
      clearShortcutSequence();
      return;
    }
    scheduleShortcutSequenceEnd();
  });

  if (accountMenuTrigger && accountMenu) {
    accountMenuTrigger.addEventListener('click', function(e) {
      e.preventDefault();
      if (accountMenu.classList.contains('hidden')) {
        openAccountMenu();
      } else {
        closeAccountMenu();
      }
    });
    document.addEventListener('click', function(e) {
      if (!accountMenu.contains(e.target) && !accountMenuTrigger.contains(e.target)) {
        closeAccountMenu();
      }
    });
  }
  wireProductExportDrawer();
  wireProductImportModal();
  if (window.ProductCreateUI) {
    ProductCreateUI.init({
      onCommit: function() {
        if (getPage() === 'product-detail') {
          renderProductDetail();
          return;
        }
        if (getPage() !== 'products') return;
        productUi.localCatalog = null;
        productUi.page = 1;
        productUi.selectedIndex = 0;
        productUi.q = '';
        var si = document.getElementById('productSearchInput');
        if (si) si.value = '';
        hideProductSearchSuggest();
        refreshProductImportBanner();
        renderProductFilterPills();
        loadProductsTable();
      }
    });
  }
  window.addEventListener('popstate', init);
  init();
})();
