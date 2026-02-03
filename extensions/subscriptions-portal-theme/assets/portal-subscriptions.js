(function () {
  window.__SP = window.__SP || {};

  function getBasePrefix() {
    return String(window.location.pathname || "").startsWith("/pages/") ? "/pages" : "";
  }

  function getStatusFromUrl() {
    var params = new URLSearchParams(window.location.search || "");
    return (params.get("status") || "active").toLowerCase();
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

  function pill(ui, text, kind) {
    var cls = "sp-pill sp-pill--neutral";
    if (kind === "active") cls = "sp-pill sp-pill--active";
    if (kind === "cancelled") cls = "sp-pill sp-pill--cancelled";
    return ui.el("span", { class: cls }, [text]);
  }

function money(m) {
  if (!m || m.amount == null) return "";

  var num = Number(m.amount);
  if (!isFinite(num)) return "";

  var code = m.currencyCode ? String(m.currencyCode) : "USD";

  var formatted = num.toFixed(2);

  return "$" + formatted + (code !== "USD" ? " " + code : "");
}

  function pickContracts(homeData) {
    if (!homeData) return [];
    if (Array.isArray(homeData.contracts)) return homeData.contracts;
    if (Array.isArray(homeData.contracts_preview)) return homeData.contracts_preview;
    return [];
  }

  function normalizeStatus(s) {
    return String(s || "").toUpperCase();
  }

  function filterContracts(contracts, status) {
    if (status === "all") return contracts.slice(); // visual-only
    if (status === "cancelled")
      return contracts.filter(function (c) { return normalizeStatus(c.status) === "CANCELLED"; });
    return contracts.filter(function (c) { return normalizeStatus(c.status) === "ACTIVE"; });
  }

  function isShippingProtectionLine(ln) {
    var title = String((ln && ln.title) || "").trim().toLowerCase();
    var sku = String((ln && ln.sku) || "").trim().toLowerCase();
    if (title === "shipping protection") return true;
    if (sku.indexOf("shipping") >= 0 && sku.indexOf("protect") >= 0) return true;
    return false;
  }

  function billingLabel(policy) {
    var interval = policy && policy.interval ? String(policy.interval).toUpperCase() : "";
    var count = policy && policy.intervalCount != null ? Number(policy.intervalCount) : NaN;

    if (interval === "WEEK") {
      if (count === 4) return "Monthly";
      if (count === 8) return "Every other month";
      if (count === 2) return "Twice a month";
    }

    if (interval && Number.isFinite(count) && count > 0) {
      return (
        String(count) +
        " " +
        interval.toLowerCase() +
        (count > 1 ? "s" : "")
      );
    }
    return "Billing schedule";
  }

  function renderContractCard(ui, basePrefix, c) {
    var status = normalizeStatus(c.status);
    var statusKind = status === "ACTIVE" ? "active" : status === "CANCELLED" ? "cancelled" : "neutral";

    var linesAll = Array.isArray(c.lines) ? c.lines : [];
    var shipLine = null;
    var lines = [];
    linesAll.forEach(function (ln) {
      if (!ln) return;
      if (isShippingProtectionLine(ln) && !shipLine) shipLine = ln;
      else lines.push(ln);
    });

    var titleRow = ui.el("div", { class: "sp-subcard__header sp-row" }, [
      ui.el("div", { class: "sp-subcard__header-left" }, [
        ui.el("div", { class: "sp-subcard__title" }, ["Superfoods Subscription"]),
        ui.el("div", { class: "sp-subcard__meta sp-muted" }, [
          billingLabel(c.billingPolicy) + (c.nextBillingDate ? " • Next: " + fmtDate(c.nextBillingDate) : ""),
        ]),
      ]),
      pill(ui, statusKind === "active" ? "Active" : statusKind === "cancelled" ? "Cancelled" : status, statusKind),
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
            ln.variantTitle
              ? ui.el("div", { class: "sp-line__variant" }, [String(ln.variantTitle)])
              : null,

            ui.el("div", { class: "sp-line__qty" }, [
              "Qty " + String(ln.quantity || 1)
            ]),


          ])
        ]);

        var priceText = "";
        if (ln.lineDiscountedPrice) priceText = money(ln.lineDiscountedPrice);
        else if (ln.currentPrice) priceText = money(ln.currentPrice);

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

    var detailHref = basePrefix + "/portal/subscription?id=" + encodeURIComponent(String(c.id || ""));
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

  // ---- NEW: active class helpers for tabs ----
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

      // Update visual state immediately
      var tab = String(a.getAttribute("data-tab") || "active").toLowerCase();
      setActiveTabClass(tabsEl, tab);
      // Navigation still happens (router / link), no preventDefault here.
    });
  }

  async function render() {
    var ui = window.__SP.ui;
    ui.ensureBaseStyles();

    ui.setRoot(ui.loading("Loading subscriptions…"));

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

    var contractsAll = pickContracts(homeData);
    var contracts = filterContracts(contractsAll, status);

    var tabs = ui.el("div", { class: "sp-tabs" }, [
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=active", "data-tab": "active" }, ["Active"]),
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=cancelled", "data-tab": "cancelled" }, ["Cancelled"]),
      ui.el("a", { class: "sp-tab", href: basePrefix + "/portal/subscriptions?status=all", "data-tab": "all" }, ["All"]),
    ]);

    // NEW: set active class based on current URL
    setActiveTabClass(tabs, status);
    // NEW: update active class on click immediately
    wireTabClicks(tabs);

    var headerCard = ui.el("div", { class: "sp-card sp-subs-header" }, [
      ui.el("h2", { class: "sp-title" }, ["Your subscriptions"]),
      ui.el("p", { class: "sp-muted" }, ["Status: " + status]),
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
              : status === "active"
              ? "You don’t have any active subscriptions."
              : "No subscriptions to show right now.",
          ]),
        ])
      );
    } else {
      contracts.forEach(function (c) {
        listWrap.appendChild(renderContractCard(ui, basePrefix, c));
      });
    }

    var wrap = ui.el("div", { class: "sp-wrap" }, [headerCard, listWrap]);
    ui.setRoot(wrap);
  }

  window.__SP.screens = window.__SP.screens || {};
  window.__SP.screens.subscriptions = { render: render };
})();