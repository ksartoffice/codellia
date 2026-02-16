<?php
/**
 * REST handlers for saving Codellia content.
 *
 * @package Codellia
 */

namespace Codellia;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for save and compile.
 */
class Rest_Save {
	/**
	 * Save Codellia post content and metadata.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function save( \WP_REST_Request $request ): \WP_REST_Response {

		$post_id          = absint( $request->get_param( 'post_id' ) );
		$html             = (string) $request->get_param( 'html' );
		$css_input        = self::sanitize_css_input( (string) $request->get_param( 'css' ) );
		$js_input         = (string) $request->get_param( 'js' );
		$has_js           = $request->has_param( 'js' );
		$tailwind_enabled = rest_sanitize_boolean( $request->get_param( 'tailwindEnabled' ) );
		$settings_updates = $request->get_param( 'settingsUpdates' );
		$has_settings     = $request->has_param( 'settingsUpdates' );
		$prepared_updates = null;

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'codellia' ),
				),
				400
			);
		}

		if ( $has_js && ! current_user_can( 'unfiltered_html' ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Permission denied.', 'codellia' ),
				),
				403
			);
		}

		if ( $has_settings ) {
			if ( ! is_array( $settings_updates ) ) {
					return new \WP_REST_Response(
						array(
							'ok'    => false,
							'error' => __( 'Invalid payload.', 'codellia' ),
						),
						400
					);
			}
			$prepared_updates = Rest_Settings::prepare_updates( $post_id, $settings_updates );
			if ( is_wp_error( $prepared_updates ) ) {
				$error_data = $prepared_updates->get_error_data();
				$status     = is_array( $error_data ) && isset( $error_data['status'] )
					? (int) $error_data['status']
					: 400;
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => $prepared_updates->get_error_message(),
					),
					$status
				);
			}
		}

		$tailwind_meta   = get_post_meta( $post_id, '_codellia_tailwind', true );
		$tailwind_locked = '1' === get_post_meta( $post_id, '_codellia_tailwind_locked', true );
		$has_tailwind    = '' !== $tailwind_meta;
		if ( $tailwind_locked || $has_tailwind ) {
			$tailwind_enabled = '1' === $tailwind_meta;
		}

		if ( $tailwind_enabled ) {
			$size_validation = self::validate_tailwind_input_size( $html, $css_input );
			if ( is_wp_error( $size_validation ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => $size_validation->get_error_message(),
					),
					400
				);
			}
		}

		$result = wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => wp_slash( $html ),
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
							__( 'Tailwind compile failed: %s', 'codellia' ),
							$e->getMessage()
						),
					),
					500
				);
			}
		}

		update_post_meta( $post_id, '_codellia_css', wp_slash( $css_input ) );
		if ( $has_js ) {
			update_post_meta( $post_id, '_codellia_js', wp_slash( $js_input ) );
		}
		delete_post_meta( $post_id, '_codellia_js_enabled' );
		if ( $tailwind_enabled ) {
			update_post_meta( $post_id, '_codellia_generated_css', wp_slash( $compiled_css ) );
		} else {
			delete_post_meta( $post_id, '_codellia_generated_css' );
		}
		update_post_meta( $post_id, '_codellia_tailwind', $tailwind_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_codellia_tailwind_locked', '1' );

		if ( $has_settings && is_array( $prepared_updates ) ) {
			$applied_updates = Rest_Settings::apply_prepared_updates( $post_id, $prepared_updates );
			if ( is_wp_error( $applied_updates ) ) {
				$error_data = $applied_updates->get_error_data();
				$status     = is_array( $error_data ) && isset( $error_data['status'] )
					? (int) $error_data['status']
					: 400;
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => $applied_updates->get_error_message(),
					),
					$status
				);
			}
		}

		return new \WP_REST_Response(
			array(
				'ok'       => true,
				'settings' => Rest_Settings::build_settings_payload( $post_id ),
			),
			200
		);
	}
	/**
	 * Sanitize CSS input to prevent style tag injection.
	 *
	 * @param string $css Raw CSS input.
	 * @return string
	 */
	private static function sanitize_css_input( string $css ): string {
		if ( '' === $css ) {
			return '';
		}
		return str_ireplace( '</style', '&lt;/style', $css );
	}

	/**
	 * Validate Tailwind compile input size.
	 *
	 * @param string $html HTML input.
	 * @param string $css  CSS input.
	 * @return true|\WP_Error
	 */
	private static function validate_tailwind_input_size( string $html, string $css ) {
		if ( strlen( $html ) > Limits::MAX_TAILWIND_HTML_BYTES ) {
			return new \WP_Error(
				'codellia_tailwind_html_too_large',
				__( 'Tailwind HTML input exceeds the maximum size.', 'codellia' ),
				array( 'status' => 400 )
			);
		}

		if ( strlen( $css ) > Limits::MAX_TAILWIND_CSS_BYTES ) {
			return new \WP_Error(
				'codellia_tailwind_css_too_large',
				__( 'Tailwind CSS input exceeds the maximum size.', 'codellia' ),
				array( 'status' => 400 )
			);
		}

		return true;
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

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'codellia' ),
				),
				400
			);
		}

		$size_validation = self::validate_tailwind_input_size( $html, $css_input );
		if ( is_wp_error( $size_validation ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => $size_validation->get_error_message(),
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
						__( 'Tailwind compile failed: %s', 'codellia' ),
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
