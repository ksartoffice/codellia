<?php
/**
 * Front-end preview handling for WP LiveCode.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles preview rendering and asset setup.
 */
class Preview {
	/**
	 * Current preview post ID.
	 *
	 * @var int|null
	 */
	private static ?int $post_id = null;

	/**
	 * Whether the current request is a preview.
	 *
	 * @var bool
	 */
	private static bool $is_preview = false;
	private const MARKER_START      = 'wp-livecode:start';
	private const MARKER_END        = 'wp-livecode:end';

	/**
	 * Register preview hooks.
	 */
	public static function init(): void {
		add_filter( 'query_vars', array( __CLASS__, 'register_query_vars' ) );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_handle_preview' ) );
		add_filter( 'the_content', array( __CLASS__, 'filter_content' ), 0 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
	}

	/**
	 * Register query vars used by preview.
	 *
	 * @param array $vars Query vars.
	 * @return array
	 */
	public static function register_query_vars( array $vars ): array {
		$vars[] = 'lc_preview';
		$vars[] = 'post_id';
		$vars[] = 'token';
		return $vars;
	}

	/**
	 * Check whether the current request is a preview.
	 *
	 * @return bool
	 */
	private static function is_preview_request(): bool {
		return (bool) get_query_var( 'lc_preview' );
	}

	/**
	 * Handle preview request setup.
	 */
	public static function maybe_handle_preview(): void {
		if ( ! self::is_preview_request() ) {
			return;
		}

		$post_id = absint( get_query_var( 'post_id' ) );
		$token   = (string) get_query_var( 'token' );

		if ( ! $post_id ) {
			wp_die( 'post_id is required.' );
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( 'Permission denied.' );
		}

		if ( ! wp_verify_nonce( $token, 'lc_preview_' . $post_id ) ) {
			wp_die( 'Invalid preview token.' );
		}

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			wp_die( 'Invalid post type.' );
		}

		if ( ! get_post( $post_id ) ) {
			wp_die( 'Post not found.' );
		}

		self::$post_id    = $post_id;
		self::$is_preview = true;

		// Disable auto formatting so markers are not wrapped in <p> tags.
		if ( has_filter( 'the_content', 'wpautop' ) ) {
			remove_filter( 'the_content', 'wpautop' );
		}
		if ( has_filter( 'the_content', 'shortcode_unautop' ) ) {
			remove_filter( 'the_content', 'shortcode_unautop' );
		}

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		nocache_headers();
	}

	/**
	 * Wrap preview content in marker comments.
	 *
	 * @param string $content Post content.
	 * @return string
	 */
	public static function filter_content( string $content ): string {
		if ( ! self::$is_preview ) {
			return $content;
		}

		if ( ! is_main_query() || ! in_the_loop() ) {
			return $content;
		}

		return sprintf(
			'<!--%s-->%s<!--%s-->',
			self::MARKER_START,
			$content,
			self::MARKER_END
		);
	}

	/**
	 * Enqueue preview assets and payload.
	 */
	public static function enqueue_assets(): void {
		if ( ! self::$is_preview ) {
			return;
		}

		wp_enqueue_script(
			'wp-livecode-preview',
			WP_LIVECODE_URL . 'includes/preview.js',
			array(),
			WP_LIVECODE_VERSION,
			true
		);

		$admin_origin           = self::build_admin_origin();
		$highlight_meta         = get_post_meta( self::$post_id, '_lc_live_highlight', true );
		$live_highlight_enabled = '' === $highlight_meta ? true : rest_sanitize_boolean( $highlight_meta );
		$payload                = array(
			'allowedOrigin'        => $admin_origin,
			'postId'               => self::$post_id,
			'liveHighlightEnabled' => $live_highlight_enabled,
			'markers'              => array(
				'start' => self::MARKER_START,
				'end'   => self::MARKER_END,
			),
			'renderRestUrl'        => rest_url( 'wp-livecode/v1/render-shortcodes' ),
			'restNonce'            => wp_create_nonce( 'wp_rest' ),
		);

		wp_add_inline_script(
			'wp-livecode-preview',
			'window.WP_LIVECODE_PREVIEW = ' . wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . ';',
			'before'
		);
	}

	/**
	 * Build admin origin for preview postMessage validation.
	 *
	 * @return string
	 */
	private static function build_admin_origin(): string {
		$admin_url = admin_url();
		$parts     = wp_parse_url( $admin_url );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return home_url();
		}
		$origin = $parts['scheme'] . '://' . $parts['host'];
		if ( ! empty( $parts['port'] ) ) {
			$origin .= ':' . $parts['port'];
		}
		return $origin;
	}
}
