(() => {
  const container = document.querySelector('.container');
  const cats = container && container.querySelector('.categories');
  const header = container && container.querySelector('header');
  if (!cats || !header || !window.fetch) return;

  const links = [...cats.querySelectorAll('a.cat-btn')];
  if (links.length < 2) return;

  const norm = u => {
    let p = new URL(u, location.href).pathname.replace(/index\.html$/, '');
    return p.length > 1 ? p.replace(/\/$/, '') : p;
  };
  const cur = links.findIndex(a => norm(a.href) === norm(location.href));
  if (cur < 0) return;                       // 文章页等：不接管，只吃 CSS 玻璃

  const SKIP = 'header,.categories,footer,script,style';
  const grab = root => [...root.children].filter(n => !n.matches(SKIP));

  Promise.all(links.map((a, i) => i === cur ? null :
    fetch(a.href).then(r => r.ok ? r.text() : Promise.reject())
      .then(t => new DOMParser().parseFromString(t, 'text/html'))
  )).then(docs => {
    const root = document.documentElement;
    const footer = container.querySelector('footer');

    const bodies = docs.map((d, i) => {
      if (i === cur) return grab(container);
      const c = d.querySelector('.container');
      return c ? grab(c).map(n => document.importNode(n, true)) : [];
    });

    const gbar = document.createElement('div'); gbar.className = 'gbar';
    header.contains(cats) ? gbar.append(header) : gbar.append(header, cats);
    const ind = document.createElement('span'); ind.className = 'gind';
    cats.prepend(ind);

    const pager = document.createElement('div'); pager.className = 'pager';
    bodies.forEach(nodes => {
      const pane = document.createElement('section'); pane.className = 'pane';
      const inner = document.createElement('div'); inner.className = 'pane-inner';
      nodes.forEach(n => inner.append(n));
      if (footer) inner.append(footer.cloneNode(true));
      pane.append(inner); pager.append(pane);
    });

    const bg = document.createElement('div'); bg.className = 'glass-bg';
    bg.innerHTML = '<i></i><i></i><i></i>';

    if (footer) footer.remove();
    container.append(gbar, pager);
    document.body.prepend(bg);
    root.classList.add('glass-on');

    const n = links.length;
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let ticking = false, activeIdx = -1, drag = null, settling = false;

    // 把玻璃滑块放到连续位置 p（0 ~ n-1）
    const place = p => {
      const i = clamp(Math.floor(p), 0, n - 1), f = Math.min(1, p - i);
      const a = links[i], b = links[Math.min(i + 1, n - 1)];
      ind.style.transform = `translate3d(${lerp(a.offsetLeft, b.offsetLeft, f)}px,0,0)`;
      ind.style.width = lerp(a.offsetWidth, b.offsetWidth, f) + 'px';
    };
    const paint = act => links.forEach((l, k) => l.classList.toggle('active', k === act));

    const update = () => {
      ticking = false;
      const p = pager.scrollLeft / pager.clientWidth;
      bg.style.setProperty('--p', p.toFixed(3));
      if ((drag && drag.started) || settling) return;   // 拖动/落位期间，玻璃不由页面带动
      place(p);
      const act = Math.round(p);
      if (act !== activeIdx) { activeIdx = act; paint(act); }
    };
    pager.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    // 滑动停止后同步地址栏
    let t;
    const syncUrl = () => { if (activeIdx >= 0) history.replaceState(null, '', links[activeIdx].href); };
    if ('onscrollend' in window) pager.addEventListener('scrollend', syncUrl);
    else pager.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(syncUrl, 140); }, { passive: true });

    // 点击 → 平滑滑动
    let suppressClick = false;
    links.forEach((a, i) => {
      a.draggable = false;
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        if (suppressClick) return;
        pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
      });
    });
    cats.addEventListener('contextmenu', e => e.preventDefault());

    // ===== 按住玻璃：放大 → 只有玻璃跟手移动 → 松手后页面才跳转 =====
    const centers = () => links.map(l => l.offsetLeft + l.offsetWidth / 2);
    const navX = e => e.clientX - cats.getBoundingClientRect().left;
    const xToP = x => {
      const c = centers();
      if (x <= c[0]) return 0;
      if (x >= c[n - 1]) return n - 1;
      let i = 0; while (x > c[i + 1]) i++;
      return i + (x - c[i]) / (c[i + 1] - c[i]);
    };
    let raf = 0, settleTimer = 0;

    const endSettle = () => {
      settling = false;
      ind.classList.remove('settle');
      update();
    };
    const begin = e => {
      drag.started = true;
      clearTimeout(settleTimer); settling = false; ind.classList.remove('settle');
      cats.setPointerCapture(e.pointerId);
      ind.classList.add('grab');
      if (navigator.vibrate) navigator.vibrate(8);
    };
    const applyDrag = () => {
      raf = 0; if (!drag) return;
      const p = xToP(drag.x), now = performance.now(), dt = now - drag.lastT;
      if (dt > 0) drag.vp = drag.vp * .6 + .4 * (p - drag.lastP) / dt;
      drag.lastP = p; drag.lastT = now;
      place(p);                                   // 只移动玻璃，页面保持不动
      const act = Math.round(p);
      if (act !== drag.idx) {                     // 玻璃经过某个标签：标签高亮 + 轻震
        drag.idx = act; paint(act);
        if (navigator.vibrate) navigator.vibrate(6);
      }
    };

    cats.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button) return;
      const x = navX(e), a = links[Math.max(0, activeIdx)];
      drag = { id: e.pointerId, x0: x, x, started: false, vp: 0, idx: activeIdx,
               lastP: Math.max(0, activeIdx), lastT: performance.now() };
      if (x >= a.offsetLeft && x <= a.offsetLeft + a.offsetWidth) begin(e);   // 按在当前玻璃上：立刻放大
    });
    cats.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = navX(e);
      if (!drag.started) { if (Math.abs(x - drag.x0) < 8) return; begin(e); }
      drag.x = x;
      if (!raf) raf = requestAnimationFrame(applyDrag);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.started) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
      ind.classList.remove('grab');

      // 玻璃停下的位置（带一点惯性）= 要跳转的页面
      const dest = clamp(Math.round(d.lastP + d.vp * 160), 0, n - 1);
      activeIdx = dest; paint(dest);

      settling = true;                            // 玻璃自己落位，页面同时开始滑过去
      ind.classList.add('settle');
      place(dest);
      pager.scrollTo({ left: dest * pager.clientWidth, behavior: 'smooth' });
      settleTimer = setTimeout(endSettle, 650);
    };
    cats.addEventListener('pointerup', end);
    cats.addEventListene