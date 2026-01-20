<?php
/**
 * External script helpers for WP LiveCode.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and sanitizes external script URLs.
 */
class External_Scripts {
	/**
	 * Fetch external scripts list for a LiveCode post.
	 *
	 * @param int      $post_id LiveCode post ID.
	 * @param int|null $max     Optional max items.
	 * @return array
	 */
	public static function get_external_scripts( int $post_id, ?int $max = null ): array {
		$raw  = get_post_meta( $post_id, '_lc_external_scripts', true );
		$list = array();

		if ( is_array( $raw ) ) {
			$list = $raw;
		} elseif ( is_string( $raw ) && '' !== $raw ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$list = $decoded;
			}
		}

		return self::sanitize_list( $list, $max );
	}

	/**
	 * Validate a list of external script URLs.
	 *
	 * @param array       $raw   Raw list of URLs.
	 * @param int|null    $max   Optional max items.
	 * @param string|null $error Error message output.
	 * @return array|null
	 */
	public static function validate_list( array $raw, ?int $max = null, ?string &$error = null ): ?array {
		$sanitized = array();
		foreach ( array_values( $raw ) as $script_url ) {
			if ( ! is_string( $script_url ) ) {
				$error = 'Invalid externalScripts value.';
				return null;
			}
			$script_url = trim( $script_url );
			if ( '' === $script_url ) {
				continue;
			}
			$clean_url = self::sanitize_url( $script_url );
			if ( ! $clean_url ) {
				$error = 'External scripts must be valid https:// URLs.';
				return null;
			}
			$sanitized[] = $clean_url;
		}

		$sanitized = array_values( array_unique( $sanitized ) );
		if ( null !== $max && $max < count( $sanitized ) ) {
			$error = 'External scripts exceed the maximum allowed.';
			return null;
		}

		return $sanitized;
	}

	/**
	 * Sanitize a list of external script URLs.
	 *
	 * @param array    $raw Raw list of URLs.
	 * @param int|null $max Optional max items.
	 * @return array
	 */
	public static function sanitize_list( array $raw, ?int $max = null ): array {
		$sanitized = array();
		foreach ( array_values( $raw ) as $script_url ) {
			if ( ! is_string( $script_url ) ) {
				continue;
			}
			$script_url = trim( $script_url );
			if ( '' === $script_url ) {
				continue;
			}
			$clean_url = self::sanitize_url( $script_url );
			if ( $clean_url ) {
				$sanitized[] = $clean_url;
			}
		}

		$sanitized = array_values( array_unique( $sanitized ) );
		if ( null !== $max && $max < count( $sanitized ) ) {
			$sanitized = array_slice( $sanitized, 0, $max );
		}

		return $sanitized;
	}

	/**
	 * Sanitize and validate a single external URL.
	 *
	 * @param string $url URL to sanitize.
	 * @return string|null
	 */
	private static function sanitize_url( string $url ): ?string {
		$url = trim( $url );
		if ( '' === $url ) {
			return null;
		}

		$validated = wp_http_validate_url( $url );
		if ( ! $validated ) {
			return null;
		}

		$parts  = wp_parse_url( $validated );
		$scheme = isset( $parts['scheme'] ) ? strtolower( $parts['scheme'] ) : '';
		if ( 'https' !== $scheme ) {
			return null;
		}

		return esc_url_raw( $validated );
	}
}
