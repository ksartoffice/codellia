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
 * Register the LiveCode editor page.
 */
function wp_livecode_register_editor_page() {
	add_submenu_page(
		null,
		'WP LiveCode Editor',
		'WP LiveCode Editor',
		'edit_posts',
		'wp-livecode-editor',
		'wp_livecode_render_editor_page'
	);
}
add_action( 'admin_menu', 'wp_livecode_register_editor_page' );

/**
 * Render the LiveCode editor page.
 */
function wp_livecode_render_editor_page() {
	$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$preview_url = add_query_arg(
		array(
			'lc_preview' => 1,
			'post_id'    => $post_id,
		),
		home_url( '/' )
	);
	?>
	<div class="wrap wp-livecode-editor">
		<div class="wp-livecode-toolbar">
			<div class="wp-livecode-toolbar__left">
				<strong>WP LiveCode</strong>
			</div>
			<div class="wp-livecode-toolbar__actions">
				<button type="button" class="button" data-action="undo">Undo</button>
				<button type="button" class="button" data-action="redo">Redo</button>
				<button type="button" class="button button-primary" data-action="save">保存</button>
			</div>
		</div>
		<div class="wp-livecode-editor__body" data-preview-url="<?php echo esc_url( $preview_url ); ?>">
			<div class="wp-livecode-editor__left">
				<div class="wp-livecode-tabs">
					<button type="button" class="wp-livecode-tab is-active" data-tab="html">HTML</button>
					<button type="button" class="wp-livecode-tab" data-tab="css">CSS</button>
				</div>
				<div class="wp-livecode-editors">
					<div class="wp-livecode-editor__panel is-active" data-panel="html">
						<div class="wp-livecode-monaco" aria-label="HTML editor"></div>
					</div>
					<div class="wp-livecode-editor__panel" data-panel="css">
						<div class="wp-livecode-monaco" aria-label="CSS editor"></div>
					</div>
				</div>
			</div>
			<div class="wp-livecode-editor__right">
				<iframe class="wp-livecode-preview" title="LiveCode Preview"></iframe>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Enqueue assets for the editor screen.
 */
function wp_livecode_enqueue_editor_assets( $hook ) {
	if ( 'admin_page_wp-livecode-editor' !== $hook ) {
		return;
	}

	wp_enqueue_style(
		'wp-livecode-editor',
		WP_LIVECODE_URL . 'assets/editor.css',
		array(),
		WP_LIVECODE_VERSION
	);

	wp_enqueue_script(
		'wp-livecode-editor',
		WP_LIVECODE_URL . 'assets/editor.js',
		array(),
		WP_LIVECODE_VERSION,
		true
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_enqueue_editor_assets' );

/**
 * Add Gutenberg header link to open LiveCode editor.
 */
function wp_livecode_enqueue_gutenberg_link( $hook ) {
	if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
		return;
	}

	$screen = get_current_screen();
	if ( ! $screen || ! $screen->is_block_editor ) {
		return;
	}

	wp_register_script(
		'ai-editor-gutenberg-button',
		WP_LIVECODE_URL . 'assets/gutenberg-button.js',
		array(),
		WP_LIVECODE_VERSION,
		true
	);
	wp_enqueue_script( 'ai-editor-gutenberg-button' );

	$post_id = 0;
	if ( isset( $_GET['post'] ) ) {
		$post_id = absint( $_GET['post'] );
	}

	$editor_url = add_query_arg(
		array(
			'page'    => 'wp-livecode-editor',
			'post_id' => $post_id,
		),
		admin_url( 'admin.php' )
	);

	wp_add_inline_script(
		'ai-editor-gutenberg-button',
		'window.addEventListener(\'load\', function() {' .
		'var linkUrl = ' . wp_json_encode( $editor_url ) . ';' .
		'var header = document.querySelector(\'.edit-post-header-toolbar\');' .
		'if (!header) { return; }' .
		'var link = document.createElement(\'a\');' .
		'link.className = \'components-button is-secondary\';' .
		'link.textContent = \'LiveCodeで編集\';' .
		'link.href = linkUrl;' .
		'link.style.marginLeft = \'8px\';' .
		'header.appendChild(link);' .
		'});'
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_enqueue_gutenberg_link' );

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
