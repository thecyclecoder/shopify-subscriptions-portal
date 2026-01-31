(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getAssetBase() {
    // Shopify serves assets with querystrings, but we just need the folder root.
    // This script tag is rendered by Liquid: {{ 'subscription-portal.js' | asset_url | script_tag }}
    var current = document.currentScript && document.currentScript.src;
    if (!current) return "";
    // Remove filename + querystring
    return current.split("subscription-portal.js")[0];
  }

  function bootOne(el) {
    var root = el.querySelector("#subscriptions-portal-root");
    if (!root) return;

    var endpoint = el.getAttribute("data-endpoint") || "/apps/portal";
    var debug = el.getAttribute("data-debug") === "true";
    var isDesignMode = document.documentElement.classList.contains("shopify-design-mode");

    // Store config globally for other modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode;
    window.__SP.root = root;
    window.__SP.el = el;

    var base = getAssetBase();
    // Load modules in order
    Promise.resolve()
      .then(function () { return loadScript(base + "portal/ui.js"); })
      .then(function () { return loadScript(base + "portal/api.js"); })
      .then(function () { return loadScript(base + "portal/home.js"); })
      .then(function () { return loadScript(base + "portal/subscriptions.js"); })
      .then(function () { return loadScript(base + "portal/subscription-detail.js"); })
      .then(function () { return loadScript(base + "portal/router.js"); })
      .then(function () {
        if (window.__SP && window.__SP.router && typeof window.__SP.router.start === "function") {
          window.__SP.router.start();
        } else {
          root.innerHTML = "<p>Portal router failed to load.</p>";
        }
      })
      .catch(function (err) {
        console.error("[Subscriptions Portal] Boot error:", err);
        root.innerHTML = "<p>Could not load portal scripts. Please refresh.</p>";
      });
  }

  function boot() {
    document.querySelectorAll('[data-app="subscriptions-portal"]').forEach(bootOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("shopify:section:load", boot);
})();