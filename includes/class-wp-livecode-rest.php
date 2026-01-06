<?php
namespace WPLiveCode;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest {
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function register_routes(): void {
		register_rest_route( 'wp-livecode/v1', '/save', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
		] );

		register_rest_route( 'wp-livecode/v1', '/render-shortcodes', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'render_shortcodes' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
			'args'                => [
				'postId'     => [
					'type'     => 'integer',
					'required' => true,
				],
				'shortcodes' => [
					'type'     => 'array',
					'required' => true,
				],
			],
		] );

		register_rest_route( 'wp-livecode/v1', '/compile-tailwind', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'compile_tailwind' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
			'args'                => [
				'postId' => [
					'type'     => 'integer',
					'required' => true,
				],
				'html'   => [
					'type'     => 'string',
					'required' => true,
				],
			],
		] );
	}

	public static function permission_check( \WP_REST_Request $request ): bool {
		$post_id = absint( $request->get_param( 'postId' ) );
		if ( $post_id <= 0 ) {
			return false;
		}
		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return false;
		}
		return current_user_can( 'edit_post', $post_id );
	}

	public static function save( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$html    = (string) $request->get_param( 'html' );
		$css     = (string) $request->get_param( 'css' );
		$tailwind_enabled = rest_sanitize_boolean( $request->get_param( 'tailwind' ) );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		$result = wp_update_post( [
			'ID'           => $post_id,
			'post_content' => $html,
		], true );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => $result->get_error_message(),
			], 400 );
		}

		if ( $tailwind_enabled ) {
			try {
				$css = tw::generate( [
					'content' => $html,
					'css'     => '@import "tailwindcss";',
				] );
			} catch ( \Throwable $e ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Tailwind compile failed: ' . $e->getMessage(),
				], 500 );
			}
		}

		update_post_meta( $post_id, '_lc_css', $css );
		update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );

		return new \WP_REST_Response( [ 'ok' => true ], 200 );
	}

	public static function compile_tailwind( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$html    = (string) $request->get_param( 'html' );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		try {
			$css = tw::generate( [
				'content' => $html,
				'css'     => '@import "tailwindcss";',
			] );
		} catch ( \Throwable $e ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Tailwind compile failed: ' . $e->getMessage(),
			], 500 );
		}

		return new \WP_REST_Response( [
			'ok'  => true,
			'css' => $css,
		], 200 );
	}

	/**
	 * Render shortcode blocks on the server and return rendered HTML mapped to an id.
	 */
	public static function render_shortcodes( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$items   = $request->get_param( 'shortcodes' );

		if ( ! $post_id || ! Post_Type::is_livecode_post( $post_id ) || ! $items || ! is_array( $items ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid parameters.',
			], 400 );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Post not found.',
			], 404 );
		}

		$results   = [];
		$cache_map = [];

		$previous_post = $GLOBALS['post'] ?? null;
		setup_postdata( $post );

		foreach ( $items as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$id        = isset( $entry['id'] ) ? sanitize_key( (string) $entry['id'] ) : '';
			$shortcode = isset( $entry['shortcode'] ) ? (string) $entry['shortcode'] : '';

			if ( $id === '' ) {
				continue;
			}

			if ( $shortcode === '' ) {
				$results[ $id ] = '';
				continue;
			}

			$cache_key = md5( $shortcode );
			if ( isset( $cache_map[ $cache_key ] ) ) {
				$results[ $id ] = $cache_map[ $cache_key ];
				continue;
			}

			$rendered = do_shortcode( $shortcode );

			$results[ $id ]          = $rendered;
			$cache_map[ $cache_key ] = $rendered;
		}

		if ( $previous_post instanceof \WP_Post ) {
			$GLOBALS['post'] = $previous_post;
			setup_postdata( $previous_post );
		} else {
			wp_reset_postdata();
		}

		return new \WP_REST_Response( [
			'ok'      => true,
			'results' => $results,
		], 200 );
	}
}
