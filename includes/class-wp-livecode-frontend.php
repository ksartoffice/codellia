<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Frontend {
	public static function init(): void {
		add_action( 'wp', [ __CLASS__, 'maybe_disable_autop' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_css' ] );
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

		$css = (string) get_post_meta( $post_id, '_lc_css', true );
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
}
