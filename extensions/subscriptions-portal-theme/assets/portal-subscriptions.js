(function () {
  window.__SP = window.__SP || {};

  function getStatusFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return (params.get("status") || "active").toLowerCase();
  }

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();

    ui.setRoot(ui.loading("Loading subscriptions…"));

    // TEMP: we are not calling Appstle yet. Just show tabs + placeholder.
    var status = getStatusFromUrl();

    var wrap = ui.el("div", { class: "sp-wrap sp-grid" }, [
      ui.el("div", { class: "sp-card" }, [
        ui.el("h2", { class: "sp-title" }, ["Your subscriptions"]),
        ui.el("p", { class: "sp-muted" }, ["Status: " + status])
      ]),
      ui.el("div", { class: "sp-card" }, [
        ui.el("div", { class: "sp-row" }, [
          ui.el("a", { class: "sp-btn sp-btn--ghost", href: "/pages/portal/subscriptions?status=active" }, ["Active"]),
          ui.el("a", { class: "sp-btn sp-btn--ghost", href: "/pages/portal/subscriptions?status=cancelled" }, ["Cancelled"]),
          ui.el("a", { class: "sp-btn sp-btn--ghost", href: "/pages/portal/subscriptions?status=all" }, ["All (limit 5)"])
        ]),
        ui.el("p", { class: "sp-muted", style: "margin-top:10px;" }, [
          "Next: render cards for contracts. Cancelled list should only fetch when status=cancelled."
        ])
      ])
    ]);

    ui.setRoot(wrap);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.subscriptions = { render: render };
})();