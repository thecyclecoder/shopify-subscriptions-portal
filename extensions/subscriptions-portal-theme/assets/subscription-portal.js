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

    // ---- Config parsing (NEW) ----
    function getAttrAny(el, names) {
      for (var i = 0; i < names.length; i++) {
        var v = el.getAttribute(names[i]);
        if (v !== null && v !== undefined && String(v).trim() !== "") return v;
      }
      return "";
    }

    function toInt(val, fallback) {
      var n = parseInt(String(val || "").trim(), 10);
      return isFinite(n) ? n : fallback;
    }

    function cleanStr(val) {
      return String(val == null ? "" : val).trim();
    }

    function parseList(val) {
      // Accept JSON array string or comma-separated list
      var s = cleanStr(val);
      if (!s) return [];

      // Try JSON
      if ((s[0] === "[" && s[s.length - 1] === "]") || (s[0] === "{" && s[s.length - 1] === "}")) {
        try {
          var parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            return parsed.map(function (x) { return cleanStr(x); }).filter(Boolean);
          }
        } catch (_) {}
      }

      // CSV fallback
      return s
        .split(",")
        .map(function (x) { return cleanStr(x); })
        .filter(Boolean);
    }

    function parsePortalConfig(el) {
      // These names are flexible: supports a few likely attribute variants.
      // You can standardize later; this keeps you moving now.
      var raw = {
        lock_window_days: getAttrAny(el, ["data-lock-window-days", "data-lock_window_days", "data-config-lock-window-days"]),
        selling_plan_week_4: getAttrAny(el, ["data-selling-plan-week-4", "data-selling_plan_week_4", "data-selling-plan-week4"]),
        selling_plan_week_8: getAttrAny(el, ["data-selling-plan-week-8", "data-selling_plan_week_8", "data-selling-plan-week8"]),
        selling_plan_week_2: getAttrAny(el, ["data-selling-plan-week-2", "data-selling_plan_week_2", "data-selling-plan-week2"]),

        shipping_protection_product: getAttrAny(el, [
          "data-shipping-protection-product",
          "data-shipping_protection_product",
          "data-shipping-protection-product-id"
        ]),

        products_available_to_add: getAttrAny(el, [
          "data-products-available-to-add",
          "data-products_available_to_add",
          "data-products-add"
        ]),

        addons: getAttrAny(el, ["data-addons", "data-addon-products", "data-addons-products"])
      };

      // Normalize into a stable shape
      var cfg = {
        lockWindowDays: toInt(raw.lock_window_days, 7),

        sellingPlans: {
          week4: cleanStr(raw.selling_plan_week_4),
          week8: cleanStr(raw.selling_plan_week_8),
          week2: cleanStr(raw.selling_plan_week_2)
        },

        // store product identifiers as strings (handle or id; your screens can decide)
        shippingProtectionProduct: cleanStr(raw.shipping_protection_product),

        // arrays of identifiers (handle or id)
        productsAvailableToAdd: parseList(raw.products_available_to_add),
        addons: parseList(raw.addons)
      };

      return { raw: raw, config: cfg };
    }

    // Global config for other modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.portalPage = portalPage;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode;
    window.__SP.root = root;
    window.__SP.el = el;

    // Parse config ONCE, store on window.__SP
    var parsed = parsePortalConfig(el);
    window.__SP.configRaw = parsed.raw;
    window.__SP.config = parsed.config;

    log("[Portal Config] raw:", window.__SP.configRaw);
    log("[Portal Config] normalized:", window.__SP.config);

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

    // ---- Navigation helpers (programmatic SPA nav) ----

    function normalizePortalPage(p) {
      p = String(p || "/pages/portal");
      // strip trailing slash
      return p.replace(/\/+$/, "");
    }

    function getPortalPageBase() {
      return normalizePortalPage(window.__SP && window.__SP.portalPage ? window.__SP.portalPage : portalPage);
    }

    function navTo(url, opts) {
      opts = opts || {};
      url = String(url || "");
      if (!url) return;

      try {
        if (opts.replace) window.history.replaceState({}, "", url);
        else window.history.pushState({}, "", url);
      } catch (e) {
        // Fallback hard navigation
        window.location.href = url;
        return;
      }

      // Router listens to popstate; pushState doesn't fire it automatically.
      try { window.dispatchEvent(new Event("popstate")); } catch (e) {}
    }

    function currentPortalScreen() {
      var base = getPortalPageBase(); // "/pages/portal"
      var path = String(window.location.pathname || "");
      // only reason about screens inside the portal base
      if (path.indexOf(base) !== 0) return "other";

      var tail = path.slice(base.length); // "" | "/" | "/subscriptions" | "/subscription/..."
      tail = String(tail || "").replace(/^\/+/, ""); // remove leading slashes

      if (!tail) return "home";
      if (tail.indexOf("subscriptions") === 0) return "subscriptions";
      if (tail.indexOf("subscription") === 0) return "subscription-detail";
      return "other";
    }

    function subscriptionsUrlFromHere() {
      var base = getPortalPageBase();
      // preserve status if present, default active
      var params = new URLSearchParams(window.location.search || "");
      var status = (params.get("status") || "active").toLowerCase();
      return base + "/subscriptions?status=" + encodeURIComponent(status);
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

      function updateBackLink() {
        var screen = currentPortalScreen();
        var isHome = screen === "home";

        backLink.textContent = "← " + (isHome ? "Account" : "Back");
        backLink.setAttribute("href", isHome ? "/account" : "#");
      }

      function handleBack(e) {
        var screen = currentPortalScreen();

        // Home screen: let the normal href="/account" navigation happen
        if (screen === "home") return;

        // All other screens: custom behavior (no history walking through filters)
        if (e && e.preventDefault) e.preventDefault();

        var base = getPortalPageBase();

        // On subscriptions list, ALWAYS go to portal home
        if (screen === "subscriptions") {
          navTo(base, { replace: false });
          return false;
        }

        // Detail: go back to subscriptions (preserve status query if present)
        if (screen === "subscription-detail") {
          navTo(subscriptionsUrlFromHere(), { replace: false });
          return false;
        }

        // Fallback: portal home
        navTo(base, { replace: false });
        return false;
      }

      backLink.addEventListener("click", handleBack);

      // Initial + update on SPA navigation
      updateBackLink();
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
          if (window.__SP && typeof window.__SP.setScreenRoot === "function") {
            window.__SP.setScreenRoot(htmlOrEl);
            return;
          }
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
      .then(function () { return loadScript(base + "portal-utils.js"); })
      .then(function () { return loadScript(base + "portal-ui.js"); })
      .then(function () { return loadScript(base + "portal-api.js"); })
      // NEW: actions (load before screens)
      .then(function () { return loadScript(base + "portal-actions-busy.js"); })
      .then(function () { return loadScript(base + "portal-actions-pause.js"); })
      .then(function () { return loadScript(base + "portal-actions-resume.js"); })
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