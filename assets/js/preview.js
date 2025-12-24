(function () {
  const rootId = 'lc-root';
  const root = document.getElementById(rootId);
  if (!root) {
    return;
  }

  let styleTag = document.getElementById('lc-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'lc-style';
    document.head.appendChild(styleTag);
  }

  function sendClick(id) {
    window.parent.postMessage({
      type: 'lc_element_click',
      id,
    }, '*');
  }

  root.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-lc-id]');
    if (target) {
      target.style.outline = '2px solid #2271b1';
    }
  });

  root.addEventListener('mouseout', (event) => {
    const target = event.target.closest('[data-lc-id]');
    if (target) {
      target.style.outline = '';
    }
  });

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-lc-id]');
    if (target) {
      event.preventDefault();
      sendClick(target.getAttribute('data-lc-id'));
    }
  });

  window.addEventListener('message', (event) => {
    const payload = event.data || {};
    if (payload.type === 'lc_update') {
      root.innerHTML = payload.html || '';
      styleTag.textContent = payload.css || '';
    }
  });
})();
