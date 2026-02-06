// assets/portal-cards-frequency.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  function disabledBtn(ui, text) {
    return ui.el(
      "button",
      { type: "button", class: "sp-btn sp-btn--disabled", disabled: true },
      [text]
    );
  }

  /**
   * Card: Frequency / Billing Schedule
   *
   * This card is intentionally read-only for now.
   * The goal is to keep all frequency-related UI + future logic isolated here,
   * so wiring interactive changes later does not touch subscription-detail.js.
   *
   * Expected inputs:
   *  - ui
   *  - contract (normalized)
   *  - utils (portal-utils)
   *  - opts:
   *      - isReadOnly (boolean)
   *
   * Usage:
   *   window.__SP.cards.frequency.render(ui, contract, utils, { isReadOnly })
   */
  window.__SP.cards.frequency = {
    render: function render(ui, contract, utils, opts) {
      opts = opts || {};
      var isReadOnly = !!opts.isReadOnly;

      var freqText = "";
      try {
        freqText = utils && utils.billingLabel
          ? utils.billingLabel(contract && contract.billingPolicy)
          : "";
      } catch (e) {
        freqText = "";
      }

      return ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Your Schedule", "How often your superfoods are sent."),
        ui.el("div", { class: "sp-detail__freq" }, [
          ui.el(
            "div",
            { class: "sp-detail__freq-value" },
            [freqText ? ("Currently: " + freqText) : "Billing frequency not available."]
          ),
        ]),
        ui.el("div", { class: "sp-detail__actions" }, [
          disabledBtn(ui, "Change frequency"),
        ]),
        ui.el(
          "p",
          { class: "sp-muted sp-detail__hint" },
          [
            isReadOnly
              ? "Actions will unlock when available."
              : "Changing delivery frequency is coming next.",
          ]
        ),
      ]);
    },
  };
})();