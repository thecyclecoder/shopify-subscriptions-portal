(function () {
  window.__SP = window.__SP || {};

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();

    // Theme editor: don’t scare people with signature errors
    if (window.__SP.isDesignMode) {
      ui.setRoot(ui.card(
        "<div class='sp-wrap'>" +
          "<h2 class='sp-title'>Subscriptions Portal</h2>" +
          "<p class='sp-muted'>Preview mode: data loads on the live storefront.</p>" +
        "</div>"
      ));
      return;
    }

    ui.setRoot(ui.loading("Loading your portal…"));

    // For now, call the proxy base GET (your current /apps/portal returns ok + ids)
    var data = await window.__SP.api.getJson("");

    if (!data || data.ok !== true) {
      ui.setRoot(ui.card("<div class='sp-wrap'><p>Could not load portal data.</p></div>"));
      return;
    }

    var shop = ui.escapeHtml(data.shop || "");
    var cid = ui.escapeHtml(data.logged_in_customer_id || "");

    // TEMP UI – we’ll replace with Appstle customer+subscriptions payload
    var wrap = ui.el("div", { class: "sp-wrap sp-grid" }, [
      ui.el("div", { class: "sp-card" }, [
        ui.el("div", { class: "sp-row" }, [
          ui.el("div", {}, [
            ui.el("h2", { class: "sp-title" }, ["Welcome back"]),
            ui.el("p", { class: "sp-muted" }, ["Let’s keep your results rolling."])
          ]),
          ui.el("span", { class: "sp-pill" }, ["Portal"])
        ])
      ]),
      ui.el("div", { class: "sp-card" }, [
        ui.el("p", {}, ["✅ Signed request verified"]),
        ui.el("p", { class: "sp-muted" }, ["Shop: " + shop]),
        ui.el("p", { class: "sp-muted" }, ["Customer ID: " + cid])
      ]),
      ui.el("div", { class: "sp-card" }, [
        ui.el("div", { class: "sp-row" }, [
          ui.el("a", { class: "sp-btn", href: "/portal/subscriptions?status=active" }, ["View active subscriptions"]),
          ui.el("a", { class: "sp-btn sp-btn--ghost", href: "/portal/subscriptions?status=cancelled" }, ["See cancelled (reactivate)"])
        ]),
        ui.el("p", { class: "sp-muted", style: "margin-top:10px;" }, [
          "Next: this page will call Appstle’s subscription-customer endpoint and show your active contracts, rewards, and a “stay the course” module when someone is early in their journey."
        ])
      ])
    ]);

    ui.setRoot(wrap);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.home = { render: render };
})();