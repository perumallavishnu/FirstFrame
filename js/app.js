/* app.js: router, theme, startup. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h, $ = U.$, $$ = U.$$;
  const app = (FF.app = {});
  let simBuilt = false, current = '';

  /* ---- theme ---- */
  const root = document.documentElement;
  const savedTheme = U.store.get('theme', null);
  if (savedTheme) root.setAttribute('data-theme', savedTheme);
  $('#themebtn').addEventListener('click', () => {
    const dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark'; root.setAttribute('data-theme', next); U.store.set('theme', next);
    if (current === 'simulator') FF.sim.hudDirty = true;
  });

  /* ---- mission bar inside the simulator view ---- */
  app.renderMissionBar = function () {
    const host = $('#missionbar'); if (!host) return;
    const m = FF.missions.active && FF.missions.byId(FF.missions.active);
    host.replaceChildren();
    if (!m) { host.hidden = true; return; }
    host.hidden = false;
    host.append(h('div', { class: 'row' }, h('span', { class: 'tag acc' }, 'Mission'), h('b', null, m.title), h('span', { class: 'small' }, m.brief)), h('div', { class: 'row' }, h('details', null, h('summary', { class: 'small' }, 'Hint'), h('div', { class: 'small' }, m.hint)), h('button', { class: 'btn sm', type: 'button', onclick: () => FF.missions.quit() }, 'End mission')));
  };
  app.refreshMissionPage = function () { if (current === 'missions') FF.missions.renderPage($('#view-missions')); };

  /* ---- routes ---- */
  function parse() {
    const k = (location.hash || '#home').slice(1);
    if (k.startsWith('lesson-')) return { v: 'lesson', id: k.slice(7) };
    return { v: ['home', 'camera', 'simulator', 'academy', 'missions', 'gear', 'portfolio', 'glossary'].includes(k) ? k : 'home' };
  }
  function ensureSim() {
    const host = $('#view-simulator');
    if (simBuilt) return true;
    if (!FF.Renderer.ok) { host.replaceChildren(h('div', { class: 'callout warn' }, h('b', null, 'This simulator needs WebGL 2. '), FF.Renderer.error || 'Your browser or device did not provide it. Try a recent Chrome, Edge, Firefox or Safari on a computer or a recent phone. The lessons and guides still work.')); return false; }
    host.replaceChildren(h('div', { id: 'missionbar', class: 'missionbar', hidden: true }), h('div', { id: 'simroot' }));
    FF.sim.build($('#simroot', host));
    simBuilt = true; FF.sim.built = true;
    const first = U.store.get('visited', false);
    FF.cam.setScene(FF.missions.active ? FF.missions.byId(FF.missions.active).scene : 'fan');
    FF.sim.setKnob && FF.sim.setKnob(); FF.sim.refreshControls();
    app.renderMissionBar();
    const thumbs = (list, t0) => list.forEach((sc, i) => setTimeout(() => {
      try { const img = $('button[data-id="' + sc.id + '"] img', FF.sim.wall); if (img && !img.src) img.src = FF.sim.makeThumb(sc.id); } catch (e) { console.error('thumb', sc.id, e); }
    }, t0 + i * 350));
    thumbs(FF.SCENES.filter((x) => !x.three), 400);
    FF.Render3D.onAsset = (id) => { try { const img = $('button[data-id="' + id + '"] img', FF.sim.wall); FF.sim.dropThumb(id); if (img) img.src = FF.sim.makeThumb(id); FF.sim.hudDirty = true; } catch (e) { /* thumbnail refresh is optional */ } };
    FF.loadThree().then(() => { thumbs(FF.SCENES.filter((x) => x.three), 3200); if (FF.cam.state.scene === 'fan' && !FF.missions.active && !FF.cam.shots.length) { (FF.sim.pickScene || FF.cam.setScene)('still3d'); FF.sim.refreshControls(); } }).catch(() => {});
    if (!first) { U.store.set('visited', true); setTimeout(() => U.toast('Tip: click the picture to place the focus point, press Space or the shutter button to shoot.'), 900); }
    return true;
  }
  function route() {
    const r = parse(); const key = r.v === 'lesson' ? 'lesson-' + r.id : r.v;
    FF.sim && FF.sim.stop && FF.sim.stop();
    if (r.v !== 'camera' && FF.explore) FF.explore.hide();
    if (r.v !== 'home' && FF.pages.homeStop) FF.pages.homeStop();
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + r.v));
    $$('#nav a').forEach((a) => { const on = a.dataset.v === (r.v === 'lesson' ? 'academy' : r.v); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    current = r.v;
    const el = $('#view-' + r.v);
    try {
      if (r.v === 'home') FF.pages.home(el);
      else if (r.v === 'camera') { FF.explore.render(el); FF.explore.show(); }
      else if (r.v === 'simulator') { if (ensureSim()) { FF.sim.start(); app.renderMissionBar(); } }
      else if (r.v === 'academy') FF.lessons.renderAcademy(el);
      else if (r.v === 'lesson') FF.lessons.renderLesson(el, r.id);
      else if (r.v === 'missions') FF.missions.renderPage(el);
      else if (r.v === 'gear') FF.pages.gear(el);
      else if (r.v === 'portfolio') FF.pages.portfolio(el);
      else if (r.v === 'glossary') FF.pages.glossary(el);
    } catch (e) { console.error(e); el.replaceChildren(h('div', { class: 'callout warn' }, 'Something went wrong drawing this page: ' + e.message)); }
    document.title = 'FirstFrame · ' + (r.v === 'lesson' ? (FF.lessons.byId(r.id) || { title: 'Lesson' }).title : r.v[0].toUpperCase() + r.v.slice(1));
    if (r.v !== 'simulator') window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('ff-progress', () => FF.progress.chip());
  document.addEventListener('visibilitychange', () => { if (document.hidden) FF.sim.stop(); else if (current === 'simulator' && simBuilt) FF.sim.start(); });

  /* ---- start ---- */
  FF.Renderer.init();
  FF.progress.chip();
  route();
})();
