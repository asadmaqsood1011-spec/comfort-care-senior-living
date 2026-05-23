// @ts-check

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function iconRefresh(context) {
  if (!window.lucide) return;
  if (context) _iconContexts.add(context);
  if (_iconRafId) return;
  _iconRafId = requestAnimationFrame(() => {
    _iconRafId = null;
    if (_iconContexts.size > 0) {
      _iconContexts.forEach((ctx) => window.lucide.createIcons({ context: ctx }));
      _iconContexts.clear();
    } else {
      window.lucide.createIcons();
    }
  });
}
