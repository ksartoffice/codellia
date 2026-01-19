<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest {
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function register_routes(): void {
		register_rest_route( 'wp-livecode/v1', '/save', [
			'methods'             => 'POST',
			'callback'            => [ Rest_Save::class, 'save' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
		] );

		register_rest_route( 'wp-livecode/v1', '/render-shortcodes', [
			'methods'             => 'POST',
			'callback'            => [ Rest_Preview::class, 'render_shortcodes' ],
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
			'callback'            => [ Rest_Save::class, 'compile_tailwind' ],
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
				'css'    => [
					'type'     => 'string',
					'required' => false,
				],
			],
		] );

		register_rest_route( 'wp-livecode/v1', '/setup', [
			'methods'             => 'POST',
			'callback'            => [ Rest_Setup::class, 'setup_mode' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
			'args'                => [
				'postId' => [
					'type'     => 'integer',
					'required' => true,
				],
				'mode'   => [
					'type'     => 'string',
					'required' => true,
				],
			],
		] );

		register_rest_route( 'wp-livecode/v1', '/import', [
			'methods'             => 'POST',
			'callback'            => [ Rest_Import::class, 'import_payload' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
			'args'                => [
				'postId'  => [
					'type'     => 'integer',
					'required' => true,
				],
				'payload' => [
					'type'     => 'object',
					'required' => true,
				],
			],
		] );

		register_rest_route( 'wp-livecode/v1', '/settings', [
			'methods'             => 'POST',
			'callback'            => [ Rest_Settings::class, 'update_settings' ],
			'permission_callback' => [ __CLASS__, 'permission_check' ],
			'args'                => [
				'postId' => [
					'type'     => 'integer',
					'required' => true,
				],
				'updates' => [
					'type'     => 'object',
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

	public static function build_settings_payload( int $post_id ): array {
		return Rest_Settings::build_settings_payload( $post_id );
	}
}
