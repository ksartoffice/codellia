<?php
/**
 * Front-end rendering for Codellia posts and shortcodes.
 *
 * @package Codellia
 */

namespace Codellia;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles front-end rendering, assets, and shortcodes.
 */
class Frontend {
	/**
	 * Shortcode instance counter for unique IDs.
	 *
	 * @var int
	 */
	private static int $shortcode_instance = 0;

	/**
	 * Tracks which posts have already enqueued inline assets.
	 *
	 * @var array<int,bool>
	 */
	private static array $shortcode_assets_loaded = array();

	/**
	 * Tracks external script handles by URL for deduping.
	 *
	 * @var array<string,string>
	 */
	private static array $external_script_handles = array();

	/**
	 * Tracks whether the shadow runtime has been enqueued.
	 *
	 * @var bool
	 */
	private static bool $shadow_runtime_enqueued = false;
	private const TEMPLATE_MODE_META_KEY         = '_codellia_template_mode';
	private const TEMPLATE_MODE_VALUES           = array( 'default', 'standalone', 'frame', 'theme' );
	private const DEFAULT_TEMPLATE_MODE_VALUES   = array( 'standalone', 'frame', 'theme' );

	/**
	 * Register front-end hooks.
	 */
	public static function init(): void {
		add_action( 'wp', array( __CLASS__, 'maybe_disable_autop' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_redirect_single_page' ) );
		add_action( 'wp_head', array( __CLASS__, 'maybe_add_noindex' ), 1 );
		add_action( 'pre_get_posts', array( __CLASS__, 'exclude_single_page_from_query' ) );
		// Enqueue late so Codellia styles can override theme styles on the front-end.
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_css' ), 999 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_js' ) );
		add_filter( 'the_content', array( __CLASS__, 'filter_content' ), 20 );
		add_filter( 'template_include', array( __CLASS__, 'maybe_override_template' ), 20 );
		add_shortcode( 'codellia', array( __CLASS__, 'shortcode' ) );
	}

	/**
	 * Check whether single page view is disabled for a post.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return bool
	 */
	private static function is_single_page_disabled( int $post_id ): bool {
		return ! Post_Type::is_single_page_enabled( $post_id );
	}

	/**
	 * Redirect single page requests when disabled.
	 */
	public static function maybe_redirect_single_page(): void {
		if ( is_admin() || get_query_var( 'codellia_preview' ) ) {
			return;
		}

		if ( ! is_singular( Post_Type::POST_TYPE ) ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! self::is_single_page_disabled( $post_id ) ) {
			return;
		}

		$target = apply_filters( 'codellia_single_page_redirect', home_url( '/' ), $post_id );
		if ( '404' === $target ) {
			global $wp_query;
			$wp_query->set_404();
			status_header( 404 );
			nocache_headers();
			include get_404_template();
			exit;
		}

		if ( is_string( $target ) && '' !== $target ) {
			wp_safe_redirect( $target );
			exit;
		}
	}

	/**
	 * Output noindex meta when single page is disabled.
	 */
	public static function maybe_add_noindex(): void {
		if ( is_admin() || get_query_var( 'codellia_preview' ) ) {
			return;
		}

		if ( ! is_singular( Post_Type::POST_TYPE ) ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! self::is_single_page_disabled( $post_id ) ) {
			return;
		}

		echo '<meta name="robots" content="noindex">' . PHP_EOL;
	}

	/**
	 * Exclude single-page-disabled posts from search and archives.
	 *
	 * @param \WP_Query $query Query instance.
	 */
	public static function exclude_single_page_from_query( \WP_Query $query ): void {
		if ( is_admin() || ! $query->is_main_query() || $query->is_singular() ) {
			return;
		}

		$post_type     = $query->get( 'post_type' );
		$should_filter = false;

		if ( $query->is_search() ) {
			$should_filter = true;
		} elseif ( 'any' === $post_type ) {
			$should_filter = true;
		} elseif ( is_array( $post_type ) ) {
			$should_filter = in_array( Post_Type::POST_TYPE, $post_type, true );
		} elseif ( is_string( $post_type ) ) {
			$should_filter = Post_Type::POST_TYPE === $post_type;
		}

		if ( ! $should_filter ) {
			return;
		}

		$meta_query = $query->get( 'meta_query' );
		if ( ! is_array( $meta_query ) ) {
			$meta_query = array();
		}

		$meta_query[] = array(
			'relation' => 'OR',
			array(
				'key'     => '_codellia_single_page_enabled',
				'compare' => 'NOT EXISTS',
			),
			array(
				'key'     => '_codellia_single_page_enabled',
				'value'   => '1',
				'compare' => '=',
			),
		);

		$query->set( 'meta_query', $meta_query );
	}

