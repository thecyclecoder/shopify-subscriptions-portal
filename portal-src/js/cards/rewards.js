// assets/portal-cards-rewards.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  // Card: Rewards (placeholder)
  // usage:
  // window.__SP.cards.rewards.render(ui)
  window.__SP.cards.rewards = {
    render: function render(ui) {
      return ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Rewards", "Your points and perks."),
        ui.el(
          "div",
          { class: "sp-detail__rewards sp-muted" },
          ["Rewards widget placeholder (we’ll drop in your widget code here)."]
        ),
      ]);
    },
  };
})();