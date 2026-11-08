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

    // 取各页正文
    const bodies = docs.map((d, i) => {
      if (i === cur) return grab(container);
      const c = d.querySelector('.container');
      return c ? grab(c).map(n => document.importNode(n, true)) : [];
    });

    // 玻璃栏
    const gbar = document.createElement('div'); gbar.className = 'gbar';
    header.contains(cats) ? gbar.append(header) : gbar.append(header, cats);
    const ind = document.createElement('span'); ind.className = 'gind';
    cats.prepend(ind);

    // 分页器
    const pager = document.createElement('div'); pager.className = 'pager';
    bodies.forEach(nodes => {
      const pane = document.createElement('section'); pane.className = 'pane';
      const inner = document.createElement('div'); inner.className = 'pane-inner';
      nodes.forEach(n => inner.append(n));
      if (footer) inner.append(footer.cloneNode(true));
      pane.append(inner); pager.append(pane);
    });

    // 背景
    const bg = document.createElement('div'); bg.className = 'glass-bg';
    bg.innerHTML = '<i></i><i></i><i></i>';

    if (footer) footer.remove();
    container.append(gbar, pager);
    document.body.prepend(bg);
    root.classList.add('glass-on');

    const n = links.length;
    const lerp = (a, b, t) => a + (b - a) * t;
    let ticking = false, activeIdx = -1;

    const update = () => {
      ticking = false;
      const p = pager.scrollLeft / pager.clientWidth;
      const i = Math.max(0, Math.min(n - 1, Math.floor(p)));
      const f = Math.min(1, p - i), a = links[i], b = links[Math.min(i + 1, n - 1)];
      ind.style.transform = `translate3d(${lerp(a.offsetLeft, b.offsetLeft, f)}px,0,0)`;
      ind.style.width = lerp(a.offsetWidth, b.offsetWidth, f) + 'px';
      bg.style.setProperty('--p', p.toFixed(3));
      const act = Math.round(p);
      if (act !== activeIdx) {
        activeIdx = act;
        links.forEach((l, k) => l.classList.toggle('active', k === act));
      }
    };
    pager.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    // 滑动停止后同步地址栏（刷新/分享/返回都停在当前页）
    let t;
    const settle = () => history.replaceState(null, '', links[activeIdx].href);
    if ('onscrollend' in window) pager.addEventListener('scrollend', settle);
    else pager.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(settle, 140); }, { passive: true });

    // 点击 → 平滑滑动
    links.forEach((a, i) => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
    }));

    // 玻璃栏高度 → 内容顶部留白
    const setH = () => root.style.setProperty('--hdr-h', gbar.offsetHeight + 12 + 'px');
    new ResizeObserver(() => { setH(); update(); }).observe(gbar);
    setH();

    // 初始位置 / 旋转屏幕后对齐
    const align = () => { pager.style.scrollBehavior = 'auto'; pager.scrollLeft = (activeIdx < 0 ? cur : activeIdx) * pager.clientWidth; update(); };
    align();
    addEventListener('resize', align);
  }).catch(() => { /* 抓取失败：保持原样 */ });
})();