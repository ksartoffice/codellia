<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class External_Styles {
	public static function get_external_styles( int $post_id, ?int $max = null ): array {
		$raw = get_post_meta( $post_id, '_lc_external_styles', true );
		$list = [];

		if ( is_array( $raw ) ) {
			$list = $raw;
		} elseif ( is_string( $raw ) && $raw !== '' ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$list = $decoded;
			}
		}

		return self::sanitize_list( $list, $max );
	}

	public static function validate_list( array $raw, ?int $max = null, ?string &$error = null ): ?array {
		$sanitized = [];
		foreach ( array_values( $raw ) as $style_url ) {
			if ( ! is_string( $style_url ) ) {
				$error = 'Invalid externalStyles value.';
				return null;
			}
			$style_url = trim( $style_url );
			if ( $style_url === '' ) {
				continue;
			}
			$clean_url = self::sanitize_url( $style_url );
			if ( ! $clean_url ) {
				$error = 'External styles must be valid https:// URLs.';
				return null;
			}
			$sanitized[] = $clean_url;
		}

		$sanitized = array_values( array_unique( $sanitized ) );
		if ( null !== $max && count( $sanitized ) > $max ) {
			$error = 'External styles exceed the maximum allowed.';
			return null;
		}

		return $sanitized;
	}

	public static function sanitize_list( array $raw, ?int $max = null ): array {
		$sanitized = [];
		foreach ( array_values( $raw ) as $style_url ) {
			if ( ! is_string( $style_url ) ) {
				continue;
			}
			$style_url = trim( $style_url );
			if ( $style_url === '' ) {
				continue;
			}
			$clean_url = self::sanitize_url( $style_url );
			if ( $clean_url ) {
				$sanitized[] = $clean_url;
			}
		}

		$sanitized = array_values( array_unique( $sanitized ) );
		if ( null !== $max && count( $sanitized ) > $max ) {
			$sanitized = array_slice( $sanitized, 0, $max );
		}

		return $sanitized;
	}

	private static function sanitize_url( string $url ): ?string {
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
