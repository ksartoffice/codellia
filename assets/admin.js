(() => {
	const htmlTab = document.querySelector('[data-tab="html"]');
	const cssTab = document.querySelector('[data-tab="css"]');
	const htmlPanel = document.querySelector('[data-tab-panel="html"]');
	const cssPanel = document.querySelector('[data-tab-panel="css"]');

	if (!htmlTab || !cssTab || !htmlPanel || !cssPanel) {
		return;
	}

	const setActiveTab = (tab) => {
		const isHtml = tab === 'html';
		htmlTab.classList.toggle('is-active', isHtml);
		cssTab.classList.toggle('is-active', !isHtml);
		htmlTab.setAttribute('aria-selected', isHtml ? 'true' : 'false');
		cssTab.setAttribute('aria-selected', !isHtml ? 'true' : 'false');
		htmlPanel.classList.toggle('is-active', isHtml);
		cssPanel.classList.toggle('is-active', !isHtml);
	};

	htmlTab.addEventListener('click', () => setActiveTab('html'));
	cssTab.addEventListener('click', () => setActiveTab('css'));

	const initMonaco = () => {
		if (!window.require || !window.monaco) {
			return;
		}

		const htmlEditor = window.monaco.editor.create(htmlPanel, {
			value: '<div>WP LiveCode</div>',
			language: 'html',
			theme: 'vs-light',
			minimap: { enabled: false },
		});

		const cssEditor = window.monaco.editor.create(cssPanel, {
			value: 'body { background: #fff; }',
			language: 'css',
			theme: 'vs-light',
			minimap: { enabled: false },
		});

		window.addEventListener('resize', () => {
			htmlEditor.layout();
			cssEditor.layout();
		});
	};

	const loadMonaco = () => {
		if (!window.require || !window.WP_LIVECODE) {
			return;
		}

		window.require.config({ paths: { vs: WP_LIVECODE.monacoBaseUrl } });
		window.require(['vs/editor/editor.main'], initMonaco);
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', loadMonaco);
	} else {
		loadMonaco();
	}
})();