	/**
	 * Prevent WordPress auto-formatting from injecting <p> tags on the front-end.
	 */
	public static function maybe_disable_autop(): void {
		if ( is_admin() ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return;
		}

		if ( has_filter( 'the_content', 'wpautop' ) ) {
			remove_filter( 'the_content', 'wpautop' );
		}
		if ( has_filter( 'the_content', 'shortcode_unautop' ) ) {
			remove_filter( 'the_content', 'shortcode_unautop' );
		}
	}

	/**
	 * Check whether Shadow DOM rendering is enabled for a post.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return bool
	 */
	private static function is_shadow_dom_enabled( int $post_id ): bool {
		return '1' === get_post_meta( $post_id, '_codellia_shadow_dom', true );
	}

	/**
	 * Normalize template mode string.
	 *
	 * @param mixed $value Template mode value.
	 * @return string
	 */
	private static function normalize_template_mode( $value ): string {
		$template_mode = is_string( $value ) ? $value : '';
		return in_array( $template_mode, self::TEMPLATE_MODE_VALUES, true ) ? $template_mode : 'default';
	}

	/**
	 * Resolve default template mode from options.
	 *
	 * @return string
	 */
	private static function resolve_default_template_mode(): string {
		$template_mode = get_option( Admin::OPTION_DEFAULT_TEMPLATE_MODE, 'theme' );
		$template_mode = Admin::sanitize_default_template_mode( $template_mode );
		return in_array( $template_mode, self::DEFAULT_TEMPLATE_MODE_VALUES, true ) ? $template_mode : 'theme';
	}

	/**
	 * Resolve template mode for the current request.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return string
	 */
	private static function resolve_template_mode( int $post_id ): string {
		$template_mode = self::normalize_template_mode( get_post_meta( $post_id, self::TEMPLATE_MODE_META_KEY, true ) );

		if ( get_query_var( 'codellia_preview' ) ) {
			$override = self::normalize_template_mode( get_query_var( 'codellia_template_mode' ) );
			if ( 'default' !== $override ) {
				$template_mode = $override;
			}
		}

		if ( 'default' === $template_mode ) {
			$template_mode = self::resolve_default_template_mode();
		}

		return $template_mode;
	}

	/**
	 * Override single template based on Codellia template mode.
	 *
	 * @param string $template Template path.
	 * @return string
	 */
	public static function maybe_override_template( string $template ): string {
		if ( is_admin() ) {
			return $template;
		}

		if ( ! is_singular( Post_Type::POST_TYPE ) ) {
			return $template;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return $template;
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return $template;
		}

		$template_mode = self::resolve_template_mode( $post_id );
		if ( 'theme' === $template_mode ) {
			return $template;
		}

		$path = '';
		if ( 'standalone' === $template_mode ) {
			$path = CODELLIA_PATH . 'templates/single-codellia-standalone.php';
		} elseif ( 'frame' === $template_mode ) {
			$path = CODELLIA_PATH . 'templates/single-codellia-frame.php';
		}

		if ( $path && file_exists( $path ) ) {
			return $path;
		}

		return $template;
	}

