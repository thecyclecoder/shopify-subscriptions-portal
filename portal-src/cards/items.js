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

  function disabledGhostBtn(ui, text) {
    return ui.el(
      "button",
      { type: "button", class: "sp-btn sp-btn--ghost sp-btn--disabled", disabled: true },
      [text]
    );
  }

  function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function getLineImageUrl(ln, utils) {
    try {
      if (utils && typeof utils.safeStr === "function") {
        return utils.safeStr(ln && ln.variantImage && ln.variantImage.transformedSrc);
      }
    } catch (e) {}
    return safeStr(ln && ln.variantImage && ln.variantImage.transformedSrc);
  }

  function renderLine(ui, ln, utils) {
    var img = getLineImageUrl(ln, utils);
    var title = (utils && utils.safeStr ? utils.safeStr(ln && ln.title) : safeStr(ln && ln.title)) || "Item";
    var variant = utils && utils.safeStr ? utils.safeStr(ln && ln.variantTitle) : safeStr(ln && ln.variantTitle);
    var qty = ln && ln.quantity != null ? Number(ln.quantity) : 1;

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

  function getContractLines(contract) {
    // Normalized contract should have contract.lines as an array, but keep defensive.
    try {
      if (contract && Array.isArray(contract.lines)) return contract.lines;
    } catch (e) {}
    try {
      if (contract && contract.lines && Array.isArray(contract.lines.nodes)) return contract.lines.nodes;
    } catch (e) {}
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

  /**
   * Card: Items
   *
   * Expected inputs:
   *  - ui
   *  - contract (normalized)
   *  - utils (portal-utils)
   *  - opts:
   *      - isReadOnly (boolean)
   *
   * Usage:
   *   var out = window.__SP.cards.items.render(ui, contract, utils, { isReadOnly: true/false })
   *   // out: { el, lines, shipLine }
   */
  window.__SP.cards.items = {
    render: function render(ui, contract, utils, opts) {
      opts = opts || {};
      var isReadOnly = !!opts.isReadOnly;

      var split = splitLinesExcludingShipProt(contract, utils);
      var lines = split.lines;

      var linesEl = ui.el("div", { class: "sp-detail__lines" }, (function () {
        if (!lines.length) return [ui.el("p", { class: "sp-muted" }, ["No items found on this subscription."])];
        return lines.map(function (ln) { return renderLine(ui, ln, utils); });
      })());

      var actionsRow = ui.el("div", { class: "sp-detail__items-actions" }, [
        disabledGhostBtn(ui, "Add product"),
        disabledGhostBtn(ui, "Swap product"),
        disabledGhostBtn(ui, "Change quantity"),
        disabledGhostBtn(ui, "Remove product"),
      ]);

      var hint = ui.el("p", { class: "sp-muted sp-detail__hint" }, [
        isReadOnly
          ? "Actions will unlock when available."
          : "You’ll be able to add products as one-time or subscribe, swap flavors, and adjust quantities (1–3) here.",
      ]);

      var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Items", "What’s included in your subscription."),
        linesEl,
        actionsRow,
        hint,
      ]);

      return { el: card, lines: lines, shipLine: split.shipLine };
    },
  };
})();