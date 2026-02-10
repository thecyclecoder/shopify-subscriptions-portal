// /actions/toggle-shipping-protection.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};
  window.__SP.actions.shippingProtection = window.__SP.actions.shippingProtection || {};

  // -----------------------------------------------------------------------------
  // Shipping Protection toggle (cache-first like pause.js)
  //
  // Flow:
  // 1) Read contract from __sp_subscriptions_cache_v2 (sessionStorage)
  // 2) Build replaceVariants payload using existing ship-prot line detection
  // 3) POST route=replaceVariants
  // 4) Expect resp.patch with { lines, deliveryPrice?, updatedAt? }
  // 5) Patch cached contract + refresh TTL
  // 6) Re-render current screen
  //
  // Notes:
  // - We do NOT require a "shop" param in the action itself.
  //   If your portal-api injects it globally, great; if not, we pass it only if present.
  // - When turning OFF (remove-only), pass allowRemoveWithoutAdd:true to satisfy Vercel guardrail.
  // -----------------------------------------------------------------------------

  var SUBS_CACHE_KEY = "__sp_subscriptions_cache_v2";

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function toStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  // ---- cache helpers (mirrors pause.js pattern) ----------------------------

  function looksLikeSubsCacheEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (!entry.ts || typeof entry.ts !== "number") return false;
    if (!entry.data || typeof entry.data !== "object") return false;
    if (entry.data.ok !== true) return false;
    if (!Array.isArray(entry.data.contracts)) return false;
    return true;
  }

  function readSubsCacheEntry() {
    try {
      var raw = sessionStorage.getItem(SUBS_CACHE_KEY);
      if (!raw) return null;

      var entry;
      try {
        entry = JSON.parse(raw);
      } catch (e) {
        return null;
      }

      if (!looksLikeSubsCacheEntry(entry)) return null;
      return entry;
    } catch (e) {
      return null;
    }
  }

  function writeSubsCacheEntry(entry) {
    try {
      entry.ts = Date.now();
      sessionStorage.setItem(SUBS_CACHE_KEY, JSON.stringify(entry));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getContractIndexByGid(entry, contractGid) {
    try {
      if (!entry || !entry.data || !Array.isArray(entry.data.contracts)) return -1;
      var cid = String(shortId(contractGid));
      if (!cid) return -1;

      var list = entry.data.contracts;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c || !c.id) continue;
        if (String(shortId(c.id)) === cid) return i;
      }
    } catch (e) {}
    return -1;
  }

  function getContractFromCacheByGid(contractGid) {
    try {
      var entry = readSubsCacheEntry();
      if (!entry) return null;

      var idx = getContractIndexByGid(entry, contractGid);
      if (idx < 0) return null;

      return entry.data.contracts[idx] || null;
    } catch (e) {
      return null;
    }
  }

  function applyLinesPatchToContract(contract, patch) {
    var base = (contract && typeof contract === "object") ? contract : {};
    var p = (patch && typeof patch === "object") ? patch : {};

    // shallow clone
    var next = {};
    for (var k in base) next[k] = base[k];

    if (p.lines) next.lines = p.lines;
    if (p.deliveryPrice) next.deliveryPrice = p.deliveryPrice;
    if (p.updatedAt) next.updatedAt = p.updatedAt;

    // touch updatedAt if missing
    if (!next.updatedAt) {
      try { next.updatedAt = new Date().toISOString(); } catch (e) {}
    }

    return next;
  }

  function patchContractInCache(contractGid, patch) {
    try {
      var entry = readSubsCacheEntry();
      if (!entry) return { ok: false, error: "cache_missing" };

      var idx = getContractIndexByGid(entry, contractGid);
      if (idx < 0) return { ok: false, error: "contract_not_found_in_cache" };

      var existing = entry.data.contracts[idx];
      var base = (existing && typeof existing === "object") ? existing : { id: String(contractGid) };
      var next = applyLinesPatchToContract(base, patch);

      entry.data.contracts[idx] = next;

      var wrote = writeSubsCacheEntry(entry);
      if (!wrote) return { ok: false, error: "cache_write_failed" };

      return { ok: true, contract: next };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  // ---- contract helpers ----------------------------------------------------

  function getContractLines(contract) {
    try {
      if (contract && Array.isArray(contract.lines)) return contract.lines;
    } catch (e) {}
    try {
      if (contract && contract.lines && Array.isArray(contract.lines.nodes)) return contract.lines.nodes;
    } catch (e2) {}
    return [];
  }

  function isShipProtLine(ln) {
    try {
      var t = ln && ln.title ? String(ln.title) : "";
      var tl = t.trim().toLowerCase();
      if (tl === "shipping protection") return true;
      if (tl.indexOf("shipping protection") >= 0) return true;
    } catch (e) {}

    try {
      if (window.__SP.utils && typeof window.__SP.utils.isShippingProtectionLine === "function") {
        return !!window.__SP.utils.isShippingProtectionLine(ln);
      }
    } catch (e2) {}

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
        // ln.variantId may be gid or numeric-like string
        var vid = toNum(shortId(ln.variantId), 0);
        if (vid > 0) vids.push(vid);
      } catch (e2) {}
    }

    // unique
    try { vids = Array.from(new Set(vids)); } catch (_) {}
    try { lineIds = Array.from(new Set(lineIds)); } catch (_) {}

    return { variantIds: vids, lineIds: lineIds };
  }

  // ---- config helpers (optional shop + required variant id for ON) ---------

  function getRoot() {
    return document.querySelector(".subscriptions-portal");
  }



  function pickShipProtVariantIdFromMeta(meta) {
    // primary: meta.shippingProtectionVariantId
    try {
      var id = toNum(meta && meta.shippingProtectionVariantId, 0);
      if (id > 0) return id;
    } catch (e) {}

    // fallback: root attributes (single-variant legacy)
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
    } catch (e2) {}

    return 0;
  }

  function refreshCurrentScreen() {
    try {
      if (
        window.__SP &&
        window.__SP.screens &&
        window.__SP.screens.subscriptionDetail &&
        typeof window.__SP.screens.subscriptionDetail.render === "function"
      ) {
        window.__SP.screens.subscriptionDetail.render();
        return;
      }
    } catch (e) {}

    try {
      if (
        window.__SP &&
        window.__SP.screens &&
        window.__SP.screens.subscriptions &&
        typeof window.__SP.screens.subscriptions.render === "function"
      ) {
        window.__SP.screens.subscriptions.render();
        return;
      }
    } catch (e2) {}
  }

  var __inFlight = false;

  // Main implementation (internal)
  async function toggleShippingProtectionImpl(ui, contractGid, nextOn, meta) {
    var busy = window.__SP.actions && window.__SP.actions.busy;
    if (!busy) throw new Error("busy_not_loaded");
    if (__inFlight) return { ok: false, error: "busy" };

    __inFlight = true;

    try {
      return await busy.withBusy(ui, async function () {
        try {
          var contractShortId = toNum(shortId(contractGid), 0);
          if (!contractShortId) throw new Error("missing_contractId");

          // Read contract from cache (like pause.js)
          var contract = getContractFromCacheByGid(contractGid);
          if (!contract) throw new Error("cache_missing_contract");

          // Guardrail: can’t add ship prot if there are no regular items
          var nonSpCount = countNonShipProtLines(contract);
          if (nextOn && nonSpCount < 1) {
            throw new Error("cannot_add_shipping_protection_to_empty_subscription");
          }

          // Variant id required when turning ON
          var shipProtVariantId = pickShipProtVariantIdFromMeta(meta);
          if (nextOn && !shipProtVariantId) throw new Error("missing_shipping_protection_variant_id");

          var existing = findExistingShipProt(contract);

          var useOldLineId = (existing.lineIds && existing.lineIds.length === 1) ? existing.lineIds[0] : "";
          var removeVariantIds = existing.variantIds || [];

          var newVariants = undefined;
          if (nextOn) {
            newVariants = {};
            newVariants[String(shipProtVariantId)] = 1; // qty hard 1
          }

          var payload = {
            contractId: contractShortId,

            oldLineId: useOldLineId || undefined,
            oldVariants: useOldLineId ? undefined : (removeVariantIds.length ? removeVariantIds : undefined),

            newVariants: newVariants,

            eventSource: "CUSTOMER_PORTAL",
            stopSwapEmails: true,
            carryForwardDiscount: "PRODUCT_THEN_EXISTING",

            // IMPORTANT: Vercel guardrail requires explicit allow on remove-only operations
            allowRemoveWithoutAdd: !nextOn ? true : undefined
          };



          // If turning OFF and there is nothing to remove, treat as success (already off)
          if (!nextOn) {
            var hasRemoval = !!(payload.oldLineId || (payload.oldVariants && payload.oldVariants.length));
            if (!hasRemoval) {
              try { busy.showToast(ui, "Shipping protection removed.", "success"); } catch (e) {}
              return { ok: true, contractId: contractShortId, patch: { lines: getContractLines(contract) } };
            }
          }

          // POST replaceVariants (this should be a POST; api.postJson)
          var resp = await window.__SP.api.postJson("replaceVariants", payload);
          if (!resp || resp.ok === false) {
            throw new Error(resp && resp.error ? resp.error : "replace_variants_failed");
          }

          var patch = (resp && resp.patch) ? resp.patch : null;
          if (!patch || typeof patch !== "object") patch = {};

          // Patch cache like pause.js
          var result = patchContractInCache(contractGid, patch);
          if (!result.ok) {
            try { console.warn("[toggleShippingProtection] cache patch failed:", result.error); } catch (e2) {}
          }

          refreshCurrentScreen();

          try {
            busy.showToast(ui, nextOn ? "Shipping protection added." : "Shipping protection removed.", "success");
          } catch (e3) {}

          return { ok: true, contract: result.contract || null, patch: patch };
        } catch (e) {
          try { busy.showToast(ui, "Sorry — we couldn’t update shipping protection. Please try again.", "error"); } catch (_) {}
          return { ok: false, error: String(e && e.message ? e.message : e) };
        }
      }, "Updating shipping protection…");
    } finally {
      __inFlight = false;
    }
  }

  // Public API expected by the card:
  // actions.shippingProtection.toggle(ui, contractGid, nextOn, meta?)
  window.__SP.actions.shippingProtection.toggle = function (ui, contractGid, nextOn, meta) {
    return toggleShippingProtectionImpl(ui, contractGid, nextOn, meta);
  };


})();