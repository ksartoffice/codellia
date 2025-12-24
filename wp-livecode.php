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
 * Register admin menu for WP LiveCode editor.
 */
function wp_livecode_register_admin_menu() {
	add_menu_page(
		__( 'WP LiveCode', 'wp-livecode' ),
		__( 'WP LiveCode', 'wp-livecode' ),
		'edit_posts',
		'wp-livecode-editor',
		'wp_livecode_render_admin_page',
		'dashicons-edit',
		58
	);
}
add_action( 'admin_menu', 'wp_livecode_register_admin_menu' );

/**
 * Enqueue admin assets for editor screen.
 *
 * @param string $hook Current admin page hook.
 */
function wp_livecode_admin_enqueue_assets( $hook ) {
	if ( 'toplevel_page_wp-livecode-editor' !== $hook ) {
		return;
	}

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

	$post_id     = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$preview_url = add_query_arg(
		array(
			'lc_preview' => 1,
			'post_id'    => $post_id,
			'token'      => wp_create_nonce( 'wp_livecode_preview' ),
		),
		home_url( '/' )
	);

	wp_localize_script(
		'wp-livecode-admin',
		'WP_LIVECODE',
		array(
			'monacoBaseUrl' => WP_LIVECODE_URL . 'assets/monaco/vs',
			'previewUrl'    => esc_url_raw( $preview_url ),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_admin_enqueue_assets' );

/**
 * Render the LiveCode admin editor page.
 */
function wp_livecode_render_admin_page() {
	$post_id     = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0;
	$preview_url = add_query_arg(
		array(
			'lc_preview' => 1,
			'post_id'    => $post_id,
			'token'      => wp_create_nonce( 'wp_livecode_preview' ),
		),
		home_url( '/' )
	);
	?>
	<div class="wrap wp-livecode-admin">
		<h1 class="wp-livecode-title"><?php esc_html_e( 'WP LiveCode', 'wp-livecode' ); ?></h1>
		<div class="wp-livecode-toolbar" role="toolbar" aria-label="<?php esc_attr_e( 'LiveCode toolbar', 'wp-livecode' ); ?>">
			<button type="button" class="button wp-livecode-button" id="wp-livecode-undo">
				<?php esc_html_e( 'Undo', 'wp-livecode' ); ?>
			</button>
			<button type="button" class="button wp-livecode-button" id="wp-livecode-redo">
				<?php esc_html_e( 'Redo', 'wp-livecode' ); ?>
			</button>
			<button type="button" class="button button-primary wp-livecode-button" id="wp-livecode-save">
				<?php esc_html_e( '保存', 'wp-livecode' ); ?>
			</button>
		</div>
		<div class="wp-livecode-layout">
			<section class="wp-livecode-editor" aria-label="<?php esc_attr_e( 'Editor', 'wp-livecode' ); ?>">
				<div class="wp-livecode-tabs" role="tablist">
					<button type="button" class="wp-livecode-tab is-active" data-tab="html" role="tab" aria-selected="true">
						HTML
					</button>
					<button type="button" class="wp-livecode-tab" data-tab="css" role="tab" aria-selected="false">
						CSS
					</button>
				</div>
				<div class="wp-livecode-editor-panels">
					<div id="wp-livecode-editor-html" class="wp-livecode-editor-panel is-active" data-tab-panel="html"></div>
					<div id="wp-livecode-editor-css" class="wp-livecode-editor-panel" data-tab-panel="css"></div>
				</div>
			</section>
			<section class="wp-livecode-preview" aria-label="<?php esc_attr_e( 'Preview', 'wp-livecode' ); ?>">
				<iframe
					class="wp-livecode-preview-frame"
					src="<?php echo esc_url( $preview_url ); ?>"
					title="<?php esc_attr_e( 'Live preview', 'wp-livecode' ); ?>"
					loading="lazy"
				></iframe>
			</section>
		</div>
	</div>
	<?php
}
