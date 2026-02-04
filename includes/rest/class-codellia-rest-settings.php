<?php
/**
 * REST settings handlers for Codellia.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for updating Codellia settings.
 */
class Rest_Settings {
	private const MAX_EXTERNAL_SCRIPTS = 5;
	private const MAX_EXTERNAL_STYLES  = 5;

	/**
	 * Build settings payload for the admin UI.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return array
	 */
	public static function build_settings_payload( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return array();
		}

		$visibility = 'public';
		if ( 'private' === $post->post_status ) {
			$visibility = 'private';
		} elseif ( $post->post_password ) {
			$visibility = 'password';
		}

		$status_options = array(
			array(
				'value' => 'draft',
				'label' => __( 'Draft', 'codellia' ),
			),
			array(
				'value' => 'pending',
				'label' => __( 'Pending', 'codellia' ),
			),
			array(
				'value' => 'private',
				'label' => __( 'Private', 'codellia' ),
			),
			array(
				'value' => 'future',
				'label' => __( 'Scheduled', 'codellia' ),
			),
			array(
				'value' => 'publish',
				'label' => __( 'Published', 'codellia' ),
			),
		);

		$authors = array_map(
			static function ( $user ) {
				return array(
					'id'   => (int) $user->ID,
					'name' => (string) $user->display_name,
				);
			},
			get_users(
				array(
					'fields'  => array( 'ID', 'display_name' ),
					'orderby' => 'display_name',
					'order'   => 'ASC',
				)
			)
		);

		$templates = array(
			array(
				'value' => 'default',
				'label' => __( 'Default', 'codellia' ),
			),
		);

		$theme        = wp_get_theme();
		$template_map = $theme->get_page_templates( $post );
		foreach ( $template_map as $template_name => $template_file ) {
			$templates[] = array(
				'value' => (string) $template_file,
				'label' => (string) $template_name,
			);
		}

		$formats = array(
			array(
				'value' => 'standard',
				'label' => get_post_format_string( 'standard' ),
			),
		);
		if ( current_theme_supports( 'post-formats' ) ) {
			$supported_formats = get_theme_support( 'post-formats' );
			$supported_formats = is_array( $supported_formats ) ? ( $supported_formats[0] ?? array() ) : array();
			foreach ( $supported_formats as $format ) {
				$formats[] = array(
					'value' => (string) $format,
					'label' => get_post_format_string( $format ),
				);
			}
		}

		$featured_id  = (int) get_post_thumbnail_id( $post_id );
		$featured_url = $featured_id ? wp_get_attachment_image_url( $featured_id, 'medium' ) : '';
		$featured_alt = $featured_id ? (string) get_post_meta( $featured_id, '_wp_attachment_image_alt', true ) : '';

		$highlight_meta         = get_post_meta( $post_id, '_codellia_live_highlight', true );
		$live_highlight_enabled = '' === $highlight_meta ? true : rest_sanitize_boolean( $highlight_meta );
		$single_page_enabled    = Post_Type::is_single_page_enabled( $post_id );

		$template_slug = get_page_template_slug( $post_id );
		$template_slug = $template_slug ? $template_slug : 'default';

		$post_format = get_post_format( $post_id );
		$post_format = $post_format ? $post_format : 'standard';

