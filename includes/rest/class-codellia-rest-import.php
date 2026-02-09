<?php
/**
 * REST handler for importing Codellia data.
 *
 * @package Codellia
 */

namespace Codellia;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for Codellia import.
 */
class Rest_Import {
	private const MAX_EXTERNAL_SCRIPTS = 5;
	private const MAX_EXTERNAL_STYLES  = 5;

	/**
	 * Import a Codellia JSON payload into a post.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function import_payload( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'post_id' ) );
		$payload = $request->get_param( 'payload' );

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid post type.', 'codellia' ),
				),
				400
			);
		}

		if ( ! current_user_can( 'unfiltered_html' ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Permission denied.', 'codellia' ),
				),
				403
			);
		}

		if ( ! is_array( $payload ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid import payload.', 'codellia' ),
				),
				400
			);
		}

		$version = isset( $payload['version'] ) ? (int) $payload['version'] : 0;
		if ( 1 !== $version ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Unsupported import version.', 'codellia' ),
				),
				400
			);
		}

		if ( ! array_key_exists( 'html', $payload ) || ! is_string( $payload['html'] ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid HTML value.', 'codellia' ),
				),
				400
			);
		}

		if ( ! array_key_exists( 'css', $payload ) || ! is_string( $payload['css'] ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid CSS value.', 'codellia' ),
				),
				400
			);
		}

		if ( ! array_key_exists( 'tailwindEnabled', $payload ) || ! is_bool( $payload['tailwindEnabled'] ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid tailwindEnabled value.', 'codellia' ),
				),
				400
			);
		}
		$js_input = '';
		if ( array_key_exists( 'js', $payload ) ) {
			if ( ! is_string( $payload['js'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid JavaScript value.', 'codellia' ),
					),
					400
				);
			}
			$js_input = $payload['js'];
		}

		$shadow_dom_enabled = false;
		if ( array_key_exists( 'shadowDomEnabled', $payload ) ) {
			if ( ! is_bool( $payload['shadowDomEnabled'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid shadowDomEnabled value.', 'codellia' ),
					),
					400
				);
			}
			$shadow_dom_enabled = $payload['shadowDomEnabled'];
		}

		$shortcode_enabled = false;
		if ( array_key_exists( 'shortcodeEnabled', $payload ) ) {
			if ( ! is_bool( $payload['shortcodeEnabled'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid shortcodeEnabled value.', 'codellia' ),
					),
					400
				);
			}
			$shortcode_enabled = $payload['shortcodeEnabled'];
		}

		$single_page_enabled = null;
		if ( array_key_exists( 'singlePageEnabled', $payload ) ) {
			if ( ! is_bool( $payload['singlePageEnabled'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid singlePageEnabled value.', 'codellia' ),
					),
					400
				);
			}
			$single_page_enabled = $payload['singlePageEnabled'];
		}

		$live_highlight_enabled = null;
		if ( array_key_exists( 'liveHighlightEnabled', $payload ) ) {
			if ( ! is_bool( $payload['liveHighlightEnabled'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid liveHighlightEnabled value.', 'codellia' ),
					),
					400
				);
			}
			$live_highlight_enabled = $payload['liveHighlightEnabled'];
		}

		$generated_css_input = '';
		if ( array_key_exists( 'generatedCss', $payload ) ) {
			if ( ! is_string( $payload['generatedCss'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid generatedCss value.', 'codellia' ),
					),
					400
				);
			}
			$generated_css_input = self::sanitize_css_input( $payload['generatedCss'] );
		}

		$external_scripts = array();
		if ( array_key_exists( 'externalScripts', $payload ) ) {
			if ( ! is_array( $payload['externalScripts'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid externalScripts value.', 'codellia' ),
					),
					400
				);
			}

			$error            = null;
			$external_scripts = External_Scripts::validate_list(
				array_values( $payload['externalScripts'] ),
				self::MAX_EXTERNAL_SCRIPTS,
				$error
			);
			if ( null === $external_scripts ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => null !== $error ? $error : __( 'Invalid externalScripts value.', 'codellia' ),
					),
					400
				);
			}
		}

		$external_styles = array();
		if ( array_key_exists( 'externalStyles', $payload ) ) {
			if ( ! is_array( $payload['externalStyles'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid externalStyles value.', 'codellia' ),
					),
					400
				);
			}

			$error           = null;
			$external_styles = External_Styles::validate_list(
				array_values( $payload['externalStyles'] ),
				self::MAX_EXTERNAL_STYLES,
				$error
			);
			if ( null === $external_styles ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => null !== $error ? $error : __( 'Invalid externalStyles value.', 'codellia' ),
					),
					400
				);
			}
		}

		$html             = $payload['html'];
		$css_input        = self::sanitize_css_input( $payload['css'] );
		$tailwind_enabled = $payload['tailwindEnabled'];
		$result           = wp_update_post(
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
			if ( '' !== $generated_css_input ) {
				$compiled_css = $generated_css_input;
			} else {
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
		}

		update_post_meta( $post_id, '_codellia_css', wp_slash( $css_input ) );
		update_post_meta( $post_id, '_codellia_js', wp_slash( $js_input ) );
		delete_post_meta( $post_id, '_codellia_js_enabled' );
		update_post_meta( $post_id, '_codellia_shadow_dom', $shadow_dom_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_codellia_shortcode_enabled', $shortcode_enabled ? '1' : '0' );
		if ( null !== $single_page_enabled ) {
			update_post_meta( $post_id, '_codellia_single_page_enabled', $single_page_enabled ? '1' : '0' );
		}
		if ( null !== $live_highlight_enabled ) {
			update_post_meta( $post_id, '_codellia_live_highlight', $live_highlight_enabled ? '1' : '0' );
		}
		update_post_meta( $post_id, '_codellia_tailwind', $tailwind_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_codellia_tailwind_locked', '1' );
		delete_post_meta( $post_id, '_codellia_setup_required' );

		if ( $tailwind_enabled ) {
			update_post_meta( $post_id, '_codellia_generated_css', wp_slash( $compiled_css ) );
		} else {
			delete_post_meta( $post_id, '_codellia_generated_css' );
		}

		if ( empty( $external_scripts ) ) {
			delete_post_meta( $post_id, '_codellia_external_scripts' );
		} else {
			update_post_meta(
				$post_id,
				'_codellia_external_scripts',
				wp_json_encode( $external_scripts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
			);
		}

		if ( empty( $external_styles ) ) {
			delete_post_meta( $post_id, '_codellia_external_styles' );
		} else {
			update_post_meta(
				$post_id,
				'_codellia_external_styles',
				wp_json_encode( $external_styles, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
			);
		}

		$response = array(
			'ok'              => true,
			'html'            => $html,
			'tailwindEnabled' => $tailwind_enabled,
			'settingsData'    => Rest_Settings::build_settings_payload( $post_id ),
		);

		return new \WP_REST_Response( $response, 200 );
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
}
