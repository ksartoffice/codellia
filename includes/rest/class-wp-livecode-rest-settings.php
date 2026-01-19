<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest_Settings {
	private const MAX_EXTERNAL_SCRIPTS = 5;

	public static function build_settings_payload( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return [];
		}

		$visibility = 'public';
		if ( $post->post_status === 'private' ) {
			$visibility = 'private';
		} elseif ( $post->post_password ) {
			$visibility = 'password';
		}

		$status_options = [
			[ 'value' => 'draft', 'label' => '下書き' ],
			[ 'value' => 'pending', 'label' => '保留中' ],
			[ 'value' => 'private', 'label' => '非公開' ],
			[ 'value' => 'future', 'label' => '予約済み' ],
			[ 'value' => 'publish', 'label' => '公開済み' ],
		];

		$authors = array_map( static function ( $user ) {
			return [
				'id'   => (int) $user->ID,
				'name' => (string) $user->display_name,
			];
		}, get_users( [
			'fields'  => [ 'ID', 'display_name' ],
			'orderby' => 'display_name',
			'order'   => 'ASC',
		] ) );

		$templates = [
			[ 'value' => 'default', 'label' => 'デフォルト' ],
		];

		$theme = wp_get_theme();
		$template_map = $theme->get_page_templates( $post );
		foreach ( $template_map as $template_name => $template_file ) {
			$templates[] = [
				'value' => (string) $template_file,
				'label' => (string) $template_name,
			];
		}

		$formats = [
			[ 'value' => 'standard', 'label' => get_post_format_string( 'standard' ) ],
		];
		if ( current_theme_supports( 'post-formats' ) ) {
			$supported_formats = get_theme_support( 'post-formats' );
			$supported_formats = is_array( $supported_formats ) ? ( $supported_formats[0] ?? [] ) : [];
			foreach ( $supported_formats as $format ) {
				$formats[] = [
					'value' => (string) $format,
					'label' => get_post_format_string( $format ),
				];
			}
		}

		$terms = get_terms( [
			'taxonomy'   => 'category',
			'hide_empty' => false,
		] );
		if ( is_wp_error( $terms ) ) {
			$terms = [];
		}

		$categories_list = array_map( static function ( $term ) {
			return [
				'id'   => (int) $term->term_id,
				'name' => (string) $term->name,
			];
		}, $terms );

		$featured_id = (int) get_post_thumbnail_id( $post_id );
		$featured_url = $featured_id ? wp_get_attachment_image_url( $featured_id, 'medium' ) : '';
		$featured_alt = $featured_id ? (string) get_post_meta( $featured_id, '_wp_attachment_image_alt', true ) : '';

		$category_ids = wp_get_post_terms( $post_id, 'category', [ 'fields' => 'ids' ] );
		if ( is_wp_error( $category_ids ) ) {
			$category_ids = [];
		}

		$tag_names = wp_get_post_terms( $post_id, 'post_tag', [ 'fields' => 'names' ] );
		if ( is_wp_error( $tag_names ) ) {
			$tag_names = [];
		}

		$highlight_meta = get_post_meta( $post_id, '_lc_live_highlight', true );
		$live_highlight_enabled = $highlight_meta === '' ? true : rest_sanitize_boolean( $highlight_meta );

		return [
			'title'           => (string) $post->post_title,
			'status'          => (string) $post->post_status,
			'visibility'      => $visibility,
			'password'        => (string) $post->post_password,
			'dateLocal'       => get_post_time( 'Y-m-d\\TH:i', false, $post ),
			'dateLabel'       => get_post_time( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), false, $post ),
			'slug'            => (string) $post->post_name,
			'author'          => (int) $post->post_author,
			'commentStatus'   => (string) $post->comment_status,
			'pingStatus'      => (string) $post->ping_status,
			'template'        => (string) ( get_page_template_slug( $post_id ) ?: 'default' ),
			'format'          => (string) ( get_post_format( $post_id ) ?: 'standard' ),
			'categories'      => array_map( 'intval', (array) $category_ids ),
			'tags'            => (array) $tag_names,
			'featuredImageId' => $featured_id,
			'featuredImageUrl' => $featured_url ? (string) $featured_url : '',
			'featuredImageAlt' => $featured_alt,
			'statusOptions'   => $status_options,
			'authors'         => $authors,
			'templates'       => $templates,
			'formats'         => $formats,
			'categoriesList'  => $categories_list,
			'canPublish'      => current_user_can( 'publish_post', $post_id ),
			'canTrash'        => current_user_can( 'delete_post', $post_id ),
			'jsEnabled'       => get_post_meta( $post_id, '_lc_js_enabled', true ) === '1',
			'shadowDomEnabled' => get_post_meta( $post_id, '_lc_shadow_dom', true ) === '1',
			'shortcodeEnabled' => get_post_meta( $post_id, '_lc_shortcode_enabled', true ) === '1',
			'liveHighlightEnabled' => $live_highlight_enabled,
			'canEditJavaScript' => current_user_can( 'unfiltered_html' ),
			'externalScripts' => External_Scripts::get_external_scripts( $post_id, self::MAX_EXTERNAL_SCRIPTS ),
		];
	}

	public static function update_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$updates = $request->get_param( 'updates' );

		if ( ! is_array( $updates ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid payload.',
			], 400 );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Post not found.',
			], 404 );
		}

		$status = isset( $updates['status'] ) ? sanitize_key( (string) $updates['status'] ) : null;
		$visibility = isset( $updates['visibility'] ) ? sanitize_key( (string) $updates['visibility'] ) : null;
		$password = isset( $updates['password'] ) ? (string) $updates['password'] : null;

		if ( $status === 'trash' ) {
			if ( ! current_user_can( 'delete_post', $post_id ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
			wp_trash_post( $post_id );
			return new \WP_REST_Response( [
				'ok'          => true,
				'redirectUrl' => admin_url( 'edit.php?post_type=' . Post_Type::POST_TYPE ),
			], 200 );
		}

		$post_update = [ 'ID' => $post_id ];

		if ( isset( $updates['title'] ) ) {
			$post_update['post_title'] = sanitize_text_field( (string) $updates['title'] );
		}

		if ( isset( $updates['slug'] ) ) {
			$post_update['post_name'] = sanitize_title( (string) $updates['slug'] );
		}

		if ( isset( $updates['author'] ) ) {
			$post_update['post_author'] = absint( $updates['author'] );
		}

		if ( isset( $updates['date'] ) ) {
			$date_value = sanitize_text_field( (string) $updates['date'] );
			if ( $date_value !== '' ) {
				$post_update['post_date']     = $date_value;
				$post_update['post_date_gmt'] = get_gmt_from_date( $date_value );
			}
		}

		if ( isset( $updates['commentStatus'] ) ) {
			$post_update['comment_status'] = $updates['commentStatus'] === 'open' ? 'open' : 'closed';
		}

		if ( isset( $updates['pingStatus'] ) ) {
			$post_update['ping_status'] = $updates['pingStatus'] === 'open' ? 'open' : 'closed';
		}

		if ( $visibility === 'private' ) {
			$post_update['post_status'] = 'private';
			$post_update['post_password'] = '';
		} else {
			if ( $visibility === 'password' ) {
				$post_update['post_password'] = $password ?? $post->post_password;
			} elseif ( $visibility === 'public' ) {
				$post_update['post_password'] = '';
			}
			if ( $status ) {
				$post_update['post_status'] = $status;
			}
		}

		if ( isset( $post_update['post_status'] ) && $post_update['post_status'] === 'publish' ) {
			if ( ! current_user_can( 'publish_post', $post_id ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
		}

		if ( count( $post_update ) > 1 ) {
			$result = wp_update_post( $post_update, true );
			if ( is_wp_error( $result ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => $result->get_error_message(),
				], 400 );
			}
		}

		if ( isset( $updates['template'] ) ) {
			$template = sanitize_text_field( (string) $updates['template'] );
			if ( $template === 'default' ) {
				delete_post_meta( $post_id, '_wp_page_template' );
			} else {
				update_post_meta( $post_id, '_wp_page_template', $template );
			}
		}

		if ( isset( $updates['format'] ) ) {
			$format = sanitize_key( (string) $updates['format'] );
			if ( $format === 'standard' ) {
				set_post_format( $post_id, false );
			} else {
				set_post_format( $post_id, $format );
			}
		}

		if ( isset( $updates['featuredImageId'] ) ) {
			$featured_id = absint( $updates['featuredImageId'] );
			if ( $featured_id > 0 ) {
				set_post_thumbnail( $post_id, $featured_id );
			} else {
				delete_post_thumbnail( $post_id );
			}
		}

		if ( isset( $updates['categories'] ) && is_array( $updates['categories'] ) ) {
			$category_ids = array_map( 'absint', $updates['categories'] );
			if ( isset( $updates['newCategory'] ) && is_string( $updates['newCategory'] ) ) {
				$new_name = sanitize_text_field( $updates['newCategory'] );
				if ( $new_name !== '' ) {
					$created = wp_insert_term( $new_name, 'category' );
					if ( ! is_wp_error( $created ) && isset( $created['term_id'] ) ) {
						$category_ids[] = (int) $created['term_id'];
					}
				}
			}
			wp_set_post_terms( $post_id, $category_ids, 'category', false );
		}

		if ( isset( $updates['tags'] ) && is_array( $updates['tags'] ) ) {
			$tags = array_filter( array_map( 'sanitize_text_field', $updates['tags'] ) );
			wp_set_post_terms( $post_id, $tags, 'post_tag', false );
		}

		if ( array_key_exists( 'enableJavaScript', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
			$js_enabled = rest_sanitize_boolean( $updates['enableJavaScript'] );
			update_post_meta( $post_id, '_lc_js_enabled', $js_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'enableShadowDom', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
			$shadow_dom_enabled = rest_sanitize_boolean( $updates['enableShadowDom'] );
			update_post_meta( $post_id, '_lc_shadow_dom', $shadow_dom_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'enableShortcode', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
			$shortcode_enabled = rest_sanitize_boolean( $updates['enableShortcode'] );
			update_post_meta( $post_id, '_lc_shortcode_enabled', $shortcode_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'enableLiveHighlight', $updates ) ) {
			$live_highlight_enabled = rest_sanitize_boolean( $updates['enableLiveHighlight'] );
			update_post_meta( $post_id, '_lc_live_highlight', $live_highlight_enabled ? '1' : '0' );
		}

		if ( array_key_exists( 'externalScripts', $updates ) ) {
			if ( ! current_user_can( 'unfiltered_html' ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Permission denied.',
				], 403 );
			}
			if ( ! is_array( $updates['externalScripts'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid external scripts payload.',
				], 400 );
			}

			$raw_scripts = array_values( $updates['externalScripts'] );
			$string_scripts = array_values( array_filter( $raw_scripts, 'is_string' ) );
			$error = null;
			$sanitized = External_Scripts::validate_list(
				$string_scripts,
				self::MAX_EXTERNAL_SCRIPTS,
				$error
			);
			if ( null === $sanitized ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => $error ?: 'External scripts must be valid https:// URLs.',
				], 400 );
			}

			if ( empty( $sanitized ) ) {
				delete_post_meta( $post_id, '_lc_external_scripts' );
			} else {
				update_post_meta(
					$post_id,
					'_lc_external_scripts',
					wp_json_encode( $sanitized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
				);
			}
		}

		return new \WP_REST_Response( [
			'ok'       => true,
			'settings' => self::build_settings_payload( $post_id ),
		], 200 );
	}
}
