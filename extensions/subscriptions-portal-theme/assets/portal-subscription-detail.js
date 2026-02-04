// assets/portal-subscription-detail.js
(function () {
  window.__SP = window.__SP || {};

  function getContractId() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var qid = params.get("id");
      if (qid) return String(qid);
    } catch (e) {}

    var parts = String(window.location.pathname || "").split("/").filter(Boolean);
    var idx = parts.indexOf("subscription");
    if (idx === -1) return "";
    return parts[idx + 1] || "";
  }

  function toNumDate(s) {
    var t = typeof s === "string" ? Date.parse(s) : NaN;
    return isFinite(t) ? t : 0;
  }

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function daysBetween(aMs, bMs) {
    var MS_PER_DAY = 24 * 60 * 60 * 1000;
    if (!aMs || !bMs) return 0;
    return Math.floor(Math.abs(bMs - aMs) / MS_PER_DAY);
  }

  function getConfig() {
    var cfg = (window.__SP && window.__SP.config) || {};
    return {
      lockDays: Number(cfg.lockDays || cfg.subscriptionLockDays || cfg.detailLockDays || 7),
      portalLock: Boolean(cfg.portalLock || cfg.portal_lock || false),
      shippingProtectionProductId: cfg.shippingProtectionProductId || cfg.shipping_protection_product_id || ""
    };
  }

  function findContract(contracts, shortContractId) {
    if (!shortContractId) return null;
    var want = String(shortContractId).trim();
    if (!want) return null;

    for (var i = 0; i < contracts.length; i++) {
      var c = contracts[i];
      if (!c) continue;
      var cid = shortId(c.id);
      if (cid && cid === want) return c;
    }
    return null;
  }

  function normalizeStatus(s) {
    return (window.__SP.utils && window.__SP.utils.normalizeStatus)
      ? window.__SP.utils.normalizeStatus(s)
      : String(s || "").toUpperCase();
  }

  function fmtPrettyDate(iso) {
    if (!iso) return "";
    var t = Date.parse(iso);
    if (!isFinite(t)) return "";

    var s = "";
    try {
      s = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(t));
    } catch (e) {
      s = new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }

    return s.replace(/^([A-Za-z]{3})\s/, "$1. ");
  }

  function isShipProt(ln) {
    return (window.__SP.utils && window.__SP.utils.isShippingProtectionLine)
      ? window.__SP.utils.isShippingProtectionLine(ln)
      : false;
  }

  function pill(ui, text, kind) {
    var cls = "sp-pill sp-pill--neutral";
    if (kind === "active") cls = "sp-pill sp-pill--active";
    if (kind === "cancelled") cls = "sp-pill sp-pill--cancelled";
    if (kind === "paused") cls = "sp-pill sp-pill--paused";
    return ui.el("span", { class: cls }, [text]);
  }

  function disabledBtn(ui, text) {
    return ui.el("button", { type: "button", class: "sp-btn sp-btn--disabled", disabled: true }, [text]);
  }

  function disabledGhostBtn(ui, text) {
    return ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost sp-btn--disabled", disabled: true }, [text]);
  }

  function sectionTitle(ui, title, sub) {
    return ui.el("div", { class: "sp-detail__sectionhead" }, [
      ui.el("div", { class: "sp-title2" }, [title]),
      sub ? ui.el("p", { class: "sp-muted sp-detail__section-sub" }, [sub]) : ui.el("span", {}, [])
    ]);
  }

  function renderNotice(ui, text) {
    return ui.el("div", { class: "sp-alert" }, [
      ui.el("div", { class: "sp-alert__title" }, ["Heads up"]),
      ui.el("div", { class: "sp-alert__body sp-muted" }, [text])
    ]);
  }

  function renderLine(ui, ln) {
    var img = ln && ln.variantImageUrl ? String(ln.variantImageUrl) : "";
    var title = (ln && ln.title) ? String(ln.title) : "Item";
    var variant = (ln && ln.variantTitle) ? String(ln.variantTitle) : "";
    var qty = ln && ln.quantity != null ? Number(ln.quantity) : 1;

    return ui.el("div", { class: "sp-line sp-line--detail" }, [
      img
        ? ui.el("img", { class: "sp-line__img", src: img, alt: title })
        : ui.el("div", { class: "sp-line__img sp-line__img--placeholder" }, []),

      ui.el("div", { class: "sp-line__meta" }, [
        ui.el("div", { class: "sp-line__title" }, [title]),
        ui.el("div", { class: "sp-line__sub sp-muted" }, [variant ? variant : ""]),
        ui.el("div", { class: "sp-line__sub sp-muted" }, ["Qty " + String(isFinite(qty) ? qty : 1)])
      ])
    ]);
  }

  async function loadHome() {
    if (!window.__SP.api || typeof window.__SP.api.requestJson !== "function") {
      throw new Error("API not loaded");
    }
    return await window.__SP.api.requestJson("home");
  }

  function getSoftPauseInfo(contract) {
    var utils = window.__SP && window.__SP.utils;
    var paused = !!(utils && typeof utils.isSoftPaused === "function" && utils.isSoftPaused(contract));

    var untilLabel = "";
    if (paused && utils && typeof utils.getPausedUntilLabel === "function") {
      untilLabel = String(utils.getPausedUntilLabel(contract) || "");
    }
    if (paused && !untilLabel && contract && contract.nextBillingDate) {
      untilLabel = fmtPrettyDate(contract.nextBillingDate);
    }

    return { paused: paused, untilLabel: untilLabel };
  }

  function frequencyLabel(policy) {
    if (!policy) return "";
    var interval = policy.interval ? String(policy.interval).toUpperCase() : "";
    var count = policy.intervalCount != null ? Number(policy.intervalCount) : NaN;

    if (interval === "WEEK") {
      if (count === 4) return "Monthly";
      if (count === 8) return "Every 2 Months";
      if (count === 2) return "Twice a Month";
    }

    if (interval && isFinite(count) && count > 0) {
      return String(count) + " " + interval.toLowerCase() + (count > 1 ? "s" : "");
    }
    return "";
  }

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();
    ui.setRoot(ui.loading("Loading subscription…"));

    var utils = window.__SP && window.__SP.utils;
    if (!utils || typeof utils.pickContracts !== "function") {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Portal utils not loaded"]),
            ui.el("p", { class: "sp-muted" }, ["Please refresh. If this keeps happening, contact support."])
          ])
        ])
      );
      return;
    }

    var actions = window.__SP.actions || {};
    var hasPause = typeof actions.pause === "function";
    var hasResume = typeof actions.resume === "function";

    var id = getContractId();
    var cfg = getConfig();

    var homeData;
    try {
      homeData = await loadHome();
    } catch (e) {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Could not load subscription"]),
            ui.el("p", { class: "sp-muted" }, ["Please refresh. If this keeps happening, contact support."])
          ])
        ])
      );
      return;
    }

    var contractsAll = utils.pickContracts(homeData);
    var contract = findContract(Array.isArray(contractsAll) ? contractsAll : [], id);

    if (!contract) {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Subscription not found"]),
            ui.el("p", { class: "sp-muted" }, ["We couldn’t find that subscription in your account."])
          ])
        ])
      );
      return;
    }

    var status = normalizeStatus(contract.status);

    var pauseInfo = getSoftPauseInfo(contract);
    var isSoftPaused = !!pauseInfo.paused;
    var pausedUntilLabel = pauseInfo.untilLabel || "";

    var effectiveStatusText = (status === "ACTIVE" ? "Active" : status === "CANCELLED" ? "Cancelled" : status);
    var effectiveStatusKind = (status === "ACTIVE" ? "active" : status === "CANCELLED" ? "cancelled" : "neutral");
    if (isSoftPaused) {
      effectiveStatusText = "Paused";
      effectiveStatusKind = "paused";
    }

    var createdMs = toNumDate(contract.createdAt);
    var now = Date.now();
    var ageDays = createdMs ? daysBetween(createdMs, now) : 9999;
    var isYoung = ageDays < cfg.lockDays;

    var isPortalLocked = !!cfg.portalLock;
    var isReadOnly = isYoung || isPortalLocked;

    // Lines: separate shipping protection
    var linesAll = Array.isArray(contract.lines) ? contract.lines : [];
    var shipLine = null;
    var lines = [];
    var shipProdId = String((cfg && cfg.shippingProtectionProductId) || "").trim();

    function lineMatchesShipProtection(ln) {
      if (!ln) return false;

      try { if (isShipProt(ln)) return true; } catch (e) {}

      if (shipProdId) {
        var lp = "";
        try {
          if (ln.productId != null) lp = String(ln.productId);
          else if (ln.product && ln.product.id != null) lp = String(ln.product.id);
        } catch (e) {}

        var lpShort = shortId(lp);
        if (lpShort && lpShort === shipProdId) return true;
      }
      return false;
    }

    linesAll.forEach(function (ln) {
      if (!ln) return;
      if (lineMatchesShipProtection(ln)) {
        if (!shipLine) shipLine = ln;
        return;
      }
      lines.push(ln);
    });

    // Header subtitle
    var subtitleText = "";
    if (isSoftPaused) {
      subtitleText = pausedUntilLabel ? ("Paused until " + pausedUntilLabel) : "This subscription is paused.";
    } else if (contract.nextBillingDate) {
      var pretty = fmtPrettyDate(contract.nextBillingDate);
      subtitleText = pretty ? ("Your next order is on " + pretty) : "";
    } else {
      subtitleText = "Your next order date is not available";
    }

    var header = ui.el("div", { class: "sp-card sp-detail__header" }, [
      ui.el("div", { class: "sp-detail__header-top" }, [
        ui.el("div", { class: "sp-detail__titlewrap" }, [
          ui.el("h2", { class: "sp-title sp-detail__title" }, ["Subscription details"]),
          ui.el("p", { class: "sp-muted sp-detail__subtitle" }, [subtitleText])
        ]),
        pill(ui, effectiveStatusText, effectiveStatusKind)
      ])
    ]);

    // Notices
    var notices = [];
    if (isYoung) {
      notices.push(renderNotice(
        ui,
        "Your subscription is being set up. Once you receive your first order, you can return here and make edits to upcoming orders."
      ));
    } else if (isPortalLocked) {
      notices.push(renderNotice(
        ui,
        "This subscription is currently locked. You can still contact support if you need help."
      ));
    }

    // Action button helpers
    function btnProps(onclick) {
      var p = { type: "button", class: "sp-btn", onclick: onclick };
      if (isReadOnly) {
        p.class += " sp-btn--disabled";
        p.disabled = true;
      }
      return p;
    }

    function onPause(days) {
      if (isReadOnly || !hasPause) return;
      actions.pause(ui, contract.id, Number(days)).then(function () { render(); });
    }

    function onResume() {
      if (isReadOnly || !hasResume) return;
      actions.resume(ui, contract.id, 1).then(function () { render(); });
    }

    // Pause/Resume card
    var pauseOrResumeCard = null;

    if (isSoftPaused) {
      var resumeHelp =
        "Resuming sets your next order to tomorrow, so you can review and make changes before it is placed.";

      pauseOrResumeCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Resume", "Restart your subscription when you are ready."),
        ui.el("p", { class: "sp-muted sp-detail__hint" }, [resumeHelp]),
        ui.el("div", { class: "sp-detail__actions" }, [
          hasResume ? ui.el("button", btnProps(onResume), ["Resume subscription"]) : disabledBtn(ui, "Resume subscription")
        ]),
        pausedUntilLabel
          ? ui.el("p", { class: "sp-muted sp-detail__hint" }, ["Currently paused until " + pausedUntilLabel + "."])
          : ui.el("span", {}, [])
      ]);
    } else {
      pauseOrResumeCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
        sectionTitle(ui, "Pause", "Pause pushes your next order out from today."),
        ui.el("div", { class: "sp-detail__actions" }, [
          hasPause ? ui.el("button", btnProps(function () { onPause(30); }), ["Pause 30 days"]) : disabledBtn(ui, "Pause 30 days"),
          hasPause ? ui.el("button", btnProps(function () { onPause(60); }), ["Pause 60 days"]) : disabledBtn(ui, "Pause 60 days")
        ]),
        ui.el("p", { class: "sp-muted sp-detail__hint" }, [
          isReadOnly ? "Actions will unlock when available." : "Subscription will resume after the selected period ends."
        ])
      ]);
    }

    // Frequency card
    var freqText = frequencyLabel(contract.billingPolicy);
    var frequencyCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Your Schedule", "How often your superfoods are sent."),
      ui.el("div", { class: "sp-detail__freq" }, [
        ui.el("div", { class: "sp-detail__freq-value" }, [
          freqText ? ("Currently: " + freqText) : "Billing frequency not available."
        ])
      ]),
      ui.el("div", { class: "sp-detail__actions" }, [
        disabledBtn(ui, "Change frequency")
      ])
    ]);

    // Items card
    var itemsCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Items", "What’s included in your subscription."),
      ui.el("div", { class: "sp-detail__lines" }, (function () {
        if (!lines.length) return [ui.el("p", { class: "sp-muted" }, ["No items found on this subscription."])];
        return lines.map(function (ln) { return renderLine(ui, ln); });
      })()),
      ui.el("div", { class: "sp-detail__items-actions" }, [
        disabledGhostBtn(ui, "Add product"),
        disabledGhostBtn(ui, "Swap product"),
        disabledGhostBtn(ui, "Change quantity"),
        disabledGhostBtn(ui, "Remove product")
      ]),
      ui.el("p", { class: "sp-muted sp-detail__hint" }, [
        "You’ll be able to add products as one-time or subscribe, swap flavors, and adjust quantities (1–3) here."
      ])
    ]);

    // Shipping card
    var shippingAddressCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Shipping", "Update where your next order ships."),
      ui.el("div", { class: "sp-detail__actions" }, [
        disabledBtn(ui, "Change shipping address"),
        ui.el("a", {
          class: "sp-btn sp-btn--ghost",
          href: "https://account.superfoodscompany.com/orders",
          target: "_blank",
          rel: "noopener"
        }, ["View recent orders"])
      ])
    ]);

    // Ship protection placeholder
    var shipProtCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Shipping Protection", "Protect orders from loss or theft during shipping."),
      ui.el("div", { class: "sp-detail__shiprow" }, [
        ui.el("div", { class: "sp-detail__shipmeta" }, [
          ui.el("div", { class: "sp-detail__shipstate" }, [(shipLine ? "Currently on" : "Currently off")]),
          ui.el("p", { class: "sp-muted sp-detail__shipsub" }, [
            shipLine ? "This will appear as a line item on your subscription." : "Turn it on to protect your next shipment."
          ])
        ]),
        ui.el("button", { type: "button", class: "sp-toggle sp-toggle--disabled", disabled: true }, [shipLine ? "On" : "Off"])
      ])
    ]);

    // Add-ons placeholder
    var addonsCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "One-time add-ons", "Add to your next order (one-time only)."),
      ui.el("div", { class: "sp-detail__addons" }, [
        ui.el("div", { class: "sp-addon sp-addon--disabled" }, [
          ui.el("div", { class: "sp-addon__title" }, ["Add-on products will show here"]),
          ui.el("div", { class: "sp-muted sp-addon__sub" }, ["(Not wired yet)"])
        ])
      ])
    ]);

    // Coupon placeholder
    var couponCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Coupon", "Apply a discount to your next subscription order."),
      ui.el("div", { class: "sp-detail__coupon" }, [
        ui.el("input", { class: "sp-input", type: "text", placeholder: "Enter coupon code", disabled: true }, []),
        ui.el("button", { type: "button", class: "sp-btn sp-btn--disabled", disabled: true }, ["Apply"])
      ]),
      ui.el("p", { class: "sp-muted sp-detail__hint" }, ["Coming next."])
    ]);

    // Rewards placeholder
    var rewardsCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Rewards", "Your points and perks."),
      ui.el("div", { class: "sp-detail__rewards sp-muted" }, [
        "Rewards widget placeholder (we’ll drop in your widget code here)."
      ])
    ]);

    // Reviews placeholder
    var reviewsCard = ui.el("div", { class: "sp-card sp-detail__card" }, [
      sectionTitle(ui, "Reviews", "What customers are saying."),
      ui.el("div", { class: "sp-detail__reviews sp-muted" }, [
        "Auto-advancing review slider placeholder (we’ll wire this to product-tied reviews/metaobjects)."
      ])
    ]);

    // Cancel placeholder
    var cancelCard = null;
    if (!isYoung) {
      cancelCard = ui.el("div", { class: "sp-card sp-detail__cancel" }, [
        ui.el("div", { class: "sp-detail__cancel-row" }, [
          ui.el("div", {}, [
            ui.el("div", { class: "sp-detail__cancel-title" }, ["Cancel subscription"]),
            ui.el("p", { class: "sp-muted sp-detail__cancel-sub" }, ["We’ll ask a couple quick questions first."])
          ]),
          ui.el("button", { type: "button", class: "sp-btn sp-btn--danger sp-btn--disabled", disabled: true }, ["Cancel"])
        ])
      ]);
    }

    var main = ui.el("div", { class: "sp-wrap sp-detail" }, [header]);
    notices.forEach(function (n) { main.appendChild(n); });

    var grid = ui.el("div", { class: "sp-grid sp-detail__grid" }, [
      ui.el("div", { class: "sp-detail__col" }, [
        pauseOrResumeCard,
        shippingAddressCard,
        shipProtCard,
        couponCard,
        rewardsCard
      ]),
      ui.el("div", { class: "sp-detail__col" }, [
        frequencyCard,
        itemsCard,
        addonsCard,
        reviewsCard,
        cancelCard ? cancelCard : ui.el("span", {}, [])
      ])
    ]);

    main.appendChild(grid);
    ui.setRoot(main);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.subscriptionDetail = { render: render };
})();