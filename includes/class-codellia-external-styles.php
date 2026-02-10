<?php
/**
 * External style helpers for Codellia.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and sanitizes external stylesheet URLs.
 */
class External_Styles {
	/**
	 * Fetch external styles list for a Codellia post.
	 *
	 * @param int      $post_id Codellia post ID.
	 * @param int|null $max     Optional max items.
	 * @return array
	 */
	public static function get_external_styles( int $post_id, ?int $max = null ): array {

		$raw  = get_post_meta( $post_id, '_codellia_external_styles', true );
		$list = array();
		if ( is_array( $raw ) ) {
			$list = $raw;
		} elseif ( is_string( $raw ) && '' !== $raw ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$list = $decoded;
			}
		}

		if ( null === $max ) {
			$max = Limits::MAX_EXTERNAL_STYLES;
		}

		return self::sanitize_list( $list, $max );
	}
	/**
	 * Validate a list of external stylesheet URLs.
	 *
	 * @param array       $raw   Raw list of URLs.
	 * @param int|null    $max   Optional max items.
	 * @param string|null $error Error message output.
	 * @return array|null
	 */
	public static function validate_list( array $raw, ?int $max = null, ?string &$error = null ): ?array {
		$sanitized = array();
		foreach ( array_values( $raw ) as $style_url ) {
			if ( ! is_string( $style_url ) ) {
				$error = __( 'Invalid externalStyles value.', 'codellia' );
				return null;
			}
			$style_url = trim( $style_url );
			if ( '' === $style_url ) {
				continue;
			}
			$clean_url = self::sanitize_url( $style_url );
			if ( ! $clean_url ) {
				$error = __( 'External styles must be valid https:// URLs.', 'codellia' );
				return null;
			}
			$sanitized[] = $clean_url;
		}

		$sanitized = array_values( array_unique( $sanitized ) );
		if ( null !== $max && $max < count( $sanitized ) ) {
			$error = __( 'External styles exceed the maximum allowed.', 'codellia' );
			return null;
		}

		return $sanitized;
	}

	/**
	 * Sanitize a list of external stylesheet URLs.
	 *
	 * @param array    $raw Raw list of URLs.
	 * @param int|null $max Optional max items.
	 * @return array
	 */
	public static function sanitize_list( array $raw, ?int $max = null ): array {
		$sanitized = array();
		foreach ( array_values( $raw ) as $style_url ) {
			if ( ! is_string( $style_url ) ) {
				continue;
			}
			$style_url = trim( $style_url );
			if ( '' === $style_url ) {
				continue;
			}
			$clean_url = self::sanitize_url( $style_url );
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
