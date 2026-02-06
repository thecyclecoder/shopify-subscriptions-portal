// assets/portal-actions-shipping-protection.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};

  // -----------------------------------------------------------------------------
  // Shipping Protection toggle
  // - Uses replaceVariants route (our reusable API)
  // - Returns a PATCH like pause/resume/address:
  //     { ok:true, patch:{ lines:[...], deliveryPrice?, updatedAt? }, appstle? }
// - Enforces:
//     - qty hard 1 for shipping protection
//     - never remove last real subscription item
//     - never allow subscription to contain only shipping protection
// -----------------------------------------------------------------------------

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function getRoot() {
    return document.querySelector(".subscriptions-portal");
  }

  function pickShopFromUrl() {
    try {
      var sp = new URLSearchParams(window.location.search || "");
      return sp.get("shop") || "";
    } catch (e) {
      return "";
    }
  }

  function getShop() {
    try {
      var root = getRoot();
      var s = root ? String(root.getAttribute("data-shop") || "").trim() : "";
      if (s) return s;
    } catch (e) {}
    return pickShopFromUrl();
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function pickShipProtVariantIdFromMeta(meta) {
    // primary: passed from caller (detail screen), fallback: root data attr
    try {
      var id = toNum(meta && meta.shippingProtectionVariantId, 0);
      if (id > 0) return id;
    } catch (e) {}

    try {
      var root = getRoot();
      var raw =
        (root && root.getAttribute("data-shipping-protection-variant-id")) ||
        (root && root.getAttribute("data-ship-protection-variant-id")) ||
        (root && root.getAttribute("data-shipping-protection-variant")) ||
        (root && root.getAttribute("data-ship-protection-variant")) ||
        "";
      var n = toNum(String(raw).trim(), 0);
      return n > 0 ? n : 0;
    } catch (e) {}

    return 0;
  }

  function getContractLines(contract) {
    try {
      if (contract && Array.isArray(contract.lines)) return contract.lines;
    } catch (e) {}
    try {
      if (contract && contract.lines && Array.isArray(contract.lines.nodes)) return contract.lines.nodes;
    } catch (e) {}
    return [];
  }

  function isShipProtLine(ln) {
    // Requirement: title "shipping protection" is authoritative
    try {
      var t = ln && ln.title ? String(ln.title) : "";
      if (t.trim().toLowerCase() === "shipping protection") return true;
      if (t.toLowerCase().indexOf("shipping protection") >= 0) return true;
    } catch (e) {}

    try {
      if (window.__SP.utils && typeof window.__SP.utils.isShippingProtectionLine === "function") {
        return !!window.__SP.utils.isShippingProtectionLine(ln);
      }
    } catch (e) {}

    return false;
  }

  function countNonShipProtLines(contract) {
    var n = 0;
    var lines = getContractLines(contract);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (!ln) continue;
      if (isShipProtLine(ln)) continue;
      n++;
    }
    return n;
  }

  function findExistingShipProt(contract) {
    var vids = [];
    var lineIds = [];

    var lines = getContractLines(contract);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (!ln) continue;
      if (!isShipProtLine(ln)) continue;

      try {
        if (ln.id) lineIds.push(String(ln.id));
      } catch (e) {}

      try {
        var vid = toNum(shortId(ln.variantId), 0);
        if (vid > 0) vids.push(vid);
      } catch (e) {}
    }

    // unique
    try { vids = Array.from(new Set(vids)); } catch (_) {}
    try { lineIds = Array.from(new Set(lineIds)); } catch (_) {}

    return { variantIds: vids, lineIds: lineIds };
  }

  async function fetchFreshContractByShortId(contractShortId) {
    // Use home() because it's already part of our cached architecture
    var home = await window.__SP.api.requestJson("home", {}, { force: true });

    var list =
      (window.__SP.utils && typeof window.__SP.utils.pickContracts === "function")
        ? window.__SP.utils.pickContracts(home)
        : (home && (home.contracts || home.contracts_preview) ? (home.contracts || home.contracts_preview) : []);

    var arr = Array.isArray(list) ? list : [];
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c) continue;
      if (shortId(c.id) === String(contractShortId)) return c;
    }
    return null;
  }

  function mergeLinesPatch(contract, patch) {
    // Minimal merge: if patch.lines exists, overwrite contract.lines
    if (!contract || typeof contract !== "object") return contract;
    if (!patch || typeof patch !== "object") return contract;

    if (patch.lines) contract.lines = patch.lines;
    if (patch.deliveryPrice) contract.deliveryPrice = patch.deliveryPrice;
    if (patch.updatedAt) contract.updatedAt = patch.updatedAt;
    return contract;
  }

  var __inFlight = false;

  // Public action (what detail screen will call):
  // actions.toggleShippingProtection(ui, contractGid, nextOn, meta)
  window.__SP.actions.toggleShippingProtection = async function toggleShippingProtection(ui, contractGid, nextOn, meta) {
    var busy = window.__SP.actions && window.__SP.actions.busy;
    if (!busy) throw new Error("busy_not_loaded");
    if (__inFlight) return { ok: false, error: "busy" };

    __inFlight = true;

    return busy.withBusy(
      ui,
      async function () {
        var contractShortId = 0;
        try {
          contractShortId = toNum(shortId(contractGid), 0);
          if (!contractShortId) throw new Error("missing_contractId");

          var shop = getShop();
          if (!shop) throw new Error("missing_shop");

          var shipProtVariantId = pickShipProtVariantIdFromMeta(meta);
          if (nextOn && !shipProtVariantId) throw new Error("missing_shipping_protection_variant_id");

          // Pull latest contract so removals are accurate + enforce rules
          var contract = await fetchFreshContractByShortId(contractShortId);
          if (!contract) throw new Error("contract_not_found");

          // Guardrails:
          // - must have at least one non-shipping-protection line to allow SP on
          var nonSpCount = countNonShipProtLines(contract);
          if (nextOn && nonSpCount < 1) {
            throw new Error("cannot_add_shipping_protection_to_empty_subscription");
          }

          var existing = findExistingShipProt(contract);

          // Build replaceVariants request:
          // - Always remove existing SP first (enforce qty=1 / dedupe)
          // - If turning ON, add exactly qty 1 for ship protection variant
          var useOldLineId = (existing.lineIds && existing.lineIds.length === 1) ? existing.lineIds[0] : "";
          var removeVariantIds = existing.variantIds || [];

          var newVariants = undefined;
          if (nextOn) {
            newVariants = {};
            newVariants[String(shipProtVariantId)] = 1;
          }

          var payload = {
            shop: shop,
            contractId: contractShortId,

            oldLineId: useOldLineId || undefined,
            oldVariants: useOldLineId ? undefined : (removeVariantIds.length ? removeVariantIds : undefined),

            newVariants: newVariants,

            eventSource: "CUSTOMER_PORTAL",
            stopSwapEmails: true,
            carryForwardDiscount: "PRODUCT_THEN_EXISTING",
          };

          // If turning OFF and there is nothing to remove, treat as success (already off)
          if (!nextOn) {
            var hasRemoval = !!(payload.oldLineId || (payload.oldVariants && payload.oldVariants.length));
            if (!hasRemoval) {
              try { busy.showToast(ui, "Shipping protection removed.", "success"); } catch (e) {}
              return {
                ok: true,
                contractId: contractShortId,
                patch: { lines: getContractLines(contract) }
              };
            }
          }

          // Call our route (server will hit Appstle replace-variants-v3)
          var resp = await window.__SP.api.postJson("replaceVariants", payload);
          if (!resp || resp.ok === false) {
            throw new Error((resp && resp.error) ? resp.error : "replace_variants_failed");
          }

          // Clear caches so subsequent screen renders are correct
          try {
            if (window.__SP.api && typeof window.__SP.api.clearCaches === "function") {
              window.__SP.api.clearCaches();
            }
          } catch (e) {}

          // Our replaceVariants route should return a patch (like address/pause/resume)
          var patch = (resp && resp.patch) ? resp.patch : null;

          // If the route didn’t return patch yet, best-effort refresh via busy helper
          if (!patch && busy && typeof busy.refreshContractByShortId === "function") {
            var fresh = await busy.refreshContractByShortId(String(contractShortId));
            // Convert to patch-ish shape (overwrite lines)
            patch = { lines: getContractLines(fresh || {}) };
          }

          // Toast
          try {
            busy.showToast(ui, nextOn ? "Shipping protection added." : "Shipping protection removed.", "success");
          } catch (e) {}

          return {
            ok: true,
            contractId: contractShortId,
            patch: patch || {},
            app: resp || null,
          };
        } catch (e) {
          // Visible + loggable error
          try {
            console.warn("[toggleShippingProtection] failed", e);
          } catch (_) {}
          try {
            busy.showToast(ui, "Sorry — we couldn’t update shipping protection. Please try again.", "error");
          } catch (_) {}

          return { ok: false, error: String(e && e.message ? e.message : e) };
        }
      },
      "Updating shipping protection…"
    ).finally(function () {
      __inFlight = false;
    });
  };

})();