// assets/portal-cards-reviews.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  /**
   * Card: Reviews (placeholder for now)
   *
   * Usage:
   *   var card = window.__SP.cards.reviews.render(ui, contract, utils, { isReadOnly: true/false })
   * Returns: { el }
   */
  window.__SP.cards.reviews = {
    render: function render(ui /*, contract, utils*/, opts) {
      opts = opts || {};
      var isReadOnly = !!opts.isReadOnly;

      var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Reviews", "What customers are saying."),
        ui.el("div", { class: "sp-detail__reviews sp-muted" }, [
          "Auto-advancing review slider placeholder (we’ll wire this to product-tied reviews/metaobjects).",
        ]),
        ui.el("p", { class: "sp-muted sp-detail__hint" }, [
          isReadOnly ? "Actions will unlock when available." : "Coming next.",
        ]),
      ]);

      return { el: card };
    },
  };
})();