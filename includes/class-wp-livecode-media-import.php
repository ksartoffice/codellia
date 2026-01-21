<?php
/**
 * External media import utilities.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles importing external images into the media library.
 */
class Media_Import {
	private const SOURCE_URL_META_KEY = '_lc_source_url';

	/**
	 * Import external images referenced in HTML and rewrite URLs.
	 *
	 * @param string $html     HTML to scan.
	 * @param int    $post_id  LiveCode post ID.
	 * @param array  $warnings Output warnings.
	 * @param array  $imported Output imported image data.
	 * @return string
	 */
	public static function localize_external_images(
		string $html,
		int $post_id,
		array &$warnings = array(),
		array &$imported = array()
	): string {
		if ( '' === $html ) {
			return $html;
		}

		if ( class_exists( '\WP_HTML_Tag_Processor' ) ) {
			return self::localize_with_tag_processor( $html, $post_id, $warnings, $imported );
		}

		$warnings[] = __( 'HTML parser unavailable; external images were not imported.', 'wp-livecode' );
		return $html;
	}

	/**
	 * Localize images using WP_HTML_Tag_Processor.
	 *
	 * @param string $html     HTML to scan.
	 * @param int    $post_id  LiveCode post ID.
	 * @param array  $warnings Output warnings.
	 * @param array  $imported Output imported image data.
	 * @return string
	 */
	private static function localize_with_tag_processor(
		string $html,
		int $post_id,
		array &$warnings,
		array &$imported
	): string {
		$processor = new \WP_HTML_Tag_Processor( $html );
		$site_host = self::get_site_host();
		$cache     = array();

		while ( $processor->next_tag( 'img' ) ) {
			$src        = $processor->get_attribute( 'src' );
			$srcset     = $processor->get_attribute( 'srcset' );
			$source_url = self::pick_external_source_url( $src, $srcset, $site_host );
			if ( ! $source_url ) {
				continue;
			}

			$result = self::import_external_image( $source_url, $post_id, $cache, $warnings, $imported );
			if ( ! $result ) {
				continue;
			}

			$processor->set_attribute( 'src', $result['url'] );
			if ( '' !== $result['srcset'] ) {
				$processor->set_attribute( 'srcset', $result['srcset'] );
			} else {
				$processor->remove_attribute( 'srcset' );
			}
		}

		return $processor->get_updated_html();
	}

	/**
	 * Download an external image and attach it to the post.
	 *
	 * @param string $source_url Source image URL.
	 * @param int    $post_id    LiveCode post ID.
	 * @param array  $cache      Cached URL-to-attachment map.
	 * @param array  $warnings   Output warnings.
	 * @param array  $imported   Output imported image data.
	 * @return array|null
	 */
	private static function import_external_image(
		string $source_url,
		int $post_id,
		array &$cache,
		array &$warnings,
		array &$imported
	): ?array {
		$normalized = self::normalize_url( $source_url );
		if ( '' === $normalized ) {
			$warnings[] = __( 'Skipped invalid image URL.', 'wp-livecode' );
			return null;
		}

		if ( array_key_exists( $normalized, $cache ) ) {
			$cached_id = (int) $cache[ $normalized ];
			return $cached_id ? self::build_image_payload( $cached_id, $normalized, $imported ) : null;
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			$warnings[]           = sprintf(
				/* translators: %s: image URL. */
				__( 'Skipping image import (missing upload_files): %s', 'wp-livecode' ),
				$normalized
			);
			$cache[ $normalized ] = 0;
			return null;
		}

		$existing_id = self::find_attachment_by_source_url( $normalized );
		if ( $existing_id ) {
			$cache[ $normalized ] = (int) $existing_id;
			return self::build_image_payload( (int) $existing_id, $normalized, $imported );
		}

		self::ensure_media_dependencies();
		$temp_file = download_url( $normalized, 30 );
		if ( is_wp_error( $temp_file ) ) {
			$warnings[]           = sprintf(
				/* translators: 1: image URL, 2: error message. */
				__( 'Failed to download image: %1$s (%2$s)', 'wp-livecode' ),
				$normalized,
				$temp_file->get_error_message()
			);
			$cache[ $normalized ] = 0;
			return null;
		}

		$filename = self::build_filename_from_url( $normalized );
		$filename = self::ensure_filename_extension( $filename, $temp_file, $normalized, $warnings );

		$file_array = array(
			'name'     => $filename,
			'tmp_name' => $temp_file,
		);

		$attachment_id = media_handle_sideload( $file_array, $post_id );
		if ( is_wp_error( $attachment_id ) ) {
			wp_delete_file( $temp_file );
			$warnings[]           = sprintf(
				/* translators: 1: image URL, 2: error message. */
				__( 'Failed to sideload image: %1$s (%2$s)', 'wp-livecode' ),
				$normalized,
				$attachment_id->get_error_message()
			);
			$cache[ $normalized ] = 0;
			return null;
		}

		update_post_meta( (int) $attachment_id, self::SOURCE_URL_META_KEY, $normalized );
		$cache[ $normalized ] = (int) $attachment_id;

		return self::build_image_payload( (int) $attachment_id, $normalized, $imported );
	}

