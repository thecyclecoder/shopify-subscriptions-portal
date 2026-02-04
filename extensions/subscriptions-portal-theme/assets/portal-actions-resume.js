(function () {
  window.__SP = window.__SP || {};
  window.__SP.actions = window.__SP.actions || {};

  function shortId(gid) {
    var s = String(gid || "");
    if (!s) return "";
    var parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  // Expected server behavior: set nextBillingDate = now + resumeInDays, and clear pause attrs.
  window.__SP.actions.resume = async function resume(ui, contractGid, resumeInDays) {
    var busy = window.__SP.actions && window.__SP.actions.busy;
    if (!busy) throw new Error("busy_not_loaded");

    return await busy.withBusy(ui, async function () {
      try {
        var contractShortId = Number(shortId(contractGid));

        var resp = await window.__SP.api.postJson("resume", {
          contractId: contractShortId,
          resumeInDays: Number(resumeInDays || 1)
        });

        if (!resp || resp.ok === false) {
          throw new Error((resp && resp.error) ? resp.error : "resume_failed");
        }

        var fresh = await busy.refreshContractByShortId(String(contractShortId));
        busy.showToast(ui, "Done. Your subscription will resume tomorrow.", "success");

        return { ok: true, contract: fresh || null };
      } catch (e) {
        busy.showToast(ui, "Sorry — we couldn’t resume your subscription. Please try again.", "error");
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    });
  };
})();