		return array(
			'title'                => (string) $post->post_title,
			'status'               => (string) $post->post_status,
			'visibility'           => $visibility,
			'password'             => (string) $post->post_password,
			'dateLocal'            => get_post_time( 'Y-m-d\\TH:i', false, $post ),
			'dateLabel'            => get_post_time( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), false, $post ),
			'slug'                 => (string) $post->post_name,
			'viewUrl'              => $single_page_enabled ? (string) get_permalink( $post_id ) : '',
			'author'               => (int) $post->post_author,
			'commentStatus'        => (string) $post->comment_status,
			'pingStatus'           => (string) $post->ping_status,
			'template'             => (string) $template_slug,
			'format'               => (string) $post_format,
			'featuredImageId'      => $featured_id,
			'featuredImageUrl'     => $featured_url ? (string) $featured_url : '',
			'featuredImageAlt'     => $featured_alt,
			'statusOptions'        => $status_options,
			'authors'              => $authors,
			'templates'            => $templates,
			'formats'              => $formats,
			'canPublish'           => current_user_can( 'publish_post', $post_id ),
			'canTrash'             => current_user_can( 'delete_post', $post_id ),
			'shadowDomEnabled'     => '1' === get_post_meta( $post_id, '_codellia_shadow_dom', true ),
			'shortcodeEnabled'     => '1' === get_post_meta( $post_id, '_codellia_shortcode_enabled', true ),
			'singlePageEnabled'    => $single_page_enabled,
			'liveHighlightEnabled' => $live_highlight_enabled,
			'canEditJs'            => current_user_can( 'unfiltered_html' ),
			'externalScripts'      => External_Scripts::get_external_scripts( $post_id, self::MAX_EXTERNAL_SCRIPTS ),
			'externalStyles'       => External_Styles::get_external_styles( $post_id, self::MAX_EXTERNAL_STYLES ),
		);
	}

	/**
	 * Update Codellia settings from the admin UI.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function update_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'post_id' ) );
		$updates = $request->get_param( 'updates' );

		if ( ! is_array( $updates ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid payload.', 'codellia' ),
				),
				400
			);
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Post not found.', 'codellia' ),
				),
				404
			);
		}

		$status           = isset( $updates['status'] ) ? sanitize_key( (string) $updates['status'] ) : null;
		$visibility       = isset( $updates['visibility'] ) ? sanitize_key( (string) $updates['visibility'] ) : null;
		$valid_statuses   = array( 'draft', 'pending', 'private', 'publish' );
		$valid_visibility = array( 'public', 'private' );

		if ( null !== $status && ! in_array( $status, $valid_statuses, true ) ) {
			$status = null;
		}

		if ( null !== $visibility && ! in_array( $visibility, $valid_visibility, true ) ) {
			$visibility = null;
		}

		$post_update = array( 'ID' => $post_id );

		if ( isset( $updates['title'] ) ) {
			$post_update['post_title'] = sanitize_text_field( (string) $updates['title'] );
		}

		if ( 'private' === $visibility ) {
			$post_update['post_status']   = 'private';
			$post_update['post_password'] = '';
		} else {
			if ( 'public' === $visibility ) {
				$post_update['post_password'] = '';
			}
			if ( $status ) {
				$post_update['post_status'] = $status;
			}
		}

		if ( isset( $post_update['post_status'] ) && 'publish' === $post_update['post_status'] ) {
			if ( ! current_user_can( 'publish_post', $post_id ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
		}

		if ( 1 < count( $post_update ) ) {
			$result = wp_update_post( $post_update, true );
			if ( is_wp_error( $result ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => $result->get_error_message(),
					),
					400
				);
			}
		}

		if ( array_key_exists( 'shadowDomEnabled', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
			$shadow_dom_enabled = rest_sanitize_boolean( $updates['shadowDomEnabled'] );
			update_post_meta( $post_id, '_codellia_shadow_dom', $shadow_dom_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'shortcodeEnabled', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
			$shortcode_enabled = rest_sanitize_boolean( $updates['shortcodeEnabled'] );
			update_post_meta( $post_id, '_codellia_shortcode_enabled', $shortcode_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'singlePageEnabled', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
			$single_page_enabled = rest_sanitize_boolean( $updates['singlePageEnabled'] );
			update_post_meta( $post_id, '_codellia_single_page_enabled', $single_page_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'liveHighlightEnabled', $updates ) ) {
			$live_highlight_enabled = rest_sanitize_boolean( $updates['liveHighlightEnabled'] );
			update_post_meta( $post_id, '_codellia_live_highlight', $live_highlight_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'externalScripts', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
			if ( ! is_array( $updates['externalScripts'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid external scripts payload.', 'codellia' ),
					),
					400
				);
			}

			$raw_scripts    = array_values( $updates['externalScripts'] );
			$string_scripts = array_values( array_filter( $raw_scripts, 'is_string' ) );
			$error          = null;
			$sanitized      = External_Scripts::validate_list(
				$string_scripts,
				self::MAX_EXTERNAL_SCRIPTS,
				$error
			);
			if ( null === $sanitized ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => null !== $error ? $error : __( 'External scripts must be valid https:// URLs.', 'codellia' ),
					),
					400
				);
			}

			if ( empty( $sanitized ) ) {
				delete_post_meta( $post_id, '_codellia_external_scripts' );
			} else {
				update_post_meta(
					$post_id,
					'_codellia_external_scripts',
					wp_json_encode( $sanitized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
				);
			}
		}

		if ( array_key_exists( 'externalStyles', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Permission denied.', 'codellia' ),
					),
					403
				);
			}
			if ( ! is_array( $updates['externalStyles'] ) ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => __( 'Invalid external styles payload.', 'codellia' ),
					),
					400
				);
			}

			$raw_styles    = array_values( $updates['externalStyles'] );
			$string_styles = array_values( array_filter( $raw_styles, 'is_string' ) );
			$error         = null;
			$sanitized     = External_Styles::validate_list(
				$string_styles,
				self::MAX_EXTERNAL_STYLES,
				$error
			);
			if ( null === $sanitized ) {
				return new \WP_REST_Response(
					array(
						'ok'    => false,
						'error' => null !== $error ? $error : __( 'External styles must be valid https:// URLs.', 'codellia' ),
					),
					400
				);
			}

			if ( empty( $sanitized ) ) {
				delete_post_meta( $post_id, '_codellia_external_styles' );
			} else {
				update_post_meta(
					$post_id,
					'_codellia_external_styles',
					wp_json_encode( $sanitized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
				);
			}
		}

		return new \WP_REST_Response(
			array(
				'ok'       => true,
				'settings' => self::build_settings_payload( $post_id ),
			),
			200
		);
	}
}
