<?php
/**
 * REST handler for setup wizard.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for Codellia setup.
 */
class Rest_Setup {
	/**
	 * Set up Codellia mode (Normal or Tailwind).
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function setup_mode( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'post_id' ) );
		$mode    = sanitize_key( (string) $request->get_param( 'mode' ) );

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'codellia' ),
				),
				400
			);
		}

		if ( 'tailwind' !== $mode && 'normal' !== $mode ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid setup mode.', 'codellia' ),
				),
				400
			);
		}

		$tailwind_meta    = get_post_meta( $post_id, '_codellia_tailwind', true );
		$tailwind_locked  = '1' === get_post_meta( $post_id, '_codellia_tailwind_locked', true );
		$tailwind_enabled = '1' === $tailwind_meta;

		if ( ! $tailwind_locked ) {
			$tailwind_enabled = 'tailwind' === $mode;
			update_post_meta( $post_id, '_codellia_tailwind', $tailwind_enabled ? '1' : '0' );
			update_post_meta( $post_id, '_codellia_tailwind_locked', '1' );
			delete_post_meta( $post_id, '_codellia_setup_required' );
		} else {
			delete_post_meta( $post_id, '_codellia_setup_required' );
		}

		return new \WP_REST_Response(
			array(
				'ok'              => true,
				'tailwindEnabled' => $tailwind_enabled,
			),
			200
		);
	}
}
