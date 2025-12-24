( function() {
	if ( ! window.wpLivecodeData ) {
		return;
	}

	var data = window.wpLivecodeData;
	var htmlEditor;
	var cssEditor;
	var activeEditor = null;

	function setActiveTab( tab ) {
		var tabs = document.querySelectorAll( '.wp-livecode-tab' );
		var panels = document.querySelectorAll( '.wp-livecode-panel' );

		tabs.forEach( function( item ) {
			item.classList.toggle( 'is-active', item.dataset.lcTab === tab );
		} );
		panels.forEach( function( item ) {
			item.classList.toggle( 'is-active', item.dataset.lcPanel === tab );
		} );

		activeEditor = tab === 'css' ? cssEditor : htmlEditor;
		if ( activeEditor ) {
			activeEditor.layout();
			activeEditor.focus();
		}
	}

	function bindTabs() {
		document.querySelectorAll( '.wp-livecode-tab' ).forEach( function( tab ) {
			tab.addEventListener( 'click', function() {
				setActiveTab( tab.dataset.lcTab );
			} );
		} );
	}

	function bindToolbar() {
		var toolbar = document.querySelector( '.wp-livecode-toolbar' );
		if ( ! toolbar ) {
			return;
		}

		toolbar.addEventListener( 'click', function( event ) {
			var action = event.target.dataset.lcAction;
			if ( ! action || ! activeEditor ) {
				return;
			}

			if ( action === 'undo' ) {
				activeEditor.trigger( 'toolbar', 'undo', null );
			}
			if ( action === 'redo' ) {
				activeEditor.trigger( 'toolbar', 'redo', null );
			}
			if ( action === 'save' ) {
				saveContent();
			}
		} );
	}

	function saveContent() {
		var formData = new window.FormData();
		formData.append( 'action', 'wp_livecode_save' );
		formData.append( 'postId', data.postId );
		formData.append( 'nonce', data.nonce );
		formData.append( 'html', htmlEditor ? htmlEditor.getValue() : '' );
		formData.append( 'css', cssEditor ? cssEditor.getValue() : '' );

		window.fetch( data.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			body: formData
		} ).then( function( response ) {
			return response.json();
		} ).then( function( payload ) {
			if ( payload.success ) {
				window.alert( '保存しました。' );
			} else {
				window.alert( '保存に失敗しました。' );
			}
		} ).catch( function() {
			window.alert( '保存に失敗しました。' );
		} );
	}

	function setPreview() {
		var frame = document.querySelector( '.wp-livecode-preview__frame' );
		if ( frame && data.previewUrl ) {
			frame.src = data.previewUrl;
		}
	}

	function initEditors() {
		window.require.config( {
			paths: {
				vs: data.monacoBase
			}
		} );

		window.require( [ 'vs/editor/editor.main' ], function() {
			htmlEditor = window.monaco.editor.create( document.getElementById( 'wp-livecode-html-editor' ), {
				value: data.html || '',
				language: 'html',
				automaticLayout: true,
				minimap: { enabled: false }
			} );
			cssEditor = window.monaco.editor.create( document.getElementById( 'wp-livecode-css-editor' ), {
				value: data.css || '',
				language: 'css',
				automaticLayout: true,
				minimap: { enabled: false }
			} );

			activeEditor = htmlEditor;
			setActiveTab( 'html' );
		} );
	}

	function boot() {
		bindTabs();
		bindToolbar();
		setPreview();

		if ( window.require && window.monaco ) {
			initEditors();
			return;
		}

		if ( window.require ) {
			initEditors();
			return;
		}

		window.addEventListener( 'load', function() {
			initEditors();
		} );
	}

	document.addEventListener( 'DOMContentLoaded', boot );
} )();
