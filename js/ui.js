/* ui.js: tiny DOM helpers and control factories. */
(function () {
  'use strict';
  const FF = (window.FF = window.FF || {});
  const U = (FF.ui = {});

  U.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(9).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  };
  const h = U.h;
  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  U.seg = function (opts, value, onChange, cls) {
    const wrap = h('div', { class: 'seg ' + (cls || ''), role: 'group' });
    const set = (v) => { value = v; Array.from(wrap.children).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); };
    opts.forEach((o) => {
      const b = h('button', { type: 'button', 'data-v': o.v, title: o.title || '', disabled: o.disabled, onclick: () => { set(o.v); onChange(o.v); } }, o.label);
      wrap.append(b);
    });
    set(value); wrap.set = set;
    return wrap;
  };

  // [-] value [+] stepper. get() -> {text, auto, sub}; dec/inc callbacks; returns element with refresh().
  U.stepper = function (get, dec, inc) {
    const val = h('div', { class: 'val' }), b1 = h('button', { type: 'button', 'aria-label': 'decrease', onclick: dec }, '−'), b2 = h('button', { type: 'button', 'aria-label': 'increase', onclick: inc }, '+');
    const el = h('div', { class: 'step' }, b1, val, b2);
    el.refresh = function () {
      const g = get();
      val.className = 'val' + (g.auto ? ' auto' : ''); val.replaceChildren(g.text, g.sub ? h('small', null, g.sub) : '');
      b1.disabled = b2.disabled = !!g.locked;
    };
    el.refresh();
    return el;
  };

  U.ctl = (label, body, hint, right) => h('div', { class: 'ctl' }, h('div', { class: 'lab' }, h('span', null, label), right ? h('span', { class: 'mono' }, right) : null), body, hint ? h('div', { class: 'hint' }, hint) : null);

  U.toggle = function (label, checked, onChange) {
    const i = h('input', { type: 'checkbox', checked: checked || null, onchange: () => onChange(i.checked) });
    const el = h('label', { class: 'sw' }, i, h('span', null, label)); el.input = i; return el;
  };

  U.range = function (min, max, step, value, onInput) {
    const i = h('input', { type: 'range', min, max, step, value, oninput: () => onInput(+i.value) });
    return i;
  };

  let toastEl, toastT;
  U.toast = function (msg) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status' }); document.body.append(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600);
  };

  /* storage with graceful fallback */
  const mem = {};
  U.store = {
    get(k, d) { try { const v = localStorage.getItem('ff.' + k); if (v != null) return JSON.parse(v); } catch (e) {} return k in mem ? mem[k] : d; },
    set(k, v) { mem[k] = v; try { localStorage.setItem('ff.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  U.fmt = {
    ev: (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(1),
    ec: (thirds) => { const x = thirds / 3; const w = Math.trunc(Math.abs(x)), f = Math.round((Math.abs(x) - w) * 3); const s = thirds > 0 ? '+' : thirds < 0 ? '−' : ''; return s + (f ? (w ? w + ' ' : '') + f + '/3' : String(w)); },
    dist: (m) => (m >= 100 ? Math.round(m) + ' m' : m >= 10 ? m.toFixed(1) + ' m' : m >= 1 ? m.toFixed(2) + ' m' : Math.round(m * 100) + ' cm'),
    px: (x) => (x < 10 ? x.toFixed(1) : Math.round(x)) + ' px'
  };
})();
