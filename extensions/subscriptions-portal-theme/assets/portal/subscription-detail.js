(function () {
  window.__SP = window.__SP || {};

  function getIdFromPath() {
    // /portal/subscription/:id
    var parts = window.location.pathname.split("/").filter(Boolean);
    var idx = parts.indexOf("subscription");
    if (idx === -1) return "";
    return parts[idx + 1] || "";
  }

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();

    var id = getIdFromPath();
    ui.setRoot(ui.loading("Loading subscription…"));

    var wrap = ui.el("div", { class: "sp-wrap sp-grid" }, [
      ui.el("div", { class: "sp-card" }, [
        ui.el("h2", { class: "sp-title" }, ["Subscription"]),
        ui.el("p", { class: "sp-muted" }, ["ID: " + (id || "(missing)")])
      ]),
      ui.el("div", { class: "sp-card" }, [
        ui.el("p", {}, ["Actions will live here: pause, skip, swap, update qty."]),
        ui.el("p", { class: "sp-muted" }, [
          "Cancel gating will happen here too (we will check Shopify fulfillment before enabling cancel)."
        ])
      ])
    ]);

    ui.setRoot(wrap);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.subscriptionDetail = { render: render };
})();