	/**
	 * Build response payload for an imported attachment.
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $source_url    Original source URL.
	 * @param array  $imported      Output imported image data.
	 * @return array|null
	 */
	private static function build_image_payload(
		int $attachment_id,
		string $source_url,
		array &$imported
	): ?array {
		$attachment_url = wp_get_attachment_image_url( $attachment_id, 'full' );
		if ( ! $attachment_url ) {
			return null;
		}

		$srcset = wp_get_attachment_image_srcset( $attachment_id, 'full' );
		if ( ! is_string( $srcset ) ) {
			$srcset = '';
		}

		$imported[] = array(
			'sourceUrl'     => $source_url,
			'attachmentId'  => $attachment_id,
			'attachmentUrl' => $attachment_url,
		);

		return array(
			'id'     => $attachment_id,
			'url'    => $attachment_url,
			'srcset' => $srcset,
		);
	}

	/**
	 * Find an attachment by the stored source URL.
	 *
	 * @param string $source_url Original source URL.
	 * @return int|null
	 */
	private static function find_attachment_by_source_url( string $source_url ): ?int {
		$matches = get_posts(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'meta_key'       => self::SOURCE_URL_META_KEY,
				'meta_value'     => $source_url,
			)
		);

		if ( empty( $matches ) ) {
			return null;
		}

