<?php
/**
 * REST API route registration for Codellia.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers REST endpoints for Codellia.
 */
class Rest {
	/**
	 * Register REST route hooks.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register REST routes for Codellia.
	 */
	public static function register_routes(): void {
		register_rest_route(
			'codellia/v1',
			'/save',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Save::class, 'save' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
			)
		);

		register_rest_route(
			'codellia/v1',
			'/render-shortcodes',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Preview::class, 'render_shortcodes' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
				'args'                => array(
					'post_id'    => array(
						'type'     => 'integer',
						'required' => true,
					),
					'shortcodes' => array(
						'type'     => 'array',
						'required' => true,
						'maxItems' => Limits::MAX_RENDER_SHORTCODES,
					),
				),
			)
		);

		register_rest_route(
			'codellia/v1',
			'/compile-tailwind',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Save::class, 'compile_tailwind' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
				'args'                => array(
					'post_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'html'    => array(
						'type'      => 'string',
						'required'  => true,
						'maxLength' => Limits::MAX_TAILWIND_HTML_BYTES,
					),
					'css'     => array(
						'type'      => 'string',
						'required'  => false,
						'maxLength' => Limits::MAX_TAILWIND_CSS_BYTES,
					),
				),
			)
		);

		register_rest_route(
			'codellia/v1',
			'/setup',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Setup::class, 'setup_mode' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
				'args'                => array(
					'post_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'mode'    => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			'codellia/v1',
			'/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Import::class, 'import_payload' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
				'args'                => array(
					'post_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'payload' => array(
						'type'     => 'object',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			'codellia/v1',
			'/settings',
			array(
				'methods'             => 'POST',
				'callback'            => array( Rest_Settings::class, 'update_settings' ),
				'permission_callback' => array( __CLASS__, 'permission_check' ),
				'args'                => array(
					'post_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'updates' => array(
						'type'     => 'object',
						'required' => true,
					),
				),
			)
		);
	}

	/**
	 * Permission check for Codellia REST routes.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return bool
	 */
	public static function permission_check( \WP_REST_Request $request ): bool {
		$post_id = absint( $request->get_param( 'post_id' ) );
		if ( 0 >= $post_id ) {
			return false;
		}
		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return false;
		}
		return current_user_can( 'edit_post', $post_id );
	}

	/**
	 * Build settings payload for the admin app.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return array
	 */
	public static function build_settings_payload( int $post_id ): array {
		return Rest_Settings::build_settings_payload( $post_id );
	}
}
