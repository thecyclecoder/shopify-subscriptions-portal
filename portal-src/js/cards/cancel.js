// assets/portal-cards-cancel.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  /**
   * Card: Cancel subscription
   *
   * This is intentionally conservative:
   * - Button is disabled by default
   * - Real cancel flow (survey / confirmation) will be wired later
   *
   * Usage:
   *   var card = window.__SP.cards.cancel.render(ui, contract, utils, {
   *     isReadOnly: true/false,
   *     canCancel: true/false
   *   })
   * Returns: { el }
   */
  window.__SP.cards.cancel = {
    render: function render(ui, contract /*, utils*/, opts) {
      opts = opts || {};
      var isReadOnly = !!opts.isReadOnly;
      var canCancel = !!opts.canCancel && !isReadOnly;

      var btnAttrs = {
        type: "button",
        class: "sp-btn sp-btn--danger",
      };

      if (!canCancel) {
        btnAttrs.class += " sp-btn--disabled";
        btnAttrs.disabled = true;
      }

      var card = ui.el("div", { class: "sp-card sp-detail__cancel" }, [
        ui.el("div", { class: "sp-detail__cancel-row" }, [
          ui.el("div", {}, [
            ui.el("div", { class: "sp-detail__cancel-title" }, ["Cancel subscription"]),
            ui.el("p", { class: "sp-muted sp-detail__cancel-sub" }, [
              "We’ll ask a couple quick questions first.",
            ]),
          ]),
          ui.el("button", btnAttrs, ["Cancel"]),
        ]),
      ]);

      return { el: card };
    },
  };
})();