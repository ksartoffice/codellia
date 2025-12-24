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
define( 'WP_LIVECODE_EDITOR_SLUG', 'wp-livecode-editor' );

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
 * Register the LiveCode editor page.
 */
function wp_livecode_register_editor_page() {
	add_menu_page(
		'WP LiveCode',
		'WP LiveCode',
		'edit_posts',
		WP_LIVECODE_EDITOR_SLUG,
		'wp_livecode_render_editor_page',
		'dashicons-editor-code',
		80
	);
}
add_action( 'admin_menu', 'wp_livecode_register_editor_page' );

/**
 * Enqueue admin assets for the LiveCode editor.
 *
 * @param string $hook Current admin page hook.
 */
function wp_livecode_enqueue_editor_assets( $hook ) {
	if ( 'toplevel_page_' . WP_LIVECODE_EDITOR_SLUG !== $hook ) {
		return;
	}

	$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$post    = $post_id ? get_post( $post_id ) : null;

	$initial_html = $post ? $post->post_content : '';
	$initial_css  = $post ? (string) get_post_meta( $post_id, '_lc_css', true ) : '';

	wp_enqueue_style(
		'wp-livecode-admin',
		WP_LIVECODE_URL . 'assets/css/admin.css',
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
		WP_LIVECODE_URL . 'assets/js/admin.js',
		array( 'wp-livecode-monaco-loader' ),
		WP_LIVECODE_VERSION,
		true
	);

	wp_localize_script(
		'wp-livecode-admin',
		'wpLivecodeConfig',
		array(
			'postId'        => $post_id,
			'initialHtml'   => $initial_html,
			'initialCss'    => $initial_css,
			'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
			'nonce'         => wp_create_nonce( 'wp-livecode-save' ),
			'monacoPath'    => WP_LIVECODE_URL . 'assets/monaco/vs',
			'previewOrigin' => home_url(),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_enqueue_editor_assets' );

/**
 * Render the LiveCode editor page.
 */
function wp_livecode_render_editor_page() {
	$post_id     = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$preview_url = add_query_arg(
		array(
			'lc_preview' => '1',
			'post_id'    => $post_id,
		),
		home_url( '/' )
	);
	?>
	<div class="wrap wp-livecode-editor">
		<div class="wp-livecode-toolbar">
			<button class="button" id="wp-livecode-undo" type="button">Undo</button>
			<button class="button" id="wp-livecode-redo" type="button">Redo</button>
			<button class="button button-primary" id="wp-livecode-save" type="button">保存</button>
			<span class="wp-livecode-status" id="wp-livecode-status">準備完了</span>
		</div>
		<div class="wp-livecode-layout">
			<div class="wp-livecode-panel">
				<div class="wp-livecode-tabs">
					<button class="wp-livecode-tab is-active" type="button" data-tab="html">HTML</button>
					<button class="wp-livecode-tab" type="button" data-tab="css">CSS</button>
				</div>
				<div class="wp-livecode-editor-pane" id="wp-livecode-html">
					<div class="monaco-container"></div>
				</div>
				<div class="wp-livecode-editor-pane" id="wp-livecode-css" style="display:none;">
					<div class="monaco-container"></div>
				</div>
			</div>
			<div class="wp-livecode-preview">
				<iframe id="wp-livecode-preview" src="<?php echo esc_url( $preview_url ); ?>" title="Live Preview"></iframe>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Save LiveCode editor content.
 */
function wp_livecode_save_editor() {
	check_ajax_referer( 'wp-livecode-save', 'nonce' );

	$post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
	if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
		wp_send_json_error( '権限がありません。' );
	}

	$html = isset( $_POST['html'] ) ? wp_kses_post( wp_unslash( $_POST['html'] ) ) : '';
	$css  = isset( $_POST['css'] ) ? wp_unslash( $_POST['css'] ) : '';

	wp_update_post(
		array(
			'ID'           => $post_id,
			'post_content' => $html,
		)
	);

	update_post_meta( $post_id, '_lc_css', $css );

	wp_send_json_success();
}
add_action( 'wp_ajax_wp_livecode_save', 'wp_livecode_save_editor' );

/**
 * Add LiveCode button in Gutenberg header.
 */
function wp_livecode_enqueue_gutenberg_button() {
	wp_register_script(
		'ai-editor-gutenberg-button',
		WP_LIVECODE_URL . 'assets/js/gutenberg-link.js',
		array( 'wp-data', 'wp-edit-post' ),
		WP_LIVECODE_VERSION,
		true
	);

	wp_enqueue_script( 'ai-editor-gutenberg-button' );

	wp_localize_script(
		'ai-editor-gutenberg-button',
		'wpLivecodeGutenberg',
		array(
			'editorUrl' => admin_url( 'admin.php?page=' . WP_LIVECODE_EDITOR_SLUG ),
		)
	);

	wp_add_inline_script(
		'ai-editor-gutenberg-button',
		<<<JS
window.addEventListener('load', function() {
  var toolbar = document.querySelector('.edit-post-header-toolbar');
  if (!toolbar || !window.wp || !window.wp.data) {
    return;
  }
  var postId = window.wp.data.select('core/editor').getCurrentPostId();
  if (!postId) {
    return;
  }
  var link = document.createElement('a');
  link.href = wpLivecodeGutenberg.editorUrl + '&post_id=' + postId;
  link.target = '_blank';
  link.className = 'components-button is-secondary';
  link.textContent = 'WP LiveCodeで編集';
  toolbar.appendChild(link);
});
JS
	);
}
add_action( 'enqueue_block_editor_assets', 'wp_livecode_enqueue_gutenberg_button' );

/**
 * Inject preview container and script on front-end preview.
 */
function wp_livecode_enqueue_preview_assets() {
	if ( empty( $_GET['lc_preview'] ) ) {
		return;
	}

	wp_enqueue_script(
		'wp-livecode-preview',
		WP_LIVECODE_URL . 'assets/js/preview.js',
		array(),
		WP_LIVECODE_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'wp_livecode_enqueue_preview_assets' );

/**
 * Output the preview root element.
 */
function wp_livecode_output_preview_root() {
	if ( empty( $_GET['lc_preview'] ) ) {
		return;
	}
	echo '<div id="lc-root"></div>';
}
add_action( 'wp_footer', 'wp_livecode_output_preview_root' );
