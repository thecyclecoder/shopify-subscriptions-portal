(function () {
  window.__SP = window.__SP || {};

  function safeRender(screenKey) {
    var ui = window.__SP.ui;
    var screens = window.__SP.screens || {};
    var screen = screens[screenKey];

    if (screen && typeof screen.render === "function") {
      return screen.render();
    }

    try { console.warn("[Portal Router] Missing screen:", screenKey, screen); } catch (e) {}

    if (ui) {
      ui.setRoot(
        ui.card(
          "<div class='sp-wrap'>" +
            "<h2 class='sp-title'>Loading…</h2>" +
            "<p class='sp-muted'>The portal is still loading. Please refresh.</p>" +
            (window.__SP.debug ? "<p class='sp-muted'>Missing screen: <code>" + screenKey + "</code></p>" : "") +
          "</div>"
        )
      );
    }
  }

  function start() {
    if (!window.__SP.root) return;

    window.addEventListener("popstate", route);

    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;

      var href = a.getAttribute("href") || "";
      if (!href.startsWith("/pages/portal")) return;

      e.preventDefault();
      window.history.pushState({}, "", href);
      route();
    });

    route();
  }

  function route() {
    var path = String(window.location.pathname || "");

    // Normalize: strip trailing slash so "/pages/portal/" becomes "/pages/portal"
    path = path.replace(/\/+$/, "");

    if (path === "/pages/portal") return safeRender("home");
    if (path.indexOf("/pages/portal/subscriptions") === 0) return safeRender("subscriptions");

    // ✅ Detail page is always "/pages/portal/subscription?id=123"
    // (querystring is not part of pathname, so we only match the base path)
    if (path === "/pages/portal/subscription") return safeRender("subscriptionDetail");

    if (window.__SP.ui) {
      window.__SP.ui.setRoot(
        window.__SP.ui.card(
          "<div class='sp-wrap'><h2 class='sp-title'>Not found</h2><p class='sp-muted'>That portal page does not exist.</p></div>"
        )
      );
    }
  }

  window.__SP.router = { start: start };
})();