<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest_Preview {
	/**
	 * Render shortcode blocks on the server and return rendered HTML mapped to an id.
	 */
	public static function render_shortcodes( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$items   = $request->get_param( 'shortcodes' );

		if ( ! $post_id || ! Post_Type::is_livecode_post( $post_id ) || ! $items || ! is_array( $items ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid parameters.',
			], 400 );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Post not found.',
			], 404 );
		}

		$results   = [];
		$cache_map = [];

		$previous_post = $GLOBALS['post'] ?? null;
		setup_postdata( $post );

		foreach ( $items as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$id        = isset( $entry['id'] ) ? sanitize_key( (string) $entry['id'] ) : '';
			$shortcode = isset( $entry['shortcode'] ) ? (string) $entry['shortcode'] : '';

			if ( $id === '' ) {
				continue;
			}

			if ( $shortcode === '' ) {
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

		if ( $previous_post instanceof \WP_Post ) {
			$GLOBALS['post'] = $previous_post;
			setup_postdata( $previous_post );
		} else {
			wp_reset_postdata();
		}

		return new \WP_REST_Response( [
			'ok'      => true,
			'results' => $results,
		], 200 );
	}
}
