// assets/portal-cards-items.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
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

  function getLineImageUrl(ln, utils) {
    try {
      if (utils && typeof utils.safeStr === "function") {
        return utils.safeStr(ln && ln.variantImage && ln.variantImage.transformedSrc);
      }
    } catch (e) {}
    return safeStr(ln && ln.variantImage && ln.variantImage.transformedSrc);
  }

  function getContractLines(contract) {
    try {
      if (contract && Array.isArray(contract.lines)) return contract.lines;
    } catch (e) {}
    try {
      if (contract && contract.lines && Array.isArray(contract.lines.nodes)) return contract.lines.nodes;
    } catch (e2) {}
    return [];
  }

  function splitLinesExcludingShipProt(contract, utils) {
    var all = getContractLines(contract);
    var shipLine = null;
    var lines = [];

    for (var i = 0; i < all.length; i++) {
      var ln = all[i];
      if (!ln) continue;

      var isShip = false;
      try {
        if (utils && typeof utils.isShippingProtectionLine === "function") {
          isShip = !!utils.isShippingProtectionLine(ln);
        }
      } catch (e) {
        isShip = false;
      }

      if (isShip && !shipLine) shipLine = ln;
      else lines.push(ln);
    }

    return { shipLine: shipLine, lines: lines };
  }

    // ---- tier pricing snapshot helpers --------------------------------------

  function isRealLineForTier(ln, utils) {
    if (!ln) return false;

    // Exclude shipping protection (and similar non-real items)
    try {
      if (utils && typeof utils.isShippingProtectionLine === "function") {
        if (utils.isShippingProtectionLine(ln)) return false;
      }
    } catch (e) {}

    // Must have a variant + positive quantity
    var vId = safeStr(ln && ln.variantId);
    if (!vId) return false;

    var qty = toNum(ln && ln.quantity, 0);
    if (!(qty > 0)) return false;

    // Exclude lines that look "non-real" / placeholder-ish
    // (safe no-op if fields don't exist)
    try {
      if (ln.isRemoved || ln.isDeleted) return false;
    } catch (e2) {}

    return true;
  }

  function buildLineSnapshotFromContract(contract, utils) {
    // Returns an array of "real" lines that tier-pricing logic can use.
    // IMPORTANT: uses only the in-memory/cached contract object passed into this card.
    var all = getContractLines(contract);
    var snap = [];

    for (var i = 0; i < all.length; i++) {
      var ln = all[i];
      if (!isRealLineForTier(ln, utils)) continue;

      snap.push({
        id: safeStr(ln && ln.id),
        variantId: safeStr(ln && ln.variantId),
        quantity: toNum(ln && ln.quantity, 1) || 1,
      });
    }

    return snap;
  }

  function addBtn(ui, text, onClick, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;

    var attrs = {
      type: "button",
      class: "sp-btn sp-btn--ghost",
    };
    if (disabled) {
      attrs.class += " sp-btn--disabled";
      attrs.disabled = true;
    }

    var btn = ui.el("button", attrs, [text]);
    if (!disabled && typeof onClick === "function") btn.addEventListener("click", onClick);
    return btn;
  }

  // ---------------- catalog + modal wiring ----------------

  function parseJsonAttribute(str) {
    var s = safeStr(str).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function getCatalogFromDom() {
    // Catalog is attached to root div data-products-available-to-add='[...]'
    // We grab the first occurrence on the page.
    try {
      var el =
        document.querySelector("[data-products-available-to-add]") ||
        document.querySelector("[data-products-available-to-add-json]") ||
        null;
      if (!el) return [];
      var raw =
        el.getAttribute("data-products-available-to-add") ||
        el.getAttribute("data-products-available-to-add-json") ||
        "";
      var parsed = parseJsonAttribute(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e2) {
      return [];
    }
  }

  function buildVariantPriceMapFromCatalog(catalog) {
    // returns:
    //  { msrpCentsByVariantId: { [id:number]: number }, priceCentsByVariantId: { [id:number]: number } }
    var msrpCentsByVariantId = {};
    var priceCentsByVariantId = {};

    if (!Array.isArray(catalog)) return { msrpCentsByVariantId: msrpCentsByVariantId, priceCentsByVariantId: priceCentsByVariantId };

    for (var i = 0; i < catalog.length; i++) {
      var p = catalog[i];
      var vars = p && Array.isArray(p.variants) ? p.variants : [];
      for (var j = 0; j < vars.length; j++) {
        var v = vars[j];
        if (!v) continue;

        var id = toNum(v.id, 0);
        if (!id) continue;

        var priceCents = toNum(v.price_cents, 0);
        var compareCents = toNum(v.compare_at_price_cents, 0);

        // MSRP: prefer compare_at if present; otherwise treat price as MSRP baseline
        var msrpCents = compareCents > 0 ? compareCents : (priceCents > 0 ? priceCents : 0);

        if (priceCents > 0) priceCentsByVariantId[id] = priceCents;
        if (msrpCents > 0) msrpCentsByVariantId[id] = msrpCents;
      }
    }

    return { msrpCentsByVariantId: msrpCentsByVariantId, priceCentsByVariantId: priceCentsByVariantId };
  }

  function buildExcludeVariantIdSet(lines) {
    var set = new Set();
    for (var i = 0; i < (lines ? lines.length : 0); i++) {
      var id = safeStr(lines[i] && lines[i].variantId);
      if (id) set.add(id);
    }
    return set;
  }

  function pickAddSwapModal() {
    try {
      var m = window.__SP && window.__SP.modals && window.__SP.modals.addSwap;
      if (m && typeof m.open === "function") return m;
    } catch (e) {}
    return null;
  }

    function pickRemoveModal() {
    try {
      var m = window.__SP && window.__SP.modals && window.__SP.modals.remove;
      if (m && typeof m.open === "function") return m;
    } catch (e) {}
    return null;
  }



  function openRemoveModal(ui, args) {
    var modal = pickRemoveModal();
    if (!modal) {
      showToast(ui, "Remove modal is not loaded.", "error");
      return;
    }

    var actions = args.actions || null;

    // Catalog (DOM) so modal can show MSRP / price like add-swap step 2
    var catalog = getCatalogFromDom();
    if (!catalog.length) {
      // No catalog found = still allow modal (it will just omit price row)
      catalog = [];
    }

    var computePrice = pickComputePrice(actions);

    modal.open(ui, {
      contractId: args.contractId,
      line: args.line || null,
      catalog: catalog,
      computePrice: computePrice,

      onRemove: async function () {
        // Keep “remove” action wiring consistent with how you already expect it.
        if (!actions || !actions.items || typeof actions.items.remove !== "function") {
          throw new Error("Remove is not wired yet.");
        }
        return actions.items.remove(ui, String(args.contractId), args.line);
      },

      onSwapInstead: function () {
        if (typeof args.onSwapInstead === "function") args.onSwapInstead();
      },
    });
  }

    function pickQuantityModal() {
    try {
      var m = window.__SP && window.__SP.modals && window.__SP.modals.quantity;
      if (m && typeof m.open === "function") return m;
    } catch (e) {}
    return null;
  }

  function openQuantityModal(ui, args) {
    var modal = pickQuantityModal();
    if (!modal) {
      showToast(ui, "Quantity modal is not loaded.", "error");
      return;
    }

    var actions = args.actions || null;

    // Catalog (DOM) so modal can show MSRP / price like add-swap step 2
    var catalog = getCatalogFromDom();
    if (!catalog.length) catalog = [];

    var computePrice = pickComputePrice(actions);

    modal.open(ui, {
      contractId: args.contractId,
      line: args.line || null,
      catalog: catalog,
      computePrice: computePrice,

      onSubmit: async function (payload) {
        // For now, we’ll call the existing hook if present.
        // You said you’ll ask next for actions/quantity.js — we’ll wire that in there.
        if (!actions || !actions.items) throw new Error("Actions not available.");
        var items = actions.items;

        // Prefer a dedicated handler if you add it later
        if (typeof items.submitQuantity === "function") return items.submitQuantity(ui, payload);
        if (typeof items.changeQty === "function") {
          // Maintain backward compatibility with existing pattern
          return items.changeQty(ui, String(args.contractId), args.line, payload.quantity, payload);
        }

        throw new Error("Quantity action is not wired yet.");
      },
    });
  }

  function pickComputePrice(actions) {
    // Optional: let actions supply pricing (recommended).
    // Signature expected by modal:
    //   computePrice({ variant, qty, context }) => { msrpCents, priceCents }
    try {
      if (actions && actions.items && typeof actions.items.computeAddSwapPrice === "function") {
        return actions.items.computeAddSwapPrice;
      }
    } catch (e) {}
    try {
      if (actions && actions.pricing && typeof actions.pricing.computeAddSwapPrice === "function") {
        return actions.pricing.computeAddSwapPrice;
      }
    } catch (e2) {}
    return null;
  }

  async function submitAddSwap(actions, ui, payload) {
    // We try a few possible handlers, in priority order.
    // payload:
    //   { mode, contractId, line, variantId, variant, product, quantity }
    if (!actions || !actions.items) throw new Error("Actions not available.");

    var items = actions.items;

    // Preferred unified handler
    if (typeof items.submitAddSwap === "function") return items.submitAddSwap(ui, payload);
    if (typeof items.applyAddSwap === "function") return items.applyAddSwap(ui, payload);
    if (typeof items.addSwapSubmit === "function") return items.addSwapSubmit(ui, payload);

    // Separate handlers (swap vs add)
    if (payload.mode === "swap") {
      if (typeof items.submitSwap === "function") return items.submitSwap(ui, payload);
      if (typeof items.swapSubmit === "function") return items.swapSubmit(ui, payload.contractId, payload.line, payload.variantId, payload.quantity, payload);
      if (typeof items.swapToVariant === "function") return items.swapToVariant(ui, payload.contractId, payload.line, payload.variantId, payload.quantity, payload);
      if (typeof items.replaceVariant === "function") return items.replaceVariant(ui, payload.contractId, payload.line, payload.variantId, payload.quantity, payload);
    } else {
      if (typeof items.submitAdd === "function") return items.submitAdd(ui, payload);
      if (typeof items.addSubmit === "function") return items.addSubmit(ui, payload.contractId, payload.variantId, payload.quantity, payload);
      if (typeof items.addVariant === "function") return items.addVariant(ui, payload.contractId, payload.variantId, payload.quantity, payload);
      if (typeof items.addLine === "function") return items.addLine(ui, payload.contractId, payload.variantId, payload.quantity, payload);
    }

    throw new Error("Add/Swap submit handler is not wired yet.");
  }

    function openAddSwapModal(ui, args) {
    var modal = pickAddSwapModal();
    if (!modal) {
      showToast(ui, "Add/Swap modal is not loaded.", "error");
      return;
    }

    var actions = args.actions || null;
    var catalog = getCatalogFromDom();
    if (!catalog.length) {
      showToast(ui, "No catalog data found on page.", "error");
      return;
    }

    var computePrice = pickComputePrice(actions);

    modal.open(ui, {
      mode: args.mode,
      contractId: args.contractId,
      line: args.line || null,
      catalog: catalog, // raw; modal normalizes
      excludeVariantIds: args.excludeVariantIds || null,
      computePrice: computePrice,

      // ✅ Tier pricing snapshot (no fresh fetch; uses cached/in-memory contract/lines)
      // Modal will call this as quantity/variant changes to recalc tier pricing.
      getLineSnapshot: (typeof args.getLineSnapshot === "function") ? args.getLineSnapshot : null,
      lineSnapshot: args.lineSnapshot || null,

      onSubmit: async function (payload) {
        await submitAddSwap(actions, ui, payload);
      },
    });
  }

  // ---------------- money helpers ----------------

  function pickCurrency(contract, lines) {
    try {
      if (contract && contract.deliveryPrice && contract.deliveryPrice.currencyCode) {
        return String(contract.deliveryPrice.currencyCode);
      }
    } catch (e) {}
    try {
      var ln0 = lines && lines[0];
      if (ln0 && ln0.currentPrice && ln0.currentPrice.currencyCode) return String(ln0.currentPrice.currencyCode);
    } catch (e2) {}
    try {
      var ln1 = lines && lines[0];
      if (ln1 && ln1.lineDiscountedPrice && ln1.lineDiscountedPrice.currencyCode) return String(ln1.lineDiscountedPrice.currencyCode);
    } catch (e3) {}
    return "USD";
  }

  function moneyAmount(m) {
    try {
      if (!m) return 0;
      return toNum(m.amount, 0);
    } catch (e) {
      return 0;
    }
  }

  function formatMoney(amount, currencyCode) {
    var n = toNum(amount, 0);
    var fixed = (Math.round(n * 100) / 100).toFixed(2);
    if (!currencyCode || String(currencyCode).toUpperCase() === "USD") return "$" + fixed;
    return String(currencyCode).toUpperCase() + " " + fixed;
  }

  function centsToMoney(cents) {
    return toNum(cents, 0) / 100;
  }

  function computeLinePrices(ln, msrpCentsByVariantId) {
    var qty = toNum(ln && ln.quantity, 1) || 1;

    // What customer pays NOW: always from line item
    var currentUnit = moneyAmount(ln && ln.currentPrice);
    var lineDiscounted = moneyAmount(ln && ln.lineDiscountedPrice);

    var lineNow = 0;
    if (lineDiscounted > 0) lineNow = lineDiscounted;
    else if (currentUnit > 0) lineNow = currentUnit * qty;
    else lineNow = 0;

    var unitNow = 0;
    if (currentUnit > 0) unitNow = currentUnit;
    else unitNow = qty > 0 ? (lineNow / qty) : 0;

    // MSRP: from catalog (preferred)
    var unitMsrp = 0;

    try {
      var vId = toNum(shortId(ln && ln.variantId), 0);
      if (vId && msrpCentsByVariantId && msrpCentsByVariantId[vId] != null) {
        unitMsrp = centsToMoney(msrpCentsByVariantId[vId]);
      }
    } catch (e) {
      unitMsrp = 0;
    }

    // Fallback: pricingPolicy basePrice if catalog does not have it
    if (!(unitMsrp > 0)) {
      try {
        unitMsrp = moneyAmount(ln && ln.pricingPolicy && ln.pricingPolicy.basePrice);
      } catch (e2) {
        unitMsrp = 0;
      }
    }

    var showMsrp = false;
    if (unitMsrp > 0 && unitNow >= 0 && unitMsrp > unitNow + 0.009) showMsrp = true;

    var lineMsrp = showMsrp ? (unitMsrp * qty) : 0;

    return {
      qty: qty,
      unitNow: unitNow,
      lineNow: lineNow,
      showMsrp: showMsrp,
      unitMsrp: unitMsrp,
      lineMsrp: lineMsrp,
    };
  }

  // ---- line row (image + details + price) ------------

  function renderLineRow(ui, ln, utils, currencyCode, msrpCentsByVariantId) {
    var img = getLineImageUrl(ln, utils);
    var title = (utils && utils.safeStr ? utils.safeStr(ln && ln.title) : safeStr(ln && ln.title)) || "Item";
    var variant = utils && utils.safeStr ? utils.safeStr(ln && ln.variantTitle) : safeStr(ln && ln.variantTitle);

    var p = computeLinePrices(ln, msrpCentsByVariantId);
    var qty = p.qty;

    var priceBlock = ui.el("div", { class: "sp-line__priceblock" }, [
      p.showMsrp
        ? ui.el("div", { class: "sp-line__msrp" }, [formatMoney(p.lineMsrp, currencyCode)])
        : ui.el("span", {}, []),
      ui.el("div", { class: "sp-line__price" }, [formatMoney(p.lineNow, currencyCode)]),
    ]);

    return ui.el("div", { class: "sp-line sp-line--detail" }, [
      img
        ? ui.el("img", { class: "sp-line__img", src: img, alt: title })
        : ui.el("div", { class: "sp-line__img sp-line__img--placeholder" }, []),

      ui.el("div", { class: "sp-line__meta" }, [
        ui.el("div", { class: "sp-line__title" }, [title]),
        variant ? ui.el("div", { class: "sp-line__sub sp-muted" }, [variant]) : ui.el("span", {}, []),
        ui.el("div", { class: "sp-line__sub sp-muted" }, ["Qty " + String(isFinite(qty) ? qty : 1)]),
      ]),

      priceBlock,
    ]);
  }

  // ---- action option button (ghost button with title + description) ----------

  function optionBtn(ui, title, desc, onClick, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;

    var attrs = { type: "button", class: "sp-btn sp-btn--ghost sp-itemopt" };
    if (disabled) {
      attrs.class += " sp-btn--disabled";
      attrs.disabled = true;
    }

    var btn = ui.el("button", attrs, [
      ui.el("div", { class: "sp-itemopt__title" }, [title]),
      desc ? ui.el("div", { class: "sp-itemopt__desc sp-muted" }, [desc]) : ui.el("span", {}, []),
    ]);

    if (!disabled && typeof onClick === "function") btn.addEventListener("click", onClick);
    return btn;
  }

    function createDisclosure(ui, ln, contract, utils, actions, isReadOnly, totalRealLines, excludeVariantIds) {
    var canAct = !isReadOnly && !!(contract && contract.id);

        function onSwap() {
      if (!canAct) return;

      openAddSwapModal(ui, {
        mode: "swap",
        contractId: String(contract.id),
        line: ln,
        excludeVariantIds: excludeVariantIds,
        actions: actions,

        // ✅ Snapshot of REAL lines only (excludes ship protection + non-real)
        // Modal handles swap-mode override (swapped line becomes selected qty/variant)
        getLineSnapshot: function () {
          return buildLineSnapshotFromContract(contract, utils);
        },
      });
    }

    function onQty() {
      if (!canAct) return;

      openQuantityModal(ui, {
        contractId: String(contract.id),
        line: ln,
        actions: actions,
      });
    }

    function onRemove() {
      if (!canAct) return;

      openRemoveModal(ui, {
        contractId: String(contract.id),
        line: ln,
        actions: actions,
        onSwapInstead: function () {
          // Reuse the exact swap flow you already have
          openAddSwapModal(ui, {
            mode: "swap",
            contractId: String(contract.id),
            line: ln,
            excludeVariantIds: excludeVariantIds,
            actions: actions,

            // ✅ Snapshot of REAL lines only (excludes ship protection + non-real)
            getLineSnapshot: function () {
              return buildLineSnapshotFromContract(contract, utils);
            },
          });
        },
      });
    }

    var btn = ui.el(
      "button",
      { type: "button", class: "sp-btn sp-btn--ghost sp-disclosurebtn", "aria-expanded": "false" },
      [
        ui.el("span", { class: "sp-disclosurebtn__label" }, ["Make changes to this item"]),
        ui.el("span", { class: "sp-disclosurebtn__chev", "aria-hidden": "true" }, ["▾"]),
      ]
    );

    var disclosureRow = ui.el("div", { class: "sp-line__disclosure" }, [btn]);
    var canRemove = (toNum(totalRealLines, 0) > 1);

    var panel = ui.el(
      "div",
      { class: "sp-line__panel", style: "padding:10px 10px; border-radius:12px; background:#fcf4ee;" },
      [
        ui.el(
          "div",
          { class: "sp-detail__actions sp-detail__actions--stack sp-itemopt__stack" },
          (function () {
            var opts = [
              optionBtn(ui, "Swap", "Choose different flavor or product.", onSwap, { disabled: !canAct }),
              optionBtn(ui, "Change quantity", "Update how many you receive.", onQty, { disabled: !canAct }),
            ];

            if (canRemove) {
              opts.push(optionBtn(ui, "Remove", "Remove this item.", onRemove, { disabled: !canAct }));
            }

            return opts;
          })()
        ),
      ]
    );
    panel.hidden = true;

    return { btn: btn, disclosureRow: disclosureRow, panel: panel };
  }

  // ---- totals block ---------------------------------------------------------

  function computeTotals(contract, lines, shipLine, currencyCode, msrpCentsByVariantId) {
    var itemsNow = 0;
    var itemsMsrp = 0;

    for (var i = 0; i < lines.length; i++) {
      var p = computeLinePrices(lines[i], msrpCentsByVariantId);
      itemsNow += toNum(p.lineNow, 0);
      if (p.showMsrp) itemsMsrp += toNum(p.lineMsrp, 0);
      else itemsMsrp += toNum(p.lineNow, 0);
    }

    // Shipping Protection line (excluded from list, included in totals)
    var shipProtNow = 0;
    var shipProtMsrp = 0;
    try {
      if (shipLine) {
        var sp = computeLinePrices(shipLine, msrpCentsByVariantId);
        shipProtNow = toNum(sp.lineNow, 0);
        shipProtMsrp = sp.showMsrp ? toNum(sp.lineMsrp, 0) : toNum(sp.lineNow, 0);
      }
    } catch (eSp) {}

    // Delivery / shipping price on contract
    var ship = 0;
    try { ship = moneyAmount(contract && contract.deliveryPrice); } catch (e) { ship = 0; }

    return {
      itemsNow: itemsNow,
      itemsMsrp: itemsMsrp,
      shipProtNow: shipProtNow,
      shipProtMsrp: shipProtMsrp,
      ship: ship,
      totalNow: itemsNow + shipProtNow + ship,
      totalMsrp: itemsMsrp + shipProtMsrp + ship,
    };
  }

  function renderTotals(ui, totals, currencyCode) {
    var showMsrp = totals.totalMsrp > totals.totalNow + 0.009;

    function row(label, msrpText, nowText, isTotal) {
      return ui.el("div", { class: "sp-items-total__row" + (isTotal ? " sp-items-total__row--total" : "") }, [
        ui.el("div", { class: "sp-items-total__label" }, [label]),
        ui.el("div", { class: "sp-items-total__vals" }, [
          msrpText ? ui.el("span", { class: "sp-items-total__msrp" }, [msrpText]) : ui.el("span", {}, []),
          ui.el("span", { class: "sp-items-total__now" }, [nowText]),
        ]),
      ]);
    }

    var msrpItems = showMsrp ? formatMoney(totals.totalMsrp, currencyCode) : "";
    var nowItems = formatMoney(totals.totalNow, currencyCode);

    return ui.el("div", { class: "sp-items-total" }, [
      row("Items subtotal", "", formatMoney(totals.itemsNow, currencyCode), false),
      (totals.shipProtNow > 0.009)
        ? row("Shipping protection", "", formatMoney(totals.shipProtNow, currencyCode), false)
        : ui.el("span", {}, []),
      row("Shipping", "", formatMoney(totals.ship, currencyCode), false),
      row("Total", msrpItems, nowItems, true),
    ]);
  }

  // ---- card -----------------------------------------------------------------

  window.__SP.cards.items = {
    render: function render(ui, contractOrCtx, utilsMaybe, optsMaybe) {
      var contract = null;
      var utils = null;
      var actions = null;
      var isReadOnly = false;

      if (contractOrCtx && typeof contractOrCtx === "object" && contractOrCtx.contract) {
        contract = contractOrCtx.contract || null;
        utils = contractOrCtx.utils || null;
        actions = contractOrCtx.actions || (window.__SP.actions || null);
        isReadOnly = !!contractOrCtx.isReadOnly;
      } else {
        contract = contractOrCtx || null;
        utils = utilsMaybe || null;
        actions = (window.__SP && window.__SP.actions) ? window.__SP.actions : null;
        optsMaybe = optsMaybe || {};
        isReadOnly = !!optsMaybe.isReadOnly;
      }

      var split = splitLinesExcludingShipProt(contract, utils);
      var lines = split.lines;
      var shipLine = split.shipLine;

      // Build MSRP map from catalog (DOM)
      var catalog = getCatalogFromDom();
      var priceMaps = buildVariantPriceMapFromCatalog(catalog);
      var msrpCentsByVariantId = priceMaps.msrpCentsByVariantId;

      var currencyCode = pickCurrency(contract, lines);

      // Exclude set: exclude ALL existing subscription flavors (for both add + swap)
      var excludeVariantIds = buildExcludeVariantIdSet(lines);

      // accordion open state
      var openKey = null;
      if (lines && lines.length === 1) {
        try { openKey = lines[0] && lines[0].id ? String(lines[0].id) : null; } catch (e) { openKey = null; }
      }

      var itemParts = [];
      var listChildren = [];

      if (!lines.length) {
        listChildren.push(ui.el("p", { class: "sp-muted" }, ["No items found on this subscription."]));
      } else {
        for (var i = 0; i < lines.length; i++) {
          (function (ln, idx) {
            var key = null;
            try { key = ln && ln.id ? String(ln.id) : null; } catch (e) { key = null; }
            if (!key) key = "line_" + String(idx);

            var rowEl = renderLineRow(ui, ln, utils, currencyCode, msrpCentsByVariantId);
            var d = createDisclosure(ui, ln, contract, utils, actions, isReadOnly, lines.length, excludeVariantIds);

            var group = ui.el("div", { class: "sp-itemgroup" }, [
              rowEl,
              ui.el("div", { class: "sp-itemgroup__below" }, [
                d.disclosureRow,
                d.panel,
              ]),
            ]);

            var wrap = ui.el("div", { class: "sp-line-wrap sp-line-wrap--item", "data-line-id": key }, [group]);

            itemParts.push({ key: key, wrapEl: wrap, btn: d.btn, panel: d.panel });
            listChildren.push(wrap);
          })(lines[i], i);
        }
      }

      function setOpen(nextKey) {
        openKey = nextKey || null;

        for (var j = 0; j < itemParts.length; j++) {
          var it = itemParts[j];
          var isOpen = !!(openKey && it.key === openKey);

          try { if (it.panel) it.panel.hidden = !isOpen; } catch (e1) {}
          try { if (it.btn) it.btn.setAttribute("aria-expanded", isOpen ? "true" : "false"); } catch (e2) {}

          try {
            if (it.wrapEl) {
              if (isOpen) it.wrapEl.classList.add("sp-line-wrap--open");
              else it.wrapEl.classList.remove("sp-line-wrap--open");
            }
          } catch (e3) {}
        }
      }

      for (var k = 0; k < itemParts.length; k++) {
        (function (it) {
          if (!it || !it.btn) return;
          it.btn.addEventListener("click", function () {
            var next = (openKey && openKey === it.key) ? null : it.key;
            setOpen(next);
          });
        })(itemParts[k]);
      }

      setOpen(openKey);

      var linesEl = ui.el("div", { class: "sp-detail__lines" }, listChildren);

      // Totals (items + ship prot + shipping)
      var totalsEl = ui.el("span", {}, []);
      try {
        if (lines && (lines.length || shipLine)) {
          var totals = computeTotals(contract, lines, shipLine, currencyCode, msrpCentsByVariantId);
          totalsEl = renderTotals(ui, totals, currencyCode);
        }
      } catch (eTotals) {}

      var canAdd = !isReadOnly && !!(contract && contract.id);
            function onAdd() {
        if (!canAdd) return;

        openAddSwapModal(ui, {
          mode: "add",
          contractId: String(contract.id),
          line: null,
          excludeVariantIds: excludeVariantIds,
          actions: actions,

          // ✅ Snapshot of REAL lines only (excludes ship protection + non-real)
          getLineSnapshot: function () {
            return buildLineSnapshotFromContract(contract, utils);
          },
        });
      }

      var addRow = ui.el("div", { class: "sp-detail__items-actions" }, [
        addBtn(ui, "Add product", onAdd, { disabled: !canAdd }),
      ]);

      var hint = ui.el("p", { class: "sp-muted sp-detail__hint" }, [
        isReadOnly ? "Actions will unlock when available." : "Add a product and save even more.",
      ]);

      var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Items", "What’s included in your subscription."),
        linesEl,
        addRow,
        hint,
        totalsEl,
      ]);

      return { el: card, lines: lines, shipLine: shipLine };
    },
  };
})();