	/**
	 * Resolve CSS for a post, handling Tailwind compilation where needed.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return string
	 */
	private static function get_css_for_post( int $post_id ): string {

		$is_tailwind   = '1' === get_post_meta( $post_id, '_codellia_tailwind', true );
		$stored_css    = (string) get_post_meta( $post_id, '_codellia_css', true );
		$generated_css = (string) get_post_meta( $post_id, '_codellia_generated_css', true );
		$css           = $is_tailwind ? $generated_css : $stored_css;

		if ( $is_tailwind ) {
			$css = Rest_Save::append_tailwind_shadow_fallbacks( $css );
		}

		$has_unescaped_arbitrary = ! $is_tailwind
			&& '' !== $stored_css
			&& false !== strpos( $stored_css, '-[' )
			&& false === strpos( $stored_css, '-\\[' );
		$should_compile          = ! $is_tailwind && $has_unescaped_arbitrary;

		if ( $should_compile ) {
			$post = get_post( $post_id );
			if ( $post instanceof \WP_Post ) {
				try {
					$css = tw::generate(
						array(
							'content' => (string) $post->post_content,
							'css'     => '@import "tailwindcss";',
						)
					);
				} catch ( \Throwable $e ) {
					$css = $stored_css;
				}
			}
		}

		return self::escape_style_tag( $css );
	}

	/**
	 * Escape closing style tags to prevent tag injection.
	 *
	 * @param string $css CSS output.
	 * @return string
	 */
	private static function escape_style_tag( string $css ): string {
		if ( '' === $css ) {
			return '';
		}

		return str_ireplace( '</style', '&lt;/style', $css );
	}

	/**
	 * Filter Codellia post content for Shadow DOM preview.
	 *
	 * @param string $content Post content.
	 * @return string
	 */
	public static function filter_content( string $content ): string {
		if ( is_admin() ) {
			return $content;
		}
		if ( get_query_var( 'codellia_preview' ) ) {
			return $content;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return $content;
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return $content;
		}

		if ( ! self::is_shadow_dom_enabled( $post_id ) ) {
			return $content;
		}

		$css        = self::get_css_for_post( $post_id );
		$style_html = self::build_external_styles_html( $post_id );
		if ( '' !== $css ) {
			$style_html .= '<style id="cd-style">' . $css . '</style>';
		}
		$script_html = self::build_inline_shadow_script( $post_id );
		return '<codellia-output data-post-id="' . esc_attr( $post_id ) . '"><template shadowrootmode="open">' . $style_html . $content . '</template>' . $script_html . '</codellia-output>';
	}

	/**
	 * Render the [codellia] shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public static function shortcode( $atts = array() ): string {
		$atts    = shortcode_atts(
			array(
				'post_id' => 0,
			),
			(array) $atts,
			'codellia'
		);
		$post_id = absint( $atts['post_id'] ?? 0 );
		if ( ! $post_id ) {
			return '';
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return '';
		}

		if ( '1' !== get_post_meta( $post_id, '_codellia_shortcode_enabled', true ) ) {
			return '';
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post ) {
			return '';
		}
		if ( 'publish' !== $post->post_status && ! current_user_can( 'read_post', $post_id ) ) {
			return '';
		}

		$content = (string) $post->post_content;
		$content = do_shortcode( $content );

		if ( self::is_shadow_dom_enabled( $post_id ) ) {
			++self::$shortcode_instance;
			$instance    = self::$shortcode_instance;
			$style_html  = self::build_inline_style( $post_id, $instance );
			$script_html = self::build_inline_shadow_script( $post_id, $instance );
			self::enqueue_shortcode_scripts( $post_id );
			return '<codellia-output data-post-id="' . esc_attr( $post_id ) . '"><template shadowrootmode="open">' . $style_html . $content . '</template>' . $script_html . '</codellia-output>';
		}

		$assets = self::get_non_shadow_assets_html( $post_id );
		return $assets['style'] . $content . $assets['scripts'];
	}

	/**
	 * Build inline style HTML for Shadow DOM rendering.
	 *
	 * @param int $post_id  Codellia post ID.
	 * @param int $instance Instance number.
	 * @return string
	 */
	private static function build_inline_style( int $post_id, int $instance = 0 ): string {
		$css             = self::get_css_for_post( $post_id );
		$external_styles = self::build_external_styles_html( $post_id );
		if ( '' === $css && '' === $external_styles ) {
			return '';
		}
		$suffix       = 0 < $instance ? '-' . $post_id . '-' . $instance : '-' . $post_id;
		$inline_style = '' !== $css ? '<style id="cd-style' . esc_attr( $suffix ) . '">' . $css . '</style>' : '';
		return $external_styles . $inline_style;
	}

