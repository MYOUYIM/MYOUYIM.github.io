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
C.append(bar, pager);
document.body.prepend(bg);
root.classList.add('glass-on');

// 禁止内容区横向滑动
pager.style.overflowX = 'hidden';
pager.style.touchAction = 'pan-y';

const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let act = cur, drag = null, settling = false, raf = 0, st = 0;
const W = () => pager.clientWidth;

const place = (p) => {
  const i = clamp(Math.floor(p), 0, n - 1);
  const f = Math.min(1, p - i);
  const a = L[i], b = L[Math.min(i + 1, n - 1)];
  ind.style.transform = `translateX(${lerp(a.offsetLeft, b.offsetLeft, f)}px)`;
  ind.style.width = lerp(a.offsetWidth, b.offsetWidth, f) + 'px';
};
const paint = k => L.forEach((l, j) => l.classList.toggle('active', j === k));

const goTo = (i) => {
  i = clamp(i, 0, n - 1);
  if (i === act && !settling) return;
  act = i;
  paint(i);
  place(i);
  pager.scrollTo({ left: i * W(), behavior: 'smooth' });
  history.replaceState(null, '', L[i].dataset.u);
};

// 点击切换
L.forEach((a, i) => {
  a.addEventListener('click', e => {
    e.preventDefault();
    goTo(i);
  });
});

// 导航栏滑动切换
const X = e => e.clientX - cats.getBoundingClientRect().left;
const xToP = x => {
  const c = L.map(l => l.offsetLeft + l.offsetWidth / 2);
  if (x <= c[0]) return 0;
  if (x >= c[n - 1]) return n - 1;
  let i = 0; while (x > c[i + 1]) i++;
  return i + (x - c[i]) / (c[i + 1] - c[i]);
};

const begin = e => {
  drag.on = true;
  clearTimeout(st);
  settling = false;
  ind.classList.remove('settle');
  cats.setPointerCapture(e.pointerId);
  ind.classList.add('grab');
};

const apply = () => {
  raf = 0;
  if (!drag) return;
  const p = xToP(drag.x);
  const now = performance.now();
  const dt = now - drag.t;
  if (dt > 0) drag.v = drag.v * .6 + .4 * (p - drag.p) / dt;
  drag.p = p;
  drag.t = now;
  place(p);
  const k = Math.round(p);
  if (k !== drag.k) {
    drag.k = k;
    paint(k);
  }
};

cats.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button) return;
  const x = X(e);
  drag = { id: e.pointerId, x0: x, x, on: false, v: 0, k: act, p: act, t: performance.now() };
});

cats.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const x = X(e);
  if (!drag.on) {
    if (Math.abs(x - drag.x0) < 8) return;
    begin(e);
  }
  drag.x = x;
  if (!raf) raf = requestAnimationFrame(apply);
});

const end = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.on) return;
  ind.classList.remove('grab');
  const dest = clamp(Math.round(d.p + d.v * 160), 0, n - 1);
  settling = true;
  ind.classList.add('settle');
  goTo(dest);
  st = setTimeout(() => {
    settling = false;
    ind.classList.remove('settle');
  }, 400);
};

cats.addEventListener('pointerup', end);
cats.addEventListener('pointercancel', end);
cats.addEventListener('lostpointercapture', end);

// 初始化
paint(act);
place(act);
pager.scrollLeft = act * W();

addEventListener('resize', () => {
  pager.scrollLeft = act * W();
  place(act);
});
}).catch(() => {});
})();