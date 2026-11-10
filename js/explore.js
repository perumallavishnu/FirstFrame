/* explore.js: the "3D Camera" page. Hosts the 3D viewer, the working rear screen with its keys, the lens shelf and the camera-types tab. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = FF.ui, h = U.h, P = FF.phys;
  const E = (FF.explore = { api: null, built: false, tab: 'cam' });
  // ids of either model (registry ids for the GLB, legacy ids for the teaching model) that need a state change before they are visible
  const NEEDS_DOOR = ['battery', 'card'], NEEDS_OPEN = ['sensor', 'shutter', 'processor', 'elements', 'lens-elements'], NEEDS_NOLENS = ['mount', 'contacts', 'lens-mount', 'lens-lock-pin', 'rf-lens-mount-index'];
  const NEEDS_COVER = ['digital-terminal', 'hdmi-micro-out', 'dc-cord-hole'], NEEDS_COVER2 = ['external-mic-in', 'remote-terminal'];
  const STATUS = { verified: 'Name and position checked against Canon\u2019s Part Names diagram and product photos', approximate: 'Name from Canon; position estimated from the Canon diagram (not visible in the photos)', educational: 'Educational illustration, not an externally visible Canon part' };

  const clean = (...xs) => xs.flat().filter((x) => x != null && x !== false); // replaceChildren would print null
  E.render = function (root) {
    if (E.built) { E.show(); return; }
    E.built = true;
    const stage = h('div', { class: 'c3d-stage' }, h('div', { class: 'c3d-loading' }, 'Loading the 3D camera…'));
    const info = h('div', { class: 'c3d-info card', 'aria-live': 'polite' });
    const lcd = h('canvas', { width: 720, height: 480, class: 'c3d-lcd', 'aria-label': 'Camera rear screen' });
    const menuHelp = h('div', { class: 'small c3d-menuhelp' });
    const key = (label, k, cls, aria) => h('button', { class: 'btn sm key ' + (cls || ''), type: 'button', 'aria-label': aria || label, onclick: () => { if (k === 'power') act('power'); else FF.menu.key(k); } }, label);
    const keys = h('div', { class: 'c3d-keys' },
      h('div', { class: 'row' }, key('ON/OFF', 'power', 'pw', 'Power'), key('MENU', 'menu'), key('INFO', 'info'), key('▶', 'play', '', 'Playback')),
      h('div', { class: 'dpad' }, key('▲', 'up', 'u', 'Up'), key('◀', 'left', 'l', 'Left'), key('SET', 'set', 'c', 'Q / SET'), key('▶', 'right', 'r', 'Right'), key('▼', 'down', 'd', 'Down')));
    const tabsRow = h('div', { class: 'row c3d-mtabs' }, FF.menu.tabs.map((t, i) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: t.col }, onclick: () => { if (!FF.menu.power) act('power'); FF.menu.setTab(i); } }, t.glyph + ' ' + t.name)));
    const screenCard = h('div', { class: 'card c3d-screen' }, h('h4', null, 'The rear screen (it works)'), lcd, keys, menuHelp, h('details', null, h('summary', { class: 'small' }, 'Jump to a menu tab'), tabsRow));

    /* toolbar */
    const views = h('div', { class: 'row c3d-views', role: 'group', 'aria-label': 'View' }, ['front', 'back', 'top', 'bottom', 'left', 'right'].map((v) => h('button', { class: 'btn sm', type: 'button', onclick: () => E.api && E.api.set('view', v) }, v[0].toUpperCase() + v.slice(1))));
    const tg = {};
    const tog = (id, label, fn) => { const b = h('button', { class: 'btn sm tog', type: 'button', 'aria-pressed': 'false', onclick: () => { fn(); sync(); } }, label); tg[id] = b; return b; };
    const toggles = h('div', { class: 'row' },
      tog('power', 'Power', () => act('power')), tog('flash', 'Flash', () => act('flash')), tog('door', 'Card & battery door', () => act('door')), tog('cover', 'Terminal covers', () => { act('terminals'); act('terminals2'); }),
      tog('xray', 'X-ray', () => E.api.set('xray', !E.api.st.xray)), tog('hotspots', 'Labels', () => E.api.set('hotspots', !E.api.st.hotspots)),
      h('button', { class: 'btn sm', type: 'button', onclick: () => act('shutterbtn') }, 'Press shutter'), tog('lens', 'Detach lens', () => { const s = E.api.lensState(); if (s.state === 'mounted') E.api.detach(); else if (s.state === 'free') E.api.attach(); }));
    const exV = h('span', { class: 'mono' }, '0%');
    const explode = U.range(0, 100, 1, 0, (v) => { E.api && E.api.set('explode', v / 100); exV.textContent = v + '%'; });
    const zoomV = h('span', { class: 'mono' }), apV = h('span', { class: 'mono' });
    const zoom = U.range(0, 100, 1, 30, (v) => { E.api && E.api.setZoom(v / 100); sync(); });
    const ap = U.range(0, 10, 1, 0, (v) => { if (!E.api) return; const l = FF.lensById(E.api.st.lens), f = l.fmin + (l.fmax - l.fmin) * E.api.st.zoomK, r = P.apertureRange(l, f); E.api.setAperture(P.apertureValue(Math.min(r[1], r[0] + v))); sync(); });
    const sliders = h('div', { class: 'lab-sl' },
      h('label', { class: 'lab-row' }, h('span', { class: 'lab-name' }, 'Exploded view'), explode, exV),
      h('label', { class: 'lab-row' }, h('span', { class: 'lab-name' }, 'Zoom ring'), zoom, zoomV),
      h('label', { class: 'lab-row' }, h('span', { class: 'lab-name' }, 'Aperture'), ap, apV));
    const sel = h('select', { class: 'c3d-select', 'aria-label': 'Find a part', onchange: () => { if (sel.value) goPart(sel.value); } }, h('option', { value: '' }, 'Find a part…'));
    function fillParts() {
      const list = E.api.parts().slice().sort((a, b) => a.name.localeCompare(b.name));
      sel.replaceChildren(h('option', { value: '' }, 'Find a part (' + list.length + ')…'), ...list.map((p) => h('option', { value: p.id }, p.name)));
    }
    let tourI = -1;
    const tourBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (!E.api) return; const T = E.api.tour(); tourI = (tourI + 1) % T.length; goPart(T[tourI]); tourBtn.textContent = 'Next part (' + (tourI + 1) + '/' + T.length + ')'; } }, 'Start the guided tour');

    /* lens shelf */
    const shelf = h('div', { class: 'c3d-shelf' }, FF.LENSES.map((l) => h('button', { class: 'card lensbtn', type: 'button', draggable: 'true', 'data-id': l.id, title: 'Drag onto the camera, or click', ondragstart: (e) => { e.dataTransfer.setData('text/lens', l.id); e.dataTransfer.effectAllowed = 'copy'; }, onclick: () => { if (E.api) E.api.offer(l.id); } },
      h('span', { html: lensSVG(l) }), h('b', null, l.short), h('span', { class: 'small muted' }, l.equiv + ' equiv.'), h('span', { class: 'small muted' }, 'f/' + (l.maxAp[0] === l.maxAp[1] ? l.maxAp[0] : l.maxAp.join('–')) + ' · ' + l.weight + ' g'))));

    const camPanel = h('div', { class: 'c3d-panel' },
      h('div', { class: 'c3d-grid' },
        h('div', { class: 'c3d-left' }, h('div', { class: 'row c3d-bar' }, views, sel, tourBtn), stage, h('div', { class: 'card c3d-ctl' }, toggles, sliders)),
        h('div', { class: 'c3d-right' }, info, screenCard)),
      h('h3', { class: 'c3d-h' }, 'Lenses for this camera'), h('p', { class: 'small muted' }, 'Drag a lens onto the camera, or click it to place it beside the camera and then drag it to the mount in 3D. To take a lens off, click the lens release button on the camera. The lens you attach here is the one the Simulator shoots with.'), shelf);
    const typesPanel = h('div', { class: 'c3d-panel', hidden: true });
    const tabs = U.seg([{ v: 'cam', label: 'Explore the EOS R100' }, { v: 'types', label: 'Types of camera and how they work' }], 'cam', (v) => { E.tab = v; camPanel.hidden = v !== 'cam'; typesPanel.hidden = v !== 'types'; if (v === 'types') { E.api && E.api.stop(); FF.types3d.mount(typesPanel); } else { FF.types3d.stop(); E.api && E.api.start(); } });
    root.replaceChildren(h('div', { class: 'page-head' }, h('h1', null, 'The camera in 3D'), h('p', { class: 'lead' }, 'Turn it over, switch it on, open every door and pull it apart. Click any part to learn what it does. The rear screen runs a working copy of the menu system.'), h('p', { class: 'small muted' }, 'Hand-built from Canon\u2019s product photos and published dimensions, with part names from Canon\u2019s manual. It is an accurate learning model, not a factory scan; inside parts are illustrations.')), tabs, camPanel, typesPanel);

    function showInfo(id) {
      if (!id) { info.replaceChildren(h('h3', null, 'Click any part'), h('p', { class: 'muted' }, 'Drag to rotate. Scroll or pinch to zoom. The small dots mark parts you can learn about; many of them move when you click them.'), h('ul', { class: 'small' }, h('li', null, 'Flip the power switch, then press MENU.'), h('li', null, 'Click the lens release button and drag the lens away.'), h('li', null, 'Turn on X-ray, or pull the Exploded view slider, to see inside.'))); return; }
      const p = E.api.partInfo(id), a = E.api.actionLabel(id);
      const arrow = { up: '\u25b2', down: '\u25bc', left: '\u25c0', right: '\u25b6' };
      const fn = p.functions ? h('div', { class: 'row c3d-fn', role: 'group', 'aria-label': 'Cross key press points' }, p.functions.map((f) => h('button', { class: 'btn sm', type: 'button', title: f.officialLabel, onclick: () => { E.api.act(id, f.dir); sync(); } }, arrow[f.dir] + ' ' + f.marking))) : null;
      info.replaceChildren(...clean(h('span', { class: 'tag' }, p.status === 'educational' ? 'Inside / illustration' : 'Part'), h('h3', null, p.short || p.name),
        p.official && p.official !== p.short ? h('p', { class: 'small muted' }, 'Canon name: ' + p.official) : null,
        h('p', null, p.desc), p.use ? h('p', { class: 'small' }, h('b', null, 'Using it: '), p.use) : null,
        p.marking ? h('p', { class: 'small' }, h('b', null, 'Marked on the camera: '), p.marking) : null,
        p.functions ? h('p', { class: 'small muted' }, 'One ring with four press points. Press one:') : null, fn,
        h('div', { class: 'row' }, a ? h('button', { class: 'btn sm primary', type: 'button', onclick: () => act(id) }, a) : null, p.lesson ? h('a', { class: 'btn sm', href: p.lesson }, 'Read the lesson') : null),
        p.status ? h('p', { class: 'small muted c3d-src' }, STATUS[p.status] || '', p.source ? [' \u00b7 ', h('a', { href: p.source, target: '_blank', rel: 'noopener' }, 'source')] : null) : null,
        p.note ? h('p', { class: 'small muted' }, p.note) : null));
    }
    function act(id) { if (!E.api) return; E.api.act(id); sync(); }
    function goPart(id) {
      const a = E.api; if (!a) return;
      if (NEEDS_DOOR.includes(id) && a.tgt.door < 0.5) a.set('door', 1);
      if (NEEDS_COVER.includes(id) && a.tgt.cover < 0.5) a.set('cover', 1);
      if (NEEDS_COVER2.includes(id) && a.tgt.cover2 < 0.5) a.set('cover2', 1);
      if (NEEDS_OPEN.includes(id) && !a.st.xray && a.tgt.explode < 0.3) { a.set('explode', 0.7); explode.value = 70; exV.textContent = '70%'; }
      if (NEEDS_NOLENS.includes(id) && a.lensState().state === 'mounted') a.detach();
      a.set('view', a.viewOf(id)); a.select(id); if (a.model === 'glb') a.focus(id); sync();
    }
    function sync() {
      const a = E.api; if (!a) return; const s = a.lensState(), l = FF.lensById(s.id);
      const on = { power: FF.menu.power, flash: a.tgt.flash > 0.5, door: a.tgt.door > 0.5, cover: a.tgt.cover > 0.5, xray: a.st.xray, hotspots: a.st.hotspots, lens: s.state !== 'mounted' };
      Object.keys(tg).forEach((k) => tg[k].setAttribute('aria-pressed', String(!!on[k])));
      tg.lens.textContent = s.state === 'mounted' ? 'Detach lens' : 'Attach lens';
      if (l) { const f = l.fmin + (l.fmax - l.fmin) * a.st.zoomK, r = P.apertureRange(l, f); zoom.disabled = l.fmin === l.fmax; zoom.value = Math.round(a.st.zoomK * 100); zoomV.textContent = Math.round(f) + ' mm'; ap.max = r[1] - r[0]; const ai = Math.max(r[0], Math.min(r[1], P.apertureIndex(a.st.N))); ap.value = ai - r[0]; apV.textContent = 'f/' + P.APERTURE_LABELS[ai]; if (Math.abs(P.apertureValue(ai) - a.st.N) > 0.01) a.setAperture(P.apertureValue(ai)); }
      Array.from(shelf.children).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === s.id && s.state === 'mounted')));
    }
    function menuText() {
      const c = FF.menu.current();
      if (!FF.menu.power) menuHelp.textContent = 'The camera is off. Click the power switch on the model or press ON/OFF.';
      else if (c) menuHelp.replaceChildren(h('b', { style: { color: c.tab.col } }, c.tab.name + ' menu › ' + c.item[0]), h('br'), c.item[3], c.item[1] ? h('div', { class: 'muted' }, 'Options: ' + c.item[1].slice(0, 9).join(' · ') + (c.item[1].length > 9 ? ' …' : '')) : null, c.item[4] ? h('div', { class: 'tag ok', style: { marginTop: '4px' } }, 'Linked to the Simulator') : null);
      else if (FF.menu.screen === 'q') menuHelp.textContent = 'Quick Control: ▲▼ choose a setting, ◀▶ change it, SET to finish.';
      else if (FF.menu.screen === 'play') menuHelp.textContent = 'Playback: ◀▶ move between the photos in your Portfolio.';
      else menuHelp.textContent = 'Shooting screen. Press MENU for all settings, or SET for Quick Control. ▲ exposure compensation, ▼ drive, ◀ ISO, ▶ flash.';
    }
    FF.menu.on(menuText);
    showInfo(null); menuText();

    FF.cam3d.create(stage, { lcd }).then((api) => {
      E.api = api; stage.querySelector('.c3d-loading').remove(); fillParts();
      if (api.model !== 'glb') stage.append(h('div', { class: 'c3d-note small' }, 'Showing the simplified teaching model (the detailed EOS R100 model did not load).'));
      api.on.select = showInfo; api.on.lens = sync; api.on.state = sync;
      if (FF.Renderer && FF.Renderer.ok && FF.sim && FF.sim.makeThumb) { try { FF.menu.liveSrc = FF.sim.makeThumb(FF.cam.state.scene); } catch (e) { /* no preview */ } }
      api.refreshScreen(); sync(); if (E.tab === 'cam' && E.visible) api.start();
    }).catch((e) => { stage.replaceChildren(h('div', { class: 'callout warn' }, 'The 3D view could not start: ' + e.message + ' The rear screen and menus on the right still work.')); FF.menu.on(() => FF.menu.draw(lcd)); FF.menu.draw(lcd); });
  };
  E.show = function () { E.visible = true; if (E.tab === 'cam') { E.api && E.api.start(); } else FF.types3d.start(); };
  E.hide = function () { E.visible = false; E.api && E.api.stop(); FF.types3d && FF.types3d.stop(); };

  function lensSVG(l) { const d = l.dims || [69, 60], w = Math.max(16, d[1] * 0.5), hh = d[0] * 0.5; return `<svg viewBox="0 0 100 46" width="100" height="46" aria-hidden="true"><rect x="${50 - w / 2}" y="${23 - hh / 2}" width="${w}" height="${hh}" rx="3" fill="#1c1e21" stroke="#555b62"/><rect x="${50 - w / 2 + w * 0.3}" y="${23 - hh / 2}" width="${w * 0.35}" height="${hh}" fill="#0f1011"/><rect x="${50 - w / 2 - 3}" y="${23 - hh * 0.4}" width="3" height="${hh * 0.8}" fill="#b9bdc3"/><rect x="${50 + w / 2 - 2}" y="${23 - hh * 0.36}" width="2" height="${hh * 0.72}" fill="#33507a"/></svg>`; }
})();
