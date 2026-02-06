// assets/portal-cards-coupon.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  // Card: Coupon (placeholder for now)
  // usage:
  // window.__SP.cards.coupon.render(ui, { isReadOnly })
  window.__SP.cards.coupon = {
    render: function render(ui, ctx) {
      ctx = ctx || {};
      return ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Coupon", "Apply a discount to your next subscription order."),
        ui.el("div", { class: "sp-detail__coupon" }, [
          ui.el("input", { class: "sp-input", type: "text", placeholder: "Enter coupon code", disabled: true }, []),
          ui.el("button", { type: "button", class: "sp-btn sp-btn--disabled", disabled: true }, ["Apply"]),
        ]),
        ui.el("p", { class: "sp-muted sp-detail__hint" }, ["Coming next."]),
      ]);
    },
  };
})();