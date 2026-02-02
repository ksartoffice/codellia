<?php
/**
 * Plugin Name: CodeNagi
 * Plugin URI: https://wordpress.org/plugins/codenagi/
 * Description: CodeNagi – Live HTML/CSS/JS Editor with Tailwind CSS.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Tested up to: 6.9
 * Requires PHP: 8.2
 * Author: CodeNagi
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: codenagi
 * Domain Path: /languages
 *
 * @package CodeNagi
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'CODENAGI_VERSION', '1.0.0' );
define( 'CODENAGI_PATH', plugin_dir_path( __FILE__ ) );
define( 'CODENAGI_URL', plugin_dir_url( __FILE__ ) );

$codenagi_autoload = CODENAGI_PATH . 'vendor/autoload.php';
if ( file_exists( $codenagi_autoload ) ) {
	require_once $codenagi_autoload;
}

require_once CODENAGI_PATH . 'includes/class-codenagi-post-type.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-admin.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-editor-bridge.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-external-scripts.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-external-styles.php';
require_once CODENAGI_PATH . 'includes/rest/class-codenagi-rest-save.php';
require_once CODENAGI_PATH . 'includes/rest/class-codenagi-rest-setup.php';
require_once CODENAGI_PATH . 'includes/rest/class-codenagi-rest-import.php';
require_once CODENAGI_PATH . 'includes/rest/class-codenagi-rest-settings.php';
require_once CODENAGI_PATH . 'includes/rest/class-codenagi-rest-preview.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-rest.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-preview.php';
require_once CODENAGI_PATH . 'includes/class-codenagi-frontend.php';

add_action(
	'plugins_loaded',
	function () {
		// Custom post type used exclusively by CodeNagi.
		\CodeNagi\Post_Type::init();

		// Admin UI.
		\CodeNagi\Admin::init();
		\CodeNagi\Editor_Bridge::init();

		// REST endpoints.
		\CodeNagi\Rest::init();

		// Preview mode for iframe.
		\CodeNagi\Preview::init();

		// Frontend rendering (public view).
		\CodeNagi\Frontend::init();
	}
);

/**
 * Plugin activation hook.
 */
function codenagi_activate() {
	\CodeNagi\Post_Type::activation();
}
register_activation_hook( __FILE__, 'codenagi_activate' );

/**
 * Plugin deactivation hook.
 */
function codenagi_deactivate() {
	\CodeNagi\Post_Type::deactivation();
}
register_deactivation_hook( __FILE__, 'codenagi_deactivate' );


