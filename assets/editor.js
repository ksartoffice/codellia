(function () {
  function setupTabs(container) {
    var tabs = container.querySelectorAll('.wp-livecode-tab');
    var panels = container.querySelectorAll('.wp-livecode-editor__panel');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');

        tabs.forEach(function (btn) {
          btn.classList.toggle('is-active', btn === tab);
        });

        panels.forEach(function (panel) {
          panel.classList.toggle(
            'is-active',
            panel.getAttribute('data-panel') === target
          );
        });
      });
    });
  }

  function setupPreview(container) {
    var previewUrl = container.getAttribute('data-preview-url');
    var iframe = container.querySelector('.wp-livecode-preview');
    if (previewUrl && iframe) {
      iframe.src = previewUrl;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var editor = document.querySelector('.wp-livecode-editor__body');
    if (!editor) {
      return;
    }

    setupTabs(editor);
    setupPreview(editor);
  });
})();
