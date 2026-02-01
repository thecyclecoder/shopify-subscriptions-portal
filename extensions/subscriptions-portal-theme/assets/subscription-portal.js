(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      switch (m) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return m;
      }
    });
  }

  function isDesignMode() {
    // Shopify adds this class in the theme editor
    return document.documentElement.classList.contains("shopify-design-mode");
  }

  function getExtensionAssetBase() {
    // Find the script tag that loaded subscription-portal.js and derive its directory.
    // Example:
    // https://cdn.shopify.com/extensions/.../assets/subscription-portal.js
    // -> https://cdn.shopify.com/extensions/.../assets/
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("subscription-portal.js") !== -1) {
        return src.split("subscription-portal.js")[0];
      }
    }
    return null;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      // Avoid double-loading the same script
      var existing = document.querySelector('script[data-sp-src="' + src + '"]');
      if (existing) return resolve();

      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-sp-src", src);
      s.onload = function () {
        resolve();
      };
      s.onerror = function (e) {
        reject(e);
      };
      document.head.appendChild(s);
    });
  }

  function bootOne(el) {
    var root = el.querySelector("#subscriptions-portal-root");
    if (!root) return;

    var endpoint = el.getAttribute("data-endpoint") || "/apps/portal";
    var debug = el.getAttribute("data-debug") === "true";

    // Store config globally for other modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode();
    window.__SP.root = root;
    window.__SP.el = el;

    if (window.__SP.isDesignMode) {
      // In the theme editor, Shopify app proxy signature often won't be present.
      // Avoid showing scary errors.
      root.innerHTML =
        "<p style='color:#6b7280; font-size:16px; line-height:1.4;'>Preview mode: portal data loads on the live storefront.</p>";
      return;
    }

    root.innerHTML =
      "<p style='font-size:16px; line-height:1.4;'>Loading your subscriptions…</p>";

    var base = getExtensionAssetBase();
    if (!base) {
      console.error("[Subscriptions Portal] Could not determine extension asset base.");
      root.innerHTML =
        "<p style='font-size:16px; line-height:1.4;'>Could not load portal scripts. Please refresh.</p>";
      return;
    }

    if (debug) {
      console.log("[Subscriptions Portal] asset base:", base);
      console.log("[Subscriptions Portal] endpoint:", endpoint);
    }

    // Load modules in order from the SAME assets directory as subscription-portal.js
    Promise.resolve()
      .then(function () {
        return loadScript(base + "portal-ui.js");
      })
      .then(function () {
        return loadScript(base + "portal-api.js");
      })
      .then(function () {
        return loadScript(base + "portal-home.js");
      })
      .then(function () {
        return loadScript(base + "portal-subscriptions.js");
      })
      .then(function () {
        return loadScript(base + "portal-subscription-detail.js");
      })
      .then(function () {
        return loadScript(base + "portal-router.js");
      })
      .then(function () {
        if (window.__SP && window.__SP.router && typeof window.__SP.router.start === "function") {
          window.__SP.router.start();
          return;
        }

        console.error("[Subscriptions Portal] router.start() not found.");
        root.innerHTML =
          "<p style='font-size:16px; line-height:1.4;'>Portal router failed to load.</p>";
      })
      .catch(function (err) {
        console.error("[Subscriptions Portal] Boot error:", err);

        var hint =
          "<p style='margin-top:10px;color:#6b7280;font-size:14px;line-height:1.4;'>" +
          "Tip: confirm these assets exist in your theme extension:<br/>" +
          "<code>portal-ui.js</code>, <code>portal-api.js</code>, <code>portal-home.js</code>, " +
          "<code>portal-subscriptions.js</code>, <code>portal-subscription-detail.js</code>, <code>portal-router.js</code>" +
          "</p>";

        root.innerHTML =
          "<div style='padding:14px;border:1px solid #e5e7eb;border-radius:12px;'>" +
          "<p style='margin:0;font-size:16px;line-height:1.4;'><strong>Could not load portal scripts.</strong> Please refresh.</p>" +
          (debug ? hint : "") +
          "</div>";
      });
  }

  function boot() {
    var nodes = document.querySelectorAll('[data-app="subscriptions-portal"]');
    for (var i = 0; i < nodes.length; i++) bootOne(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", boot);
})();