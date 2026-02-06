// assets/portal-cards-shipping-protection.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.cards = window.__SP.cards || {};

  // Card: Shipping Protection
  // - Detects presence by line item title "shipping protection" OR utils.isShippingProtectionLine
  // - Toggle uses actions.shippingProtection.toggle(ui, contractGid, nextOn)
  // - "On" shows actual line price (best-effort)
  // - "Off" shows $5.00 struck-through + $3.75 (25% off)
  // - If not configured (no data-shipping-protection-variant-ids), shows hint + disables toggle
  //
  // IMPORTANT:
  // - Legacy shipping protection variant may be present in contract lines.
  // - "Toggling ON" uses the allowed variant id from the root div attribute.
  // - This file does NOT mutate the subscription; it delegates to the action.

  function getRoot() {
    return document.querySelector(".subscriptions-portal");
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function fmtMoney(n) {
    var x = Number(n);
    if (!isFinite(x)) return "";
    return "$" + x.toFixed(2);
  }

  // Best-effort parse price from a line item.
  // Returns number in dollars if found, otherwise NaN.
  function pickLinePriceDollars(ln) {
    if (!ln) return NaN;

    function unwrapAmount(x) {
      if (x == null) return null;
      if (typeof x === "object") {
        if (x.amount != null) return x.amount;
        if (x.value != null) return x.value;
      }
      return x;
    }

    // Common candidates (Appstle/Shopify shapes vary)
    var candidates = [
      // Often: { amount: { amount: "5.00", currencyCode: "USD" } }
      ln && ln.lineDiscountedPrice && ln.lineDiscountedPrice.amount && ln.lineDiscountedPrice.amount.amount,
      ln && ln.lineDiscountedPrice && ln.lineDiscountedPrice.amount,
      ln && ln.currentPrice && ln.currentPrice.amount && ln.currentPrice.amount.amount,
      ln && ln.currentPrice && ln.currentPrice.amount,
      ln && ln.price && ln.price.amount && ln.price.amount.amount,
      ln && ln.price && ln.price.amount,
      ln && ln.discountedPrice && ln.discountedPrice.amount && ln.discountedPrice.amount.amount,
      ln && ln.discountedPrice && ln.discountedPrice.amount,
      // Sometimes directly a number/string
      ln && ln.linePrice,
      ln && ln.amount,
      ln && ln.price,
    ];

    for (var i = 0; i < candidates.length; i++) {
      var v = unwrapAmount(candidates[i]);
      if (v == null) continue;

      var s = String(v).trim();
      if (!s) continue;

      // If it contains a decimal, treat as dollars
      if (s.indexOf(".") >= 0) {
        var dollars = Number(s);
        if (isFinite(dollars)) return dollars;
        continue;
      }

      // Otherwise might be cents — but we can't be 100% sure.
      // Heuristic: integers >= 50 are likely cents (e.g. 500 => $5.00)
      var n = Number(s);
      if (!isFinite(n)) continue;
      if (n >= 50) return n / 100;
      // If small integer (e.g. 5), assume dollars
      return n;
    }

    return NaN;
  }

  function lineTitleLower(ln, utils) {
    try {
      var t = utils && utils.safeStr ? utils.safeStr(ln && ln.title) : (ln && ln.title);
      return String(t || "").trim().toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function getAllowedShipProtVariantIdsFromRoot() {
    try {
      var root = getRoot();
      if (!root) return [];
      var raw = root.getAttribute("data-shipping-protection-variant-ids") || "";
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map(function (x) { return Number(x); })
        .filter(function (n) { return isFinite(n) && n > 0; });
    } catch (e) {
      return [];
    }
  }

  function findShipProtectionLine(contract, utils) {
    var linesAll = (contract && Array.isArray(contract.lines)) ? contract.lines : [];
    var found = null;

    for (var i = 0; i < linesAll.length; i++) {
      var ln = linesAll[i];
      if (!ln) continue;

      // Requirement #1: title == "shipping protection" (case-insensitive)
      if (lineTitleLower(ln, utils) === "shipping protection") {
        found = ln;
        break;
      }
    }

    // Fallback: use utils detector (legacy titles, etc.)
    if (!found && utils && typeof utils.isShippingProtectionLine === "function") {
      for (var j = 0; j < linesAll.length; j++) {
        var ln2 = linesAll[j];
        if (!ln2) continue;
        try {
          if (utils.isShippingProtectionLine(ln2)) {
            found = ln2;
            break;
          }
        } catch (e) {}
      }
    }

    return found;
  }

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, []),
    ]);
  }

  // Public renderer
  // usage:
  // window.__SP.cards.shippingProtection.render(ui, { contract, utils, actions, isReadOnly, bucket })
  window.__SP.cards.shippingProtection = {
    render: function render(ui, ctx) {
      ctx = ctx || {};
      var contract = ctx.contract || {};
      var utils = ctx.utils || window.__SP.utils || {};
      var actions = ctx.actions || window.__SP.actions || {};
      var isReadOnly = !!ctx.isReadOnly;
      var bucket = String(ctx.bucket || "");

      var shipProtLine = findShipProtectionLine(contract, utils);
      var shipHas = !!shipProtLine;

      // Determine "configured": needs at least one allowed variant id from root attr
      var allowed = getAllowedShipProtVariantIdsFromRoot();
      var isConfigured = allowed.length > 0;

      // Action existence
      var hasAction =
        actions &&
        actions.shippingProtection &&
        typeof actions.shippingProtection.toggle === "function";

      // Enable toggle rules
      // - not read-only
      // - action exists
      // - configured
      // - not cancelled (can't edit)
      var canToggle = !isReadOnly && hasAction && isConfigured && (bucket !== "cancelled");

      // Pricing
      var onPrice = pickLinePriceDollars(shipProtLine);
      var onPriceText = isFinite(onPrice) ? fmtMoney(onPrice) : "$0.00";

      var listPrice = 5.0;
      var discPrice = listPrice * 0.75;

      var priceRow = shipHas
        ? ui.el("div", { class: "sp-muted", style: "margin-top:6px;" }, [
            ui.el("span", {}, ["Price: "]),
            ui.el("strong", {}, [onPriceText]),
          ])
        : ui.el("div", { class: "sp-muted", style: "margin-top:6px;" }, [
            ui.el("span", {}, ["Price: "]),
            ui.el("span", { style: "text-decoration:line-through; margin-right:8px;" }, [fmtMoney(listPrice)]),
            ui.el("strong", {}, [fmtMoney(discPrice)]),
          ]);

      // Toggle element
      // NOTE: ui.el("input", attrs, []) is used elsewhere; we follow that.
      var toggleAttrs = { class: "sp-switch", type: "checkbox" };
      if (shipHas) toggleAttrs.checked = true;
      if (!canToggle) toggleAttrs.disabled = true;

      var toggleEl = ui.el("input", toggleAttrs, []);

      // Wire change handler (only if canToggle)
      if (canToggle) {
        toggleEl.addEventListener("change", function () {
          try {
            if (toggleEl.disabled) return;
          } catch (e) {}

          var nextOn = !!toggleEl.checked;

          // Lock immediately to prevent double toggle spam
          try { toggleEl.disabled = true; } catch (e) {}

          actions.shippingProtection
            .toggle(ui, contract.id, nextOn)
            .then(function () {
              // Re-render screen after server patch/caches are handled by action
              try {
                if (window.__SP.screens && window.__SP.screens.subscriptionDetail && typeof window.__SP.screens.subscriptionDetail.render === "function") {
                  window.__SP.screens.subscriptionDetail.render();
                }
              } catch (e) {}
            })
            .catch(function () {
              // Revert checkbox on failure
              try { toggleEl.checked = !nextOn; } catch (e) {}
              try {
                if (window.__SP.screens && window.__SP.screens.subscriptionDetail && typeof window.__SP.screens.subscriptionDetail.render === "function") {
                  window.__SP.screens.subscriptionDetail.render();
                }
              } catch (e2) {}
            });
        });
      }

      var hintText = "";
      if (!isConfigured) hintText = "Shipping protection is not configured.";
      else if (isReadOnly) hintText = "Actions will unlock when available.";
      else if (bucket === "cancelled") hintText = "This subscription can’t be edited right now.";
      else hintText = "Toggle to add or remove shipping protection for your next order.";

      var hintEl = ui.el("p", { class: "sp-muted sp-detail__hint" }, [hintText]);

      return ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Shipping Protection", "Protect orders from loss or theft during shipping."),
        ui.el("div", { class: "sp-detail__shiprow" }, [
          ui.el("div", { class: "sp-detail__shipmeta" }, [
            ui.el("div", { class: "sp-detail__shipstate" }, [shipHas ? "Currently on" : "Currently off"]),
            ui.el("p", { class: "sp-muted sp-detail__shipsub" }, ["Protects against loss, theft, and damage in transit."]),
            priceRow,
          ]),
          ui.el("div", { class: "sp-switchwrap" }, [toggleEl]),
        ]),
        hintEl,
      ]);
    },
  };
})();