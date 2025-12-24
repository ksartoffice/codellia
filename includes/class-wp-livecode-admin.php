<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Admin {
	const MENU_SLUG = 'wp-livecode';

	public static function init(): void {
		add_action('admin_menu', [__CLASS__, 'register_menu']);
		add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
		add_action('admin_action_wp_livecode', [__CLASS__, 'action_redirect']); // admin.php?action=wp_livecode
	}

	/**
	 * 要件: admin.php?action=●● の独自編集画面を持つ
	 * → action=wp_livecode は実体として page=wp-livecode へリダイレクトして画面を出す
	 */
	public static function action_redirect(): void {
		$post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;
		if ( ! $post_id ) {
			wp_die('post_id is required.');
		}
		if ( ! current_user_can('edit_post', $post_id) ) {
			wp_die('Permission denied.');
		}
		$url = add_query_arg(
			['page' => self::MENU_SLUG, 'post_id' => $post_id],
			admin_url('admin.php')
		);
		wp_safe_redirect($url);
		exit;
	}

	public static function register_menu(): void {
		// とりあえず「ツール」配下（好みで変更OK）
		add_submenu_page(
			'tools.php',
			'WP LiveCode',
			'WP LiveCode',
			'edit_posts',
			self::MENU_SLUG,
			[__CLASS__, 'render_page']
		);
	}

	public static function render_page(): void {
		$post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;
		if ( ! $post_id ) {
			echo '<div class="wrap"><h1>WP LiveCode</h1><p>post_id is required.</p></div>';
			return;
		}
		if ( ! current_user_can('edit_post', $post_id) ) {
			wp_die('Permission denied.');
		}

		echo '<div class="wrap">';
		echo '<h1>WP LiveCode</h1>';
		echo '<div id="wp-livecode-app" data-post-id="' . esc_attr($post_id) . '"></div>';
		echo '</div>';
	}

	public static function enqueue_assets(string $hook_suffix): void {
		// 自分のページだけで読み込む
		if ( $hook_suffix !== 'tools_page_' . self::MENU_SLUG ) return;

		$post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;

		// Monaco AMD loader（assets/monaco/vs/loader.js）
		wp_register_script(
			'wp-livecode-monaco-loader',
			WP_LIVECODE_URL . 'assets/monaco/vs/loader.js',
			[],
			WP_LIVECODE_VERSION,
			true
		);

		// 管理画面メイン（Viteビルド成果物）
		wp_register_script(
			'wp-livecode-admin',
			WP_LIVECODE_URL . 'assets/dist/main.js',
			['wp-livecode-monaco-loader', 'wp-api-fetch'],
			WP_LIVECODE_VERSION,
			true
		);

		wp_register_style(
			'wp-livecode-admin',
			WP_LIVECODE_URL . 'assets/dist/style.css',
			[],
			WP_LIVECODE_VERSION
		);

		wp_enqueue_script('wp-livecode-admin');
		wp_enqueue_style('wp-livecode-admin');

		// 初期データ（MVP）
		$post = $post_id ? get_post($post_id) : null;
		$html = $post ? (string) $post->post_content : '';
		$css  = $post_id ? (string) get_post_meta($post_id, '_lc_css', true) : '';

		$preview_token = $post_id ? wp_create_nonce('lc_preview_' . $post_id) : '';
		$preview_url   = $post_id
			? add_query_arg(
				[
					'lc_preview' => 1,
					'post_id'    => $post_id,
					'token'      => $preview_token,
				],
				get_permalink($post_id)
			)
			: home_url('/');

		$data = [
			'postId'       => $post_id,
			'initialHtml'  => $html,
			'initialCss'   => $css,
			'previewUrl'   => $preview_url,
			'monacoVsPath' => WP_LIVECODE_URL . 'assets/monaco/vs',
			'restUrl'      => rest_url('wp-livecode/v1/save'),
			'restNonce'    => wp_create_nonce('wp_rest'),
		];

		wp_add_inline_script(
			'wp-livecode-admin',
			'window.WP_LIVECODE = ' . wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';',
			'before'
		);
	}
}
