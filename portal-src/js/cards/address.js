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

  function showToast(ui, msg, type) {
    try {
      var busy = window.__SP.actions && window.__SP.actions.busy;
      if (busy && typeof busy.showToast === "function") {
        busy.showToast(ui, msg, type || "success");
      }
    } catch (e) {}
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

  // ---------- Inline item row (image + meta only; NO buttons) -----------------

  function renderLineRow(ui, ln, utils) {
    var img = getLineImageUrl(ln, utils);
    var title = (utils && utils.safeStr ? utils.safeStr(ln && ln.title) : safeStr(ln && ln.title)) || "Item";
    var variant = utils && utils.safeStr ? utils.safeStr(ln && ln.variantTitle) : safeStr(ln && ln.variantTitle);
    var qty = toNum(ln && ln.quantity, 1) || 1;

    return ui.el("div", { class: "sp-line sp-line--detail" }, [
      img
        ? ui.el("img", { class: "sp-line__img", src: img, alt: title })
        : ui.el("div", { class: "sp-line__img sp-line__img--placeholder" }, []),
      ui.el("div", { class: "sp-line__meta" }, [
        ui.el("div", { class: "sp-line__title" }, [title]),
        variant ? ui.el("div", { class: "sp-line__sub sp-muted" }, [variant]) : ui.el("span", {}, []),
        ui.el("div", { class: "sp-line__sub sp-muted" }, ["Qty " + String(isFinite(qty) ? qty : 1)]),
      ]),
    ]);
  }

  // ---------- Disclosure + panel --------------------------------------------

  function buildActionRow(ui, title, desc, onClick, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;

    var btnAttrs = { type: "button", class: "sp-action-row__btn" };
    if (disabled) btnAttrs.disabled = true;

    var btn = ui.el("button", btnAttrs, [
      ui.el("div", { class: "sp-action-row__title" }, [title]),
      desc ? ui.el("div", { class: "sp-action-row__desc sp-muted" }, [desc]) : ui.el("span", {}, []),
    ]);

    if (!disabled && typeof onClick === "function") {
      btn.addEventListener("click", onClick);
    }

    return ui.el("div", { class: "sp-action-row" + (disabled ? " sp-action-row--disabled" : "") }, [btn]);
  }

  function createItemDisclosure(ui, ln, contract, actions, isReadOnly) {
    var canAct = !isReadOnly && !!(contract && contract.id);

    function notWired(name) {
      showToast(ui, name + " is not wired yet.", "error");
    }

    function onSwap() {
      try {
        if (actions && actions.items && typeof actions.items.swap === "function") {
          actions.items.swap(ui, String(contract.id), ln);
          return;
        }
      } catch (e) {}
      notWired("Swap");
    }

    function onQty() {
      try {
        if (actions && actions.items && typeof actions.items.changeQty === "function") {
          actions.items.changeQty(ui, String(contract.id), ln);
          return;
        }
      } catch (e) {}
      notWired("Change quantity");
    }

    function onRemove() {
      try {
        if (actions && actions.items && typeof actions.items.remove === "function") {
          actions.items.remove(ui, String(contract.id), ln);
          return;
        }
      } catch (e) {}
      notWired("Remove");
    }

    // Disclosure button (full width)
    var disclosureBtn = ui.el(
      "button",
      { type: "button", class: "sp-disclosure__btn", "aria-expanded": "false" },
      [
        ui.el("span", { class: "sp-disclosure__label" }, ["Make changes to this item"]),
        ui.el("span", { class: "sp-disclosure__chev", "aria-hidden": "true" }, ["▾"]),
      ]
    );

    var disclosureRow = ui.el("div", { class: "sp-line__disclosure" }, [disclosureBtn]);

    // Panel content (vertical list)
    var panel = ui.el("div", { class: "sp-line__panel", hidden: true }, [
      ui.el("div", { class: "sp-action-list" }, [
        buildActionRow(ui, "Swap", "Choose a different flavor or product.", onSwap, { disabled: !canAct }),
        buildActionRow(ui, "Change quantity", "Update how many of this item you receive.", onQty, { disabled: !canAct }),
        buildActionRow(ui, "Remove", "Remove this item from your subscription.", onRemove, { disabled: !canAct }),
      ]),
    ]);

    return { disclosureRow: disclosureRow, panel: panel, btn: disclosureBtn };
  }

  // ---------- Main card ------------------------------------------------------

  window.__SP.cards.items = {
    render: function render(ui, contractOrCtx, utilsMaybe, optsMaybe) {
      var ctx = null;
      var contract = null;
      var utils = null;
      var actions = null;
      var isReadOnly = false;

      // New style: render(ui, ctx)
      if (contractOrCtx && typeof contractOrCtx === "object" && contractOrCtx.contract) {
        ctx = contractOrCtx;
        contract = ctx.contract || null;
        utils = ctx.utils || null;
        actions = ctx.actions || (window.__SP.actions || null);
        isReadOnly = !!ctx.isReadOnly;
      } else {
        // Old style: render(ui, contract, utils, opts)
        contract = contractOrCtx || null;
        utils = utilsMaybe || null;
        actions = (window.__SP && window.__SP.actions) ? window.__SP.actions : null;
        optsMaybe = optsMaybe || {};
        isReadOnly = !!optsMaybe.isReadOnly;
      }

      var split = splitLinesExcludingShipProt(contract, utils);
      var lines = split.lines;

      // Accordion state
      var openKey = null; // line.id string

      // If there is exactly one line item, open by default
      if (lines && lines.length === 1) {
        try {
          openKey = lines[0] && lines[0].id ? String(lines[0].id) : null;
        } catch (e) {
          openKey = null;
        }
      }

      var itemParts = []; // [{ key, wrapEl, btn, panel }]
      var listChildren = [];

      if (!lines.length) {
        listChildren.push(ui.el("p", { class: "sp-muted" }, ["No items found on this subscription."]));
      } else {
        for (var i = 0; i < lines.length; i++) {
          (function (ln) {
            var key = null;
            try {
              key = ln && ln.id ? String(ln.id) : null;
            } catch (e) {
              key = null;
            }
            if (!key) key = "line_" + String(i);

            var rowEl = renderLineRow(ui, ln, utils);
            var d = createItemDisclosure(ui, ln, contract, actions, isReadOnly);

            var wrap = ui.el("div", { class: "sp-line-wrap", "data-line-id": key }, [
              rowEl,
              d.disclosureRow,
              d.panel,
            ]);

            itemParts.push({ key: key, wrapEl: wrap, btn: d.btn, panel: d.panel });
            listChildren.push(wrap);
          })(lines[i]);
        }
      }

      function setOpen(nextKey) {
        openKey = nextKey || null;

        for (var j = 0; j < itemParts.length; j++) {
          var it = itemParts[j];
          var isOpen = !!(openKey && it.key === openKey);

          try {
            if (it.panel) it.panel.hidden = !isOpen;
          } catch (e1) {}

          try {
            if (it.btn) it.btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
          } catch (e2) {}

          try {
            if (it.wrapEl) {
              if (isOpen) it.wrapEl.classList.add("sp-line-wrap--open");
              else it.wrapEl.classList.remove("sp-line-wrap--open");
            }
          } catch (e3) {}
        }
      }

      // Wire disclosure clicks
      for (var k = 0; k < itemParts.length; k++) {
        (function (it) {
          if (!it || !it.btn) return;
          it.btn.addEventListener("click", function () {
            // Toggle current; accordion means opening closes others
            var next = (openKey && openKey === it.key) ? null : it.key;
            setOpen(next);
          });
        })(itemParts[k]);
      }

      // Initial open state
      setOpen(openKey);

      var linesEl = ui.el("div", { class: "sp-detail__lines" }, listChildren);

      var canAdd = !isReadOnly && !!(contract && contract.id);

      function onAdd() {
        try {
          if (actions && actions.items && typeof actions.items.add === "function") {
            actions.items.add(ui, String(contract.id));
            return;
          }
        } catch (e) {}
        showToast(ui, "Add product is not wired yet.", "error");
      }

      var addRow = ui.el("div", { class: "sp-detail__items-actions" }, [
        addBtn(ui, "Add product", onAdd, { disabled: !canAdd }),
      ]);

      var hint = ui.el("p", { class: "sp-muted sp-detail__hint" }, [
        isReadOnly
          ? "Actions will unlock when available."
          : "Add products, swap flavors, remove items, and adjust quantities (1–3) here.",
      ]);

      var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Items", "What’s included in your subscription."),
        linesEl,
        addRow,
        hint,
      ]);

      return { el: card, lines: lines, shipLine: split.shipLine };
    },
  };
})();