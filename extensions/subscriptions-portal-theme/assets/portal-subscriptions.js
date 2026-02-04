(function () {
  window.__SP = window.__SP || {};

  function getBasePrefix() {
    return String(window.location.pathname || "").startsWith("/pages/") ? "/pages" : "";
  }

  function getStatusFromUrl() {
    var params = new URLSearchParams(window.location.search || "");
    var s = (params.get("status") || "active").toLowerCase();
    if (s !== "active" && s !== "paused" && s !== "cancelled") s = "active";
    return s;
  }

  function normalizeStatus(s) {
    return String(s || "").trim().toUpperCase();
  }

  function pill(ui, text, kind) {
    var cls = "sp-pill sp-pill--neutral";
    if (kind === "active") cls = "sp-pill sp-pill--active";
    if (kind === "cancelled") cls = "sp-pill sp-pill--cancelled";
    if (kind === "paused") cls = "sp-pill sp-pill--paused";
    return ui.el("span", { class: cls }, [text]);
  }

  function filterContracts(contracts, status, utils) {
    var list = Array.isArray(contracts) ? contracts : [];
    var s = String(status || "active").toLowerCase();

    if (s === "cancelled") {
      return list.filter(function (c) {
        return normalizeStatus(c && c.status) === "CANCELLED";
      });
    }

    if (s === "paused") {
      return list.filter(function (c) {
        return normalizeStatus(c && c.status) === "ACTIVE" && utils.isSoftPaused(c);
      });
    }

    // default: "active" => ACTIVE but NOT soft-paused
    return list.filter(function (c) {
      return normalizeStatus(c && c.status) === "ACTIVE" && !utils.isSoftPaused(c);
    });
  }

  function isShippingProtectionLine(ln, utils) {
    if (utils && typeof utils.isShippingProtectionLine === "function") {
      return utils.isShippingProtectionLine(ln);
    }
    var title = String((ln && ln.title) || "").trim().toLowerCase();
    var sku = String((ln && ln.sku) || "").trim().toLowerCase();
    if (title === "shipping protection") return true;
    if (sku.indexOf("shipping") >= 0 && sku.indexOf("protect") >= 0) return true;
    return false;
  }

  function billingLabel(policy, utils) {
    if (utils && typeof utils.billingLabel === "function") return utils.billingLabel(policy);

    var interval = policy && policy.interval ? String(policy.interval).toUpperCase() : "";
    var count = policy && policy.intervalCount != null ? Number(policy.intervalCount) : NaN;

    if (interval === "WEEK") {
      if (count === 4) return "Monthly";
      if (count === 8) return "Every other month";
      if (count === 2) return "Twice a month";
    }

    if (interval && Number.isFinite(count) && count > 0) {
      return String(count) + " " + interval.toLowerCase() + (count > 1 ? "s" : "");
    }
    return "Billing schedule";
  }

  function money(m, utils) {
    if (utils && typeof utils.money === "function") return utils.money(m);

    if (!m || m.amount == null) return "";
    var num = Number(m.amount);
    if (!isFinite(num)) return "";
    var code = m.currencyCode ? String(m.currencyCode) : "USD";
    var formatted = num.toFixed(2);
    return "$" + formatted + (code !== "USD" ? " " + code : "");
  }

  function shortId(gid, utils) {
    if (utils && typeof utils.shortId === "function") return utils.shortId(gid);
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  function fmtDate(iso, utils) {
    if (utils && typeof utils.fmtDate === "function") return utils.fmtDate(iso);

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

  function renderContractCard(ui, basePrefix, c, utils) {
    var status = normalizeStatus(c && c.status);

    // Derive display status
    var softPaused = status === "ACTIVE" && utils.isSoftPaused(c);

    var statusKind = "neutral";
    if (status === "ACTIVE") statusKind = "active";
    if (status === "CANCELLED") statusKind = "cancelled";
    if (softPaused) statusKind = "paused";

    var pillText =
      softPaused ? "Paused" : status === "ACTIVE" ? "Active" : status === "CANCELLED" ? "Cancelled" : status;

    // Lines: separate shipping protection
    var linesAll = Array.isArray(c && c.lines) ? c.lines : [];
    var shipLine = null;
    var lines = [];
    linesAll.forEach(function (ln) {
      if (!ln) return;
      if (isShippingProtectionLine(ln, utils) && !shipLine) shipLine = ln;
      else lines.push(ln);
    });

    // Meta: Next date or pause-until
    var metaRight = "";
    if (softPaused) {
      var untilLabel = (typeof utils.getPausedUntilLabel === "function") ? utils.getPausedUntilLabel(c) : "";
      metaRight = untilLabel ? " • Until: " + untilLabel : "";
    } else if (c && c.nextBillingDate) {
      metaRight = " • Next: " + fmtDate(c.nextBillingDate, utils);
    }

    var titleRow = ui.el("div", { class: "sp-subcard__header sp-row" }, [
      ui.el("div", { class: "sp-subcard__header-left" }, [
        ui.el("div", { class: "sp-subcard__title" }, ["Superfoods Subscription"]),
        ui.el("div", { class: "sp-subcard__meta sp-muted" }, [
          billingLabel(c && c.billingPolicy, utils) + metaRight,
        ]),
      ]),
      pill(ui, pillText, statusKind),
    ]);

    var linesWrap = ui.el("div", { class: "sp-subcard__lines" }, []);

    if (!lines.length) {
      linesWrap.appendChild(
        ui.el("p", { class: "sp-muted sp-subcard__empty" }, ["No items found on this subscription."])
      );
    } else {
      var shown = lines.slice(0, 3);
      shown.forEach(function (ln) {
        var row = ui.el("div", { class: "sp-line" }, []);

        if (ln.variantImageUrl) {
          row.appendChild(
            ui.el("img", {
              class: "sp-line__img",
              src: ln.variantImageUrl,
              alt: ln.title || "Item",
            })
          );
        } else {
          row.appendChild(ui.el("div", { class: "sp-line__img sp-line__img--placeholder" }, []));
        }

        var meta = ui.el("div", { class: "sp-line__meta" }, [
          ui.el("div", { class: "sp-line__title" }, [ln.title || "Item"]),
          ui.el("div", { class: "sp-line__subwrap sp-muted" }, [
            ln.variantTitle ? ui.el("div", { class: "sp-line__variant" }, [String(ln.variantTitle)]) : null,
            ui.el("div", { class: "sp-line__qty" }, ["Qty " + String(ln.quantity || 1)]),
          ]),
        ]);

        var priceText = "";
        if (ln.lineDiscountedPrice) priceText = money(ln.lineDiscountedPrice, utils);
        else if (ln.currentPrice) priceText = money(ln.currentPrice, utils);

        var price = ui.el("div", { class: "sp-line__price" }, [priceText || ""]);

        row.appendChild(meta);
        row.appendChild(price);
        linesWrap.appendChild(row);
      });

      if (lines.length > 3) {
        var remaining = lines.length - 3;
        linesWrap.appendChild(
          ui.el("div", { class: "sp-subcard__more sp-muted" }, [
            "+ " + remaining + " other " + (remaining === 1 ? "item" : "items"),
          ])
        );
      }
    }

    var detailHref = basePrefix + "/portal/subscription?id=" + encodeURIComponent(shortId(c && c.id, utils) || "");
    var actions = ui.el("div", { class: "sp-subcard__actions" }, [
      ui.el("a", { class: "sp-btn", href: detailHref }, ["View details"]),
    ]);

    if (shipLine) {
      var shipImgUrl = shipLine.variantImageUrl || "";
      var shipFooter = ui.el("div", { class: "sp-shipprot" }, [
        shipImgUrl
          ? ui.el("img", { class: "sp-shipprot__img", src: shipImgUrl, alt: "Shipping Protection" })
          : ui.el("div", { class: "sp-shipprot__img sp-shipprot__img--placeholder" }, []),
        ui.el("div", { class: "sp-shipprot__text" }, [
          ui.el("div", { class: "sp-shipprot__title" }, ["Shipping Protection"]),
          ui.el("div", { class: "sp-shipprot__sub sp-muted" }, [
            "Orders are protected from loss or theft during shipping",
          ]),
        ]),
      ]);

      actions.appendChild(shipFooter);
    }

    return ui.el("div", { class: "sp-card sp-subcard" }, [titleRow, linesWrap, actions]);
  }

  function setActiveTabClass(tabsEl, status) {
    if (!tabsEl) return;
    var desired = String(status || "active").toLowerCase();
    var btns = tabsEl.querySelectorAll(".sp-tab");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var tab = String(b.getAttribute("data-tab") || "").toLowerCase();
      if (tab === desired) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
  }

  function wireTabClicks(tabsEl) {
    if (!tabsEl) return;
    tabsEl.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest(".sp-tab") : null;
      if (!a || !tabsEl.contains(a)) return;

      var tab = String(a.getAttribute("data-tab") || "active").toLowerCase();
      setActiveTabClass(tabsEl, tab);
      // Navigation continues via link
    });
  }

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();
    ui.setRoot(ui.loading("Loading subscriptions…"));

    var utils = (window.__SP && window.__SP.utils) || null;
    if (!utils || typeof utils.pickContracts !== "function" || typeof utils.isSoftPaused !== "function") {
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

    var basePrefix = getBasePrefix();
    var status = getStatusFromUrl();

    var homeData = null;
    try {
      if (!window.__SP.api || typeof window.__SP.api.requestJson !== "function") {
        throw new Error("API not loaded");
      }
      homeData = await window.__SP.api.requestJson("home");
    } catch (e) {
      ui.setRoot(
        ui.el("div", { class: "sp-wrap sp-grid" }, [
          ui.el("div", { class: "sp-card" }, [
            ui.el("h2", { class: "sp-title" }, ["Could not load subscriptions"]),
            ui.el("p", { class: "sp-muted" }, ["Please refresh. If this keeps happening, contact support."]),
          ]),
        ])
      );
      return;
    }

    var contractsAll = utils.pickContracts(homeData);
    var contracts = filterContracts(contractsAll, status, utils);

    var tabs = ui.el("div", { class: "sp-tabs" }, [
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=active", "data-tab": "active" }, ["Active"]),
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=paused", "data-tab": "paused" }, ["Paused"]),
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=cancelled", "data-tab": "cancelled" }, ["Cancelled"]),
    ]);

    setActiveTabClass(tabs, status);
    wireTabClicks(tabs);

    var headerCard = ui.el("div", { class: "sp-card sp-subs-header" }, [
      ui.el("h2", { class: "sp-title" }, ["Your subscriptions"]),
      ui.el("div", { class: "sp-subs-header__tabs" }, [tabs]),
    ]);

    var listWrap = ui.el("div", { class: "sp-grid sp-subs-list" }, []);

    if (!contracts.length) {
      listWrap.appendChild(
        ui.el("div", { class: "sp-card" }, [
          ui.el("div", { class: "sp-empty-title" }, ["No subscriptions found"]),
          ui.el("p", { class: "sp-muted sp-empty-sub" }, [
            status === "cancelled"
              ? "You don’t have any cancelled subscriptions."
              : status === "paused"
              ? "You don’t have any paused subscriptions."
              : "You don’t have any active subscriptions.",
          ]),
        ])
      );
    } else {
      contracts.forEach(function (c) {
        listWrap.appendChild(renderContractCard(ui, basePrefix, c, utils));
      });
    }

    var wrap = ui.el("div", { class: "sp-wrap" }, [headerCard, listWrap]);
    ui.setRoot(wrap);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.subscriptions = { render: render };
})();