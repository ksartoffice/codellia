<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Preview {
	private static ?int $post_id = null;
	private static bool $is_preview = false;

	public static function init(): void {
		add_filter( 'query_vars', [ __CLASS__, 'register_query_vars' ] );
		add_action( 'template_redirect', [ __CLASS__, 'maybe_handle_preview' ] );
		add_filter( 'the_content', [ __CLASS__, 'filter_content' ], 0 );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
	}

	public static function register_query_vars( array $vars ): array {
		$vars[] = 'lc_preview';
		$vars[] = 'post_id';
		$vars[] = 'token';
		return $vars;
	}

	private static function is_preview_request(): bool {
		return (bool) get_query_var( 'lc_preview' );
	}

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

		if ( ! get_post( $post_id ) ) {
			wp_die( 'Post not found.' );
		}

		self::$post_id = $post_id;
		self::$is_preview = true;

		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		nocache_headers();
	}

	public static function filter_content( string $content ): string {
		if ( ! self::$is_preview ) {
			return $content;
		}

		if ( ! is_main_query() || ! in_the_loop() ) {
			return $content;
		}

		return '<div id="lc-root"></div>';
	}

	public static function enqueue_assets(): void {
		if ( ! self::$is_preview ) {
			return;
		}

		wp_enqueue_script(
			'wp-livecode-preview',
			WP_LIVECODE_URL . 'includes/preview.js',
			[],
			WP_LIVECODE_VERSION,
			true
		);

		$admin_origin = self::build_admin_origin();
		$payload = [
			'allowedOrigin' => $admin_origin,
			'postId'        => self::$post_id,
		];

		wp_add_inline_script(
			'wp-livecode-preview',
			'window.WP_LIVECODE_PREVIEW = ' . wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . ';',
			'before'
		);
	}

	private static function build_admin_origin(): string {
		$admin_url = admin_url();
		$parts = wp_parse_url( $admin_url );
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
