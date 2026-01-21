<?php
/**
 * REST handlers for saving LiveCode content.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for save and compile.
 */
class Rest_Save {
	/**
	 * Save LiveCode post content and metadata.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function save( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id          = absint( $request->get_param( 'post_id' ) );
		$html             = (string) $request->get_param( 'html' );
		$css_input        = (string) $request->get_param( 'css' );
		$js_input         = (string) $request->get_param( 'js' );
		$has_js           = $request->has_param( 'js' );
		$has_js_enabled   = $request->has_param( 'jsEnabled' );
		$js_enabled       = rest_sanitize_boolean( $request->get_param( 'jsEnabled' ) );
		$tailwind_enabled = rest_sanitize_boolean( $request->get_param( 'tailwindEnabled' ) );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'wp-livecode' ),
				),
				400
			);
		}

		if ( ( $has_js || $has_js_enabled ) && ! current_user_can( 'unfiltered_html' ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Permission denied.', 'wp-livecode' ),
				),
				403
			);
		}

		$tailwind_meta   = get_post_meta( $post_id, '_lc_tailwind', true );
		$tailwind_locked = '1' === get_post_meta( $post_id, '_lc_tailwind_locked', true );
		$has_tailwind    = '' !== $tailwind_meta;

		if ( $tailwind_locked || $has_tailwind ) {
			$tailwind_enabled = '1' === $tailwind_meta;
		}

		$result = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $html,
			),
			true
		);

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => $result->get_error_message(),
				),
				400
			);
		}

		$compiled_css = '';
		if ( $tailwind_enabled ) {
			try {
				$compiled_css = tw::generate(
					array(
						'content' => $html,
						'css'     => $css_input,
					)
				);
			} catch ( \Throwable $e ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => sprintf(
							/* translators: %s: error message. */
							__( 'Tailwind compile failed: %s', 'wp-livecode' ),
							$e->getMessage()
						),
					),
					500
				);
			}
		}

		update_post_meta( $post_id, '_lc_css', $css_input );
		if ( $has_js ) {
			update_post_meta( $post_id, '_lc_js', $js_input );
		}
		if ( $has_js_enabled ) {
			update_post_meta( $post_id, '_lc_js_enabled', $js_enabled ? '1' : '0' );
		}
		if ( $tailwind_enabled ) {
			update_post_meta( $post_id, '_lc_generated_css', $compiled_css );
		} else {
			delete_post_meta( $post_id, '_lc_generated_css' );
		}
		update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_lc_tailwind_locked', '1' );

		return new \WP_REST_Response( array( 'ok' => true ), 200 );
	}

	/**
	 * Compile Tailwind CSS for preview.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function compile_tailwind( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id   = absint( $request->get_param( 'post_id' ) );
		$html      = (string) $request->get_param( 'html' );
		$css_input = (string) $request->get_param( 'css' );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'wp-livecode' ),
				),
				400
			);
		}

		try {
			$css = tw::generate(
				array(
					'content' => $html,
					'css'     => $css_input,
				)
			);
		} catch ( \Throwable $e ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => sprintf(
						/* translators: %s: error message. */
						__( 'Tailwind compile failed: %s', 'wp-livecode' ),
						$e->getMessage()
					),
				),
				500
			);
		}

		return new \WP_REST_Response(
			array(
				'ok'  => true,
				'css' => $css,
			),
			200
		);
	}
}
