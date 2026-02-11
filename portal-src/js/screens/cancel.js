// portal-src/screens/cancel.js
// Cancel flow as a "screen" (not a modal).
//
// Entry URL:
//   /pages/portal/subscription?id=<contractId>&intent=cancel
//
// Requirements:
// - Customer can exit at all times (Back to subscription details).
// - No fresh contract fetch: use cached/in-memory contract already loaded.
// - Decision tree screens: reason -> offer -> confirm
// - Offers call actions (pause/frequency/coupon/etc.) later; for now we wire hooks.
// - Images: read from DOM data attr (Liquid schema later). Safe fallback if missing.

(function () {
  window.__SP = window.__SP || {};
  window.__SP.screens = window.__SP.screens || {};

  // ---------------- helpers ----------------

  function safeStr(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function qs() {
    try { return new URLSearchParams(window.location.search || ""); } catch (e) { return new URLSearchParams(); }
  }

  function getContractIdFromUrl() {
    var sp = qs();
    return safeStr(sp.get("id") || sp.get("contractId") || "");
  }

  function buildDetailUrl(contractId) {
    var path = safeStr(window.location.pathname || "");
    return path + "?id=" + encodeURIComponent(String(contractId || ""));
  }

  function pushSearch(paramsObj) {
    // Keep pathname same, update query.
    var path = safeStr(window.location.pathname || "");
    var sp = new URLSearchParams(window.location.search || "");

    Object.keys(paramsObj || {}).forEach(function (k) {
      var val = paramsObj[k];
      if (val == null || val === "") sp.delete(k);
      else sp.set(k, String(val));
    });

    var href = path + "?" + sp.toString();
    try {
      window.history.pushState({}, "", href);
    } catch (e) {
      window.location.href = href;
      return;
    }

    // Let router re-render (it listens to popstate and sp:locationchange, but we can render directly)
    try {
      window.__SP.router && window.__SP.router.start && window.__SP.router.start();
    } catch (e2) {}

    // safer: just call our render() directly (router is already on cancel screen)
    try {
      window.__SP.screens.cancel.render();
    } catch (e3) {}
  }

  function showToast(ui, msg, type) {
    try {
      var busy = window.__SP.actions && window.__SP.actions.busy;
      if (busy && typeof busy.showToast === "function") {
        busy.showToast(ui, msg, type || "success");
        return;
      }
    } catch (e) {}
    try { console.log("[toast]", type || "info", msg); } catch (e2) {}
  }

  function getCachedContractById(contractId) {
    // Best effort: use whatever is already in memory first
    try {
      var st = window.__SP.state || {};
      var c = st.currentContract || st.contract || null;
      if (c && safeStr(c.id) && String(c.id).indexOf(String(contractId)) !== -1) return c;
      if (c && safeStr(c.id) && safeStr(contractId) && safeStr(c.id).endsWith("/" + contractId)) return c;
    } catch (e) {}

    // Fall back to session cache
    try {
      var raw = sessionStorage.getItem("__sp_subscriptions_cache_v2");
      if (!raw) return null;
      var entry = JSON.parse(raw);
      var list = entry && entry.data && Array.isArray(entry.data.contracts) ? entry.data.contracts : [];
      for (var i = 0; i < list.length; i++) {
        var c2 = list[i];
        if (!c2 || !c2.id) continue;
        if (String(c2.id).endsWith("/" + String(contractId))) return c2;
        if (String(c2.id) === String(contractId)) return c2;
      }
    } catch (e2) {}

    return null;
  }

  function parseJsonAttribute(str) {
    var s = safeStr(str).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function getCancelImagesFromDom() {
    // Later: Liquid schema should render something like:
    //   <div data-cancel-images-json='{"too_much_product":"https://...","too_expensive":"https://..."}'></div>
    try {
      var el = document.querySelector("[data-cancel-images-json]") || null;
      if (!el) return {};
      var raw = el.getAttribute("data-cancel-images-json") || "";
      var parsed = parseJsonAttribute(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function reasonConfig(images) {
    // Minimal v1 configs. We can tune copy later.
    return {
      too_much_product: {
        title: "I have too much product",
        empath: "Totally fair. A lot of people build up a little extra at home.",
        primary: { type: "pause", days: 60, label: "Pause 60 days" },
        secondary: { type: "frequency", months: 2, label: "Switch to every 2 months" },
        image: safeStr(images.too_much_product || images.too_much || "")
      },
      too_expensive: {
        title: "It’s too expensive",
        empath: "We get it. Prices are up everywhere. If you want, we can help on the next order.",
        primary: { type: "coupon", pct: 20, label: "Get 20% off next order" },
        secondary: { type: "frequency", months: 2, label: "Switch to every 2 months" },
        image: safeStr(images.too_expensive || "")
      },
      not_getting_results: {
        title: "I’m not getting results",
        empath: "You’re not alone. Most people need a little consistency to feel the shift. Want to try one more cycle on us?",
        primary: { type: "coupon", pct: 25, label: "Get 25% off next order" },
        secondary: { type: "pause", days: 30, label: "Pause 30 days" },
        image: safeStr(images.not_getting_results || images.no_results || "")
      },
      tired_of_flavor: {
        title: "I’m tired of the flavor",
        empath: "Makes sense. Most people just need a refresh. You can swap or remove items any time.",
        primary: { type: "manage_items", label: "Swap or remove items" },
        secondary: { type: "pause", days: 30, label: "Pause 30 days" },
        image: safeStr(images.tired_of_flavor || images.flavor || "")
      },
      reached_goals: {
        title: "I already reached my goals",
        empath: "That’s a win. The easiest way to keep results is maintenance mode.",
        primary: { type: "frequency", months: 2, label: "Switch to every 2 months" },
        secondary: { type: "pause", days: 60, label: "Pause 60 days" },
        image: safeStr(images.reached_goals || images.maintenance || "")
      },
      shipping_issues: {
        title: "Shipping or delivery issues",
        empath: "Sorry about that. Want to pause while we fix things, or contact support?",
        primary: { type: "pause", days: 30, label: "Pause 30 days" },
        secondary: { type: "support", label: "Contact support" },
        image: safeStr(images.shipping_issues || images.shipping || "")
      }
    };
  }

  // ---------------- UI builders ----------------

function header(ui, contractId, titleText) {
  var detailUrl = buildDetailUrl(contractId);

  return ui.el("div", { class: "sp-cancel__header" }, [
    ui.el("a", { class: "sp-btn sp-btn--ghost sp-cancel__back", href: detailUrl }, ["← Back to subscription"]),
    ui.el("div", { class: "sp-cancel__title sp-title2" }, [titleText || "Cancel subscription"]),
  ]);
}

  function reasonTile(ui, key, label, selectedKey, onClick) {
    var isSel = key === selectedKey;
    var cls = "sp-btn sp-btn--ghost sp-itemopt" + (isSel ? " is-selected" : "");
    var btn = ui.el("button", { type: "button", class: cls, style: "text-align:left;" }, [
      ui.el("div", { class: "sp-itemopt__title" }, [label]),
      ui.el("div", { class: "sp-itemopt__desc sp-muted" }, ["Tap to select"]),
    ]);
    btn.addEventListener("click", onClick);
    return btn;
  }

    function renderReasonStep(ui, contractId, cfg, selectedKey) {
        var container = ui.el("div", { class: "sp-card sp-detail__card sp-cancel" }, [
            header(ui, contractId, "Cancel subscription"),

            // Intro (alert first, then required copy)
            ui.el("div", { class: "sp-cancel__intro" }, [
            ui.el("div", { class: "sp-cancel__alert" }, [
                ui.el("div", { class: "sp-cancel__alert-title" }, ["Not cancelled yet"]),
                ui.el("div", { class: "sp-cancel__alert-sub" }, [
                "Your subscription remains active until you confirm on the final step.",
                ]),
            ]),

            ui.el("div", { class: "sp-cancel__required" }, [
                ui.el("div", { class: "sp-cancel__required-title" }, ["To complete your cancellation"]),
                ui.el("div", { class: "sp-cancel__required-sub sp-muted" }, [
                "Select the option that best describes your reason for cancelling.",
                ]),
            ]),
            ]),

            // Reasons panel (light gray background behind tiles)
            ui.el("div", { class: "sp-cancel__reasons-panel" }, [
            ui.el("div", { class: "sp-detail__actions sp-detail__actions--stack sp-cancel__reasons" }, (function () {
                var keys = Object.keys(cfg);
                var out = [];
                for (var i = 0; i < keys.length; i++) {
                (function (k) {
                    out.push(
                    reasonTile(ui, k, cfg[k].title, selectedKey, function () {
                        pushSearch({ reason: k, step: "offer" });
                    })
                    );
                })(keys[i]);
                }
                return out;
            })()),
            ]),

            ui.el("div", { class: "sp-cancel__footer" }, [
            ui.el("a", { class: "sp-cancel__exit sp-muted", href: buildDetailUrl(contractId) }, [
                "Back to subscription details",
            ]),
            ]),
        ]);

        return container;
    }

  function offerCard(ui, conf) {
    var img = safeStr(conf.image || "");
    var hasImg = !!img;

    return ui.el("div", { class: "sp-card sp-detail__card" }, [
      ui.el("div", { class: "sp-wrap", style: "max-width:720px; margin:0 auto;" }, [
        hasImg
          ? ui.el("img", { src: img, alt: "", style: "width:100%; border-radius:16px; display:block; margin-bottom:12px;" }, [])
          : ui.el("span", {}, []),

        ui.el("div", { class: "sp-note sp-addswap-note" }, [
          ui.el("div", { class: "sp-note__title" }, ["We hear you."]),
          ui.el("div", { class: "sp-note__body" }, [safeStr(conf.empath || "")]),
        ]),
      ])
    ]);
  }

  function renderOfferStep(ui, contractId, cfg, reasonKey) {
    var conf = cfg[reasonKey] || null;
    if (!conf) {
      // If missing, go back to reasons
      pushSearch({ step: "reason", reason: "" });
      return ui.el("span", {}, []);
    }

    var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
      header(ui, contractId, "Let’s fix this"),
      offerCard(ui, conf),
      ui.el("div", { class: "sp-detail__actions sp-detail__actions--stack", style: "margin-top:14px;" }, (function () {
        var actions = [];

        // Primary offer
        actions.push(
          ui.el("button", { type: "button", class: "sp-btn sp-btn-primary" }, [safeStr(conf.primary && conf.primary.label) || "Continue"])
        );

        // Secondary offer
        actions.push(
          ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost" }, [safeStr(conf.secondary && conf.secondary.label) || "Another option"])
        );

        // Continue to cancel link
        actions.push(
          ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost", style: "opacity:0.9;" }, ["Continue to cancel"])
        );

        // Wire clicks (actions will be implemented later)
        actions[0].addEventListener("click", function () {
          // TODO: call actions for pause/frequency/coupon etc
          // For now: just toast and return to details.
          showToast(ui, "Applied: " + safeStr(conf.primary.label), "success");
          window.location.href = buildDetailUrl(contractId);
        });

        actions[1].addEventListener("click", function () {
          showToast(ui, "Applied: " + safeStr(conf.secondary.label), "success");
          window.location.href = buildDetailUrl(contractId);
        });

        actions[2].addEventListener("click", function () {
          pushSearch({ step: "confirm" });
        });

        return actions;
      })()),
    ]);

    return card;
  }

  function renderConfirmStep(ui, contractId, reasonKey) {
    var card = ui.el("div", { class: "sp-card sp-detail__card" }, [
      header(ui, contractId, "Confirm cancellation"),
      ui.el("p", { class: "sp-muted", style: "margin-top:10px;" }, [
        "You can come back any time. If you’d still like to cancel, confirm below."
      ]),
      ui.el("div", { class: "sp-detail__actions sp-detail__actions--stack", style: "margin-top:14px;" }, [
        ui.el("button", { type: "button", class: "sp-btn sp-btn-primary" }, ["Cancel subscription"]),
        ui.el("button", { type: "button", class: "sp-btn sp-btn--ghost" }, ["Keep subscription"]),
      ]),
    ]);

    // Wire (cancel action later)
    card.querySelectorAll("button")[0].addEventListener("click", function () {
      showToast(ui, "Cancel action not wired yet.", "error");
    });
    card.querySelectorAll("button")[1].addEventListener("click", function () {
      window.location.href = buildDetailUrl(contractId);
    });

    return card;
  }

  // ---------------- screen render ----------------

  function render() {
    var ui = window.__SP.ui;
    if (!ui) return;

    var contractId = getContractIdFromUrl();
    if (!contractId) {
      ui.setRoot(ui.card("<div class='sp-wrap'><h2 class='sp-title'>Missing subscription</h2><p class='sp-muted'>No subscription id was provided.</p></div>"));
      return;
    }

    // Ensure we have contract available (cache-only; no fetch)
    var contract = getCachedContractById(contractId);
    if (!contract) {
      ui.setRoot(ui.card("<div class='sp-wrap'><h2 class='sp-title'>Loading…</h2><p class='sp-muted'>Your subscription is still loading. Please try again.</p></div>"));
      return;
    }

    var sp = qs();
    var step = safeStr(sp.get("step") || "reason").toLowerCase();
    var reason = safeStr(sp.get("reason") || "");

    var images = getCancelImagesFromDom();
    var cfg = reasonConfig(images);

    var rootEl;
    if (step === "offer") rootEl = renderOfferStep(ui, contractId, cfg, reason);
    else if (step === "confirm") rootEl = renderConfirmStep(ui, contractId, reason);
    else rootEl = renderReasonStep(ui, contractId, cfg, reason);

    ui.setRoot(rootEl);
  }

  window.__SP.screens.cancel = { render: render };
})();