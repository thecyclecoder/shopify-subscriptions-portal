// portal-src/modals/add-swap.js
// Shared modal for Add Product + Swap Product (same UI, different submit handler)
//
// Two-step flow:
//   Step 1: Select product
//   Step 2: Select flavor + quantity
//
// Product rows are clickable (no visible radios).
// Stars render as: ★★★★☆ 4.8 (123)
//
// Normalizes catalog into:
//   {
//     productId: string,
//     title: string,
//     imageUrl: string,
//     directResponseHeadline: string,
//     directResponseSubhead: string,
//     ratingValue: number|null,
//     ratingCount: number|null,
//     variants: [ { variantId: string, title: string, imageUrl?: string, ... } ],
//     _raw: originalProduct
//   }

(function () {
  window.__SP = window.__SP || {};
  window.__SP.modals = window.__SP.modals || {};

  function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function toInt(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : (fallback == null ? 0 : fallback);
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback == null ? null : fallback);
  }

  function formatMoneyFromCents(cents) {
    var n = toInt(cents, 0);
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var dollars = Math.floor(n / 100);
    var rem = n % 100;
    var rem2 = rem < 10 ? "0" + String(rem) : String(rem);
    return sign + "$" + String(dollars) + "." + rem2;
  }

  // ----------------------------
  // Robust scalar extraction (prevents [object Object])
  // ----------------------------

  function isPlainObject(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
  }

  function pickScalar(v) {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);

    if (isPlainObject(v)) {
      // Metafield-ish
      if (v.value != null) return pickScalar(v.value);
      if (v.stringValue != null) return pickScalar(v.stringValue);
      if (v.text != null) return pickScalar(v.text);
      if (v.label != null) return pickScalar(v.label);

      // Image/url-ish
      if (v.url != null) return pickScalar(v.url);
      if (v.src != null) return pickScalar(v.src);
      if (v.transformedSrc != null) return pickScalar(v.transformedSrc);
      if (v.originalSrc != null) return pickScalar(v.originalSrc);

      // Nested
      if (v.previewImage && isPlainObject(v.previewImage)) {
        var a =
          pickScalar(v.previewImage.url) ||
          pickScalar(v.previewImage.src) ||
          pickScalar(v.previewImage.transformedSrc);
        if (a) return a;
      }
    }

    return "";
  }

  function isProbablyUrl(s) {
    s = safeStr(s).trim();
    if (!s) return false;
    if (s.indexOf("[object") === 0) return false;
    return (
      s.indexOf("http://") === 0 ||
      s.indexOf("https://") === 0 ||
      s.indexOf("//") === 0 ||
      s.indexOf("cdn.shopify.com") !== -1
    );
  }

  // ----------------------------
  // Normalization helpers
  // ----------------------------

  function getVariantId(v) {
    var id = (v && (v.variantId != null ? v.variantId : v.id));
    return pickScalar(id) || safeStr(id);
  }

  function getProductId(p) {
    var id = (p && (p.productId != null ? p.productId : p.id));
    return pickScalar(id) || safeStr(id);
  }

  function pickImageUrl(obj) {
    var url =
      pickScalar(obj && obj.imageUrl) ||
      pickScalar(obj && obj.image) ||
      pickScalar(obj && obj.featuredImage) ||
      pickScalar(obj && obj.featured_image) ||
      pickScalar(obj && obj.featuredMedia) ||
      "";

    if (!url) {
      try {
        var nested =
          (obj && obj.image && (obj.image.src || obj.image.url || obj.image.transformedSrc)) ||
          (obj && obj.featuredImage && (obj.featuredImage.src || obj.featuredImage.url || obj.featuredImage.transformedSrc)) ||
          (obj && obj.featured_image && (obj.featured_image.src || obj.featured_image.url || obj.featured_image.transformedSrc)) ||
          (obj && obj.variantImage && (obj.variantImage.transformedSrc || obj.variantImage.src || obj.variantImage.url)) ||
          "";
        url = pickScalar(nested);
      } catch (e) {}
    }

    url = safeStr(url).trim();
    return isProbablyUrl(url) ? url : "";
  }

  function pickHeadline(p) {
    var v =
      pickScalar(p && p.directResponseHeadline) ||
      pickScalar(p && p.direct_response_headline) ||
      pickScalar(p && p.metafields && (p.metafields.direct_response_headline || p.metafields.directResponseHeadline)) ||
      "";
    return safeStr(v).trim();
  }

  function pickSubhead(p) {
    var v =
      pickScalar(p && p.directResponseSubhead) ||
      pickScalar(p && p.direct_response_subhead) ||
      pickScalar(p && p.metafields && (p.metafields.direct_response_subhead || p.metafields.directResponseSubhead)) ||
      "";
    return safeStr(v).trim();
  }

  // Ratings: handle multiple common shapes
  function pickRatingValue(p) {
    var v = toNum(p && p.ratingValue, null);
    if (v == null && p && p.rating && p.rating.value != null) v = toNum(p.rating.value, null);

    // metafields candidates
    if (v == null && p && p.metafields) {
      var mf = p.metafields;

      // direct keys
      v = toNum(pickScalar(mf.rating_value), null);
      if (v == null) v = toNum(pickScalar(mf.ratingValue), null);
      if (v == null) v = toNum(pickScalar(mf.reviews_rating), null);

      // Shopify reviews app style sometimes: reviews_rating.value.rating
      if (v == null && mf.reviews_rating && isPlainObject(mf.reviews_rating)) {
        var rr = mf.reviews_rating.value != null ? mf.reviews_rating.value : mf.reviews_rating;
        if (rr && isPlainObject(rr)) {
          v = toNum(pickScalar(rr.rating), null);
          if (v == null) v = toNum(pickScalar(rr.value), null);
        }
      }
    }

    if (v != null && (v < 0 || v > 5.5)) return null;
    return v;
  }

  function pickRatingCount(p) {
    var v = toNum(p && p.ratingCount, null);
    if (v == null && p && p.rating && p.rating.count != null) v = toNum(p.rating.count, null);

    if (v == null && p && p.metafields) {
      var mf = p.metafields;

      v = toNum(pickScalar(mf.rating_count), null);
      if (v == null) v = toNum(pickScalar(mf.ratingCount), null);
      if (v == null) v = toNum(pickScalar(mf.reviews_count), null);

      // reviews_rating.value.count
      if (v == null && mf.reviews_rating && isPlainObject(mf.reviews_rating)) {
        var rr = mf.reviews_rating.value != null ? mf.reviews_rating.value : mf.reviews_rating;
        if (rr && isPlainObject(rr)) {
          v = toNum(pickScalar(rr.count), null);
        }
      }
    }

    if (v != null && v < 0) return null;
    return v;
  }

  function normalizeVariant(rawV) {
    if (!rawV) return null;

    var out = {
      variantId: getVariantId(rawV),
      title: safeStr(pickScalar(rawV.title) || rawV.title).trim(),
      imageUrl: pickImageUrl(rawV),
      _raw: rawV,
    };

    if (Number.isFinite(rawV.msrpCents)) out.msrpCents = rawV.msrpCents;
    if (Number.isFinite(rawV.priceCents)) out.priceCents = rawV.priceCents;

    return out.variantId ? out : null;
  }

  function normalizeProduct(rawP) {
    if (!rawP) return null;

    var variants = [];
    var rawVs = (rawP && Array.isArray(rawP.variants)) ? rawP.variants : [];
    for (var i = 0; i < rawVs.length; i++) {
      var nv = normalizeVariant(rawVs[i]);
      if (nv) variants.push(nv);
    }

    var title = safeStr(pickScalar(rawP.title) || rawP.title).trim();

    return {
      productId: getProductId(rawP) || title,
      title: title,
      imageUrl: pickImageUrl(rawP),
      directResponseHeadline: pickHeadline(rawP),
      directResponseSubhead: pickSubhead(rawP),
      ratingValue: pickRatingValue(rawP),
      ratingCount: pickRatingCount(rawP),
      variants: variants,
      _raw: rawP,
    };
  }

  function normalizeCatalog(catalog) {
    var arr = Array.isArray(catalog) ? catalog.filter(Boolean) : [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var p = normalizeProduct(arr[i]);
      if (p && p.productId && p.title) out.push(p);
    }
    return out;
  }

  function filterVariants(product, excludeSet) {
    var vs = (product && Array.isArray(product.variants)) ? product.variants : [];
    if (!excludeSet || typeof excludeSet.has !== "function") return vs.slice();
    var out = [];
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (!v) continue;
      var id = safeStr(v.variantId);
      if (!id) continue;
      if (excludeSet.has(id)) continue;
      out.push(v);
    }
    return out;
  }

  // ----------------------------
  // Modal / UI helpers
  // ----------------------------

  function ensureBodyNoScroll(on) {
    try {
      if (on) document.body.classList.add("sp-modal-open");
      else document.body.classList.remove("sp-modal-open");
    } catch (e) {}
  }

  function closeModal(state) {
    try {
      if (state && state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
    } catch (e) {}
    ensureBodyNoScroll(false);
  }

  function showToast(ui, msg, type) {
    try {
      var busy = window.__SP.actions && window.__SP.actions.busy;
      if (busy && typeof busy.showToast === "function") {
        busy.showToast(ui, msg, type || "success");
        return;
      }
    } catch (e) {}
    try { console.log("[toast]", type || "info", msg); } catch (e2) {}
  }
function renderStarsInline(ui, ratingValue, ratingCount) {
  if (!Number.isFinite(ratingValue) || ratingValue <= 0) return ui.el("span", {}, []);

  var rv = Math.max(0, Math.min(5, ratingValue));

  // PDP-style rounding:
  // .3-.7 => half star
  // >.7   => bump to next full star
  var base = Math.floor(rv);
  var dec = rv - base;

  var full = base;
  var half = 0;

  if (dec >= 0.3 && dec <= 0.7) {
    half = 1;
  } else if (dec > 0.7) {
    full = Math.min(5, full + 1);
  }

  var empty = 5 - full - half;

  // Choose a half-star glyph. If you don’t like this character,
  // we can switch to the CSS gradient method later.
  var HALF = "⯨"; // Unicode half-star
  var stars = "";
  for (var i = 0; i < full; i++) stars += "★";
  if (half) stars += HALF;
  for (var j = 0; j < empty; j++) stars += "☆";

  var suffix = "";
  if (Number.isFinite(ratingCount) && ratingCount > 0) {
    suffix = " (" + String(Math.trunc(ratingCount)) + ")";
  }

  return ui.el("div", { class: "sp-addswap-stars" }, [
    ui.el("span", { class: "sp-addswap-stars__glyphs" }, [stars]),
    ui.el("span", { class: "sp-addswap-stars__text sp-muted" }, [String(rv.toFixed(1)) + suffix]),
  ]);
}
  

  function rowBtnAttrs(isSelected) {
    return {
      type: "button",
      class: "sp-addswap-rowbtn sp-btn sp-btn--ghost" + (isSelected ? " is-selected" : ""),
    };
  }

  function productRowBtn(ui, product, onClick) {
    var title = safeStr(product && product.title) || "Product";
    var img = safeStr(product && product.imageUrl);
    var headline = safeStr(product && product.directResponseHeadline);
    var subhead = safeStr(product && product.directResponseSubhead);

    var ratingValue = product && product.ratingValue;
    var ratingCount = product && product.ratingCount;

    var hasImg = img && isProbablyUrl(img);

    var btn = ui.el("button", rowBtnAttrs(false), [
      ui.el("div", { class: "sp-addswap-rowbtn__inner sp-addswap-prodrow" }, [
        hasImg
          ? ui.el("img", { src: img, alt: title, class: "sp-addswap-prodrow__img" }, [])
          : ui.el("div", { class: "sp-addswap-prodrow__img sp-addswap-prodrow__img--placeholder", "aria-hidden": "true" }, []),

        ui.el("div", { class: "sp-addswap-prodrow__text" }, [
          ui.el("div", { class: "sp-addswap-prodrow__title" }, [title]),
          headline ? ui.el("div", { class: "sp-addswap-prodrow__headline sp-muted" }, [headline]) : ui.el("span", {}, []),
          subhead ? ui.el("div", { class: "sp-addswap-prodrow__subhead sp-muted" }, [subhead]) : ui.el("span", {}, []),
          renderStarsInline(ui, ratingValue, ratingCount),
        ]),
      ]),
    ]);

    if (typeof onClick === "function") btn.addEventListener("click", onClick);
    return btn;
  }

  function variantRowBtn(ui, variant, isSelected, onClick) {
    var label = safeStr(variant && variant.title) || "Option";
    var img = safeStr(variant && variant.imageUrl);
    var hasImg = img && isProbablyUrl(img);

    var attrs = rowBtnAttrs(!!isSelected);

    var btn = ui.el("button", attrs, [
      ui.el("div", { class: "sp-addswap-rowbtn__inner sp-addswap-varrow" }, [
        hasImg
          ? ui.el("img", { src: img, alt: label, class: "sp-addswap-varrow__img" }, [])
          : ui.el("div", { class: "sp-addswap-varrow__img sp-addswap-varrow__img--placeholder", "aria-hidden": "true" }, []),
        ui.el("div", { class: "sp-addswap-varrow__label" }, [label]),
      ]),
    ]);

    if (typeof onClick === "function") btn.addEventListener("click", onClick);
    return btn;
  }

  function renderPriceRow(ui, msrpCents, priceCents) {
    var hasMsrp = Number.isFinite(msrpCents) && msrpCents > 0;
    var hasPrice = Number.isFinite(priceCents);

    return ui.el("div", { class: "sp-addswap-price" }, [
      ui.el("div", { class: "sp-addswap-price__label sp-muted" }, ["Price"]),
      ui.el("div", { class: "sp-addswap-price__vals" }, [
        hasMsrp ? ui.el("div", { class: "sp-addswap-price__msrp" }, [formatMoneyFromCents(msrpCents)]) : ui.el("span", {}, []),
        hasPrice ? ui.el("div", { class: "sp-addswap-price__now" }, [formatMoneyFromCents(priceCents)]) : ui.el("div", { class: "sp-addswap-price__dash sp-muted" }, ["—"]),
      ]),
    ]);
  }

  // ----------------------------
  // Open
  // ----------------------------

  function open(ui, opts) {
    opts = opts || {};
    var mode = (safeStr(opts.mode).toLowerCase() === "swap") ? "swap" : "add";
    var contractId = safeStr(opts.contractId);
    var line = opts.line || null;
    var excludeVariantIds = opts.excludeVariantIds || null;
    var catalog = normalizeCatalog(opts.catalog);
    var computePrice = (typeof opts.computePrice === "function") ? opts.computePrice : null;
    var onSubmit = (typeof opts.onSubmit === "function") ? opts.onSubmit : null;

    if (!ui || typeof ui.el !== "function") throw new Error("add-swap modal: ui.el is required");
    if (!contractId) return showToast(ui, "Missing contract id.", "error");
    if (mode === "swap" && !line) return showToast(ui, "Missing line for swap.", "error");
    if (!catalog.length) return showToast(ui, "No products available.", "error");

    // state
    var state = {
      root: null,
      step: 1, // 1=product, 2=flavor+qty
      selectedProductKey: "",
      selectedVariantId: "",
      quantity: 1,
      submitting: false,
    };

    function productKey(p, idx) {
      return safeStr(p && p.productId) || safeStr(p && p.title) || ("p_" + String(idx || 0));
    }

    function getSelectedProduct() {
      for (var i2 = 0; i2 < catalog.length; i2++) {
        var p2 = catalog[i2];
        if (!p2) continue;
        if (productKey(p2, i2) === state.selectedProductKey) return p2;
      }
      return null;
    }

    function getSelectedVariant(product) {
      if (!product) return null;
      var allowed = filterVariants(product, excludeVariantIds);
      for (var j = 0; j < allowed.length; j++) {
        var v = allowed[j];
        if (safeStr(v && v.variantId) === state.selectedVariantId) return v;
      }
      return allowed.length ? allowed[0] : null;
    }

    // Build modal DOM
    var overlay = ui.el("div", { class: "sp-modal", role: "dialog", "aria-modal": "true" }, []);
    var card = ui.el("div", { class: "sp-modal__card" }, []);
    var titleEl = ui.el("div", { class: "sp-modal__title" }, []);
    var bodyEl = ui.el("div", { class: "sp-modal__body" }, []);
    var footerEl = ui.el("div", { class: "sp-modal__footer" }, []);

    function doClose() { closeModal(state); }

    overlay.addEventListener("click", function (e) {
      if (e && e.target === overlay) doClose();
    });

    function rebuildTitle() {
      while (titleEl.firstChild) titleEl.removeChild(titleEl.firstChild);

      titleEl.appendChild(
        ui.el("div", { class: "sp-addswap-title" }, [
          state.step === 1
            ? (mode === "swap" ? "Swap product" : "Add product")
            : "Choose flavor",
        ])
      );
    }

    function rebuildFooter() {
      while (footerEl.firstChild) footerEl.removeChild(footerEl.firstChild);

      var cancelBtn = ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost" }, ["Cancel"]);
      cancelBtn.addEventListener("click", doClose);
      footerEl.appendChild(cancelBtn);

      // Only show submit on step 2
      if (state.step === 2) {
        var confirmBtn = ui.el("button", { type: "button", class: "sp-btn sp-btn-primary" }, [mode === "swap" ? "Swap" : "Add"]);
        confirmBtn.addEventListener("click", function () {
          handleSubmit(doClose, confirmBtn);
        });
        footerEl.appendChild(confirmBtn);
      }
    }

    function rebuildBody() {
      while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);

      // Intro note (tight)
      bodyEl.appendChild(
        ui.el("div", { class: "sp-note sp-addswap-note" }, [
          ui.el("div", { class: "sp-note__title" }, [
            state.step === 1 ? "Step 1: Choose a product" : "Step 2: Choose flavor and quantity",
          ]),
          ui.el("div", { class: "sp-note__body" }, [
            state.step === 1
              ? "Tap a product to continue."
              : "Pick your flavor and quantity, then confirm.",
          ]),
        ])
      );

      if (state.step === 1) {
        // Product list
        var list = ui.el("div", { class: "sp-addswap-list sp-addswap-list--products" }, []);

        for (var i = 0; i < catalog.length; i++) {
          (function (prod, idx) {
            if (!prod) return;

            var allowed = filterVariants(prod, excludeVariantIds);
            if (!allowed.length) return;

            var key = productKey(prod, idx);

            list.appendChild(
              productRowBtn(ui, prod, function () {
                state.selectedProductKey = key;
                state.selectedVariantId = safeStr(allowed[0].variantId);
                state.step = 2;
                rebuildAll();
              })
            );
          })(catalog[i], i);
        }

        bodyEl.appendChild(ui.el("div", { class: "sp-addswap-sectionlabel" }, ["Product"]));
        bodyEl.appendChild(list);
        return;
      }

      // Step 2: flavor + qty
      var p = getSelectedProduct();

      // Back row (and selected product summary)
      var backBtn = ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost sp-addswap-back" }, ["← Back"]);
      backBtn.addEventListener("click", function () {
        state.step = 1;
        rebuildAll();
      });

      bodyEl.appendChild(
        ui.el("div", { class: "sp-addswap-toprow" }, [
          backBtn,
          ui.el("div", { class: "sp-addswap-toprow__hint sp-muted" }, [
            mode === "swap" ? "You’re swapping this item" : "You’re adding a new item",
          ]),
        ])
      );

      if (p) {
        var img = safeStr(p.imageUrl);
        var hasPImg = img && isProbablyUrl(img);

        bodyEl.appendChild(
          ui.el("div", { class: "sp-addswap-selected" }, [
            hasPImg
              ? ui.el("img", { src: img, alt: p.title, class: "sp-addswap-selected__img" }, [])
              : ui.el("div", { class: "sp-addswap-selected__img sp-addswap-selected__img--placeholder", "aria-hidden": "true" }, []),

            ui.el("div", { class: "sp-addswap-selected__text" }, [
              ui.el("div", { class: "sp-addswap-selected__title" }, [p.title]),
              p.directResponseHeadline ? ui.el("div", { class: "sp-addswap-selected__headline sp-muted" }, [p.directResponseHeadline]) : ui.el("span", {}, []),
              renderStarsInline(ui, p.ratingValue, p.ratingCount),
            ]),
          ])
        );
      }

      var allowedVariants = p ? filterVariants(p, excludeVariantIds) : [];
      var v = getSelectedVariant(p);

      // Flavor list (button rows)
      bodyEl.appendChild(ui.el("div", { class: "sp-addswap-sectionlabel sp-addswap-sectionlabel--spaced" }, ["Flavor"]));

      var vList = ui.el("div", { class: "sp-addswap-list sp-addswap-list--variants" }, []);
      for (var j2 = 0; j2 < allowedVariants.length; j2++) {
        (function (vv) {
          var id = safeStr(vv && vv.variantId);
          vList.appendChild(
            variantRowBtn(ui, vv, id === state.selectedVariantId, function () {
              state.selectedVariantId = id;
              rebuildAll();
            })
          );
        })(allowedVariants[j2]);
      }
      bodyEl.appendChild(vList);

      // Quantity
      var qty = toInt(state.quantity, 1) || 1;
      var qtyWrap = ui.el("div", { class: "sp-addswap-qty" }, [
        ui.el("div", { class: "sp-addswap-qty__label" }, ["Quantity"]),
        ui.el("select", { class: "sp-select" }, [
          ui.el("option", { value: "1", selected: qty === 1 }, ["1"]),
          ui.el("option", { value: "2", selected: qty === 2 }, ["2"]),
          ui.el("option", { value: "3", selected: qty === 3 }, ["3"]),
        ]),
      ]);

      qtyWrap.querySelector("select").addEventListener("change", function (e) {
        state.quantity = toInt(e && e.target && e.target.value, 1) || 1;
        rebuildAll();
      });

      bodyEl.appendChild(qtyWrap);

      // Price display
      var msrpCents = null;
      var priceCents = null;

      if (computePrice && v) {
        try {
          var out = computePrice({
            variant: v,
            qty: state.quantity,
            context: { mode: mode, contractId: contractId, line: line }
          }) || {};
          msrpCents = Number.isFinite(out.msrpCents) ? out.msrpCents : null;
          priceCents = Number.isFinite(out.priceCents) ? out.priceCents : null;
        } catch (e1) {}
      } else if (v) {
        msrpCents = Number.isFinite(v.msrpCents) ? v.msrpCents : null;
        priceCents = Number.isFinite(v.priceCents) ? v.priceCents : null;
      }

      bodyEl.appendChild(renderPriceRow(ui, msrpCents, priceCents));
    }

    function rebuildAll() {
      rebuildTitle();
      rebuildBody();
      rebuildFooter();
    }

    async function handleSubmit(closeFn, confirmBtn) {
      if (state.submitting) return;
      if (!onSubmit) return showToast(ui, "Submit handler is not wired yet.", "error");

      var p = getSelectedProduct();
      var v = getSelectedVariant(p);

      if (!p) return showToast(ui, "Please select a product.", "error");
      if (!v || !safeStr(v.variantId)) return showToast(ui, "Please select a flavor.", "error");

      state.submitting = true;
      try {
        confirmBtn.disabled = true;

        await onSubmit({
          mode: mode,
          contractId: contractId,
          line: line,
          variantId: safeStr(v.variantId),
          variant: v,
          product: p,
          quantity: toInt(state.quantity, 1) || 1,
        });

        closeFn();
      } catch (err) {
        showToast(ui, (err && err.message) ? err.message : "Something went wrong.", "error");
        try { confirmBtn.disabled = false; } catch (e2) {}
      } finally {
        state.submitting = false;
      }
    }

    // Initialize default step/product
    state.step = 1;
    state.selectedProductKey = "";
    state.selectedVariantId = "";

    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(footerEl);
    overlay.appendChild(card);
    state.root = overlay;

    // First render
    rebuildAll();

    // Mount
    ensureBodyNoScroll(true);
    document.body.appendChild(overlay);
  }

  window.__SP.modals.addSwap = {
    open: open,
    _normalizeCatalog: normalizeCatalog,
  };
})();