// assets/portal-subscription-detail.js
(function () {
  window.__SP = window.__SP || {};
  window.__SP.screens = window.__SP.screens || {};

  // ---------------------------------------------------------------------------
  // Assumptions (no backwards compat):
  // - Subscriptions payload shape is subscriptions.ts: { ok:true, contracts:[...], buckets:{...} }
  // - Contract shape is contract-external, with portalState attached
  // - Portal-api caches subscriptions response in sessionStorage with { ts:number, data:payload }
  // - Cache key is fixed: "__sp_subscriptions_cache_v2"
  // - Cards are loaded onto window.__SP.cards.* and return { el } from .render()
  // ---------------------------------------------------------------------------

  var SUBS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (match portal-api)
  var SUBS_CACHE_KEY = "__sp_subscriptions_cache_v2";

  function getContractIdFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var id = params.get("id");
      return id ? String(id).trim() : "";
    } catch (e) {
      return "";
    }
  }

  function getConfig() {
    var cfg = (window.__SP && window.__SP.config) || {};
    return {
      lockDays: Number(cfg.lockDays || 7),
      portalLock: !!cfg.portalLock,
    };
  }

  function toNumDate(iso) {
    var t = typeof iso === "string" ? Date.parse(iso) : NaN;
    return isFinite(t) ? t : 0;
  }

  function daysBetween(aMs, bMs) {
    var MS_PER_DAY = 24 * 60 * 60 * 1000;
    if (!aMs || !bMs) return 0;
    return Math.floor(Math.abs(bMs - aMs) / MS_PER_DAY);
  }

  function safeGetUtils() {
    return (window.__SP && window.__SP.utils) || null;
  }

  function pill(ui, text, kind) {
    var cls = "sp-pill sp-pill--neutral";
    if (kind === "active") cls = "sp-pill sp-pill--active";
    if (kind === "cancelled") cls = "sp-pill sp-pill--cancelled";
    if (kind === "paused") cls = "sp-pill sp-pill--paused";
    return ui.el("span", { class: cls }, [text]);
  }

  function renderAlert(ui, title, body) {
    return ui.el("div", { class: "sp-alert" }, [
      ui.el("div", { class: "sp-alert__title" }, [title]),
      ui.el("div", { class: "sp-alert__body sp-muted" }, [body]),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Cache read: fixed subscriptions cache entry in sessionStorage
  // ---------------------------------------------------------------------------

  function looksLikeSubsCacheEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (!entry.ts || typeof entry.ts !== "number") return false;
    if (!entry.data || typeof entry.data !== "object") return false;
    if (entry.data.ok !== true) return false;
    if (!Array.isArray(entry.data.contracts)) return false;
    return true;
  }

  function readSubscriptionsCachePayload() {
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
      if (Date.now() - entry.ts > SUBS_CACHE_TTL_MS) return null;

      return entry.data;
    } catch (e) {
      return null;
    }
  }

  function findContractInPayload(payload, contractId, utils) {
    if (!payload || !Array.isArray(payload.contracts)) return null;

    var list = utils.pickContracts(payload);
    var want = String(contractId || "").trim();
    if (!want) return null;

    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c) continue;
      if (utils.shortId(c.id) === want) return c;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Direct fetch (ONLY when cache missing / expired)
  // ---------------------------------------------------------------------------

  async function fetchSubscriptionDetailDirect(contractId) {
    if (!window.__SP.api || typeof window.__SP.api.requestJson !== "function") {
      throw new Error("api_not_loaded");
    }
    return await window.__SP.api.requestJson(
      "subscriptionDetail",
      { id: String(contractId || "") },
      { force: true }
    );
  }

  function normalizeDetailResponse(resp, utils) {
    if (!resp || resp.ok !== true) return null;
    var c = resp.contract || resp.data || resp.subscription || resp.appstle || null;
    if (!c || typeof c !== "object") return null;
    return utils.normalizeContract(c);
  }

  // ---------------------------------------------------------------------------
  // Cards registry helpers
  // ---------------------------------------------------------------------------

  function getCards() {
    return (window.__SP && window.__SP.cards) || {};
  }

  function safeCardRender(cardName, ui, ctx) {
    ctx = ctx || {};
    try {
      var cards = getCards();
      var card = cards && cards[cardName];
      if (!card || typeof card.render !== "function") return null;

      // ✅ all cards are render(ui, ctx)
      var out = card.render(ui, ctx);

      // ✅ Cards should return a DOM node (what ui.el returns)
      if (out && (out.nodeType === 1 || out.nodeType === 11)) return out;

      // Allow legacy { el: Node } just in case
      if (out && out.el && (out.el.nodeType === 1 || out.el.nodeType === 11)) return out.el;

      return null;
    } catch (e) {
      try {
        console.warn("[portal] card render failed:", cardName, e);
      } catch (_) {}
      return null;
    }
  }

  function placeholderCard(ui, title, body) {
    return ui.el("div", { class: "sp-card sp-detail__card" }, [
      ui.el("div", { class: "sp-detail__sectionhead" }, [
        ui.el("div", { class: "sp-title2" }, [title]),
        ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [body || ""]),
      ]),
      ui.el("p", { class: "sp-muted sp-detail__hint" }, ["(Card not loaded)"]),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();
    ui.setRoot(ui.loading("Loading subscription…"));

    var utils = safeGetUtils();
    if (!utils || typeof utils.pickContracts !== "function" || typeof utils.normalizeContract !== "function") {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Portal utils not loaded"]),
            ui.el("p", { class: "sp-muted" }, ["Please refresh. If this keeps happening, contact support."]),
          ]),
        ])
      );
      return;
    }

    var actions = window.__SP.actions || {};
    var cfg = getConfig();
    var contractId = getContractIdFromUrl();

        // URLs for cancel flow + always-available exit back to details
    var pathname = "";
    try { pathname = String(window.location.pathname || ""); } catch (e) { pathname = ""; }

    var detailUrl = pathname + "?id=" + encodeURIComponent(String(contractId || ""));
    var cancelUrl = detailUrl + "&intent=cancel";

    if (!contractId) {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Missing subscription id"]),
            ui.el("p", { class: "sp-muted" }, ["Please go back and open the subscription again."]),
          ]),
        ])
      );
      return;
    }

    // 1) Try subscriptions cache first (no network)
    var cachedPayload = readSubscriptionsCachePayload();
    var contract = cachedPayload ? findContractInPayload(cachedPayload, contractId, utils) : null;

    // 2) If cache miss, fetch direct (no cache write)
    if (!contract) {
      try {
        var detailResp = await fetchSubscriptionDetailDirect(contractId);
        contract = normalizeDetailResponse(detailResp, utils);
      } catch (e) {
        try {
          console.error("[Portal] subscriptionDetail fetch error:", e);
        } catch (_) {}
        ui.setRoot(
          ui.el("div", { class: "sp-wrap sp-grid" }, [
            ui.el("div", { class: "sp-card" }, [
              ui.el("h2", { class: "sp-title" }, ["Could not load subscription"]),
              ui.el("p", { class: "sp-muted" }, ["Please refresh. If this keeps happening, contact support."]),
            ]),
          ])
        );
        return;
      }
    }

    if (!contract) {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Subscription not found"]),
            ui.el("p", { class: "sp-muted" }, ["We couldn’t find that subscription in your account."]),
          ]),
        ])
      );
      return;
    }

    contract = utils.normalizeContract(contract);

    var bucket = utils.bucket(contract);
    var needsAttention = !!(contract && contract.portalState && contract.portalState.needsAttention);

    var statusText = bucket === "cancelled" ? "Cancelled" : bucket === "paused" ? "Paused" : "Active";
    var statusKind = bucket === "cancelled" ? "cancelled" : bucket === "paused" ? "paused" : "active";

    var createdMs = toNumDate(contract.createdAt);
    var now = Date.now();
    var ageDays = createdMs ? daysBetween(createdMs, now) : 9999;
    var isYoung = ageDays < cfg.lockDays;
    var isPortalLocked = !!cfg.portalLock;
    var isReadOnly = isYoung || isPortalLocked;

    // Split shipping protection line from items
    var linesAll = Array.isArray(contract.lines) ? contract.lines : [];
    var shipLine = null;
    var lines = [];

    for (var i = 0; i < linesAll.length; i++) {
      var ln = linesAll[i];
      if (!ln) continue;
      try {
        if (utils.isShippingProtectionLine && utils.isShippingProtectionLine(ln) && !shipLine) {
          shipLine = ln;
          continue;
        }
      } catch (e) {}
      lines.push(ln);
    }

    // Subtitle
    var subtitleText = "";
    if (bucket === "paused") {
      var untilIso = contract && contract.nextBillingDate ? String(contract.nextBillingDate) : "";
      var untilLabel = untilIso ? utils.fmtDate(untilIso) : "";
      subtitleText = untilLabel ? "Paused until " + untilLabel : "This subscription is paused.";
    } else if (contract && contract.nextBillingDate) {
      var nextLabel = utils.fmtDate(String(contract.nextBillingDate));
      subtitleText = nextLabel ? "Your next order is on " + nextLabel : "";
    } else {
      subtitleText = "Your next order date is not available";
    }

    // Header
    var header = ui.el("div", { class: "sp-card sp-detail__header" }, [
      ui.el("div", { class: "sp-detail__header-top" }, [
        ui.el("div", { class: "sp-detail__titlewrap" }, [
          ui.el("h2", { class: "sp-title sp-detail__title" }, ["Subscription details"]),
          ui.el("p", { class: "sp-muted sp-detail__subtitle" }, [subtitleText]),
        ]),
        pill(ui, statusText, statusKind),
      ]),
    ]);

    // Notices
    var notices = [];

    if (needsAttention) {
      var msg =
        contract.portalState && contract.portalState.attentionMessage
          ? String(contract.portalState.attentionMessage)
          : "Action needed: we couldn’t process your most recent payment. Please update your payment method or contact support.";
      notices.push(renderAlert(ui, "Action needed", msg));
    }

    if (isYoung) {
      notices.push(
        renderAlert(
          ui,
          "Heads up",
          "Your subscription is being set up. Once you receive your first order, you can return here and make edits to upcoming orders."
        )
      );
    } else if (isPortalLocked) {
      notices.push(
        renderAlert(
          ui,
          "Heads up",
          "This subscription is currently locked. You can still contact support if you need help."
        )
      );
    }

    // Shared card opts
    var commonOpts = {
      bucket: bucket,
      isReadOnly: isReadOnly,
      cfg: cfg,
      actions: actions,

      // data
      linesAll: linesAll,
      lines: lines,
      shipLine: shipLine,

      // allow cards to trigger a refresh
      rerender: function () {
        try {
          render();
        } catch (e) {}
      },
    };

    
