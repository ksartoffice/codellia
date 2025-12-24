(function () {
  const rootId = 'lc-root';
  const styleId = 'lc-style';
  const config = window.WP_LIVECODE_PREVIEW || {};

  function getAllowedOrigin() {
    if (config.allowedOrigin) return config.allowedOrigin;
    if (document.referrer) {
      try {
        return new URL(document.referrer).origin;
      } catch (e) {
        return '';
      }
    }
    return '';
  }

  const allowedOrigin = getAllowedOrigin();

  function ensureStyleElement() {
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  function render(html, css) {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = html || '';
    ensureStyleElement().textContent = css || '';
  }

  window.addEventListener('message', (event) => {
    if (allowedOrigin && event.origin !== allowedOrigin) return;
    const data = event.data || {};
    if (data.type === 'LC_RENDER') {
      render(data.html, data.css);
    }
  });

  if (window.parent) {
    try {
      window.parent.postMessage({ type: 'LC_READY' }, allowedOrigin || '*');
    } catch (e) {
      // noop
    }
  }
})();
