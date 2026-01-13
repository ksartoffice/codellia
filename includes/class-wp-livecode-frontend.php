<?php
namespace WPLiveCode;

use TailwindPHP\tw;

if ( ! defined( 'ABSPATH' ) ) exit;

class Frontend {
	public static function init(): void {
		add_action( 'wp', [ __CLASS__, 'maybe_disable_autop' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_css' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_js' ] );
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

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return;
		}

		if ( has_filter( 'the_content', 'wpautop' ) ) {
			remove_filter( 'the_content', 'wpautop' );
		}
		if ( has_filter( 'the_content', 'shortcode_unautop' ) ) {
			remove_filter( 'the_content', 'shortcode_unautop' );
		}
	}

	public static function enqueue_css(): void {
		if ( is_admin() ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return;
		}

		$is_tailwind   = get_post_meta( $post_id, '_lc_tailwind', true ) === '1';
		$stored_css    = (string) get_post_meta( $post_id, '_lc_css', true );
		$generated_css = (string) get_post_meta( $post_id, '_lc_generated_css', true );
		$css           = $is_tailwind ? $generated_css : $stored_css;

		$has_unescaped_arbitrary = ! $is_tailwind && $stored_css !== '' && strpos( $stored_css, '-[' ) !== false && strpos( $stored_css, '-\\[' ) === false;
		$should_compile          = ! $is_tailwind && $has_unescaped_arbitrary;

		if ( $should_compile ) {
			$post = get_post( $post_id );
			if ( $post instanceof \WP_Post ) {
				try {
					$css = tw::generate( [
						'content' => (string) $post->post_content,
						'css'     => '@import "tailwindcss";',
					] );
				} catch ( \Throwable $e ) {
					$css = $stored_css;
				}
			}
		}

		if ( $css === '' ) {
			return;
		}

		$handle = 'wp-livecode';

		if ( ! wp_style_is( $handle, 'registered' ) ) {
			wp_register_style( $handle, false, [], WP_LIVECODE_VERSION );
		}

		wp_enqueue_style( $handle );
		wp_add_inline_style( $handle, $css );
	}

	public static function enqueue_js(): void {
		if ( is_admin() ) {
			return;
		}
		if ( get_query_var( 'lc_preview' ) ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return;
		}

		$js_enabled = get_post_meta( $post_id, '_lc_js_enabled', true ) === '1';
		$js = (string) get_post_meta( $post_id, '_lc_js', true );
		$external_scripts = self::get_external_scripts( $post_id );
		if ( ! $js_enabled || ( $js === '' && empty( $external_scripts ) ) ) {
			return;
		}

		$dependency = '';
		foreach ( $external_scripts as $index => $script_url ) {
			$ext_handle = 'wp-livecode-ext-' . $post_id . '-' . $index;
			$ext_deps = $dependency ? [ $dependency ] : [];
			if ( ! wp_script_is( $ext_handle, 'registered' ) ) {
				wp_register_script( $ext_handle, $script_url, $ext_deps, null, true );
			}
			wp_enqueue_script( $ext_handle );
			$dependency = $ext_handle;
		}

		$handle = 'wp-livecode-js';
		if ( ! wp_script_is( $handle, 'registered' ) ) {
			$js_deps = $dependency ? [ $dependency ] : [];
			wp_register_script( $handle, false, $js_deps, WP_LIVECODE_VERSION, true );
		}
		wp_enqueue_script( $handle );
		if ( $js !== '' ) {
			wp_add_inline_script( $handle, $js );
		}
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

		return array_values( array_unique( $clean ) );
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
}
