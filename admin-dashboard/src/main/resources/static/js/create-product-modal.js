/**
 * Medusa-style Create Product flow (Details → Organize → Variants).
 * After a successful POST /admin/products, calls onCommit for UI refresh (catalog is persisted by products-service).
 */
(function(global) {
  'use strict';

  var hooks = { onCommit: null };
  var wired = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function api(path) {
    return fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
  }

  var st = {
    open: false,
    tab: 'details',
    title: '',
    subtitle: '',
    handle: '',
    description: '',
    hasVariants: false,
    discountable: true,
    typeId: '',
    collectionId: '',
    categoryIds: [],
    tagValues: [],
    shippingProfileId: '',
    salesChannels: [],
    options: [],
    variants: [],
    selectedIdx: new Set(),
    focusIdx: 0,
    anchorIdx: 0,
    undo: [],
    redo: [],
    clipboard: null,
    types: [],
    collections: [],
    categories: [],
    tags: [],
    salesList: [],
    mediaFiles: [],
    optionIdSeq: 1
  };

  var keyHandlerBound = false;

  function uid(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function pushUndo() {
    st.undo.push(
      JSON.stringify({
        options: st.options.map(function(o) {
          return { id: o.id, title: o.title, values: o.values.slice() };
        }),
        variants: st.variants.map(function(v) {
          return {
            id: v.id,
            title: v.title,
            sku: v.sku,
            priceUsd: v.priceUsd,
            priceEur: v.priceEur,
            combo: v.combo ? v.combo.slice() : [],
            included: v.included !== false,
            manage_inventory: !!v.manage_inventory,
            allow_backorder: !!v.allow_backorder,
            inventory_kit: !!v.inventory_kit
          };
        })
      })
    );
    if (st.undo.length > 50) st.undo.shift();
    st.redo = [];
  }

  function applyUndoSnap(json) {
    var o = JSON.parse(json);
    st.options = o.options;
    st.variants = (o.variants || []).map(function(v) {
      return Object.assign(
        {
          included: true,
          manage_inventory: false,
          allow_backorder: false,
          inventory_kit: false
        },
        v
      );
    });
    st.selectedIdx.clear();
    st.focusIdx = 0;
    renderOptionEditors();
    renderVariantMatrix();
  }

  function doUndo() {
    if (!st.undo.length) return;
    var cur = JSON.stringify({
      options: st.options,
      variants: st.variants
    });
    st.redo.push(cur);
    applyUndoSnap(st.undo.pop());
  }

  function doRedo() {
    if (!st.redo.length) return;
    var cur = JSON.stringify({
      options: st.options,
      variants: st.variants
    });
    st.undo.push(cur);
    applyUndoSnap(st.redo.pop());
  }

  function slugify(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'product';
  }

  function combinations(optionList) {
    if (!optionList.length) return [[]];
    var tail = combinations(optionList.slice(1));
    var v0 = optionList[0].values && optionList[0].values.length ? optionList[0].values : [''];
    var out = [];
    for (var i = 0; i < v0.length; i++) {
      for (var t = 0; t < tail.length; t++) {
        out.push([v0[i]].concat(tail[t]));
      }
    }
    return out;
  }

  function regenerateVariants(skipUndo) {
    if (!skipUndo) pushUndo();
    if (!st.hasVariants) {
      var prev0 = st.variants[0];
      st.variants = [
        {
          id: uid('v'),
          title: 'Default',
          sku: '',
          priceUsd: prev0 ? prev0.priceUsd : '',
          priceEur: prev0 ? prev0.priceEur : '',
          combo: [],
          included: true,
          manage_inventory: prev0 ? !!prev0.manage_inventory : false,
          allow_backorder: prev0 ? !!prev0.allow_backorder : false,
          inventory_kit: prev0 ? !!prev0.inventory_kit : false
        }
      ];
      st.selectedIdx.clear();
      st.focusIdx = 0;
      st.anchorIdx = 0;
      if (st.variants.length) st.selectedIdx.add(0);
      renderVariantMatrix();
      return;
    }
    var combos = combinations(st.options);
    var priceMap = {};
    st.variants.forEach(function(v) {
      var k = (v.combo || []).join('\0');
      priceMap[k] = {
        usd: v.priceUsd,
        eur: v.priceEur,
        sku: v.sku,
        title: v.title,
        included: v.included,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
        inventory_kit: v.inventory_kit
      };
    });
    st.variants = [];
    for (var i = 0; i < combos.length; i++) {
      var combo = combos[i];
      var k = combo.join('\0');
      var prev = priceMap[k] || {};
      var defaultTitle = combo.join(' / ');
      st.variants.push({
        id: uid('v'),
        title: prev.title != null && String(prev.title).trim() ? prev.title : defaultTitle,
        sku: prev.sku != null ? prev.sku : '',
        priceUsd: prev.usd != null ? prev.usd : '',
        priceEur: prev.eur != null ? prev.eur : '',
        combo: combo,
        included: prev.included !== false,
        manage_inventory: !!prev.manage_inventory,
        allow_backorder: !!prev.allow_backorder,
        inventory_kit: !!prev.inventory_kit
      });
    }
    st.selectedIdx.clear();
    st.focusIdx = 0;
    st.anchorIdx = 0;
    if (st.variants.length) st.selectedIdx.add(0);
    renderVariantMatrix();
  }

  function syncFormFromDomDetails() {
    st.title = ($('pcFieldTitle') && $('pcFieldTitle').value) || '';
    st.subtitle = ($('pcFieldSubtitle') && $('pcFieldSubtitle').value) || '';
    st.handle = ($('pcFieldHandle') && $('pcFieldHandle').value) || '';
    st.description = ($('pcFieldDescription') && $('pcFieldDescription').value) || '';
    var hv = $('pcHasVariants') && $('pcHasVariants').checked;
    st.hasVariants = hv;
    if ($('pcHasVariantsMirror')) $('pcHasVariantsMirror').checked = hv;
  }

  function syncOrganizeFromDom() {
    st.discountable = $('pcDiscountable') && $('pcDiscountable').checked;
    st.typeId = ($('pcSelectType') && $('pcSelectType').value) || '';
    st.collectionId = ($('pcSelectCollection') && $('pcSelectCollection').value) || '';
    st.shippingProfileId = ($('pcShippingProfile') && $('pcShippingProfile').value) || '';
    var catSel = $('pcCategories');
    st.categoryIds = [];
    if (catSel) {
      for (var i = 0; i < catSel.options.length; i++) {
        if (catSel.options[i].selected) st.categoryIds.push(catSel.options[i].value);
      }
    }
    var tagSel = $('pcTags');
    st.tagValues = [];
    if (tagSel) {
      for (var j = 0; j < tagSel.options.length; j++) {
        if (tagSel.options[j].selected) st.tagValues.push(tagSel.options[j].value);
      }
    }
  }

  function activeVariantNs() {
    if (st.tab === 'details') return 'details';
    if (st.tab === 'variants') return 'variants';
    return 'variants';
  }

  function activeOptionsContainer() {
    if (st.tab === 'details') return $('pcOptionsContainerDetails');
    if (st.tab === 'variants') return $('pcOptionsContainer');
    return null;
  }

  function syncDetailsVariantsSectionVisibility() {
    var inner = $('pcDetailsVariantsInner');
    if (!inner) return;
    var show = !!st.hasVariants;
    inner.classList.toggle('hidden', !show);
    inner.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function variantNamespacesForRender() {
    var out = ['variants'];
    if (st.hasVariants) out.push('details');
    return out;
  }

  function readVariantRowsFromDom() {
    if (st.tab !== 'details' && st.tab !== 'variants') return;
    var ns = activeVariantNs();
    st.variants.forEach(function(v, idx) {
      var pu = $('pcPriceUsd-' + ns + '-' + idx);
      var pe = $('pcPriceEur-' + ns + '-' + idx);
      if (pu) v.priceUsd = pu.value;
      if (pe) v.priceEur = pe.value;
      var sk = $('pcSku-' + ns + '-' + idx);
      if (sk) v.sku = sk.value;
      var ti = $('pcTitle-' + ns + '-' + idx);
      if (ti) v.title = ti.value;
      var inc = $('pcIncluded-' + ns + '-' + idx);
      if (inc) v.included = inc.checked;
      var mi = $('pcManageInv-' + ns + '-' + idx);
      if (mi) v.manage_inventory = mi.checked;
      var ab = $('pcAllowBo-' + ns + '-' + idx);
      if (ab) v.allow_backorder = ab.checked;
      var kit = $('pcInvKit-' + ns + '-' + idx);
      if (kit) v.inventory_kit = kit.checked;
    });
  }

  function readOptionsFromDom() {
    var wrap = activeOptionsContainer();
    if (!wrap) return;
    st.options = [];
    wrap.querySelectorAll('.pc-option-block').forEach(function(block) {
      var oid = block.getAttribute('data-option-id');
      var titleInp = block.querySelector('.pc-option-title');
      var title = titleInp ? titleInp.value.trim() : '';
      var vals = [];
      block.querySelectorAll('.pc-option-chip').forEach(function(chip) {
        var t = chip.getAttribute('data-value');
        if (t) vals.push(t);
      });
      st.options.push({ id: oid, title: title, values: vals });
    });
  }

  function renderOptionEditors() {
    var html = st.options
      .map(function(opt) {
        var chips = opt.values
          .map(function(v) {
            return (
              '<span class="pc-option-chip" data-value="' +
              esc(v) +
              '">' +
              esc(v) +
              ' <button type="button" class="pc-chip-x" aria-label="Remove">×</button></span>'
            );
          })
          .join('');
        return (
          '<div class="pc-option-block" data-option-id="' +
          esc(opt.id) +
          '">' +
          '<div class="pc-option-block-head">' +
          '<input type="text" class="pc-option-title" placeholder="e.g. color" value="' +
          esc(opt.title) +
          '" />' +
          '<button type="button" class="pc-option-remove" aria-label="Remove option">×</button></div>' +
          '<div class="pc-option-values-row">' +
          chips +
          '<input type="text" class="pc-option-value-input" placeholder="Add value, Enter" /></div></div>'
        );
      })
      .join('');
    [$('pcOptionsContainer'), $('pcOptionsContainerDetails')].forEach(function(wrap) {
      if (wrap) wrap.innerHTML = html;
    });
    [$('pcOptionsContainer'), $('pcOptionsContainerDetails')].forEach(function(wrap) {
      if (!wrap) return;
      wrap.querySelectorAll('.pc-option-block').forEach(function(block) {
      block.addEventListener('click', function(e) {
        if (e.target.classList.contains('pc-chip-x')) {
          e.preventDefault();
          var chip = e.target.closest('.pc-option-chip');
          if (!chip) return;
          pushUndo();
          readOptionsFromDom();
          var oid = block.getAttribute('data-option-id');
          var o = st.options.find(function(x) {
            return x.id === oid;
          });
          if (o) {
            var val = chip.getAttribute('data-value');
            o.values = o.values.filter(function(v) {
              return v !== val;
            });
          }
          renderOptionEditors();
          regenerateVariants(false);
          return;
        }
        if (e.target.classList.contains('pc-option-remove')) {
          e.preventDefault();
          pushUndo();
          readOptionsFromDom();
          var id2 = block.getAttribute('data-option-id');
          st.options = st.options.filter(function(x) {
            return x.id !== id2;
          });
          renderOptionEditors();
          regenerateVariants(false);
        }
      });
      var vin = block.querySelector('.pc-option-value-input');
      if (vin) {
        vin.addEventListener('keydown', function(e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          var t = vin.value.trim();
          if (!t) return;
          pushUndo();
          readOptionsFromDom();
          var oid = block.getAttribute('data-option-id');
          var o = st.options.find(function(x) {
            return x.id === oid;
          });
          if (o && o.values.indexOf(t) < 0) o.values.push(t);
          vin.value = '';
          renderOptionEditors();
          regenerateVariants(false);
        });
      }
    });
    });
    updateVariantOptionsError();
  }

  function updateVariantOptionsError() {
    var show = st.hasVariants && st.options.length === 0;
    [$('pcVariantOptionsError'), $('pcVariantOptionsErrorDetails')].forEach(function(err) {
      if (err) err.classList.toggle('hidden', !show);
    });
  }

  function variantGridTemplateColumns() {
    var parts = ['36px', '28px'];
    if (st.options.length) {
      for (var oi = 0; oi < st.options.length; oi++) {
        parts.push('minmax(72px, 1fr)');
      }
    } else {
      parts.push('minmax(100px, 1.2fr)');
    }
    parts.push('minmax(120px, 1.15fr)', 'minmax(88px, 1fr)', '40px', '40px', '40px', 'minmax(72px, 0.95fr)', 'minmax(72px, 0.95fr)');
    return parts.join(' ');
  }

  function renderVariantMatrixForNs(ns) {
    var list = ns === 'details' ? $('pcVariantListDetails') : $('pcVariantList');
    if (!list) return;
    if (!st.variants.length) {
      list.innerHTML = '<p class="pc-muted">No variants yet.</p>';
      return;
    }
    var gridId = 'pcVariantGrid-' + ns;
    var colStyle = variantGridTemplateColumns();
    var optTitles = st.options.map(function(o) {
      return o.title || 'Option';
    });
    var hint =
      optTitles.length > 0
        ? '<p class="pc-variant-hint">One column per option: ' +
          esc(optTitles.join(', ')) +
          ' — ranking affects storefront order.</p>'
        : '';
    var headCells = '<span class="pc-variant-th-check"><input type="checkbox" id="pcSelectAll-' + esc(ns) + '" title="Select all" aria-label="Select all variants" /></span>';
    headCells += '<span class="pc-variant-th-drag" aria-hidden="true"></span>';
    if (st.options.length) {
      for (var hi = 0; hi < optTitles.length; hi++) {
        headCells += '<span class="pc-variant-th-opt">' + esc(optTitles[hi]) + '</span>';
      }
    } else {
      headCells += '<span class="pc-variant-th-opt">Options</span>';
    }
    headCells +=
      '<span class="pc-variant-th-narrow">Title</span>' +
      '<span class="pc-variant-th-narrow">SKU</span>' +
      '<span class="pc-variant-th-check-h" title="Managed inventory">Inv.</span>' +
      '<span class="pc-variant-th-check-h" title="Allow backorder">BO</span>' +
      '<span class="pc-variant-th-check-h" title="Has inventory kit">Kit</span>' +
      '<span>Price USD</span>' +
      '<span>Price EUR</span>';
    var allInc = st.variants.length && st.variants.every(function(v) {
      return v.included !== false;
    });
    var someInc = st.variants.some(function(v) {
      return v.included !== false;
    });
    var rows = st.variants
      .map(function(v, idx) {
        var sel = st.selectedIdx.has(idx) ? ' is-selected' : '';
        var foc = idx === st.focusIdx ? ' is-focused' : '';
        var comboCells = '';
        if (st.options.length) {
          var combo = v.combo || [];
          for (var ci = 0; ci < st.options.length; ci++) {
            comboCells +=
              '<span class="pc-variant-combo-cell">' +
              esc((combo[ci] != null && String(combo[ci]).trim() !== '' ? combo[ci] : '') || '—') +
              '</span>';
          }
        } else {
          comboCells = '<span class="pc-variant-combo-cell">—</span>';
        }
        var inc = v.included !== false;
        return (
          '<div class="pc-variant-row' +
          sel +
          foc +
          '" role="row" data-vidx="' +
          idx +
          '" data-grid-ns="' +
          esc(ns) +
          '">' +
          '<span class="pc-variant-cell-check"><input type="checkbox" class="pc-included-cb" id="pcIncluded-' +
          esc(ns) +
          '-' +
          idx +
          '"' +
          (inc ? ' checked' : '') +
          ' title="Create this variant" aria-label="Include variant" /></span>' +
          '<span class="pc-variant-drag" draggable="true" aria-hidden="true" title="Drag to reorder">⋮⋮</span>' +
          comboCells +
          '<input type="text" class="pc-variant-title-input pc-variant-cell" id="pcTitle-' +
          esc(ns) +
          '-' +
          idx +
          '" value="' +
          esc(v.title) +
          '" />' +
          '<input type="text" class="pc-sku pc-variant-cell" id="pcSku-' +
          esc(ns) +
          '-' +
          idx +
          '" value="' +
          esc(v.sku) +
          '" />' +
          '<span class="pc-variant-cell-check"><input type="checkbox" id="pcManageInv-' +
          esc(ns) +
          '-' +
          idx +
          '"' +
          (v.manage_inventory ? ' checked' : '') +
          ' title="Managed inventory" aria-label="Managed inventory" /></span>' +
          '<span class="pc-variant-cell-check"><input type="checkbox" id="pcAllowBo-' +
          esc(ns) +
          '-' +
          idx +
          '"' +
          (v.allow_backorder ? ' checked' : '') +
          ' title="Allow backorder" aria-label="Allow backorder" /></span>' +
          '<span class="pc-variant-cell-check"><input type="checkbox" id="pcInvKit-' +
          esc(ns) +
          '-' +
          idx +
          '"' +
          (v.inventory_kit ? ' checked' : '') +
          ' title="Has inventory kit" aria-label="Has inventory kit" /></span>' +
          '<span class="pc-variant-price-wrap"><span class="pc-currency">$</span><input type="number" step="0.01" class="pc-variant-price pc-variant-cell" id="pcPriceUsd-' +
          esc(ns) +
          '-' +
          idx +
          '" value="' +
          esc(v.priceUsd) +
          '" /></span>' +
          '<span class="pc-variant-price-wrap"><span class="pc-currency">€</span><input type="number" step="0.01" class="pc-variant-price pc-variant-cell" id="pcPriceEur-' +
          esc(ns) +
          '-' +
          idx +
          '" value="' +
          esc(v.priceEur) +
          '" /></span></div>'
        );
      })
      .join('');
    list.innerHTML =
      hint +
      '<div class="pc-variant-table" role="grid" tabindex="0" id="' +
      esc(gridId) +
      '" aria-label="Product variants" style="--pc-variant-cols: ' +
      colStyle +
      '">' +
      '<div class="pc-variant-thead">' +
      headCells +
      '</div>' +
      rows +
      '</div>';
    var master = $('pcSelectAll-' + ns);
    if (master) {
      master.checked = allInc;
      master.indeterminate = !allInc && someInc;
      master.onchange = function() {
        readVariantRowsFromDom();
        var on = master.checked;
        st.variants.forEach(function(v) {
          v.included = on;
        });
        renderVariantMatrix();
      };
    }
    var grid = $(gridId);
    if (grid) {
      grid.onkeydown = variantGridKeydown;
      grid.onchange = function(e) {
        var t = e.target;
        if (!t || t.type !== 'checkbox') return;
        var id = t.id || '';
        var m = id.match(/^pc(ManageInv|AllowBo|InvKit|Included)-(details|variants)-(\d+)$/);
        if (!m) return;
        var idx = Number(m[3]);
        var v = st.variants[idx];
        if (!v) return;
        if (m[1] === 'Included') v.included = t.checked;
        if (m[1] === 'ManageInv') v.manage_inventory = t.checked;
        if (m[1] === 'AllowBo') v.allow_backorder = t.checked;
        if (m[1] === 'InvKit') v.inventory_kit = t.checked;
        renderVariantMatrix();
      };
      grid.onclick = function(e) {
        if (e.target.closest && e.target.closest('input[type="checkbox"]')) return;
        if (e.target.closest && e.target.closest('.pc-variant-price-wrap')) return;
        if (
          e.target.closest &&
          e.target.closest('input:not([type="checkbox"]), textarea, select, button, label')
        ) {
          return;
        }
        var row = e.target.closest('.pc-variant-row');
        if (!row) return;
        var idx = Number(row.getAttribute('data-vidx'));
        if (e.shiftKey) {
          var a = Math.min(st.anchorIdx, idx);
          var b = Math.max(st.anchorIdx, idx);
          st.selectedIdx.clear();
          for (var k = a; k <= b; k++) st.selectedIdx.add(k);
        } else {
          st.anchorIdx = idx;
          st.focusIdx = idx;
          st.selectedIdx.clear();
          st.selectedIdx.add(idx);
        }
        renderVariantMatrix();
        var g = $(gridId);
        if (g) g.focus();
      };
      grid.ondragstart = function(e) {
        var dragEl = e.target;
        if (dragEl && dragEl.nodeType === 3 && dragEl.parentElement) dragEl = dragEl.parentElement;
        if (!dragEl || !dragEl.closest || !dragEl.closest('.pc-variant-drag')) {
          e.preventDefault();
          return;
        }
        var row = dragEl.closest('.pc-variant-row');
        if (!row) return;
        e.dataTransfer.setData('text/plain', row.getAttribute('data-vidx'));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('is-dragging');
      };
      grid.ondragend = function(e) {
        var row = e.target.closest('.pc-variant-row');
        if (row) row.classList.remove('is-dragging');
      };
      grid.ondragover = function(e) {
        e.preventDefault();
      };
      grid.ondrop = function(e) {
        e.preventDefault();
        var from = Number(e.dataTransfer.getData('text/plain'));
        var row = e.target.closest('.pc-variant-row');
        if (row == null) return;
        var to = Number(row.getAttribute('data-vidx'));
        if (from === to || Number.isNaN(from) || Number.isNaN(to)) return;
        pushUndo();
        readVariantRowsFromDom();
        var item = st.variants.splice(from, 1)[0];
        st.variants.splice(to, 0, item);
        st.selectedIdx.clear();
        st.focusIdx = to;
        st.selectedIdx.add(to);
        renderVariantMatrix();
      };
    }
  }

  function renderVariantMatrix() {
    variantNamespacesForRender().forEach(function(ns) {
      renderVariantMatrixForNs(ns);
    });
    if (!st.hasVariants && $('pcVariantListDetails')) {
      $('pcVariantListDetails').innerHTML = '';
    }
  }

  function activeVariantGridId() {
    return 'pcVariantGrid-' + activeVariantNs();
  }

  function variantGridKeydown(e) {
    if (st.tab !== 'variants' && st.tab !== 'details') return;
    var meta = e.metaKey || e.ctrlKey;
    var shift = e.shiftKey;
    var k = e.key;

    if (meta && k === 'z') {
      e.preventDefault();
      if (shift) doRedo();
      else doUndo();
      return;
    }
    if (meta && k === 'c') {
      e.preventDefault();
      copySelectedVariants();
      return;
    }
    if (meta && k === 'v') {
      e.preventDefault();
      pasteVariants();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      var ns = activeVariantNs();
      var inp =
        $('pcTitle-' + ns + '-' + st.focusIdx) ||
        $('pcSku-' + ns + '-' + st.focusIdx) ||
        $('pcPriceUsd-' + ns + '-' + st.focusIdx);
      if (inp) inp.focus();
      return;
    }
    if (k === 'Backspace' || k === 'Delete') {
      if (e.target.tagName === 'INPUT') return;
      e.preventDefault();
      deleteSelectedVariants();
      return;
    }
    if (k === ' ' || k === 'Spacebar') {
      var gid = activeVariantGridId();
      var g = $(gid);
      if (
        g &&
        (e.target === g || (e.target.closest && e.target.closest('#' + gid) === g)) &&
        e.target.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        clearSelectedPrices();
        return;
      }
    }
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
      if (e.target.tagName === 'INPUT' && !meta) return;
      e.preventDefault();
      var n = st.variants.length;
      if (!n) return;
      var delta = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1;
      if (meta && (k === 'ArrowDown' || k === 'ArrowUp')) {
        st.focusIdx = k === 'ArrowDown' ? n - 1 : 0;
        st.anchorIdx = st.focusIdx;
        if (shift) {
          st.selectedIdx.clear();
          var a = Math.min(st.anchorIdx, st.focusIdx);
          var b = Math.max(st.anchorIdx, st.focusIdx);
          for (var i = a; i <= b; i++) st.selectedIdx.add(i);
        } else {
          st.selectedIdx.clear();
          st.selectedIdx.add(st.focusIdx);
        }
      } else if (shift && (k === 'ArrowDown' || k === 'ArrowUp')) {
        var next = Math.max(0, Math.min(n - 1, st.focusIdx + delta));
        st.focusIdx = next;
        var lo = Math.min(st.anchorIdx, st.focusIdx);
        var hi = Math.max(st.anchorIdx, st.focusIdx);
        st.selectedIdx.clear();
        for (var j = lo; j <= hi; j++) st.selectedIdx.add(j);
      } else if (meta && shift && (k === 'ArrowDown' || k === 'ArrowUp')) {
        var colFrom = st.focusIdx;
        var lo2 = k === 'ArrowDown' ? colFrom : 0;
        var hi2 = k === 'ArrowDown' ? n - 1 : colFrom;
        st.selectedIdx.clear();
        for (var c = lo2; c <= hi2; c++) st.selectedIdx.add(c);
        st.focusIdx = k === 'ArrowDown' ? n - 1 : 0;
      } else {
        st.focusIdx = Math.max(0, Math.min(n - 1, st.focusIdx + delta));
        if (!shift) {
          st.anchorIdx = st.focusIdx;
          st.selectedIdx.clear();
          st.selectedIdx.add(st.focusIdx);
        } else {
          var L = Math.min(st.anchorIdx, st.focusIdx);
          var H = Math.max(st.anchorIdx, st.focusIdx);
          st.selectedIdx.clear();
          for (var z = L; z <= H; z++) st.selectedIdx.add(z);
        }
      }
      renderVariantMatrix();
      var g2 = $(activeVariantGridId());
      if (g2) g2.focus();
      return;
    }
  }

  function copySelectedVariants() {
    readVariantRowsFromDom();
    var idxs = Array.from(st.selectedIdx).sort(function(a, b) {
      return a - b;
    });
    if (!idxs.length) return;
    st.clipboard = idxs.map(function(i) {
      return Object.assign({}, st.variants[i]);
    });
  }

  function pasteVariants() {
    if (!st.clipboard || !st.clipboard.length) return;
    pushUndo();
    readVariantRowsFromDom();
    st.clipboard.forEach(function(v) {
      st.variants.push({
        id: uid('v'),
        title: v.title,
        sku: v.sku,
        priceUsd: v.priceUsd,
        priceEur: v.priceEur,
        combo: v.combo ? v.combo.slice() : [],
        included: v.included !== false,
        manage_inventory: !!v.manage_inventory,
        allow_backorder: !!v.allow_backorder,
        inventory_kit: !!v.inventory_kit
      });
    });
    renderVariantMatrix();
  }

  function deleteSelectedVariants() {
    if (!st.selectedIdx.size) return;
    pushUndo();
    readVariantRowsFromDom();
    var idxs = Array.from(st.selectedIdx).sort(function(a, b) {
      return b - a;
    });
    idxs.forEach(function(i) {
      st.variants.splice(i, 1);
    });
    st.selectedIdx.clear();
    st.focusIdx = Math.min(st.focusIdx, st.variants.length - 1);
    if (st.focusIdx < 0) st.focusIdx = 0;
    renderVariantMatrix();
  }

  function clearSelectedPrices() {
    readVariantRowsFromDom();
    st.selectedIdx.forEach(function(i) {
      var v = st.variants[i];
      if (v) {
        v.priceUsd = '';
        v.priceEur = '';
      }
    });
    renderVariantMatrix();
  }

  function globalKeydown(e) {
    if (!st.open) return;
    var sb = $('pcShortcutsBackdrop');
    if (sb && !sb.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeShortcuts();
      }
      return;
    }
    if (
      (st.tab === 'variants' || st.tab === 'details') &&
      $(activeVariantGridId()) &&
      document.activeElement &&
      $('productCreateBackdrop') &&
      $('productCreateBackdrop').contains(document.activeElement)
    ) {
      var ae = document.activeElement;
      if (ae.tagName === 'TEXTAREA') return;
      if (
        ae.tagName === 'INPUT' &&
        (ae.classList.contains('pc-variant-price') ||
          ae.classList.contains('pc-sku') ||
          ae.classList.contains('pc-variant-title-input'))
      ) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var mm = ae.id.match(/^pc(PriceUsd|PriceEur|Sku|Title)-(details|variants)-(\d+)$/);
          if (!mm) return;
          var field = mm[1];
          var gns = mm[2];
          var idx = Number(mm[3]);
          if (Number.isNaN(idx)) return;
          var delta = e.key === 'ArrowDown' ? 1 : -1;
          var ni = Math.max(0, Math.min(st.variants.length - 1, idx + delta));
          var next = $('pc' + field + '-' + gns + '-' + ni);
          if (next) next.focus();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' || e.key === 'c' || e.key === 'v') {
          variantGridKeydown(e);
          return;
        }
      }
      var agid = activeVariantGridId();
      if (ae.id === agid || ae.classList.contains('pc-variant-row')) {
        variantGridKeydown(e);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === ',') {
      e.preventDefault();
      var t = $('pcVariantToolbar');
      if (t) t.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === '.') {
      e.preventDefault();
      var c = $('productCreateCancel');
      if (c) c.focus();
    }
  }

  function setTab(name) {
    if (st.tab === 'details' || st.tab === 'variants') {
      readOptionsFromDom();
      readVariantRowsFromDom();
    }
    st.tab = name;
    ['details', 'organize', 'variants'].forEach(function(t) {
      var tabEl = $('productCreateTab-' + t);
      var panel = $('productCreatePanel-' + t);
      if (tabEl) tabEl.classList.toggle('is-active', t === name);
      if (tabEl) tabEl.setAttribute('aria-selected', t === name ? 'true' : 'false');
      if (panel) panel.classList.toggle('hidden', t !== name);
    });
    var tDet = $('productCreateTab-details');
    var tOrg = $('productCreateTab-organize');
    if (tDet) tDet.classList.toggle('is-done', name === 'organize' || name === 'variants');
    if (tOrg) tOrg.classList.toggle('is-done', name === 'variants');
    var cont = $('productCreateContinue');
    if (cont) cont.textContent = name === 'variants' ? 'Create product' : 'Continue';
    if (name === 'variants') {
      regenerateVariants(true);
    }
    if (name === 'details' || name === 'variants') {
      renderOptionEditors();
      renderVariantMatrix();
      updateVariantOptionsError();
    }
    syncDetailsVariantsSectionVisibility();
  }

  function validateDetails() {
    syncFormFromDomDetails();
    if (!String(st.title || '').trim()) {
      alert('Please enter a product title.');
      return false;
    }
    return true;
  }

  function validateVariants() {
    readOptionsFromDom();
    syncFormFromDomDetails();
    if (st.hasVariants) {
      if (!st.options.length) {
        alert('Please create at least one product option, or turn off variants.');
        return false;
      }
      for (var i = 0; i < st.options.length; i++) {
        if (!st.options[i].values.length) {
          alert('Each option needs at least one value (e.g. color → red).');
          return false;
        }
      }
    }
    readVariantRowsFromDom();
    var anyIncluded = st.variants.some(function(v) {
      return v.included !== false;
    });
    if (!anyIncluded) {
      alert('Select at least one variant to create (use the row checkboxes), or turn off variants for a single default variant.');
      return false;
    }
    return true;
  }

  function buildProductDto(status) {
    syncFormFromDomDetails();
    syncOrganizeFromDom();
    readOptionsFromDom();
    readVariantRowsFromDom();
    var handle = String(st.handle || '').trim() || slugify(st.title);
    var typeObj = null;
    if (st.typeId) {
      var tp = st.types.find(function(t) {
        return t.id === st.typeId;
      });
      typeObj = { id: st.typeId, value: (tp && (tp.value || tp.name)) || '' };
    }
    var variants = st.variants
      .filter(function(v) {
        return v.included !== false;
      })
      .map(function(v) {
        var prices = [];
        if (v.priceUsd !== '' && v.priceUsd != null && !isNaN(Number(v.priceUsd))) {
          var nu = Math.round(Number(v.priceUsd) * 100);
          prices.push({
            calculated_amount: nu,
            currency_code: 'usd',
            original_amount: nu
          });
        }
        if (v.priceEur !== '' && v.priceEur != null && !isNaN(Number(v.priceEur))) {
          var ne = Math.round(Number(v.priceEur) * 100);
          prices.push({
            calculated_amount: ne,
            currency_code: 'eur',
            original_amount: ne
          });
        }
        var calc = null;
        if (prices.length) {
          calc = {
            calculated_amount: prices[0].calculated_amount,
            currency_code: prices[0].currency_code,
            original_amount: prices[0].original_amount
          };
        }
        var meta = {};
        if (prices.length > 1) meta.extra_prices = prices.slice(1);
        if (v.inventory_kit) meta.inventory_kit = true;
        return {
          id: v.id,
          title: v.title,
          sku: v.sku || null,
          calculated_price: calc,
          options: null,
          manage_inventory: !!v.manage_inventory,
          allow_backorder: !!v.allow_backorder,
          inventory_quantity: null,
          metadata: Object.keys(meta).length ? meta : null
        };
      });
    var options = st.options.map(function(o) {
      return {
        id: o.id,
        title: o.title,
        values: o.values.slice()
      };
    });
    var thumb = '';
    if (st.mediaFiles.length && st.mediaFiles[0].dataUrl) thumb = st.mediaFiles[0].dataUrl;
    return {
      id: uid('prod'),
      title: st.title.trim(),
      handle: handle,
      description: st.description || '',
      thumbnail: thumb,
      status: status,
      type: typeObj,
      variants: variants,
      options: options.length ? options : null,
      metadata: {
        subtitle: st.subtitle,
        discountable: st.discountable,
        shipping_profile_id: st.shippingProfileId,
        category_ids: st.categoryIds,
        tags: st.tagValues,
        sales_channels: st.salesChannels
      },
      collection_id: st.collectionId || null
    };
  }

  function commit(mode) {
    var status = mode === 'draft' ? 'draft' : 'published';
    if (!validateDetails()) return;
    if (!validateVariants()) return;
    var dto = buildProductDto(status);
    var saveBtn = $('productCreateSaveDraft');
    var contBtn = $('productCreateContinue');
    if (saveBtn) saveBtn.disabled = true;
    if (contBtn) contBtn.disabled = true;
    fetch('/admin/products', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(dto)
    })
      .then(function(r) {
        return r.json().then(function(j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function(pair) {
        if (!pair.ok) {
          var msg =
            (pair.j && (pair.j.message || (pair.j.error && String(pair.j.error)))) ||
            'Could not create product (HTTP ' + pair.status + ').';
          throw new Error(msg);
        }
        closeModal();
        if (hooks.onCommit) hooks.onCommit();
      })
      .catch(function(err) {
        alert(err && err.message ? err.message : 'Create product failed.');
      })
      .then(function() {
        if (saveBtn) saveBtn.disabled = false;
        if (contBtn) contBtn.disabled = false;
      });
  }

  function onContinue() {
    if (st.tab === 'details') {
      if (!validateDetails()) return;
      setTab('organize');
      return;
    }
    if (st.tab === 'organize') {
      setTab('variants');
      return;
    }
    commit('published');
  }

  function onSaveDraft() {
    commit('draft');
  }

  function loadOrganizeLists() {
    return Promise.all([
      api('/admin/product-types').then(function(r) {
        return r.json();
      }),
      api('/admin/product-collections?limit=500').then(function(r) {
        return r.json();
      }),
      api('/admin/product-categories?limit=500').then(function(r) {
        return r.json();
      }),
      api('/admin/product-tags').then(function(r) {
        return r.json();
      }),
      api('/admin/sales-channels').then(function(r) {
        return r.json();
      })
    ])
      .then(function(parts) {
        st.types = (parts[0].product_types || parts[0].productTypes || []).slice();
        st.collections = (parts[1].collections || []).slice();
        st.categories = (parts[2].product_categories || []).slice();
        var rawTags = parts[3].tags || [];
        st.tags = normalizeTags(rawTags);
        st.salesList = (parts[4].sales_channels || []).slice();
        fillSelect(
          $('pcSelectType'),
          st.types.map(function(t) {
            return { value: t.id, label: t.value || t.name || t.id };
          }),
          true
        );
        fillSelect(
          $('pcSelectCollection'),
          st.collections.map(function(c) {
            return { value: c.id, label: c.title || c.handle || c.id };
          }),
          true
        );
        var catSel = $('pcCategories');
        if (catSel) {
          catSel.innerHTML = st.categories
            .map(function(c) {
              return '<option value="' + esc(c.id) + '">' + esc(c.name || c.handle || c.id) + '</option>';
            })
            .join('');
        }
        var tagSel = $('pcTags');
        if (tagSel) {
          tagSel.innerHTML = st.tags
            .map(function(t) {
              return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
            })
            .join('');
        }
        if (!st.salesChannels.length && st.salesList.length) {
          var def = st.salesList.find(function(s) {
            return /default/i.test(String(s.name || ''));
          });
          var pick = def || st.salesList[0];
          if (pick) st.salesChannels = [{ id: pick.id, name: pick.name || pick.id }];
          renderSalesChannelTags();
        }
      })
      .catch(function() {
        /* non-fatal */
      });
  }

  function normalizeTags(raw) {
    var out = [];
    var seen = {};
    (raw || []).forEach(function(t) {
      var s = typeof t === 'string' ? t : t && t.value != null ? String(t.value) : String(t);
      s = s.trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  function fillSelect(el, items, withEmpty) {
    if (!el) return;
    var opts = withEmpty ? '<option value="">—</option>' : '';
    opts += items
      .map(function(it) {
        return '<option value="' + esc(it.value) + '">' + esc(it.label) + '</option>';
      })
      .join('');
    el.innerHTML = opts;
  }

  function renderSalesChannelTags() {
    var row = $('pcSalesChannelTags');
    if (!row) return;
    row.innerHTML = st.salesChannels
      .map(function(ch) {
        return (
          '<span class="pc-channel-tag" data-id="' +
          esc(ch.id) +
          '">' +
          esc(ch.name) +
          ' <button type="button" class="pc-chip-x" aria-label="Remove">×</button></span>'
        );
      })
      .join('');
    row.querySelectorAll('.pc-chip-x').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tag = btn.closest('.pc-channel-tag');
        var id = tag && tag.getAttribute('data-id');
        st.salesChannels = st.salesChannels.filter(function(c) {
          return c.id !== id;
        });
        renderSalesChannelTags();
      });
    });
  }

  function openModal() {
    st.open = true;
    st.tab = 'details';
    st.title = '';
    st.subtitle = '';
    st.handle = '';
    st.description = '';
    st.hasVariants = false;
    st.discountable = true;
    st.typeId = '';
    st.collectionId = '';
    st.categoryIds = [];
    st.tagValues = [];
    st.shippingProfileId = '';
    st.salesChannels = [];
    st.options = [];
    st.variants = [];
    st.selectedIdx.clear();
    st.focusIdx = 0;
    st.anchorIdx = 0;
    st.undo = [];
    st.redo = [];
    st.clipboard = null;
    st.mediaFiles = [];
    st.optionIdSeq = 1;
    var b = $('productCreateBackdrop');
    if (b) {
      b.classList.remove('hidden');
      b.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('create-product-open');
    if ($('pcFieldTitle')) $('pcFieldTitle').value = '';
    if ($('pcFieldSubtitle')) $('pcFieldSubtitle').value = '';
    if ($('pcFieldHandle')) $('pcFieldHandle').value = '';
    if ($('pcFieldDescription')) $('pcFieldDescription').value = '';
    if ($('pcHasVariants')) $('pcHasVariants').checked = false;
    if ($('pcDiscountable')) $('pcDiscountable').checked = true;
    if ($('pcSelectType')) $('pcSelectType').value = '';
    if ($('pcSelectCollection')) $('pcSelectCollection').value = '';
    if ($('pcShippingProfile')) $('pcShippingProfile').value = '';
    if ($('pcCategories')) {
      for (var i = 0; i < $('pcCategories').options.length; i++) $('pcCategories').options[i].selected = false;
    }
    if ($('pcTags')) {
      for (var j = 0; j < $('pcTags').options.length; j++) $('pcTags').options[j].selected = false;
    }
    if ($('pcOptionsContainer')) $('pcOptionsContainer').innerHTML = '';
    if ($('pcOptionsContainerDetails')) $('pcOptionsContainerDetails').innerHTML = '';
    if ($('pcVariantList')) $('pcVariantList').innerHTML = '';
    if ($('pcVariantListDetails')) $('pcVariantListDetails').innerHTML = '';
    if ($('pcHasVariantsMirror')) $('pcHasVariantsMirror').checked = false;
    var mz = $('pcMediaZone');
    if (mz) {
      var mh = mz.querySelector('.pc-media-hint');
      if (mh) mh.textContent = 'Drag and drop images here or click to upload.';
    }
    updateVariantOptionsError();
    regenerateVariants(true);
    setTab('details');
    loadOrganizeLists();
    renderSalesChannelTags();
  }

  function closeModal() {
    st.open = false;
    var b = $('productCreateBackdrop');
    if (b) {
      b.classList.add('hidden');
      b.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('create-product-open');
    closeShortcuts();
  }

  /** @returns {boolean} true if Escape was consumed (shortcuts or create modal) */
  function handleEscapeFromHost() {
    var sb = $('pcShortcutsBackdrop');
    if (sb && !sb.classList.contains('hidden')) {
      closeShortcuts();
      return true;
    }
    var bd = $('productCreateBackdrop');
    if (bd && !bd.classList.contains('hidden')) {
      closeModal();
      return true;
    }
    return false;
  }

  function openShortcuts() {
    var sb = $('pcShortcutsBackdrop');
    if (sb) {
      sb.classList.remove('hidden');
      sb.setAttribute('aria-hidden', 'false');
    }
    var q = $('pcShortcutsSearch');
    if (q) q.value = '';
    filterShortcutRows('');
  }

  function closeShortcuts() {
    var sb = $('pcShortcutsBackdrop');
    if (sb) {
      sb.classList.add('hidden');
      sb.setAttribute('aria-hidden', 'true');
    }
  }

  function filterShortcutRows(q) {
    var t = (q || '').toLowerCase();
    document.querySelectorAll('#pcShortcutsList .pc-sc-row').forEach(function(row) {
      var tx = row.textContent.toLowerCase();
      row.style.display = !t || tx.indexOf(t) >= 0 ? '' : 'none';
    });
  }

  function wire() {
    if (wired) return;
    if (!$('productCreateClose') || !$('productCreateContinue')) return;
    wired = true;
    $('productCreateClose').addEventListener('click', closeModal);
    $('productCreateCancel').addEventListener('click', closeModal);
    $('productCreateContinue').addEventListener('click', onContinue);
    $('productCreateSaveDraft').addEventListener('click', onSaveDraft);
    $('productCreateTab-details').addEventListener('click', function() {
      setTab('details');
    });
    $('productCreateTab-organize').addEventListener('click', function() {
      if (validateDetails()) setTab('organize');
    });
    $('productCreateTab-variants').addEventListener('click', function() {
      if (validateDetails()) setTab('variants');
    });
    function onHasVariantsChange() {
      var c = $('pcHasVariants');
      var m = $('pcHasVariantsMirror');
      var v = c && c.checked;
      if (m) m.checked = v;
      st.hasVariants = v;
      readOptionsFromDom();
      regenerateVariants(false);
      renderOptionEditors();
      renderVariantMatrix();
      updateVariantOptionsError();
      syncDetailsVariantsSectionVisibility();
    }
    $('pcHasVariants').addEventListener('change', onHasVariantsChange);
    $('pcHasVariantsMirror').addEventListener('change', function() {
      var m = $('pcHasVariantsMirror');
      var c = $('pcHasVariants');
      if (m && c) c.checked = m.checked;
      onHasVariantsChange();
    });
    $('pcFieldTitle').addEventListener('blur', function() {
      var h = $('pcFieldHandle');
      if (h && !h.value.trim() && $('pcFieldTitle').value.trim()) {
        h.value = slugify($('pcFieldTitle').value);
      }
    });
    function addProductOptionRow() {
      pushUndo();
      readOptionsFromDom();
      var id = 'opt-' + st.optionIdSeq++;
      st.options.push({ id: id, title: '', values: [] });
      renderOptionEditors();
      regenerateVariants(false);
    }
    $('pcAddOptionBtn').addEventListener('click', addProductOptionRow);
    var addOptDet = $('pcAddOptionBtnDetails');
    if (addOptDet) addOptDet.addEventListener('click', addProductOptionRow);
    $('pcShortcutsBtn').addEventListener('click', openShortcuts);
    $('pcShortcutsClose').addEventListener('click', closeShortcuts);
    $('pcShortcutsBackdrop').addEventListener('click', function(e) {
      if (e.target.id === 'pcShortcutsBackdrop') closeShortcuts();
    });
    $('pcShortcutsSearch').addEventListener('input', function() {
      filterShortcutRows($('pcShortcutsSearch').value);
    });
    $('pcShortcutsBackdrop').addEventListener('click', function(e) {
      if (e.target.id === 'pcShortcutsBackdrop') closeShortcuts();
    });
    $('pcMediaZone').addEventListener('click', function() {
      $('pcMediaInput').click();
    });
    $('pcMediaInput').addEventListener('change', function() {
      var files = $('pcMediaInput').files;
      st.mediaFiles = [];
      for (var i = 0; i < Math.min(files.length, 8); i++) {
        (function(file) {
          var r = new FileReader();
          r.onload = function() {
            st.mediaFiles.push({ name: file.name, dataUrl: r.result });
            var z = $('pcMediaZone');
            if (z) z.querySelector('.pc-media-hint').textContent = st.mediaFiles.length + ' image(s) selected (preview in table uses first).';
          };
          r.readAsDataURL(file);
        })(files[i]);
      }
    });
    $('pcAddSalesChannelBtn').addEventListener('click', function() {
      var menu = $('pcSalesChannelMenu');
      if (!menu) return;
      menu.classList.toggle('hidden');
      if (!menu.classList.contains('hidden')) {
        menu.innerHTML = st.salesList
          .map(function(sc) {
            return (
              '<button type="button" class="pc-menu-item" data-sc-id="' +
              esc(sc.id) +
              '">' +
              esc(sc.name || sc.id) +
              '</button>'
            );
          })
          .join('');
        menu.querySelectorAll('.pc-menu-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.getAttribute('data-sc-id');
            var sc = st.salesList.find(function(s) {
              return s.id === id;
            });
            if (!sc) return;
            if (!st.salesChannels.some(function(c) {
              return c.id === id;
            })) {
              st.salesChannels.push({ id: sc.id, name: sc.name || sc.id });
              renderSalesChannelTags();
            }
            menu.classList.add('hidden');
          });
        });
      }
    });
    $('pcClearSalesChannels').addEventListener('click', function() {
      st.salesChannels = [];
      renderSalesChannelTags();
    });
    document.addEventListener('mousedown', function(e) {
      var menu = $('pcSalesChannelMenu');
      var addBtn = $('pcAddSalesChannelBtn');
      if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== addBtn && !addBtn.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
    $('productCreateBackdrop').addEventListener('click', function(e) {
      if (e.target.id === 'productCreateBackdrop') closeModal();
    });
    if (!keyHandlerBound) {
      document.addEventListener('keydown', globalKeydown, true);
      keyHandlerBound = true;
    }
  }

  global.ProductCreateUI = {
    init: function(opts) {
      hooks.onCommit = (opts && opts.onCommit) || null;
      wire();
    },
    open: openModal,
    close: closeModal,
    handleEscape: handleEscapeFromHost,
    isOpen: function() {
      return st.open;
    }
  };
})(window);