	/**
	 * Build external stylesheet tags for Shadow DOM rendering.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return string
	 */
	private static function build_external_styles_html( int $post_id ): string {
		$external_styles = External_Styles::get_external_styles( $post_id );
		if ( empty( $external_styles ) ) {
			return '';
		}

		$styles_html = '';
		foreach ( $external_styles as $style_url ) {
			// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet
			$styles_html .= '<link rel="stylesheet" href="' . esc_url( $style_url ) . '">';
		}

		return $styles_html;
	}

	/**
	 * Build inline script payload for Shadow DOM rendering.
	 *
	 * @param int $post_id  Codellia post ID.
	 * @param int $instance Instance number.
	 * @return string
	 */
	private static function build_inline_shadow_script( int $post_id, int $instance = 0 ): string {
		$js = (string) get_post_meta( $post_id, '_codellia_js', true );
		if ( '' === $js ) {
			return '';
		}

		$external_scripts = External_Scripts::get_external_scripts( $post_id );
		$wait_attr        = empty( $external_scripts ) ? '' : ' data-codellia-js-wait="load"';
		$suffix           = 0 < $instance ? '-' . $post_id . '-' . $instance : '-' . $post_id;
		$encoded          = rawurlencode( $js );
		// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
		return '<script type="application/json" id="cd-script-data' . esc_attr( $suffix ) . '" data-codellia-js="1"' . $wait_attr . '>' . esc_html( $encoded ) . '</script>';
	}

	/**
	 * Build inline script tags for non-shadow rendering.
	 *
	 * @param int $post_id  Codellia post ID.
	 * @param int $instance Instance number.
	 * @return string
	 */
	private static function build_inline_scripts( int $post_id, int $instance = 0 ): string {
		$js               = (string) get_post_meta( $post_id, '_codellia_js', true );
		$external_scripts = External_Scripts::get_external_scripts( $post_id );
		if ( '' === $js && empty( $external_scripts ) ) {
			return '';
		}

		$scripts_html = '';
		foreach ( $external_scripts as $script_url ) {
			// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
			$scripts_html .= '<script src="' . esc_url( $script_url ) . '"></script>';
		}
		if ( '' !== $js ) {
			$suffix = 0 < $instance ? '-' . $post_id . '-' . $instance : '-' . $post_id;
			// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
			$scripts_html .= '<script id="cd-script' . esc_attr( $suffix ) . '">' . $js . '</script>';
		}

		return $scripts_html;
	}

	/**
	 * Fetch inline assets for non-shadow shortcode rendering.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return array{style:string,scripts:string}
	 */
	private static function get_non_shadow_assets_html( int $post_id ): array {
		if ( isset( self::$shortcode_assets_loaded[ $post_id ] ) ) {
			return array(
				'style'   => '',
				'scripts' => '',
			);
		}
		self::$shortcode_assets_loaded[ $post_id ] = true;

		return array(
			'style'   => self::build_inline_style( $post_id ),
			'scripts' => self::build_inline_scripts( $post_id ),
		);
	}

	/**
	 * Enqueue external scripts for shadow-dom shortcode rendering.
	 *
	 * @param int $post_id Codellia post ID.
	 */
	private static function enqueue_shortcode_scripts( int $post_id ): void {
		if ( isset( self::$shortcode_assets_loaded[ $post_id ] ) ) {
			return;
		}
		self::$shortcode_assets_loaded[ $post_id ] = true;

		$js = (string) get_post_meta( $post_id, '_codellia_js', true );
		if ( '' !== $js ) {
			self::enqueue_shadow_runtime();
		}

		$external_scripts = External_Scripts::get_external_scripts( $post_id );
		if ( empty( $external_scripts ) ) {
			return;
		}

		self::enqueue_external_scripts( $post_id );
	}

