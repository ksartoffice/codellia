<?php
/**
 * Uninstall handler for CazeArt.
 *
 * @package CazeArt
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$cazeart_delete_data = get_option( 'cazeart_delete_on_uninstall', '0' );
if ( '1' !== $cazeart_delete_data ) {
	return;
}

$posts = get_posts(
	array(
		'post_type'              => 'cazeart',
		'post_status'            => 'any',
		'posts_per_page'         => -1,
		'fields'                 => 'ids',
		'no_found_rows'          => true,
		'update_post_term_cache' => false,
		'update_post_meta_cache' => false,
	)
);

foreach ( $posts as $post_id ) {
	wp_delete_post( $post_id, true );
}

delete_option( 'cazeart_delete_on_uninstall' );
delete_option( 'cazeart_post_slug' );
delete_option( 'cazeart_flush_rewrite' );