var cardCtx = Object.assign(
  {
    contract: contract,
    utils: utils,
    actions: actions,
    isReadOnly: isReadOnly,
    bucket: bucket,

    // handy extras for some cards
    linesAll: linesAll,
    shipLine: shipLine,
    lines: lines,

    // cancel flow navigation helpers
    detailUrl: detailUrl,
    cancelUrl: cancelUrl,
  },
  commonOpts || {}
);

  // Left column cards
  var pauseCardEl = null;
  if (bucket === "paused") {
    pauseCardEl = safeCardRender("resume", ui, cardCtx);
    if (!pauseCardEl) pauseCardEl = placeholderCard(ui, "Resume", "Restart your subscription when you are ready.");
  } else {
    pauseCardEl = safeCardRender("pause", ui, cardCtx);
    if (!pauseCardEl) pauseCardEl = placeholderCard(ui, "Pause", "Pause pushes your next order out from today.");
  }

  var addressCardEl =
    safeCardRender("address", ui, cardCtx) ||
    placeholderCard(ui, "Shipping", "Update where your next order ships.");

  var shipProtCardEl =
    safeCardRender("shippingProtection", ui, cardCtx) ||
    placeholderCard(ui, "Shipping Protection", "Protect orders from loss or theft during shipping.");

  var couponCardEl =
    safeCardRender("coupon", ui, cardCtx) ||
    placeholderCard(ui, "Coupon", "Apply a discount to your next subscription order.");

  var rewardsCardEl =
    safeCardRender("rewards", ui, cardCtx) ||
    placeholderCard(ui, "Rewards", "Your points and perks.");

  // Right column cards
  var frequencyCardEl =
    safeCardRender("frequency", ui, cardCtx) ||
    placeholderCard(ui, "Your Schedule", "How often your superfoods are sent.");

  var itemsCardEl =
    safeCardRender("items", ui, cardCtx) ||
    placeholderCard(ui, "Items", "What’s included in your subscription.");

  var addonsCardEl =
    safeCardRender("addons", ui, cardCtx) ||
    placeholderCard(ui, "One-time add-ons", "Add to your next order (one-time only).");

  var reviewsCardEl =
    safeCardRender("reviews", ui, cardCtx) ||
    placeholderCard(ui, "Reviews", "What customers are saying.");

  // Cancel card: do NOT show during lock windows (7-day lock OR portal lock)
  var cancelCardEl = null;
  if (!isReadOnly && bucket !== "cancelled") {
    cancelCardEl =
      safeCardRender("cancel", ui, Object.assign({}, cardCtx, { canCancel: true })) ||
      placeholderCard(ui, "Cancel subscription", "We’ll ask a couple quick questions first.");
  }

    // Layout
    var main = ui.el("div", { class: "sp-wrap sp-detail" }, [header]);
    for (var n = 0; n < notices.length; n++) main.appendChild(notices[n]);

    var grid = ui.el("div", { class: "sp-grid sp-detail__grid" }, [
      ui.el("div", { class: "sp-detail__col" }, [
        pauseCardEl,
        itemsCardEl,
        frequencyCardEl,
        couponCardEl,
        rewardsCardEl,
      ].filter(Boolean)),
      ui.el("div", { class: "sp-detail__col" }, [
        addonsCardEl,
        addressCardEl,
        shipProtCardEl,
        reviewsCardEl,
        cancelCardEl,
      ].filter(Boolean)),
    ]);

    main.appendChild(grid);
    ui.setRoot(main);
  }

  window.__SP.screens.subscriptionDetail = { render: render };
})();