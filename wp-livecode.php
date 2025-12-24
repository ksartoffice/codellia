<?php
/**
 * Plugin Name: WP LiveCode
 * Plugin URI: https://example.com
 * Description: A minimal WordPress plugin template
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://example.com
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-livecode
 * Domain Path: /languages
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants
define( 'WP_LIVECODE_VERSION', '1.0.0' );
define( 'WP_LIVECODE_PATH', plugin_dir_path( __FILE__ ) );
define( 'WP_LIVECODE_URL', plugin_dir_url( __FILE__ ) );

/**
 * Load plugin textdomain
 */
function wp_livecode_load_textdomain() {
	load_plugin_textdomain(
		'wp-livecode',
		false,
		basename( dirname( __FILE__ ) ) . '/languages'
	);
}
add_action( 'plugins_loaded', 'wp_livecode_load_textdomain' );

/**
 * Plugin activation hook
 */
function wp_livecode_activate() {
	// Add any activation routines here
}
register_activation_hook( __FILE__, 'wp_livecode_activate' );

/**
 * Plugin deactivation hook
 */
function wp_livecode_deactivate() {
	// Add any deactivation routines here
}
register_deactivation_hook( __FILE__, 'wp_livecode_deactivate' );

/**
 * Register LiveCode editor page.
 */
function wp_livecode_register_admin_page() {
	add_menu_page(
		__( 'WP LiveCode', 'wp-livecode' ),
		__( 'WP LiveCode', 'wp-livecode' ),
		'edit_posts',
		'wp-livecode-editor',
		'wp_livecode_render_editor_page',
		'dashicons-editor-code',
		58
	);
}
add_action( 'admin_menu', 'wp_livecode_register_admin_page' );

/**
 * Render LiveCode editor page.
 */
