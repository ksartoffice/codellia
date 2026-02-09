(function () {
  const payloadSelector = 'script[data-codellia-js]';
  const processedAttr = 'data-codellia-js-run';
  const waitAttr = 'data-codellia-js-wait';

  function decodePayload(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }

  function runPayload(payload) {
    if (!payload || payload.hasAttribute(processedAttr)) return;
    const host = payload.closest('codellia-output');
    if (!host) {
      payload.setAttribute(processedAttr, '1');
      return;
    }
    const raw = payload.textContent || '';
    const jsText = decodePayload(raw);
    if (!jsText.trim()) {
      payload.setAttribute(processedAttr, '1');
      return;
    }
    const scriptEl = document.createElement('script');
    scriptEl.type = 'text/javascript';
    scriptEl.text = jsText;
    host.appendChild(scriptEl);
    payload.setAttribute(processedAttr, '1');
  }

  function runPending(force) {
    const payloads = document.querySelectorAll(payloadSelector);
    payloads.forEach((payload) => {
      if (!force && payload.hasAttribute(waitAttr)) {
        return;
      }
      runPayload(payload);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runPending(false));
  } else {
    runPending(false);
  }

  window.addEventListener('load', () => runPending(true));
})();
