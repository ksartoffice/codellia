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

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'WP_LIVECODE_VERSION', '1.0.0' );
define( 'WP_LIVECODE_PATH', plugin_dir_path( __FILE__ ) );
define( 'WP_LIVECODE_URL', plugin_dir_url( __FILE__ ) );

$autoload = WP_LIVECODE_PATH . 'vendor/autoload.php';
if ( file_exists( $autoload ) ) {
	require_once $autoload;
}

require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-post-type.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-admin.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-external-scripts.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-rest.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-preview.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-frontend.php';

add_action( 'plugins_loaded', function () {
	// Custom post type used exclusively by WP LiveCode.
	\WPLiveCode\Post_Type::init();

	// Admin UI.
	\WPLiveCode\Admin::init();

	// REST endpoints.
	\WPLiveCode\Rest::init();

	// Preview mode for iframe.
	\WPLiveCode\Preview::init();

	// Frontend rendering (public view).
	\WPLiveCode\Frontend::init();
} );

/**
 * Load plugin textdomain.
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
 * Plugin activation hook.
 */
function wp_livecode_activate() {
	\WPLiveCode\Post_Type::activation();
}
register_activation_hook( __FILE__, 'wp_livecode_activate' );

/**
 * Plugin deactivation hook.
 */
function wp_livecode_deactivate() {
	\WPLiveCode\Post_Type::deactivation();
}
register_deactivation_hook( __FILE__, 'wp_livecode_deactivate' );