function wp_livecode_render_editor_page() {
	$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;

	if ( ! $post_id ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( '投稿が指定されていません。', 'wp-livecode' ) . '</p></div>';
		return;
	}

	$post = get_post( $post_id );
	if ( ! $post ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( '投稿が見つかりません。', 'wp-livecode' ) . '</p></div>';
		return;
	}

	?>
	<div class="wrap wp-livecode-app" data-post-id="<?php echo esc_attr( $post_id ); ?>">
		<div class="wp-livecode-toolbar">
			<div class="wp-livecode-toolbar__left">
				<strong><?php echo esc_html( get_the_title( $post_id ) ); ?></strong>
			</div>
			<div class="wp-livecode-toolbar__right">
				<button type="button" class="button" data-lc-action="undo"><?php esc_html_e( 'Undo', 'wp-livecode' ); ?></button>
				<button type="button" class="button" data-lc-action="redo"><?php esc_html_e( 'Redo', 'wp-livecode' ); ?></button>
				<button type="button" class="button button-primary" data-lc-action="save"><?php esc_html_e( '保存', 'wp-livecode' ); ?></button>
			</div>
		</div>
		<div class="wp-livecode-main">
			<div class="wp-livecode-editor">
				<div class="wp-livecode-tabs">
					<button type="button" class="wp-livecode-tab is-active" data-lc-tab="html">HTML</button>
					<button type="button" class="wp-livecode-tab" data-lc-tab="css">CSS</button>
				</div>
				<div class="wp-livecode-editor-panels">
					<div class="wp-livecode-panel is-active" data-lc-panel="html">
						<div id="wp-livecode-html-editor" class="wp-livecode-editor-surface"></div>
					</div>
					<div class="wp-livecode-panel" data-lc-panel="css">
						<div id="wp-livecode-css-editor" class="wp-livecode-editor-surface"></div>
					</div>
				</div>
			</div>
			<div class="wp-livecode-preview">
				<iframe class="wp-livecode-preview__frame" title="<?php esc_attr_e( 'ライブプレビュー', 'wp-livecode' ); ?>"></iframe>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Enqueue admin assets for LiveCode editor.
 */
function wp_livecode_enqueue_admin_assets( $hook ) {
	if ( 'toplevel_page_wp-livecode-editor' !== $hook ) {
		return;
	}

	$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$post    = $post_id ? get_post( $post_id ) : null;

	$post_content = $post ? $post->post_content : '';
	$post_css     = $post_id ? (string) get_post_meta( $post_id, '_lc_css', true ) : '';

	wp_enqueue_style(
		'wp-livecode-admin',
		WP_LIVECODE_URL . 'assets/admin.css',
		array(),
		WP_LIVECODE_VERSION
	);

	wp_enqueue_script(
		'wp-livecode-monaco-loader',
		WP_LIVECODE_URL . 'assets/monaco/vs/loader.js',
		array(),
		WP_LIVECODE_VERSION,
		true
	);

	wp_enqueue_script(
		'wp-livecode-admin',
		WP_LIVECODE_URL . 'assets/admin.js',
		array( 'wp-livecode-monaco-loader' ),
		WP_LIVECODE_VERSION,
		true
	);

	$preview_url = '';
	if ( $post_id ) {
		$preview_url = add_query_arg(
			array(
				'lc_preview' => 1,
				'post_id'    => $post_id,
				'token'      => wp_create_nonce( 'wp_livecode_preview_' . $post_id ),
			),
			get_permalink( $post_id )
		);
	}

	wp_localize_script(
		'wp-livecode-admin',
		'wpLivecodeData',
		array(
			'postId'    => $post_id,
			'nonce'     => wp_create_nonce( 'wp_livecode_save_' . $post_id ),
			'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
			'html'      => $post_content,
			'css'       => $post_css,
			'previewUrl'=> $preview_url,
			'monacoBase'=> WP_LIVECODE_URL . 'assets/monaco/vs',
		)
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_enqueue_admin_assets' );

/**
 * Save LiveCode content via AJAX.
 */
function wp_livecode_handle_save() {
	$post_id = isset( $_POST['postId'] ) ? absint( $_POST['postId'] ) : 0;

	if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
		wp_send_json_error( array( 'message' => __( '権限がありません。', 'wp-livecode' ) ), 403 );
	}

	check_ajax_referer( 'wp_livecode_save_' . $post_id, 'nonce' );

	$html = isset( $_POST['html'] ) ? wp_kses_post( wp_unslash( $_POST['html'] ) ) : '';
	$css  = isset( $_POST['css'] ) ? wp_strip_all_tags( wp_unslash( $_POST['css'] ) ) : '';

	wp_update_post(
		array(
			'ID'           => $post_id,
			'post_content' => $html,
		)
	);

	update_post_meta( $post_id, '_lc_css', $css );

	wp_send_json_success();
}
add_action( 'wp_ajax_wp_livecode_save', 'wp_livecode_handle_save' );

/**
 * Add Gutenberg menu item to open LiveCode.
 */
function wp_livecode_enqueue_gutenberg_link() {
	wp_enqueue_script(
		'ai-editor-gutenberg-button',
		'',
		array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ),
		WP_LIVECODE_VERSION,
		true
	);

	wp_localize_script(
		'ai-editor-gutenberg-button',
		'wpLivecodeGutenberg',
		array(
			'adminUrl' => admin_url(),
		)
	);

	$inline_script = <<<JS
( function( wp ) {
	if ( ! wp || ! wp.plugins || ! wp.editPost ) {
		return;
	}
	var PluginMoreMenuItem = wp.editPost.PluginMoreMenuItem;
	var registerPlugin = wp.plugins.registerPlugin;
	var data = wp.data;

	function LiveCodeMenuItem() {
		var postId = data.select( 'core/editor' ).getCurrentPostId();
		var url = wpLivecodeGutenberg.adminUrl + 'admin.php?page=wp-livecode-editor&post_id=' + postId;
		return wp.element.createElement(
			PluginMoreMenuItem,
			{
				icon: 'editor-code',
				onClick: function() { window.open( url, '_blank' ); }
			},
			wp.i18n ? wp.i18n.__( 'WP LiveCode で編集', 'wp-livecode' ) : 'WP LiveCode で編集'
		);
	}

	registerPlugin( 'wp-livecode-menu-item', { render: LiveCodeMenuItem } );
} )( window.wp );
JS;

	wp_add_inline_script( 'ai-editor-gutenberg-button', $inline_script );
}
add_action( 'enqueue_block_editor_assets', 'wp_livecode_enqueue_gutenberg_link' );