		return (int) $matches[0];
	}

	/**
	 * Pick the best external source URL from img src/srcset.
	 *
	 * @param string|null $src       src attribute.
	 * @param string|null $srcset    srcset attribute.
	 * @param string      $site_host Current site host.
	 * @return string|null
	 */
	private static function pick_external_source_url(
		?string $src,
		?string $srcset,
		string $site_host
	): ?string {
		$src    = is_string( $src ) ? $src : '';
		$srcset = is_string( $srcset ) ? $srcset : '';

		if ( '' !== $src && self::is_external_url( $src, $site_host ) ) {
			return $src;
		}

		if ( '' === $srcset ) {
			return null;
		}

		$candidate = self::pick_srcset_candidate( $srcset, $site_host );
		if ( $candidate && self::is_external_url( $candidate, $site_host ) ) {
			return $candidate;
		}

		return null;
	}

	/**
	 * Pick a candidate URL from srcset for external import.
	 *
	 * @param string $srcset    srcset attribute.
	 * @param string $site_host Current site host.
	 * @return string|null
	 */
	private static function pick_srcset_candidate( string $srcset, string $site_host ): ?string {
		$best_width_url   = null;
		$best_width       = 0;
		$best_density_url = null;
		$best_density     = 0.0;
		$fallback         = null;

		foreach ( explode( ',', $srcset ) as $item ) {
			$item = trim( $item );
			if ( '' === $item ) {
				continue;
			}

			$parts = preg_split( '/\s+/', $item );
			if ( ! $parts || ! isset( $parts[0] ) ) {
				continue;
			}

			$url = $parts[0];
			if ( ! self::is_external_url( $url, $site_host ) ) {
				continue;
			}

			if ( null === $fallback ) {
				$fallback = $url;
			}

			$descriptor = $parts[1] ?? '';
			if ( preg_match( '/^(\d+)w$/', $descriptor, $match ) ) {
				$width = (int) $match[1];
				if ( $width > $best_width ) {
					$best_width     = $width;
					$best_width_url = $url;
				}
				continue;
			}

			if ( preg_match( '/^(\d+(?:\.\d+)?)x$/', $descriptor, $match ) ) {
				$density = (float) $match[1];
				if ( $density > $best_density ) {
					$best_density     = $density;
					$best_density_url = $url;
				}
			}
		}

		if ( $best_width_url ) {
			return $best_width_url;
		}

		if ( $best_density_url ) {
			return $best_density_url;
		}

		return $fallback;
	}

	/**
	 * Determine if a URL points to an external host.
	 *
	 * @param string $url       URL to check.
	 * @param string $site_host Current site host.
	 * @return bool
	 */
	private static function is_external_url( string $url, string $site_host ): bool {
		$normalized = self::normalize_url( $url );
		if ( '' === $normalized ) {
			return false;
		}

		if ( ! wp_http_validate_url( $normalized ) ) {
			return false;
		}

		$parts = wp_parse_url( $normalized );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return false;
		}

		$scheme = isset( $parts['scheme'] ) ? strtolower( $parts['scheme'] ) : '';
		if ( 'http' !== $scheme && 'https' !== $scheme ) {
			return false;
		}

		return strtolower( $parts['host'] ) !== $site_host;
	}

	/**
	 * Normalize a URL for comparison.
	 *
	 * @param string $url URL to normalize.
	 * @return string
	 */
	private static function normalize_url( string $url ): string {
		$url = trim( html_entity_decode( $url, ENT_QUOTES, 'UTF-8' ) );
		if ( '' === $url ) {
			return '';
		}

		if ( 0 === strpos( $url, '//' ) ) {
			$url = 'https:' . $url;
		}

		return esc_url_raw( $url );
	}

	/**
	 * Return the current site host name.
	 *
	 * @return string
	 */
	private static function get_site_host(): string {
		$parts = wp_parse_url( home_url() );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
			return '';
		}

		return strtolower( $parts['host'] );
	}

	/**
	 * Build a filename from a URL path.
	 *
	 * @param string $url Source URL.
	 * @return string
	 */
	private static function build_filename_from_url( string $url ): string {
		$path     = wp_parse_url( $url, PHP_URL_PATH );
		$filename = $path ? wp_basename( $path ) : '';
		$filename = sanitize_file_name( $filename );

		if ( '' === $filename ) {
			$filename = 'imported-image';
		}

		return $filename;
	}

	/**
	 * Ensure the filename has a valid image extension.
	 *
	 * @param string $filename   Base filename.
	 * @param string $file       Temporary file path.
	 * @param string $source_url Original source URL.
	 * @param array  $warnings   Output warnings.
	 * @return string
	 */
	private static function ensure_filename_extension(
		string $filename,
		string $file,
		string $source_url,
		array &$warnings
	): string {
		if ( preg_match( '/\.[a-zA-Z0-9]{2,10}$/', $filename ) ) {
			return $filename;
		}

		$mime = wp_get_image_mime( $file );
		if ( ! $mime ) {
			$warnings[] = sprintf(
				/* translators: %s: image URL. */
				__( 'Unable to detect image type: %s', 'wp-livecode' ),
				$source_url
			);
			return $filename;
		}

		$ext = wp_get_default_extension_for_mime_type( $mime );
		if ( ! $ext ) {
			$warnings[] = sprintf(
				/* translators: 1: mime type, 2: image URL. */
				__( 'Unsupported image type (%1$s): %2$s', 'wp-livecode' ),
				$mime,
				$source_url
			);
			return $filename;
		}

		return $filename . '.' . $ext;
	}

	/**
	 * Load media handling dependencies.
	 */
	private static function ensure_media_dependencies(): void {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
	}
}
