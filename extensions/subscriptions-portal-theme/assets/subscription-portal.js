// assets/subscription-portal.js
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

    // ---- Config parsing (unchanged) ----
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
      var s = cleanStr(val);
      if (!s) return [];

      if ((s[0] === "[" && s[s.length - 1] === "]") || (s[0] === "{" && s[s.length - 1] === "}")) {
        try {
          var parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            return parsed.map(function (x) { return cleanStr(x); }).filter(Boolean);
          }
        } catch (_) {}
      }

      return s.split(",").map(function (x) { return cleanStr(x); }).filter(Boolean);
    }

    function parsePortalConfig(el) {
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

        shipping_protection_variant_ids: getAttrAny(el, [
          "data-shipping-protection-variant-ids",
          "data-shipping_protection_variant_ids",
          "data-shipping-protection-variants",
          "data-shipping-protection-variant-ids-json"
        ]),

        products_available_to_add: getAttrAny(el, [
          "data-products-available-to-add",
          "data-products_available_to_add",
          "data-products-add"
        ]),

        addons: getAttrAny(el, ["data-addons", "data-addon-products", "data-addons-products"]),

        products_available_to_add_variant_ids: getAttrAny(el, [
          "data-products-available-to-add-variant-ids",
          "data-products_available_to_add_variant_ids",
          "data-products-add-variant-ids",
          "data-products-available-variant-ids"
        ]),

        addons_variant_ids: getAttrAny(el, [
          "data-addons-variant-ids",
          "data-addons_variant_ids",
          "data-addon-variant-ids",
          "data-addon-variants"
        ])
      };

      var cfg = {
        lockWindowDays: toInt(raw.lock_window_days, 7),
        sellingPlans: {
          week4: cleanStr(raw.selling_plan_week_4),
          week8: cleanStr(raw.selling_plan_week_8),
          week2: cleanStr(raw.selling_plan_week_2)
        },
        shippingProtectionProduct: cleanStr(raw.shipping_protection_product),
        shippingProtectionVariantIds: parseList(raw.shipping_protection_variant_ids),
        productsAvailableToAdd: parseList(raw.products_available_to_add),
        addons: parseList(raw.addons),
        productsAvailableToAddVariantIds: parseList(raw.products_available_to_add_variant_ids),
        addonsVariantIds: parseList(raw.addons_variant_ids)
      };

      return { raw: raw, config: cfg };
    }

    // Global config for bundle modules
    window.__SP = window.__SP || {};
    window.__SP.endpoint = endpoint;
    window.__SP.portalPage = portalPage;
    window.__SP.debug = debug;
    window.__SP.isDesignMode = isDesignMode;
    window.__SP.root = root;
    window.__SP.el = el;

    var parsed = parsePortalConfig(el);
    window.__SP.configRaw = parsed.raw;
    window.__SP.config = parsed.config;

    log("[Portal Config] raw:", window.__SP.configRaw);
    log("[Portal Config] normalized:", window.__SP.config);

    if (isDesignMode) {
      root.innerHTML = "<p style='color:#6b7280;'>Preview mode: subscription data loads on the live storefront.</p>";
      return;
    }

    root.innerHTML = "<p style='text-align: center;'>Loading...</p>";

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
    log("[Subscriptions Portal] portalPage:", portalPage);

    // Load ONE bundled file
    loadScript(base + "portal.bundle.js")
      .then(function () {
        // Bundle should register ui/router/etc onto window.__SP
        // Router should mount its own shell (your existing bundle code already does this).
        if (window.__SP && window.__SP.router && typeof window.__SP.router.start === "function") {
          window.__SP.router.start();
          return;
        }

        // Fallback debug if bundle didn't initialize as expected
        root.innerHTML = "<p>Portal bundle loaded, but router was not initialized.</p>";
      })
      .catch(function (err) {
        console.error("[Subscriptions Portal] Boot error:", err);
        root.innerHTML = "<p>Could not load portal. Please refresh. If this keeps happening, contact support.</p>";
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