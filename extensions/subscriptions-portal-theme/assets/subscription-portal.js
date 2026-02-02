(function () {
  function log() {
    try {
      if (window.__SP && window.__SP.debug) {
        console.log.apply(console, arguments);
      }
    } catch (e) {}
  }

  function init(el) {
    var root = el.querySelector("#subscriptions-portal-root");
    if (!root) return;

    var endpoint = el.getAttribute("data-endpoint") || "/apps/portal";
    var debug = el.getAttribute("data-debug") === "true";
    var isDesignMode = document.documentElement.classList.contains("shopify-design-mode");

    // Global config for other modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode;
    window.__SP.root = root;
    window.__SP.el = el;

    if (isDesignMode) {
      root.innerHTML =
        "<p style='color:#6b7280;'>Preview mode: subscription data loads on the live storefront.</p>";
      return;
    }

    root.innerHTML = "<p>Loading your subscriptions…</p>";

    // IMPORTANT:
    // We are inside a theme extension asset (cdn.shopify.com/extensions/.../assets/subscription-portal.js)
    // So other assets live in that same /assets/ directory.
    function getAssetBase() {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i] && scripts[i].getAttribute && scripts[i].getAttribute("src");
        if (!src) continue;
        if (src.indexOf("subscription-portal.js") >= 0) {
          return src.replace(/subscription-portal\.js.*$/, "");
        }
      }
      return "/";
    }

    function loadScript(url) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function (e) { reject(e); };
        document.head.appendChild(s);
      });
    }

    var base = getAssetBase();
    log("[Subscriptions Portal] assetBase:", base);
    log("[Subscriptions Portal] endpoint:", endpoint);

    // Load in order
    Promise.resolve()
      .then(function () { return loadScript(base + "portal-ui.js"); })
      .then(function () { return loadScript(base + "portal-api.js"); })
      .then(function () { return loadScript(base + "portal-home.js"); })
      .then(function () { return loadScript(base + "portal-subscriptions.js"); })
      .then(function () { return loadScript(base + "portal-subscription-detail.js"); })
      .then(function () { return loadScript(base + "portal-router.js"); })
      .then(function () {
        if (window.__SP && window.__SP.router && typeof window.__SP.router.start === "function") {
          window.__SP.router.start();
        } else {
          root.innerHTML = "<p>Portal router failed to load.</p>";
        }
      })
      .catch(function (err) {
        console.error("[Subscriptions Portal] Boot error:", err);
        root.innerHTML =
          "<p>Could not load portal. Please refresh. If this keeps happening, contact support.</p>";
      });
  }

  function boot() {
    document
      .querySelectorAll('[data-app="subscriptions-portal"]')
      .forEach(function (el) { init(el); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", boot);
})();