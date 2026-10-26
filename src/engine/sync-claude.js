'use strict';
/* Progress sync for the claude.ai artifact build: a private document per viewer. */
window.Sync = (() => {
  let remote = null, mode = 'local', writing = false, again = false, tries = 0;
  async function write() {
    if (!remote) return;
    if (writing) { again = true; return; }
    writing = true;
    const body = JSON.parse(JSON.stringify(state));
    try { await remote.set(body); }
    catch (err) {
      if (err && err.code === 'unavailable') {
        await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
        try { await remote.set(body); } catch (e) {}
      } else { remote = null; mode = 'local'; renderStatus(); }
    }
    writing = false;
    if (again) { again = false; write(); }
  }
  async function init() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { if (++tries < 3) setTimeout(init, 1200); return; }
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const ref = db.doc('data/users/' + uid + '/progress');
      const snap = await ref.get();
      remote = ref; mode = 'account';
      if (snap.exists) applyRemote(snap.data());
      if (!snap.exists ? state.updatedAt : stable(normalize(snap.data())) !== stable(state)) write();
      renderStatus();
    } catch (e) { remote = null; mode = 'local'; }
  }
  function renderStatus() {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = mode === 'account' ? 'Progress syncs privately to your Claude account, so it follows you across devices.' : 'Progress is saved in this browser.';
  }
  return { init, push: write, renderStatus, settingsHTML: () => '<p class="sync" id="sync-status"></p>', action() {} };
})();
