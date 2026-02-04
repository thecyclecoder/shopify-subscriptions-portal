// assets/portal-utils.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.utils = window.__SP.utils || {};

  function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function normalizeStatus(s) {
    return safeStr(s).trim().toUpperCase();
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";
    try {
      return new Date(t).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return new Date(t).toDateString();
    }
  }

  function money(m) {
    // m: { amount: "0.0", currencyCode:"USD" } or null
    if (!m || m.amount == null) return "";
    var code = m.currencyCode ? safeStr(m.currencyCode) : "USD";
    var n = Number(m.amount);
    if (!isFinite(n)) {
      // last resort: try to coerce string -> 2dp if possible
      var raw = safeStr(m.amount);
      var maybe = Number(raw);
      if (isFinite(maybe)) n = maybe;
      else return "$" + raw + (code && code !== "USD" ? " " + code : "");
    }
    var amt = n.toFixed(2);
    return "$" + amt + (code && code !== "USD" ? " " + code : "");
  }

  function isShippingProtectionLine(ln) {
    var title = String((ln && ln.title) || "").trim().toLowerCase();
    var sku = String((ln && ln.sku) || "").trim().toLowerCase();
    if (title === "shipping protection") return true;
    if (sku.indexOf("shipping") >= 0 && sku.indexOf("protect") >= 0) return true;
    return false;
  }

  function billingLabel(policy) {
    // 4 weeks -> Monthly
    // 8 weeks -> Every other month
    // 2 weeks -> Twice a month
    var interval = policy && policy.interval ? safeStr(policy.interval).toUpperCase() : "";
    var count = policy && policy.intervalCount != null ? Number(policy.intervalCount) : NaN;

    if (interval === "WEEK") {
      if (count === 4) return "Monthly";
      if (count === 8) return "Every other month";
      if (count === 2) return "Twice a month";
    }

    // fallback for anything else
    if (interval && isFinite(count) && count > 0) {
      return (
        String(count) +
        " " +
        interval.toLowerCase() +
        (count > 1 ? "s" : "")
      );
    }
    return "Billing schedule";
  }

  function shortId(gid) {
    var s = safeStr(gid);
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function safeJsonParse(textOrObj) {
    try {
      if (textOrObj == null) return null;
      if (typeof textOrObj === "object") return textOrObj;
      var t = safeStr(textOrObj);
      if (!t) return null;
      return JSON.parse(t);
    } catch (e) {
      return null;
    }
  }

  // ---- contractsMeta helpers ----------------------------------------------

  function pickContractsMeta(homeData) {
    if (!homeData) return [];
    if (Array.isArray(homeData.contractsMeta)) return homeData.contractsMeta;
    if (Array.isArray(homeData.contracts_meta)) return homeData.contracts_meta;
    if (Array.isArray(homeData.contracts_meta_preview)) return homeData.contracts_meta_preview;
    if (Array.isArray(homeData.contractsMeta_preview)) return homeData.contractsMeta_preview;
    return [];
  }

  function buildMetaIndex(metaArr) {
    var byNum = Object.create(null);
    var byGid = Object.create(null);

    (metaArr || []).forEach(function (m) {
      if (!m) return;

      // subscriptionContractId is numeric, graphSubscriptionContractId is gid://...
      var n = Number(m.subscriptionContractId);
      if (isFinite(n) && n > 0) byNum[String(n)] = m;

      var gid = safeStr(m.graphSubscriptionContractId);
      if (gid) byGid[gid] = m;
    });

    return { byNum: byNum, byGid: byGid };
  }

  function attrsFromMeta(meta) {
    // meta.orderNoteAttributes is usually a JSON-string with { orderNoteAttributesList:[{key,value}] }
    var raw = meta ? meta.orderNoteAttributes : null;
    var parsed = safeJsonParse(raw);

    var list =
      parsed &&
      parsed.orderNoteAttributesList &&
      Array.isArray(parsed.orderNoteAttributesList)
        ? parsed.orderNoteAttributesList
        : null;

    var out = Object.create(null);
    if (list) {
      for (var i = 0; i < list.length; i++) {
        var kv = list[i];
        if (!kv) continue;
        var k = safeStr(kv.key);
        if (!k) continue;
        out[k] = kv.value == null ? "" : String(kv.value);
      }
    }
    return out;
  }

  function derivePauseInfo(contract, attrs) {
    // “soft pause” = we keep contract ACTIVE but we push nextBillingDate and set portal_* attrs
    attrs = attrs || Object.create(null);

    var lastAction = safeStr(attrs.portal_last_action).toLowerCase();
    var pauseDaysRaw = attrs.portal_pause_days;
    var pauseDays = pauseDaysRaw != null ? Number(pauseDaysRaw) : NaN;
    var actionAt = safeStr(attrs.portal_last_action_at);

    var isPauseAction = lastAction.indexOf("pause_") === 0 || lastAction === "pause";
    var hasPauseDays = isFinite(pauseDays) && pauseDays > 0;

    // pausedUntil: prefer contract.nextBillingDate, fallback to attrs.portal_paused_until if you ever add it
    var pausedUntilIso = safeStr(contract && contract.nextBillingDate) || safeStr(attrs.portal_paused_until);
    var pausedUntilTs = pausedUntilIso ? Date.parse(pausedUntilIso) : NaN;
    var pausedUntil = isFinite(pausedUntilTs) ? new Date(pausedUntilTs) : null;

    // Soft paused when it looks like a pause action AND we have a future nextBillingDate
    var now = Date.now();
    var isFuture = pausedUntil ? pausedUntil.getTime() > now : false;
    var softPaused = !!(isPauseAction && hasPauseDays && isFuture);

    return {
      softPaused: softPaused,
      pauseDays: hasPauseDays ? pauseDays : null,
      pausedUntilIso: pausedUntilIso || "",
      pausedUntilLabel: pausedUntilIso ? fmtDate(pausedUntilIso) : "",
      lastAction: lastAction,
      lastActionAt: actionAt,
    };
  }

  function attachMetaToContracts(contracts, metaArr) {
    if (!Array.isArray(contracts) || !contracts.length) return contracts || [];

    var meta = Array.isArray(metaArr) && metaArr.length ? metaArr : [];
    if (!meta.length) return contracts;

    var idx = buildMetaIndex(meta);

    // mutate in-place (simpler, and current code expects plain contract objects)
    for (var i = 0; i < contracts.length; i++) {
      var c = contracts[i];
      if (!c) continue;

      var gid = safeStr(c.id);
      var num = shortId(gid);
      var m = (num && idx.byNum[num]) || (gid && idx.byGid[gid]) || null;

      if (m) {
        c.__meta = m;
        c.__attrs = attrsFromMeta(m);

        var pause = derivePauseInfo(c, c.__attrs);
        c.__softPaused = pause.softPaused;
        c.__pauseDays = pause.pauseDays;
        c.__pausedUntilIso = pause.pausedUntilIso;
        c.__pausedUntilLabel = pause.pausedUntilLabel;
      } else {
        // ensure these exist so screens can safely read
        c.__meta = c.__meta || null;
        c.__attrs = c.__attrs || null;
        c.__softPaused = !!c.__softPaused;
      }
    }

    return contracts;
  }

  // ---- existing pickContracts, now meta-aware ------------------------------

  function pickContracts(homeData) {
    if (!homeData) return [];

    var contracts = [];
    if (Array.isArray(homeData.contracts)) contracts = homeData.contracts;
    else if (Array.isArray(homeData.contracts_preview)) contracts = homeData.contracts_preview;

    // Attach contractsMeta when present
    var metaArr = pickContractsMeta(homeData);
    if (contracts && contracts.length && metaArr && metaArr.length) {
      attachMetaToContracts(contracts, metaArr);
    }

    return contracts || [];
  }

  // convenience helpers for screens
  function getContractAttrs(contract) {
    return (contract && contract.__attrs) || Object.create(null);
  }

  function isSoftPaused(contract) {
    return !!(contract && contract.__softPaused);
  }

  function getPausedUntilLabel(contract) {
    return safeStr(contract && contract.__pausedUntilLabel);
  }

  // Export (additive, do not overwrite existing keys unless missing)
  var u = window.__SP.utils;

  if (!u.safeStr) u.safeStr = safeStr;
  if (!u.normalizeStatus) u.normalizeStatus = normalizeStatus;
  if (!u.fmtDate) u.fmtDate = fmtDate;
  if (!u.money) u.money = money;
  if (!u.isShippingProtectionLine) u.isShippingProtectionLine = isShippingProtectionLine;
  if (!u.billingLabel) u.billingLabel = billingLabel;
  if (!u.pickContracts) u.pickContracts = pickContracts;
  if (!u.shortId) u.shortId = shortId;

  // NEW exports
  if (!u.pickContractsMeta) u.pickContractsMeta = pickContractsMeta;
  if (!u.attachMetaToContracts) u.attachMetaToContracts = attachMetaToContracts;
  if (!u.getContractAttrs) u.getContractAttrs = getContractAttrs;
  if (!u.isSoftPaused) u.isSoftPaused = isSoftPaused;
  if (!u.getPausedUntilLabel) u.getPausedUntilLabel = getPausedUntilLabel;

  // tiny debug hook
  if (window.__SP && window.__SP.debug) {
    try { console.log("[Portal Utils] Loaded:", Object.keys(window.__SP.utils)); } catch (e) {}
  }
})();