(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};

          function shortId(gid) {
            var s = String(gid || "");
            if (!s) return "";
            var parts = s.split("/");
            return parts[parts.length - 1] || s;
          }

  window.__SP.actions.pause = async function pause(ui, contractGid, days) {
    var busy = window.__SP.actions && window.__SP.actions.busy;
    if (!busy) throw new Error("busy_not_loaded");

    return await busy.withBusy(ui, async function () {
      try {


        var contractShortId = Number(shortId(contractGid));

        var resp = await window.__SP.api.postJson("pause", {
          contractId: contractShortId,
          pauseDays: Number(days)
        });

        if (!resp || resp.ok === false) {
          throw new Error((resp && resp.error) ? resp.error : "pause_failed");
        }
        if (window.__SP.api && typeof window.__SP.api.clearCaches === "function") {
          window.__SP.api.clearCaches();
        }
        var fresh = await busy.refreshContractByShortId(String(contractShortId));
        busy.showToast(ui, "Done. Your next order was pushed out " + String(days) + " days.", "success");

        return { ok: true, contract: fresh || null };
        
      } catch (e) {

        busy.showToast(ui, "Sorry — we couldn’t update your subscription. Please try again.", "error");
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    });
  };
})();