	/**
	 * Enqueue external script URLs once per page.
	 *
	 * @param int $post_id Codellia post ID.
	 * @return string Last dependency handle.
	 */
	private static function enqueue_external_scripts( int $post_id ): string {
		$external_scripts = External_Scripts::get_external_scripts( $post_id );
		if ( empty( $external_scripts ) ) {
			return '';
		}

		$dependency = '';
		foreach ( $external_scripts as $index => $script_url ) {
			if ( isset( self::$external_script_handles[ $script_url ] ) ) {
				$dependency = self::$external_script_handles[ $script_url ];
				continue;
			}
			$ext_handle = 'codellia-ext-' . $post_id . '-' . $index;
			$ext_deps   = $dependency ? array( $dependency ) : array();
			if ( ! wp_script_is( $ext_handle, 'registered' ) ) {
				wp_register_script( $ext_handle, $script_url, $ext_deps, CODELLIA_VERSION, true );
			}
			wp_enqueue_script( $ext_handle );
			self::$external_script_handles[ $script_url ] = $ext_handle;
			$dependency                                   = $ext_handle;
		}

		return $dependency;
	}

	/**
	 * Enqueue runtime script for executing Shadow DOM inline JS payloads.
	 */
	private static function enqueue_shadow_runtime(): void {
		if ( self::$shadow_runtime_enqueued ) {
			return;
		}
		self::$shadow_runtime_enqueued = true;

		$handle = 'codellia-shadow-runtime';
		if ( ! wp_script_is( $handle, 'registered' ) ) {
			wp_register_script(
				$handle,
				CODELLIA_URL . 'includes/shadow-runtime.js',
				array(),
				CODELLIA_VERSION,
				true
			);
		}
		wp_enqueue_script( $handle );
	}

	/**
	 * Enqueue CSS assets for non-shadow front-end rendering.
	 */
	public static function enqueue_css(): void {
		if ( is_admin() ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return;
		}

		if ( self::is_shadow_dom_enabled( $post_id ) ) {
			return;
		}

		$css             = self::get_css_for_post( $post_id );
		$external_styles = External_Styles::get_external_styles( $post_id );
		if ( '' === $css && empty( $external_styles ) ) {
			return;
		}

		$dependency = '';
		foreach ( $external_styles as $index => $style_url ) {
			$ext_handle = 'codellia-ext-style-' . $post_id . '-' . $index;
			$ext_deps   = $dependency ? array( $dependency ) : array();
			if ( ! wp_style_is( $ext_handle, 'registered' ) ) {
				wp_register_style( $ext_handle, $style_url, $ext_deps, CODELLIA_VERSION );
			}
			wp_enqueue_style( $ext_handle );
			$dependency = $ext_handle;
		}

		if ( '' === $css ) {
			return;
		}

		$handle = 'codellia';
		$deps   = $dependency ? array( $dependency ) : array();

		if ( ! wp_style_is( $handle, 'registered' ) ) {
			wp_register_style( $handle, false, $deps, CODELLIA_VERSION );
		}

		wp_enqueue_style( $handle );
		wp_add_inline_style( $handle, $css );
	}

	/**
	 * Enqueue JS assets for non-shadow front-end rendering.
	 */
	public static function enqueue_js(): void {
		if ( is_admin() ) {
			return;
		}
		if ( get_query_var( 'codellia_preview' ) ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! Post_Type::is_codellia_post( $post_id ) ) {
			return;
		}

		$js               = (string) get_post_meta( $post_id, '_codellia_js', true );
		$external_scripts = External_Scripts::get_external_scripts( $post_id );
		if ( '' === $js && empty( $external_scripts ) ) {
			return;
		}

		$dependency = self::enqueue_external_scripts( $post_id );

		if ( self::is_shadow_dom_enabled( $post_id ) ) {
			if ( '' !== $js ) {
				self::enqueue_shadow_runtime();
			}
			return;
		}

		$handle = 'codellia-js';
		if ( ! wp_script_is( $handle, 'registered' ) ) {
			$js_deps = $dependency ? array( $dependency ) : array();
			wp_register_script( $handle, false, $js_deps, CODELLIA_VERSION, true );
		}
		wp_enqueue_script( $handle );
		if ( '' !== $js ) {
			wp_add_inline_script( $handle, $js );
		}
	}
}
