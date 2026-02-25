<?php
/**
 * REST handlers for preview rendering.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST callbacks for rendering shortcodes.
 */
class Rest_Preview {
	/**
	 * Render shortcode blocks on the server and return rendered HTML mapped to an id.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response
	 */
	public static function render_shortcodes( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id      = absint( $request->get_param( 'post_id' ) );
		$context_html = $request->get_param( 'context_html' );
		$items        = $request->get_param( 'shortcodes' );

		if ( ! $post_id || ! Post_Type::is_codellia_post( $post_id ) || ! $items || ! is_array( $items ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid parameters.', 'codellia' ),
				),
				400
			);
		}

		if ( count( $items ) > Limits::MAX_RENDER_SHORTCODES ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Too many shortcodes requested.', 'codellia' ),
				),
				400
			);
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Post not found.', 'codellia' ),
				),
				404
			);
		}

		$results                  = array();
		$cache_map                = array();
		$render_post              = $post;
		$had_original_global_post = array_key_exists( 'post', $GLOBALS );
		$original_global_post     = $had_original_global_post ? $GLOBALS['post'] : null;

		if ( is_string( $context_html ) && '' !== $context_html ) {
			$render_post               = clone $post;
			$render_post->post_content = $context_html;
		}

		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Shortcode callbacks may read global $post; this temporary swap is restored in finally.
		$GLOBALS['post'] = $render_post;
		setup_postdata( $render_post );

		try {
			foreach ( $items as $entry ) {
				if ( ! is_array( $entry ) ) {
					continue;
				}
				$id        = isset( $entry['id'] ) ? sanitize_key( (string) $entry['id'] ) : '';
				$shortcode = isset( $entry['shortcode'] ) ? (string) $entry['shortcode'] : '';

				if ( '' === $id ) {
					continue;
				}

				if ( '' === $shortcode ) {
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
		} finally {
			wp_reset_postdata();
			if ( $had_original_global_post ) {
				// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restore the exact pre-render global state to avoid leaking context.
				$GLOBALS['post'] = $original_global_post;
			} else {
				unset( $GLOBALS['post'] );
			}
		}

		return new \WP_REST_Response(
			array(
				'ok'      => true,
				'results' => $results,
			),
			200
		);
	}
}
