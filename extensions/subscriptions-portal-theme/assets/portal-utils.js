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
    // Mappings you specified:
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

  function pickContracts(homeData) {
    if (!homeData) return [];
    if (Array.isArray(homeData.contracts)) return homeData.contracts;
    if (Array.isArray(homeData.contracts_preview)) return homeData.contracts_preview;
    return [];
  }

  function shortId(gid) {
    var s = safeStr(gid);
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
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

  // tiny debug hook
  if (window.__SP && window.__SP.debug) {
    try { console.log("[Portal Utils] Loaded:", Object.keys(window.__SP.utils)); } catch (e) {}
  }
})();