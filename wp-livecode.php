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


require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-admin.php';
require_once WP_LIVECODE_PATH . 'includes/class-wp-livecode-rest.php';

add_action('plugins_loaded', function () {
	// 管理画面
	\WPLiveCode\Admin::init();

	// REST
	\WPLiveCode\Rest::init();
});

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


// filepath: wp-livecode.php （既存に追記/置換）
add_action('admin_menu', function () {
  add_submenu_page(
    'tools.php',
    'WP LiveCode',
    'WP LiveCode',
    'edit_posts',
    'wp-livecode',
    function () {
      $post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;
      echo '<div class="wrap"><h1>WP LiveCode</h1><div id="wp-livecode-app" data-post-id="'.esc_attr($post_id).'"></div></div>';
    }
  );
});

add_action('admin_enqueue_scripts', function ($hook) {
  if ($hook !== 'tools_page_wp-livecode') return;

  // ① Monaco AMD loader（これが無いと window.require が作られない）
  wp_register_script(
    'wp-livecode-monaco-loader',
    plugins_url('assets/monaco/vs/loader.js', __FILE__),
    [],
    filemtime(WP_LIVECODE_PATH . 'assets/monaco/vs/loader.js'),
    true
  );

  // ② 管理画面メイン（loaderの後に読みたいので dependency に入れる）
  wp_register_script(
    'wp-livecode-admin',
    plugins_url('assets/dist/main.js', __FILE__),
    ['wp-livecode-monaco-loader', 'wp-api-fetch'],
    filemtime(WP_LIVECODE_PATH . 'assets/dist/main.js'),
    true
  );

  wp_register_style(
    'wp-livecode-admin',
    plugins_url('assets/dist/style.css', __FILE__),
    [],
    filemtime(WP_LIVECODE_PATH . 'assets/dist/style.css')
  );

  wp_enqueue_script('wp-livecode-admin');
  wp_enqueue_style('wp-livecode-admin');

  // 初期データ注入（最低限）
  $post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;
  $post = $post_id ? get_post($post_id) : null;
  $html = $post ? (string)$post->post_content : '';
  $css  = $post_id ? (string)get_post_meta($post_id, '_lc_css', true) : '';

  $preview_token = $post_id ? wp_create_nonce('lc_preview_' . $post_id) : '';
  $preview_url   = $post_id
    ? add_query_arg(['lc_preview'=>1,'post_id'=>$post_id,'token'=>$preview_token], get_permalink($post_id))
    : home_url('/');

  $data = [
    'postId'       => $post_id,
    'initialHtml'  => $html,
    'initialCss'   => $css,
    'previewUrl'   => $preview_url,
    'monacoVsPath' => plugins_url('assets/monaco/vs', __FILE__),
    'restUrl'      => rest_url('wp-livecode/v1/save'),
    'restNonce'    => wp_create_nonce('wp_rest'),
  ];

  wp_add_inline_script(
    'wp-livecode-admin',
    'window.WP_LIVECODE=' . wp_json_encode($data, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE) . ';',
    'before'
  );
});
