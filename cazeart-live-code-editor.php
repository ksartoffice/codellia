<?php
/**
 * Plugin Name: CazeArt Live Code Editor
 * Plugin URI: https://wordpress.org/plugins/cazeart-live-code-editor/
 * Description: Live HTML/CSS/JS editor with real-time preview and Tailwind CSS support for WordPress.
 * Version: 1.0.1
 * Requires at least: 6.6
 * Tested up to: 6.9
 * Requires PHP: 8.2
 * Author: CazeArt
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: cazeart-live-code-editor
 * Domain Path: /languages
 *
 * @package CazeArt
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'CAZEART_VERSION', '1.0.1' );
define( 'CAZEART_PATH', plugin_dir_path( __FILE__ ) );
define( 'CAZEART_URL', plugin_dir_url( __FILE__ ) );

$cazeart_autoload = CAZEART_PATH . 'vendor/autoload.php';
if ( file_exists( $cazeart_autoload ) ) {
	require_once $cazeart_autoload;
}

require_once CAZEART_PATH . 'includes/class-cazeart-post-type.php';
require_once CAZEART_PATH . 'includes/class-cazeart-admin.php';
require_once CAZEART_PATH . 'includes/class-cazeart-editor-bridge.php';
require_once CAZEART_PATH . 'includes/class-cazeart-limits.php';
require_once CAZEART_PATH . 'includes/class-cazeart-external-scripts.php';
require_once CAZEART_PATH . 'includes/class-cazeart-external-styles.php';
require_once CAZEART_PATH . 'includes/rest/class-cazeart-rest-save.php';
require_once CAZEART_PATH . 'includes/rest/class-cazeart-rest-setup.php';
require_once CAZEART_PATH . 'includes/rest/class-cazeart-rest-import.php';
require_once CAZEART_PATH . 'includes/rest/class-cazeart-rest-settings.php';
require_once CAZEART_PATH . 'includes/rest/class-cazeart-rest-preview.php';
require_once CAZEART_PATH . 'includes/class-cazeart-rest.php';
require_once CAZEART_PATH . 'includes/class-cazeart-preview.php';
require_once CAZEART_PATH . 'includes/class-cazeart-frontend.php';

add_action(
	'plugins_loaded',
	function () {
		// Custom post type used exclusively by CazeArt.
		\CazeArt\Post_Type::init();

		// Admin UI.
		\CazeArt\Admin::init();
		\CazeArt\Editor_Bridge::init();

		// REST endpoints.
		\CazeArt\Rest::init();

		// Preview mode for iframe.
		\CazeArt\Preview::init();

		// Frontend rendering (public view).
		\CazeArt\Frontend::init();
	}
);

/**
 * Plugin activation hook.
 */
function cazeart_activate() {
	\CazeArt\Post_Type::activation();
}
register_activation_hook( __FILE__, 'cazeart_activate' );

/**
 * Plugin deactivation hook.
 */
function cazeart_deactivate() {
	\CazeArt\Post_Type::deactivation();
}
register_deactivation_hook( __FILE__, 'cazeart_deactivate' );
