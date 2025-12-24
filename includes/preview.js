(function () {
  const rootId = 'lc-root';
  const styleId = 'lc-style';
  const config = window.WP_LIVECODE_PREVIEW || {};
  const allowedOrigin = getAllowedOrigin();
  let isReady = false;

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

  function reply(type, payload) {
    if (!window.parent) return;
    try {
      window.parent.postMessage(
        Object.assign({ type: type }, payload || {}),
        allowedOrigin || '*'
      );
    } catch (e) {
      // noop
    }
  }

  window.addEventListener('message', (event) => {
    if (allowedOrigin && event.origin !== allowedOrigin) return;
    const data = event.data || {};
    if (data.type === 'LC_INIT') {
      isReady = true;
      reply('LC_READY', { postId: config.postId || null });
      return;
    }
    if (data.type === 'LC_RENDER') {
      if (!isReady) return;
      render(data.canonicalHTML, data.cssText);
    }
  });

  reply('LC_READY', { postId: config.postId || null });
})();
