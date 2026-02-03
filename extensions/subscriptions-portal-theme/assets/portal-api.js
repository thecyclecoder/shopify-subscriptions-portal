(function () {
  window.__SP = window.__SP || {};

  // ---- helpers -------------------------------------------------------------

  function log() {
    if (window.__SP && window.__SP.debug) {
      try { console.log.apply(console, arguments); } catch (e) {}
    }
  }

  function warn() {
    if (window.__SP && window.__SP.debug) {
      try { console.warn.apply(console, arguments); } catch (e) {}
    }
  }

  function normalizeBaseEndpoint(input) {
    var s = String(input || "").trim();
    if (!s) return "/apps/portal";
    if (!s.startsWith("/")) s = "/" + s;
    return s.replace(/\/+$/, "") || "/apps/portal";
  }

  function buildUrl(base, route, params) {
    var sp = new URLSearchParams();
    sp.set("route", String(route || "").trim() || "bootstrap");

    if (params && typeof params === "object") {
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === undefined || v === null) return;
        sp.set(k, String(v));
      });
    }

    return new URL(base + "?" + sp.toString(), window.location.origin).toString();
  }

  // ---- cache ---------------------------------------------------------------

  var HOME_CACHE_KEY = "__sp_home_cache_v1";
  var HOME_CACHE_TTL_MS = 90 * 1000; // 90 seconds

  function getHomeCache() {
    try {
      var raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setHomeCache(data) {
    try {
      sessionStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: data })
      );
    } catch (e) {}
  }

  function isCacheFresh(entry) {
    return entry && (Date.now() - entry.ts) < HOME_CACHE_TTL_MS;
  }

  function getFreshHomeData() {
    var entry = getHomeCache();
    if (!entry) return null;
    if (!isCacheFresh(entry)) return null;
    return entry.data || null;
  }

  // ---- core ---------------------------------------------------------------

  async function requestJson(route, params, opts) {
    opts = opts || {};
    route = String(route || "").toLowerCase();

    // ---- HOME CACHE SHORT-CIRCUIT -----------------------------------------
    if (route === "home") {
      var cached = getHomeCache();
      if (cached && cached.data) {
        if (isCacheFresh(cached)) {
          log("[Portal API] HOME CACHE HIT (fresh)");
          return cached.data;
        } else {
          log("[Portal API] HOME CACHE HIT (stale) — revalidating");
          // return stale immediately, refresh in background
          fetchHomeAndCache(params, opts).catch(function () {});
          return cached.data;
        }
      }
    }

    // ---- NETWORK FETCH ----------------------------------------------------
    log("[Portal API] HOME FETCH (network)");
    return await fetchHomeAndCache(route === "home" ? params : params, opts, route);
  }

  async function fetchHomeAndCache(params, opts, routeOverride) {
    var endpointRaw = window.__SP && window.__SP.endpoint;
    var base = normalizeBaseEndpoint(endpointRaw);
    var route = routeOverride || "home";

    var absUrl = buildUrl(base, route, params);

    log("[Portal API] FETCH:", absUrl);

    var res;
    try {
      res = await fetch(absUrl, {
        method: opts.method || "GET",
        credentials: "include",
        headers: Object.assign({ Accept: "application/json" }, opts.headers || {}),
        body: opts.body || undefined,
      });
    } catch (e) {
      warn("[Portal API] Fetch failed:", e);
      throw e;
    }

    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var bodyText = await res.text();
    var data;

    if (ct.indexOf("application/json") >= 0) {
      data = bodyText ? JSON.parse(bodyText) : null;
    } else {
      data = bodyText;
    }

    if (!res.ok) {
      warn("[Portal API] Non-OK:", res.status, data);
      throw new Error("HTTP_" + res.status);
    }

    if (route === "home" && data && data.ok) {
      setHomeCache(data);
      log("[Portal API] HOME CACHE UPDATED");
    }

    return data;
  }

  // ---- exports ------------------------------------------------------------

  window.__SP.api = {
    requestJson: requestJson,
    _getHomeCache: getHomeCache, // exposed for debugging if needed
    getFreshHomeData: getFreshHomeData
  };

  log("[Portal API] Loaded. window.__SP.api is ready.");
})();