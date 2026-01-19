<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Rest_Setup {
	public static function setup_mode( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'postId' ) );
		$mode    = sanitize_key( (string) $request->get_param( 'mode' ) );

		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid post type.',
			], 400 );
		}

		if ( $mode !== 'tailwind' && $mode !== 'normal' ) {
			return new \WP_REST_Response( [
				'ok'    => false,
				'error' => 'Invalid setup mode.',
			], 400 );
		}

		$tailwind_meta   = get_post_meta( $post_id, '_lc_tailwind', true );
		$tailwind_locked = get_post_meta( $post_id, '_lc_tailwind_locked', true ) === '1';
		$tailwind_enabled = $tailwind_meta === '1';

		if ( ! $tailwind_locked ) {
			$tailwind_enabled = $mode === 'tailwind';
			update_post_meta( $post_id, '_lc_tailwind', $tailwind_enabled ? '1' : '0' );
			update_post_meta( $post_id, '_lc_tailwind_locked', '1' );
			delete_post_meta( $post_id, '_lc_setup_required' );
		} else {
			delete_post_meta( $post_id, '_lc_setup_required' );
		}

		return new \WP_REST_Response( [
			'ok'              => true,
			'tailwindEnabled' => $tailwind_enabled,
		], 200 );
	}
}
