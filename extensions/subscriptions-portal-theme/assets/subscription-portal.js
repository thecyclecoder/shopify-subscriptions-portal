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
    var portalPage = el.getAttribute("data-portal-page") || "/pages/portal";
    var debug = el.getAttribute("data-debug") === "true";
    var isDesignMode = document.documentElement.classList.contains("shopify-design-mode");

    function wireLocationChangeEvent() {
      if (window.__SP && window.__SP.__wiredLocationChange) return;
      window.__SP = window.__SP || {};
      window.__SP.__wiredLocationChange = true;

      function emit() {
        try { window.dispatchEvent(new Event("sp:locationchange")); } catch (e) {}
      }

      // Patch pushState/replaceState so SPA navigations emit
      ["pushState", "replaceState"].forEach(function (fn) {
        var orig = history[fn];
        if (!orig) return;
        history[fn] = function () {
          var ret = orig.apply(this, arguments);
          emit();
          return ret;
        };
      });

      window.addEventListener("popstate", emit);
      window.addEventListener("hashchange", emit);
    }

    wireLocationChangeEvent();

    // Global config for other modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.portalPage = portalPage;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode;
    window.__SP.root = root;
    window.__SP.el = el;

    if (isDesignMode) {
      root.innerHTML =
        "<p style='color:#6b7280;'>Preview mode: subscription data loads on the live storefront.</p>";
      return;
    }

    root.innerHTML = "<p style='text-align: center;'>Loading...</p>";

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


    // ---- Top bar helpers (global) ----

    function openSupport(e) {
      if (e && e.preventDefault) e.preventDefault();

      try {
        if (window.GorgiasChat && typeof window.GorgiasChat.open === "function") {
          window.GorgiasChat.open();
          return false;
        }
      } catch (_) {}

      // Fallback: open support site in new tab
      try {
        window.open("https://help.superfoodscompany.com", "_blank", "noopener");
      } catch (_) {
        // last resort
        window.location.href = "https://help.superfoodscompany.com";
      }
      return false;
    }



    function renderTopBar(ui) {
      function getPortalScreen() {
        var path = String(window.location.pathname || "");
        var m = path.match(/\/portal(\/.*)?$/);
        var tail = (m && m[1]) ? m[1].replace(/^\/+/, "") : "";

        if (!tail) return "home";
        if (tail.indexOf("subscriptions") === 0) return "subscriptions";
        if (tail.indexOf("subscription") === 0) return "subscription-detail";
        return "other";
      }

      function getBasePrefix() {
        return String(window.location.pathname || "").startsWith("/pages/") ? "/pages" : "";
      }

      // Build DOM nodes once
      var backLink = ui.el("a", { href: "#", class: "sp-topbar__back" }, []);
      var supportLink = ui.el(
        "a",
        {
          href: "https://help.superfoodscompany.com",
          class: "sp-topbar__support",
          target: "_blank",
          rel: "noopener",
          onclick: openSupport
        },
        [
          ui.el("span", { class: "sp-topbar__support-icon" }, ["💬"]),
          ui.el("span", { class: "sp-topbar__support-text" }, ["Support"])
        ]
      );

      function handleBack(e) {
        var screen = getPortalScreen();
        var isHome = screen === "home";

        if (isHome) {
          // allow normal navigation to /account
          return;
        }

        e.preventDefault();

        if (window.history && window.history.length > 1) {
          window.history.back();
          return false;
        }

        // fallback: portal home
        window.location.href = getBasePrefix() + "/portal";
        return false;
      }

      backLink.addEventListener("click", handleBack);

      function updateBackLink() {
        var screen = getPortalScreen();
        var isHome = screen === "home";

        // Set text and destination
        backLink.textContent = "← " + (isHome ? "Account" : "Back");
        backLink.setAttribute("href", isHome ? "/account" : "#");
      }

      // Initial
      updateBackLink();

      // Update on SPA navigation
      window.addEventListener("sp:locationchange", updateBackLink);

      return ui.el("div", { class: "sp-topbar" }, [backLink, supportLink]);
    }

    function mountShell() {
      var ui = window.__SP && window.__SP.ui;
      if (!ui || typeof ui.el !== "function") return;

      // Root shell: top bar + screen container
      var app = ui.el("div", { class: "sp-app" }, [
        renderTopBar(ui),
        ui.el("div", { id: "sp-screen-root" }, [])
      ]);

      root.innerHTML = "";
      root.appendChild(app);

      // Allow screens to render ONLY inside #sp-screen-root
      window.__SP.setScreenRoot = function (htmlOrEl) {
        var target = document.getElementById("sp-screen-root");
        if (!target) return;

        if (typeof htmlOrEl === "string") {
          target.innerHTML = htmlOrEl;
          return;
        }

        target.innerHTML = "";
        target.appendChild(htmlOrEl);
      };

      // Wrap ui.setRoot so existing screens keep working without edits
      if (ui && typeof ui.setRoot === "function" && !ui.__sp_wrapped_setRoot) {
        var originalSetRoot = ui.setRoot;
        ui.setRoot = function (htmlOrEl) {
          // If shell exists, route renders into screen root
          if (window.__SP && typeof window.__SP.setScreenRoot === "function") {
            window.__SP.setScreenRoot(htmlOrEl);
            return;
          }
          // Fallback to original behavior
          return originalSetRoot(htmlOrEl);
        };
        ui.__sp_wrapped_setRoot = true;
      }
    }

    var base = getAssetBase();
    log("[Subscriptions Portal] assetBase:", base);
    log("[Subscriptions Portal] endpoint:", endpoint);
    log("[Subscriptions Portal] portalPage:", portalPage);

    // Load in order
    Promise.resolve()
      .then(function () { return loadScript(base + "portal-ui.js"); })
      .then(function () { return loadScript(base + "portal-api.js"); })
      .then(function () { return loadScript(base + "portal-home.js"); })
      .then(function () { return loadScript(base + "portal-subscriptions.js"); })
      .then(function () { return loadScript(base + "portal-subscription-detail.js"); })
      .then(function () { return loadScript(base + "portal-router.js"); })
      .then(function () {
        // Mount shell AFTER ui is available but BEFORE routing renders screens
        mountShell();

        if (window.__SP && window.__SP.router && typeof window.__SP.router.start === "function") {
          window.__SP.router.start();
        } else {
          // Render into screen root if possible
          if (window.__SP && typeof window.__SP.setScreenRoot === "function") {
            window.__SP.setScreenRoot("<p>Portal router failed to load.</p>");
          } else {
            root.innerHTML = "<p>Portal router failed to load.</p>";
          }
        }
      })
      .catch(function (err) {
        console.error("[Subscriptions Portal] Boot error:", err);

        var msg =
          "<p>Could not load portal. Please refresh. If this keeps happening, contact support.</p>";

        if (window.__SP && typeof window.__SP.setScreenRoot === "function") {
          window.__SP.setScreenRoot(msg);
        } else {
          root.innerHTML = msg;
        }
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