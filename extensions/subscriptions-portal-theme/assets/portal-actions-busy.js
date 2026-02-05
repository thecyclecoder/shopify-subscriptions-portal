(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};

  var __sp_busy = false;

  function showToast(ui, text, kind) {
    var cls = "sp-toast";
    if (kind === "success") cls += " sp-toast--success";
    if (kind === "error") cls += " sp-toast--error";

    var toast = ui.el("div", { class: cls }, [
      ui.el("div", { class: "sp-toast__body" }, [text || ""])
    ]);

    var host = document.querySelector(".sp-detail");
    if (!host) host = window.__SP.root || document.body;

    var existing = host.querySelector(".sp-toast");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    host.insertBefore(toast, host.firstChild);

    window.setTimeout(function () {
      try {
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      } catch (e) {}
    }, 15000);
  }

  function showBlockingModal(ui, text) {
    var overlay = ui.el("div", { class: "sp-modal sp-modal--blocking" }, [
      ui.el("div", { class: "sp-modal__card" }, [
        ui.el("div", { class: "sp-modal__title" }, ["Processing changes…"]),
        ui.el("div", { class: "sp-modal__body sp-muted" }, [text || "Please wait."])
      ])
    ]);

    document.body.appendChild(overlay);
    return function close() {
      try {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch (e) {}
    };
  }

  async function withBusy(ui, actionFn, modalText) {
    if (__sp_busy) return { ok: false, error: "busy" };
    __sp_busy = true;

    var close = showBlockingModal(ui, modalText || "Please do not refresh while we update your subscription.");
    try {
      return await actionFn();
    } finally {
      __sp_busy = false;
      close();
    }
  }

async function refreshContractByShortId(shortContractId) {
  var home = await window.__SP.api.requestJson("home", {}, { force: true });
  var list = (window.__SP.utils && window.__SP.utils.pickContracts)
    ? window.__SP.utils.pickContracts(home)
    : (home && (home.contracts || home.contracts_preview) ? (home.contracts || home.contracts_preview) : []);

  var arr = Array.isArray(list) ? list : [];
  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    if (!c) continue;
    if (shortId(c.id) === String(shortContractId)) return c;
  }
  return null;
}

  window.__SP.actions.busy = {
    withBusy: withBusy,
    showToast: showToast,
    refreshContractByShortId: refreshContractByShortId
  };
})();