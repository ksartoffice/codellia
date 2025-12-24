<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest {
	public static function init(): void {
		add_action('rest_api_init', [__CLASS__, 'register_routes']);
	}

	public static function register_routes(): void {
		register_rest_route('wp-livecode/v1', '/save', [
			'methods'             => 'POST',
			'callback'            => [__CLASS__, 'save'],
			'permission_callback' => [__CLASS__, 'permission_check'],
		]);
	}

	public static function permission_check(\WP_REST_Request $request): bool {
		$post_id = absint($request->get_param('postId'));
		return $post_id > 0 && current_user_can('edit_post', $post_id);
	}

	public static function save(\WP_REST_Request $request): \WP_REST_Response {
		$post_id = absint($request->get_param('postId'));
		$html    = (string) $request->get_param('html');
		$css     = (string) $request->get_param('css');

		// post_content 更新
		$result = wp_update_post([
			'ID'           => $post_id,
			'post_content' => $html,
		], true);

		if ( is_wp_error($result) ) {
			return new \WP_REST_Response([
				'ok'    => false,
				'error' => $result->get_error_message(),
			], 400);
		}

		// CSS は post_meta（推奨）
		update_post_meta($post_id, '_lc_css', $css);

		return new \WP_REST_Response(['ok' => true], 200);
	}
}
