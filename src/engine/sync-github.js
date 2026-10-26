'use strict';
/* Progress sync through a private GitHub repo.
   Each device stores a fine-grained token (Contents: read and write on the
   progress repo only) in this browser. Each course keeps one JSON file there. */
window.Sync = (() => {
  const LS = 'language-courses:github';
  let cfg = read();
  let sha = null, busy = false, again = false, timer = 0, lastPull = 0;
  let status = '', statusKind = '';

  function read() {
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); return c && c.token && c.repo ? c : null; }
    catch (e) { return null; }
  }
  function store(c) { try { if (c) localStorage.setItem(LS, JSON.stringify(c)); else localStorage.removeItem(LS); } catch (e) {} }
  const enc = s => {
    const b = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
  class SyncError extends Error {}

  const headers = (c, json) => ({ Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', ...(json ? { 'Content-Type': 'application/json' } : {}) });
  const fileUrl = c => `https://api.github.com/repos/${c.repo}/contents/${encodeURIComponent(CFG.syncFile)}`;

  async function pull(c) {
    const r = await fetch(fileUrl(c), { cache: 'no-store', headers: headers(c) });
    if (r.status === 404) { sha = null; return null; }
    if (r.status === 401) throw new SyncError('auth');
    if (r.status === 403) throw new SyncError('forbidden');
    if (!r.ok) throw new SyncError('http');
    const j = await r.json();
    sha = j.sha;
    try { return JSON.parse(dec(j.content)); } catch (e) { return null; }
  }
  async function put(c) {
    const body = { message: `${CFG.brand}: ${state.xp} XP, ${crowns()} crowns`, content: enc(JSON.stringify(state, null, 1)) };
    if (sha) body.sha = sha;
    const r = await fetch(fileUrl(c), { method: 'PUT', cache: 'no-store', headers: headers(c, true), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) return false;
    if (r.status === 401) throw new SyncError('auth');
    if (r.status === 403 || r.status === 404) throw new SyncError('forbidden');
    if (!r.ok) throw new SyncError('http');
    const j = await r.json();
    sha = j.content && j.content.sha;
    return true;
  }

  async function run() {
    if (!cfg) return;
    if (busy) { again = true; return; }
    busy = true;
    setStatus('Syncing…', '');
    try {
      let remote = await pull(cfg);
      applyRemote(remote);
      lastPull = Date.now();
      const same = remote && stable(normalize(remote)) === stable(state);
      if (!same && (remote || state.updatedAt)) {
        let ok = await put(cfg);
        if (!ok) { remote = await pull(cfg); applyRemote(remote); ok = await put(cfg); }
        if (!ok) throw new SyncError('conflict');
      }
      setStatus('Synced at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.', 'ok');
    } catch (e) {
      const k = e instanceof SyncError ? e.message : 'offline';
      setStatus({
        auth: 'GitHub rejected the token. It may have expired, so disconnect and paste a new one.',
        forbidden: "This token can't write to that repo. It needs Contents: Read and write on the progress repo.",
        conflict: 'Another device saved at the same moment. Tap Sync now to try again.',
      }[k] || "Couldn't reach GitHub. Progress is saved on this device and will sync next time.", 'bad');
    }
    busy = false;
    if (again) { again = false; run(); }
  }
  function push() { if (!cfg) return; clearTimeout(timer); timer = setTimeout(run, 1200); }

  function setStatus(text, kind) { status = text; statusKind = kind; renderStatus(); }
  function renderStatus() {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = status || (cfg ? '' : 'Not connected. Progress is saved in this browser only.');
    el.className = 'sync ' + (statusKind ? 'is-' + statusKind : '');
  }
  function settingsHTML() {
    if (cfg) return `<div class="sync-box">
      <div><strong>Sync across devices</strong><span class="set-sub">Saving to <code>${esc(cfg.repo)}</code> on GitHub. Both courses on this device use this connection.</span></div>
      <p class="sync" id="sync-status" role="status"></p>
      <div class="sync-btns"><button class="btn btn-ghost" data-a="sync-now">Sync now</button><button class="btn-text" data-a="sync-off">Disconnect this device</button></div></div>`;
    return `<div class="sync-box">
      <div><strong>Sync across devices</strong><span class="set-sub">Paste the GitHub token for your progress repo. You do this once on each device, and it covers both courses.</span></div>
      <label class="field" for="sync-repo"><span>Progress repo</span><input id="sync-repo" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(CFG.progressRepo || '')}" placeholder="username/language-progress"></label>
      <label class="field" for="sync-token"><span>GitHub token</span><input id="sync-token" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_…"></label>
      <p class="sync" id="sync-status" role="status"></p>
      <button class="btn btn-brand" data-a="sync-connect">Connect</button></div>`;
  }
  async function action(a) {
    if (a === 'sync-now') { run(); return; }
    if (a === 'sync-off') { cfg = null; sha = null; store(null); status = ''; statusKind = ''; renderWords(); toast('This device is disconnected. Progress stays saved here.'); return; }
    if (a === 'sync-connect') {
      const repo = (document.getElementById('sync-repo').value || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
      const token = (document.getElementById('sync-token').value || '').trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { setStatus('Enter the repo as username/repo-name.', 'bad'); return; }
      if (!token) { setStatus('Paste the token first.', 'bad'); return; }
      setStatus('Checking the token…', '');
      try {
        const r = await fetch('https://api.github.com/repos/' + repo, { cache: 'no-store', headers: headers({ token }) });
        if (r.status === 401) { setStatus("GitHub didn't accept that token. Copy it again and paste the whole thing.", 'bad'); return; }
        if (!r.ok) { setStatus("This token can't see that repo. Check the repo name and that the token includes it.", 'bad'); return; }
      } catch (e) { setStatus("Couldn't reach GitHub. Check the connection and try again.", 'bad'); return; }
      cfg = { repo, token }; store(cfg);
      renderWords();
      toast('Connected. Syncing now.');
      run();
    }
  }
  function init() {
    if (cfg) run();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastPull > 15000) run(); });
    window.addEventListener('online', () => run());
  }
  return { init, push, settingsHTML, renderStatus, action };
})();
