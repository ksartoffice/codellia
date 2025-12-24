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
 * Register admin menu.
 */
function wp_livecode_register_admin_menu() {
	add_menu_page(
		__( 'WP LiveCode', 'wp-livecode' ),
		__( 'WP LiveCode', 'wp-livecode' ),
		'edit_posts',
		'wp-livecode',
		'wp_livecode_render_editor_screen',
		'dashicons-edit',
		58
	);
}
add_action( 'admin_menu', 'wp_livecode_register_admin_menu' );

/**
 * Enqueue admin assets for editor screen.
 *
 * @param string $hook_suffix Current admin page hook.
 */
function wp_livecode_enqueue_admin_assets( $hook_suffix ) {
	if ( 'toplevel_page_wp-livecode' !== $hook_suffix ) {
		return;
	}

	wp_enqueue_style(
		'wp-livecode-admin',
		WP_LIVECODE_URL . 'assets/admin.css',
		array(),
		WP_LIVECODE_VERSION
	);

	wp_enqueue_script(
		'wp-livecode-admin',
		WP_LIVECODE_URL . 'assets/admin.js',
		array(),
		WP_LIVECODE_VERSION,
		true
	);
}
add_action( 'admin_enqueue_scripts', 'wp_livecode_enqueue_admin_assets' );

/**
 * Render the editor screen.
 */
function wp_livecode_render_editor_screen() {
	?>
	<div class="wrap wp-livecode">
		<h1 class="wp-livecode__title"><?php esc_html_e( 'WP LiveCode', 'wp-livecode' ); ?></h1>
		<div class="wp-livecode__workspace">
			<div class="wp-livecode__editor">
				<div class="wp-livecode__toolbar">
					<button type="button" class="button" aria-label="<?php esc_attr_e( 'Undo', 'wp-livecode' ); ?>">
						<?php esc_html_e( 'Undo', 'wp-livecode' ); ?>
					</button>
					<button type="button" class="button" aria-label="<?php esc_attr_e( 'Redo', 'wp-livecode' ); ?>">
						<?php esc_html_e( 'Redo', 'wp-livecode' ); ?>
					</button>
					<button type="button" class="button button-primary" aria-label="<?php esc_attr_e( 'Save', 'wp-livecode' ); ?>">
						<?php esc_html_e( 'Save', 'wp-livecode' ); ?>
					</button>
				</div>
				<div class="wp-livecode__tabs" role="tablist" aria-label="<?php esc_attr_e( 'Editor tabs', 'wp-livecode' ); ?>">
					<button type="button" class="wp-livecode__tab is-active" role="tab" aria-selected="true">
						<?php esc_html_e( 'HTML', 'wp-livecode' ); ?>
					</button>
					<button type="button" class="wp-livecode__tab" role="tab" aria-selected="false">
						<?php esc_html_e( 'CSS', 'wp-livecode' ); ?>
					</button>
				</div>
				<div class="wp-livecode__monaco" aria-label="<?php esc_attr_e( 'Monaco editor area', 'wp-livecode' ); ?>">
					<div class="wp-livecode__monaco-placeholder">
						<?php esc_html_e( 'Monaco Editor placeholder', 'wp-livecode' ); ?>
					</div>
				</div>
			</div>
			<div class="wp-livecode__preview">
				<div class="wp-livecode__preview-header">
					<?php esc_html_e( 'プレビュー', 'wp-livecode' ); ?>
				</div>
				<iframe
					class="wp-livecode__preview-frame"
					title="<?php esc_attr_e( 'Live preview', 'wp-livecode' ); ?>"
					src="<?php echo esc_url( home_url( '/?lc_preview=1&post_id=1&token=demo' ) ); ?>"
				></iframe>
			</div>
		</div>
	</div>
	<?php
}

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
