(function () {
  const config = window.wpLivecodeConfig;
  if (!config) {
    return;
  }

  const htmlTab = document.querySelector('[data-tab="html"]');
  const cssTab = document.querySelector('[data-tab="css"]');
  const htmlPane = document.getElementById('wp-livecode-html');
  const cssPane = document.getElementById('wp-livecode-css');
  const undoButton = document.getElementById('wp-livecode-undo');
  const redoButton = document.getElementById('wp-livecode-redo');
  const saveButton = document.getElementById('wp-livecode-save');
  const status = document.getElementById('wp-livecode-status');
  const previewFrame = document.getElementById('wp-livecode-preview');

  let activeEditor = null;
  let htmlEditor = null;
  let cssEditor = null;

  function setStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  function setActiveTab(tab) {
    if (tab === 'html') {
      htmlTab.classList.add('is-active');
      cssTab.classList.remove('is-active');
      htmlPane.style.display = 'block';
      cssPane.style.display = 'none';
      activeEditor = htmlEditor;
    } else {
      htmlTab.classList.remove('is-active');
      cssTab.classList.add('is-active');
      htmlPane.style.display = 'none';
      cssPane.style.display = 'block';
      activeEditor = cssEditor;
    }
  }

  function createCanonicalHtml(rawHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    let id = 1;
    doc.body.querySelectorAll('*').forEach((node) => {
      node.setAttribute('data-lc-id', String(id));
      id += 1;
    });
    return {
      canonicalHtml: doc.body.innerHTML,
      map: {},
    };
  }

  function postPreviewUpdate() {
    if (!previewFrame || !previewFrame.contentWindow) {
      return;
    }
    const htmlValue = htmlEditor ? htmlEditor.getValue() : '';
    const cssValue = cssEditor ? cssEditor.getValue() : '';
    const canonical = createCanonicalHtml(htmlValue);
    previewFrame.contentWindow.postMessage(
      {
        type: 'lc_update',
        html: canonical.canonicalHtml,
        css: cssValue,
      },
      config.previewOrigin
    );
  }

  function attachEditorListeners(editor) {
    editor.onDidChangeModelContent(() => {
      setStatus('変更あり');
      postPreviewUpdate();
    });
  }

  function initializeMonaco() {
    if (!window.monaco) {
      return;
    }
    htmlEditor = window.monaco.editor.create(htmlPane.querySelector('.monaco-container'), {
      value: config.initialHtml,
      language: 'html',
      theme: 'vs',
      minimap: { enabled: false },
      automaticLayout: true,
    });

    cssEditor = window.monaco.editor.create(cssPane.querySelector('.monaco-container'), {
      value: config.initialCss,
      language: 'css',
      theme: 'vs',
      minimap: { enabled: false },
      automaticLayout: true,
    });

    attachEditorListeners(htmlEditor);
    attachEditorListeners(cssEditor);
    activeEditor = htmlEditor;
    setActiveTab('html');
    postPreviewUpdate();
  }

  function loadMonaco() {
    if (!window.require) {
      return;
    }
    window.require.config({ paths: { vs: config.monacoPath } });
    window.require(['vs/editor/editor.main'], () => {
      initializeMonaco();
    });
  }

  htmlTab.addEventListener('click', () => setActiveTab('html'));
  cssTab.addEventListener('click', () => setActiveTab('css'));

  undoButton.addEventListener('click', () => {
    if (activeEditor) {
      activeEditor.trigger('toolbar', 'undo', null);
    }
  });

  redoButton.addEventListener('click', () => {
    if (activeEditor) {
      activeEditor.trigger('toolbar', 'redo', null);
    }
  });

  saveButton.addEventListener('click', () => {
    const htmlValue = htmlEditor ? htmlEditor.getValue() : '';
    const cssValue = cssEditor ? cssEditor.getValue() : '';
    setStatus('保存中...');
    window.fetch(config.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({
        action: 'wp_livecode_save',
        nonce: config.nonce,
        post_id: String(config.postId),
        html: htmlValue,
        css: cssValue,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setStatus('保存しました');
        } else {
          setStatus(data.data || '保存に失敗しました');
        }
      })
      .catch(() => {
        setStatus('保存に失敗しました');
      });
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== config.previewOrigin) {
      return;
    }
    const payload = event.data || {};
    if (payload.type === 'lc_element_click') {
      setStatus('クリックした要素: ' + payload.id);
    }
  });

  if (document.readyState === 'complete') {
    loadMonaco();
  } else {
    window.addEventListener('load', loadMonaco);
  }
})();
