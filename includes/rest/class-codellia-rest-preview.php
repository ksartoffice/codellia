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
		$post_id = absint( $request->get_param( 'post_id' ) );
		$items   = $request->get_param( 'shortcodes' );

		if ( ! $post_id || ! Post_Type::is_codellia_post( $post_id ) || ! $items || ! is_array( $items ) ) {
			return new \WP_REST_Response(
				array(
					'ok'    => false,
					'error' => __( 'Invalid parameters.', 'codellia' ),
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

		$results   = array();
		$cache_map = array();

		setup_postdata( $post );

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

		wp_reset_postdata();

		return new \WP_REST_Response(
			array(
				'ok'      => true,
				'results' => $results,
			),
			200
		);
	}
}
