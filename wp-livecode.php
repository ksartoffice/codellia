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


wp_enqueue_script('wp-livecode-admin', plugins_url('assets/dist/main.js', __FILE__), [], null, true);
wp_enqueue_style('wp-livecode-admin', plugins_url('assets/dist/style.css', __FILE__));