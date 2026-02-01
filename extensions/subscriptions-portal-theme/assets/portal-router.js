(function () {
  window.__SP = window.__SP || {};

  function start() {
    var root = window.__SP.root;
    if (!root) return;

    // Ensure we render correct screen on back/forward too
    window.addEventListener("popstate", route);

    // Intercept internal portal links so the URL changes WITHOUT full page reload
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;

      var href = a.getAttribute("href") || "";
      if (!href.startsWith("/portal")) return;

      e.preventDefault();
      window.history.pushState({}, "", href);
      route();
    });

    route();
  }

  function route() {
    var path = window.location.pathname;

    // Support Shopify page route too
    // If the real path is /pages/portal but you redirect to /portal later, this still works.
    if (path === "/pages/portal") path = "/portal";

    if (path === "/portal" || path === "/portal/") {
      return window.__SP.screens.home.render();
    }

    if (path.startsWith("/portal/subscriptions")) {
      return window.__SP.screens.subscriptions.render();
    }

    if (path.startsWith("/portal/subscription/")) {
      return window.__SP.screens.subscriptionDetail.render();
    }

    // Default
    window.__SP.ui.setRoot(window.__SP.ui.card(
      "<div class='sp-wrap'><h2 class='sp-title'>Not found</h2><p class='sp-muted'>That portal page does not exist.</p></div>"
    ));
  }

  window.__SP.router = { start: start };
})();