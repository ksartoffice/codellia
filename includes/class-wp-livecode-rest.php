<?php
namespace WPLiveCode;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest {
	private const MAX_EXTERNAL_SCRIPTS = 5;

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
				'css'    => [
					'type'     => 'string',
					'required' => false,
				],
			],
		] );

		register_rest_route( 'wp-livecode/v1', '/setup', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'setup_mode' ],
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
			'callback'            => [ __CLASS__, 'import_payload' ],
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
			'callback'            => [ __CLASS__, 'update_settings' ],
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

	public static function save( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$html    = (string) $request->get_param( 'html' );
		$css_input = (string) $request->get_param( 'css' );
		$js_input = (string) $request->get_param( 'js' );
		$has_js = $request->has_param( 'js' );
		$has_js_enabled = $request->has_param( 'jsEnabled' );
		$js_enabled = rest_sanitize_boolean( $request->get_param( 'jsEnabled' ) );
		$tailwind_enabled = rest_sanitize_boolean( $request->get_param( 'tailwind' ) );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		if ( ( $has_js || $has_js_enabled ) && ! current_user_can( 'unfiltered_html' ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Permission denied.',
			], 403 );
		}

		$tailwind_meta   = get_post_meta( $post_id, '_lc_tailwind', true );
		$tailwind_locked = get_post_meta( $post_id, '_lc_tailwind_locked', true ) === '1';
		$has_tailwind    = $tailwind_meta !== '';

		if ( $tailwind_locked || $has_tailwind ) {
			$tailwind_enabled = $tailwind_meta === '1';
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

		$tailwind_preflight = self::get_tailwind_preflight_enabled( $post_id, $css_input );
		$compiled_css = '';
		if ( $tailwind_enabled ) {
			try {
				$compiled_css = self::compile_tailwind_css( $html, $css_input, $tailwind_preflight );
			} catch ( \Throwable $e ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Tailwind compile failed: ' . $e->getMessage(),
				], 500 );
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
		update_post_meta( $post_id, '_lc_tailwind_preflight', $tailwind_preflight ? '1' : '0' );

		return new \WP_REST_Response( [ 'ok' => true ], 200 );
	}

	public static function compile_tailwind( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$html    = (string) $request->get_param( 'html' );
		$css_input = (string) $request->get_param( 'css' );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		try {
			$tailwind_preflight = self::get_tailwind_preflight_enabled( $post_id, $css_input );
			$css = self::compile_tailwind_css( $html, $css_input, $tailwind_preflight );
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

	public static function setup_mode( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$mode    = sanitize_key( (string) $request->get_param( 'mode' ) );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		if ( $mode !== 'tailwind' && $mode !== 'normal' ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid setup mode.',
			], 400 );
		}

		$tailwind_meta   = get_post_meta( $post_id, '_lc_tailwind', true );
		$tailwind_locked = get_post_meta( $post_id, '_lc_tailwind_locked', true ) === '1';
		$tailwind_enabled = $tailwind_meta === '1';

		if ( ! $tailwind_locked ) {
			$tailwind_enabled = $mode === 'tailwind';
			update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );
			update_post_meta( $post_id, '_lc_tailwind_locked', '1' );
			delete_post_meta( $post_id, '_lc_setup_required' );
			if ( $tailwind_enabled && get_post_meta( $post_id, '_lc_tailwind_preflight', true ) === '' ) {
				update_post_meta( $post_id, '_lc_tailwind_preflight', '0' );
			}
		} else {
			delete_post_meta( $post_id, '_lc_setup_required' );
		}

		return new \WP_REST_Response( [
			'ok'              => true,
			'tailwindEnabled' => $tailwind_enabled,
		], 200 );
	}

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

		$tailwind_preflight = null;
		if ( array_key_exists( 'tailwindPreflight', $payload ) ) {
			if ( ! is_bool( $payload['tailwindPreflight'] ) ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'Invalid tailwindPreflight value.',
				], 400 );
			}
			$tailwind_preflight = $payload['tailwindPreflight'];
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

			foreach ( array_values( $payload['externalScripts'] ) as $script_url ) {
				if ( ! is_string( $script_url ) ) {
					return new \WP_REST_Response( [
						'ok'    => false,
						'error' => 'Invalid externalScripts value.',
					], 400 );
				}
				$script_url = trim( $script_url );
				if ( $script_url === '' ) {
					continue;
				}
				$clean_url = self::sanitize_external_script_url( $script_url );
				if ( ! $clean_url ) {
					return new \WP_REST_Response( [
						'ok'    => false,
						'error' => 'External scripts must be valid https:// URLs.',
					], 400 );
				}
				$external_scripts[] = $clean_url;
			}

			$external_scripts = array_values( array_unique( $external_scripts ) );
			if ( count( $external_scripts ) > self::MAX_EXTERNAL_SCRIPTS ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'External scripts exceed the maximum allowed.',
				], 400 );
			}
		}

		$html    = $payload['html'];
		$css_input = $payload['css'];
		$tailwind_enabled = $payload['tailwind'];
		if ( $tailwind_preflight === null ) {
			$tailwind_preflight = self::detect_tailwind_preflight( $css_input );
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

		$compiled_css = '';
		if ( $tailwind_enabled ) {
			if ( $generated_css_input !== '' ) {
				$compiled_css = $generated_css_input;
			} else {
				try {
					$compiled_css = self::compile_tailwind_css( $html, $css_input, $tailwind_preflight );
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
		update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );
		update_post_meta( $post_id, '_lc_tailwind_locked', '1' );
		delete_post_meta( $post_id, '_lc_setup_required' );
		update_post_meta( $post_id, '_lc_tailwind_preflight', $tailwind_preflight ? '1' : '0' );

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

		return new \WP_REST_Response( [
			'ok'              => true,
			'tailwindEnabled' => $tailwind_enabled,
			'settingsData'    => self::build_settings_payload( $post_id ),
		], 200 );
	}

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
			'canEditJavaScript' => current_user_can( 'unfiltered_html' ),
			'externalScripts' => self::get_external_scripts( $post_id ),
			'tailwindPreflightEnabled' => self::get_tailwind_preflight_enabled( $post_id ),
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
			$sanitized = [];
			foreach ( $raw_scripts as $script_url ) {
				if ( ! is_string( $script_url ) ) {
					continue;
				}
				$script_url = trim( $script_url );
				if ( $script_url === '' ) {
					continue;
				}
				$clean_url = self::sanitize_external_script_url( $script_url );
				if ( ! $clean_url ) {
					return new \WP_REST_Response( [
						'ok'    => false,
						'error' => 'External scripts must be valid https:// URLs.',
					], 400 );
				}
				$sanitized[] = $clean_url;
			}

			$sanitized = array_values( array_unique( $sanitized ) );
			if ( count( $sanitized ) > self::MAX_EXTERNAL_SCRIPTS ) {
				return new \WP_REST_Response( [
					'ok'    => false,
					'error' => 'External scripts exceed the maximum allowed.',
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

		if ( array_key_exists( 'tailwindPreflight', $updates ) ) {
			$tailwind_preflight = rest_sanitize_boolean( $updates['tailwindPreflight'] );
			$tailwind_enabled = get_post_meta( $post_id, '_lc_tailwind', true ) === '1';
			if ( $tailwind_enabled ) {
				$current_css = (string) get_post_meta( $post_id, '_lc_css', true );
				$current_html = (string) $post->post_content;
				try {
					$compiled_css = self::compile_tailwind_css( $current_html, $current_css, $tailwind_preflight );
				} catch ( \Throwable $e ) {
					return new \WP_REST_Response( [
						'ok'    => false,
						'error' => 'Tailwind compile failed: ' . $e->getMessage(),
					], 500 );
				}
				update_post_meta( $post_id, '_lc_generated_css', $compiled_css );
			}
			update_post_meta( $post_id, '_lc_tailwind_preflight', $tailwind_preflight ? '1' : '0' );
		}

		return new \WP_REST_Response( [
			'ok'       => true,
			'settings' => self::build_settings_payload( $post_id ),
		], 200 );
	}

	private static function compile_tailwind_css( string $html, string $css_input, bool $preflight_enabled ): string {
		$normalized_css = self::normalize_tailwind_css( $css_input, $preflight_enabled );
		return tw::generate( [
			'content' => $html,
			'css'     => $normalized_css,
		] );
	}

	private static function normalize_tailwind_css( string $css_input, bool $preflight_enabled ): string {
		if ( $preflight_enabled ) {
			return self::ensure_preflight_import( $css_input );
		}

		$css = preg_replace( '/@import\\s+["\']tailwindcss\\/preflight(?:\\.css)?["\'][^;]*;?/i', '', $css_input );
		$css = preg_replace(
			'/@import\\s+["\']tailwindcss(?:\\.css)?["\'][^;]*;?/i',
			'@import "tailwindcss/theme.css" layer(theme);' . "\n" . '@import "tailwindcss/utilities.css" layer(utilities);',
			$css
		);

		return $css ?? $css_input;
	}

	private static function ensure_preflight_import( string $css_input ): string {
		if ( preg_match( '/@import\\s+["\']tailwindcss(?:\\.css)?["\']/i', $css_input ) ) {
			return $css_input;
		}
		if ( preg_match( '/@import\\s+["\']tailwindcss\\/preflight(?:\\.css)?["\']/i', $css_input ) ) {
			return $css_input;
		}

		$pattern = '/(@import\\s+["\']tailwindcss\\/theme(?:\\.css)?["\'][^;]*;)/i';
		if ( preg_match( $pattern, $css_input ) ) {
			$replacement = '$1' . "\n" . '@import "tailwindcss/preflight.css" layer(base);';
			return preg_replace( $pattern, $replacement, $css_input, 1 ) ?? $css_input;
		}

		return '@import "tailwindcss/preflight.css" layer(base);' . "\n" . $css_input;
	}

	private static function get_tailwind_preflight_enabled( int $post_id, string $css_input = '' ): bool {
		$meta = get_post_meta( $post_id, '_lc_tailwind_preflight', true );
		if ( $meta === '1' ) {
			return true;
		}
		if ( $meta === '0' ) {
			return false;
		}

		$source = $css_input !== '' ? $css_input : (string) get_post_meta( $post_id, '_lc_css', true );
		return self::detect_tailwind_preflight( $source );
	}

	private static function detect_tailwind_preflight( string $css_input ): bool {
		if ( $css_input === '' ) {
			return false;
		}
		if ( preg_match( '/@import\\s+["\']tailwindcss(?:\\.css)?["\']\\s*;?/i', $css_input ) ) {
			return true;
		}
		if ( preg_match( '/@import\\s+["\']tailwindcss\\/preflight(?:\\.css)?["\']\\s*;?/i', $css_input ) ) {
			return true;
		}
		return false;
	}

	private static function get_external_scripts( int $post_id ): array {
		$raw = get_post_meta( $post_id, '_lc_external_scripts', true );
		$list = [];

		if ( is_array( $raw ) ) {
			$list = $raw;
		} elseif ( is_string( $raw ) && $raw !== '' ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$list = $decoded;
			}
		}

		$clean = [];
		foreach ( $list as $entry ) {
			if ( ! is_string( $entry ) ) {
				continue;
			}
			$clean_url = self::sanitize_external_script_url( $entry );
			if ( $clean_url ) {
				$clean[] = $clean_url;
			}
		}

		$clean = array_values( array_unique( $clean ) );
		if ( count( $clean ) > self::MAX_EXTERNAL_SCRIPTS ) {
			$clean = array_slice( $clean, 0, self::MAX_EXTERNAL_SCRIPTS );
		}

		return $clean;
	}

	private static function sanitize_external_script_url( string $url ): ?string {
		$url = trim( $url );
		if ( $url === '' ) {
			return null;
		}

		$validated = wp_http_validate_url( $url );
		if ( ! $validated ) {
			return null;
		}

		$parts = wp_parse_url( $validated );
		$scheme = isset( $parts['scheme'] ) ? strtolower( $parts['scheme'] ) : '';
		if ( $scheme !== 'https' ) {
			return null;
		}

		return esc_url_raw( $validated );
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
