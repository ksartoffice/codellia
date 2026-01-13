(function () {
  const styleId = 'lc-style';
  const scriptId = 'lc-script';
  const externalScriptAttr = 'data-lc-external-script';
  const LC_ATTR_NAME = 'data-lc-id';
  const config = window.WP_LIVECODE_PREVIEW || {};
  const markerStart =
    config.markers && config.markers.start ? String(config.markers.start) : 'wp-livecode:start';
  const markerEnd =
    config.markers && config.markers.end ? String(config.markers.end) : 'wp-livecode:end';
  const allowedOrigin = getAllowedOrigin();
  let isReady = false;
  let hoverTarget = null;
  let highlightBox = null;
  let selectTarget = null;
  let selectBox = null;
  let markerNodes = null;
  let externalScripts = [];
  let externalScriptsReady = Promise.resolve();
  let externalScriptsToken = 0;

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

  function ensureHighlightBox() {
    if (highlightBox) return highlightBox;
    highlightBox = document.createElement('div');
    highlightBox.id = 'lc-highlight-box';
    Object.assign(highlightBox.style, {
      position: 'fixed',
      border: '2px solid #3b82f6',
      background: 'rgba(59, 130, 246, 0.12)',
      pointerEvents: 'none',
      zIndex: 2147483646,
      top: '0px',
      left: '0px',
      width: '0px',
      height: '0px',
      boxSizing: 'border-box',
      transition: 'all 60ms ease-out',
      display: 'none',
    });
    document.body.appendChild(highlightBox);
    return highlightBox;
  }

  function ensureSelectBox() {
    if (selectBox) return selectBox;
    selectBox = document.createElement('div');
    selectBox.id = 'lc-select-box';
    Object.assign(selectBox.style, {
      position: 'fixed',
      border: '2px solid #a855f7',
      background: 'rgba(168, 85, 247, 0.12)',
      pointerEvents: 'none',
      zIndex: 2147483645,
      top: '0px',
      left: '0px',
      width: '0px',
      height: '0px',
      boxSizing: 'border-box',
      transition: 'all 80ms ease-out',
      display: 'none',
    });
    document.body.appendChild(selectBox);
    return selectBox;
  }

  function clearHighlight() {
    hoverTarget = null;
    if (highlightBox) {
      highlightBox.style.display = 'none';
    }
  }

  function clearSelection() {
    selectTarget = null;
    if (selectBox) {
      selectBox.style.display = 'none';
    }
  }

  function drawHighlight(el) {
    if (!el || !(el instanceof Element)) {
      clearHighlight();
      return;
    }
    hoverTarget = el;
    const rect = el.getBoundingClientRect();
    const box = ensureHighlightBox();
    box.style.display = 'block';
    box.style.top = rect.top + 'px';
    box.style.left = rect.left + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function drawSelection(el) {
    if (!el || !(el instanceof Element)) {
      clearSelection();
      return;
    }
    selectTarget = el;
    const rect = el.getBoundingClientRect();
    const box = ensureSelectBox();
    box.style.display = 'block';
    box.style.top = rect.top + 'px';
    box.style.left = rect.left + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function handlePointerMove(event) {
    if (!event.target || !(event.target instanceof Element)) {
      clearHighlight();
      return;
    }
    const target = event.target.closest('[' + LC_ATTR_NAME + ']');
    if (!target) {
      clearHighlight();
      return;
    }
    drawHighlight(target);
  }

  function handleClick(event) {
    if (!event.target || !(event.target instanceof Element)) return;
    const target = event.target.closest('[' + LC_ATTR_NAME + ']');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    drawSelection(target);
    const lcId = target.getAttribute(LC_ATTR_NAME);
    if (lcId) {
      reply('LC_SELECT', { lcId: lcId });
    }
  }

  function attachDomSelector() {
    document.addEventListener('mousemove', handlePointerMove, { passive: true });
    document.addEventListener('mouseover', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', clearHighlight, { capture: true });
    document.addEventListener(
      'scroll',
      () => {
        if (hoverTarget) {
          drawHighlight(hoverTarget);
        }
        if (selectTarget) {
          drawSelection(selectTarget);
        }
      },
      true
    );
    window.addEventListener('resize', () => {
      if (hoverTarget) {
        drawHighlight(hoverTarget);
      }
      if (selectTarget) {
        drawSelection(selectTarget);
      }
    });
    document.addEventListener('click', handleClick, true);
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

  function removeScriptElement() {
    const scriptEl = document.getElementById(scriptId);
    if (scriptEl) {
      scriptEl.remove();
    }
  }

  function runJs(jsText) {
    if (!jsText) {
      removeScriptElement();
      return;
    }
    const runInline = () => {
      removeScriptElement();
      const scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'text/javascript';
      scriptEl.text = String(jsText);
      document.body.appendChild(scriptEl);
    };

    const currentReady = externalScriptsReady;
    currentReady.then(() => {
      if (currentReady !== externalScriptsReady) return;
      runInline();
    });
  }

  function normalizeExternalScripts(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  function isSameList(a, b) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  function clearExternalScripts() {
    const nodes = document.querySelectorAll('script[' + externalScriptAttr + ']');
    nodes.forEach((node) => node.remove());
  }

  function loadExternalScripts(list) {
    externalScriptsToken += 1;
    const token = externalScriptsToken;
    clearExternalScripts();
    if (!list.length) {
      return Promise.resolve();
    }

    const head = document.head || document.body;
    return list.reduce((chain, url) => {
      return chain.then(
        () =>
          new Promise((resolve) => {
            if (token !== externalScriptsToken) {
              resolve();
              return;
            }
            const scriptEl = document.createElement('script');
            scriptEl.setAttribute(externalScriptAttr, '1');
            scriptEl.async = false;
            scriptEl.src = url;
            scriptEl.onload = () => resolve();
            scriptEl.onerror = () => resolve();
            head.appendChild(scriptEl);
          })
      );
    }, Promise.resolve());
  }

  function setExternalScripts(list) {
    const next = normalizeExternalScripts(list);
    if (isSameList(next, externalScripts)) return;
    externalScripts = next;
    externalScriptsReady = loadExternalScripts(next);
  }

  function findMarkers() {
    if (markerNodes) return markerNodes;
    const walker = document.createTreeWalker(
      document.body || document,
      NodeFilter.SHOW_COMMENT,
      null
    );
    let start = null;
    let end = null;
    while (walker.nextNode()) {
      const value = (walker.currentNode.textContent || '').trim();
      if (!start && value === markerStart) {
        start = walker.currentNode;
        continue;
      }
      if (start && value === markerEnd) {
        end = walker.currentNode;
        break;
      }
    }
    if (start && end) {
      markerNodes = { start: start, end: end };
      return markerNodes;
    }
    return null;
  }

  function replaceEditableContent(html) {
    const markers = findMarkers();
    if (!markers) return;

    const range = document.createRange();
    range.setStartAfter(markers.start);
    range.setEndBefore(markers.end);
    range.deleteContents();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html || '';
    const frag = document.createDocumentFragment();
    while (wrapper.firstChild) {
      frag.appendChild(wrapper.firstChild);
    }
    range.insertNode(frag);
    range.detach();
  }

  function render(html, css) {
    replaceEditableContent(html);
    clearHighlight();
    clearSelection();
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
    if (data.type === 'LC_RUN_JS') {
      if (!isReady) return;
      runJs(data.jsText || '');
    }
    if (data.type === 'LC_DISABLE_JS') {
      if (!isReady) return;
      removeScriptElement();
    }
    if (data.type === 'LC_EXTERNAL_SCRIPTS') {
      if (!isReady) return;
      setExternalScripts(data.urls || []);
    }
  });

  attachDomSelector();
  reply('LC_READY', { postId: config.postId || null });
})();
