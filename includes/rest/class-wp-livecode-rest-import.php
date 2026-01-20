<?php
namespace WPLiveCode;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest_Import {
	private const MAX_EXTERNAL_SCRIPTS = 5;
	private const MAX_EXTERNAL_STYLES = 5;

	public static function import_payload( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$payload = $request->get_param( 'payload' );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		if ( ! current_user_can( 'unfiltered_html' ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Permission denied.',
			], 403 );
		}

		if ( ! is_array( $payload ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid import payload.',
			], 400 );
		}

		$version = isset( $payload['version'] ) ? (int) $payload['version'] : 0;
		if ( $version !== 1 ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Unsupported import version.',
			], 400 );
		}

		if ( ! array_key_exists( 'html', $payload ) || ! is_string( $payload['html'] ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid HTML value.',
			], 400 );
		}

		if ( ! array_key_exists( 'css', $payload ) || ! is_string( $payload['css'] ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid CSS value.',
			], 400 );
		}

		if ( ! array_key_exists( 'tailwind', $payload ) || ! is_bool( $payload['tailwind'] ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid tailwind flag.',
			], 400 );
		}

		$js_input = '';
		if ( array_key_exists( 'js', $payload ) ) {
			if ( ! is_string( $payload['js'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid JavaScript value.',
				], 400 );
			}
			$js_input = $payload['js'];
		}

		$js_enabled = false;
		if ( array_key_exists( 'jsEnabled', $payload ) ) {
			if ( ! is_bool( $payload['jsEnabled'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid jsEnabled value.',
				], 400 );
			}
			$js_enabled = $payload['jsEnabled'];
		}

		$shadow_dom_enabled = false;
		if ( array_key_exists( 'shadowDomEnabled', $payload ) ) {
			if ( ! is_bool( $payload['shadowDomEnabled'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid shadowDomEnabled value.',
				], 400 );
			}
			$shadow_dom_enabled = $payload['shadowDomEnabled'];
		}

		$shortcode_enabled = false;
		if ( array_key_exists( 'shortcodeEnabled', $payload ) ) {
			if ( ! is_bool( $payload['shortcodeEnabled'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid shortcodeEnabled value.',
				], 400 );
			}
			$shortcode_enabled = $payload['shortcodeEnabled'];
		}

		$live_highlight_enabled = null;
		if ( array_key_exists( 'liveHighlightEnabled', $payload ) ) {
			if ( ! is_bool( $payload['liveHighlightEnabled'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid liveHighlightEnabled value.',
				], 400 );
			}
			$live_highlight_enabled = $payload['liveHighlightEnabled'];
		}

		$generated_css_input = '';
		if ( array_key_exists( 'generatedCss', $payload ) ) {
			if ( ! is_string( $payload['generatedCss'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid generatedCss value.',
				], 400 );
			}
			$generated_css_input = $payload['generatedCss'];
		}

		$external_scripts = [];
		if ( array_key_exists( 'externalScripts', $payload ) ) {
			if ( ! is_array( $payload['externalScripts'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid externalScripts value.',
				], 400 );
			}

			$error = null;
			$external_scripts = External_Scripts::validate_list(
				array_values( $payload['externalScripts'] ),
				self::MAX_EXTERNAL_SCRIPTS,
				$error
			);
			if ( null === $external_scripts ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => $error ?: 'Invalid externalScripts value.',
				], 400 );
			}
		}

		$external_styles = [];
		if ( array_key_exists( 'externalStyles', $payload ) ) {
			if ( ! is_array( $payload['externalStyles'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid externalStyles value.',
				], 400 );
			}

			$error = null;
			$external_styles = External_Styles::validate_list(
				array_values( $payload['externalStyles'] ),
				self::MAX_EXTERNAL_STYLES,
				$error
			);
			if ( null === $external_styles ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => $error ?: 'Invalid externalStyles value.',
				], 400 );
			}
		}

		$html    = $payload['html'];
		$css_input = $payload['css'];
		$tailwind_enabled = $payload['tailwind'];

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

		$compiled_css = '';
		if ( $tailwind_enabled ) {
			if ( $generated_css_input !== '' ) {
				$compiled_css = $generated_css_input;
			} else {
				try {
					$compiled_css = tw::generate( [
						'content' => $html,
						'css'     => $css_input,
					] );
				} catch ( \Throwable $e ) {
					return new \WP_REST_Response( [
						'ok'    => false,
						'error' => 'Tailwind compile failed: ' . $e->getMessage(),
					], 500 );
				}
			}
		}

		update_post_meta( $post_id, '_lc_css', $css_input );
		update_post_meta( $post_id, '_lc_js', $js_input );
		update_post_meta( $post_id, '_lc_js_enabled', $js_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_lc_shadow_dom', $shadow_dom_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_lc_shortcode_enabled', $shortcode_enabled ? '1' : '0' );
		if ( null !== $live_highlight_enabled ) {
			update_post_meta( $post_id, '_lc_live_highlight', $live_highlight_enabled ? '1' : '0' );
		}
		update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_lc_tailwind_locked', '1' );
		delete_post_meta( $post_id, '_lc_setup_required' );

		if ( $tailwind_enabled ) {
			update_post_meta( $post_id, '_lc_generated_css', $compiled_css );
		} else {
			delete_post_meta( $post_id, '_lc_generated_css' );
		}

		if ( empty( $external_scripts ) ) {
			delete_post_meta( $post_id, '_lc_external_scripts' );
		} else {
			update_post_meta(
				$post_id,
				'_lc_external_scripts',
				wp_json_encode( $external_scripts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
			);
		}

		if ( empty( $external_styles ) ) {
			delete_post_meta( $post_id, '_lc_external_styles' );
		} else {
			update_post_meta(
				$post_id,
				'_lc_external_styles',
				wp_json_encode( $external_styles, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
			);
		}

		return new \WP_REST_Response( [
			'ok'              => true,
			'tailwindEnabled' => $tailwind_enabled,
			'settingsData'    => Rest_Settings::build_settings_payload( $post_id ),
		], 200 );
	}
}
