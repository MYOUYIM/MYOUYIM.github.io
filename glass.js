(() => {
const C = document.querySelector('.container');
const cats = C && C.querySelector('.categories');
const hd = C && C.querySelector('header');
if (!cats || !hd || !window.fetch) return;
const L = [...cats.querySelectorAll('a.cat-btn')];
if (L.length < 2) return;
const norm = u => { let p = new URL(u, location.href).pathname.replace(/index\.html\( /, ''); return p.length > 1 ? p.replace(/\/ \)/, '') : p; };
const cur = L.findIndex(a => norm(a.href) === norm(location.href));
if (cur < 0) return;
const grab = r => [...r.children].filter(x => !x.matches('header,.categories,footer,script,style'));

Promise.all(L.map((a, i) => i === cur ? null :
  fetch(a.href).then(r => r.ok ? r.text() : Promise.reject()).then(t => new DOMParser().parseFromString(t, 'text/html'))
)).then(docs => {
L.forEach(a => { a.dataset.u = a.href; a.removeAttribute('href'); a.tabIndex = 0; });
const root = document.documentElement, foot = C.querySelector('footer'), n = L.length;
const bodies = docs.map((d, i) => {
  if (i === cur) return grab(C);
  const c = d.querySelector('.container');
  return c ? grab(c).map(x => document.importNode(x, true)) : [];
});
const mk = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
const bar = mk('div', 'gbar'), ind = mk('span', 'gind'), pager = mk('div', 'pager'), bg = mk('div', 'glass-bg');
hd.contains(cats) ? bar.append(hd) : bar.append(hd, cats);
cats.prepend(ind);
bg.innerHTML = '<i></i><i></i><i></i>';
bodies.forEach(nodes => {
  const pane = mk('section', 'pane'), inner = mk('div', 'pane-inner');
  nodes.forEach(x => inner.append(x));
  if (foot) inner.append(foot.cloneNode(true));
  pane.append(inner); pager.append(pane);
});
if (foot) foot.remove();
C.append(bar, pager); document.body.prepend(bg); root.classList.add('glass-on');

const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let tick = false, act = -1, drag = null, settling = false, suppress = false, raf = 0, st = 0, t;
const W = () => pager.clientWidth;
const place = p => {
  const i = clamp(Math.floor(p), 0, n - 1), f = Math.min(1, p - i), a = L[i], b = L[Math.min(i + 1, n - 1)];
  ind.style.translate = lerp(a.offsetLeft, b.offsetLeft, f) + 'px 0';
  ind.style.width = lerp(a.offsetWidth, b.offsetWidth, f) + 'px';
};
const paint = k => L.forEach((l, j) => l.classList.toggle('active', j === k));
const update = () => {
  tick = false;
  const p = pager.scrollLeft / W();
  bg.style.setProperty('--p', p.toFixed(3));
  if ((drag && drag.on) || settling) return;
  place(p);
  const k = Math.round(p);
  if (k !== act) { act = k; paint(k); }
};
pager.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
const sync = () => { if (act >= 0) history.replaceState(null, '', L[act].dataset.u); };
if ('onscrollend' in window) pager.addEventListener('scrollend', sync);
else pager.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(sync, 140); }, { passive: true });
L.forEach((a, i) => {
  a.addEventListener('keydown', e => e.key === 'Enter' && a.click());
  a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (!suppress) pager.scrollTo({ left: i * W(), behavior: 'smooth' });
  });
});
cats.addEventListener('contextmenu', e => e.preventDefault());

// 按住玻璃：放大 -> 只有玻璃跟手 -> 松手后页面才跳转
const X = e => e.clientX - cats.getBoundingClientRect().left;
const xToP = x => {
  const c = L.map(l => l.offsetLeft + l.offsetWidth / 2);
  if (x <= c[0]) return 0;
  if (x >= c[n - 1]) return n - 1;
  let i = 0; while (x > c[i + 1]) i++;
  return i + (x - c[i]) / (c[i + 1] - c[i]);
};
const vib = ms => navigator.vibrate && navigator.vibrate(ms);
const begin = e => {
  drag.on = true; clearTimeout(st); settling = false; ind.classList.remove('settle');
  cats.setPointerCapture(e.pointerId); ind.classList.add('grab'); vib(8);
};
const apply = () => {
  raf = 0; if (!drag) return;
  const p = xToP(drag.x), now = performance.now(), dt = now - drag.t;
  if (dt > 0) drag.v = drag.v * .6 + .4 * (p - drag.p) / dt;
  drag.p = p; drag.t = now; place(p);
  const k = Math.round(p);
  if (k !== drag.k) { drag.k = k; paint(k); vib(6); }
};
cats.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button) return;
  const x = X(e), a = L[Math.max(0, act)];
  drag = { id: e.pointerId, x0: x, x, on: false, v: 0, k: act, p: Math.max(0, act), t: performance.now() };
  if (x >= a.offsetLeft && x <= a.offsetLeft + a.offsetWidth) begin(e);
});
cats.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const x = X(e);
  if (!drag.on) { if (Math.abs(x - drag.x0) < 8) return; begin(e); }
  drag.x = x;
  if (!raf) raf = requestAnimationFrame(apply);
});
const end = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (!d.on) return;
  suppress = true; setTimeout(() => { suppress = false; }, 60);
  ind.classList.remove('grab');
  const dest = clamp(Math.round(d.p + d.v * 160), 0, n - 1);
  act = dest; paint(dest);
  settling = true; ind.classList.add('settle'); place(dest);
  pager.scrollTo({ left: dest * W(), behavior: 'smooth' });
  st = setTimeout(() => { settling = false; ind.classList.remove('settle'); update(); }, 650);
};
cats.addEventListener('pointerup', end);
cats.addEventListener('pointercancel', end);
cats.addEventListener('lostpointercapture', end);

const setH = () => root.style.setProperty('--hdr-h', bar.offsetHeight + 12 + 'px');
new ResizeObserver(() => { setH(); update(); }).observe(bar);
setH();

// ---------- 导航栏折叠（轻量流畅版） ----------
let collapsed = true;

const setCollapsed = (v) => {
  if (collapsed === v) return;
  collapsed = v;
  bar.classList.toggle('collapsed', v);
  requestAnimationFrame(() => {
    requestAnimationFrame(setH);
  });
};

setCollapsed(true);

bar.addEventListener('click', (e) => {
  if (drag && drag.on) return;
  if (e.target.closest('.cat-btn') && collapsed) {
    setCollapsed(false);
    return;
  }
  setCollapsed(!collapsed);
});

const panes = [...pager.querySelectorAll('.pane')];
panes.forEach(pane => {
  let lastY = 0;
  let locked = false;

  pane.addEventListener('scroll', () => {
    if (locked) return;
    locked = true;
    requestAnimationFrame(() => {
      const y = pane.scrollTop;
      if (y > lastY + 50 && !collapsed) {
        setCollapsed(true);
      }
      lastY = y;
      locked = false;
    });
  }, { passive: true });
});

const align = () => { pager.style.scrollBehavior = 'auto'; pager.scrollLeft = (act < 0 ? cur : act) * W(); update(); };
align();
addEventListener('resize', align);
}).catch(() => {});
})();