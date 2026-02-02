<?php
/**
 * Uninstall handler for CodeNagi.
 *
 * @package CodeNagi
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$delete_data = get_option( 'codenagi_delete_on_uninstall', '0' );
if ( '1' !== $delete_data ) {
	return;
}

$posts = get_posts(
	array(
		'post_type'              => 'codenagi',
		'post_status'            => 'any',
		'posts_per_page'         => -1,
		'fields'                 => 'ids',
		'no_found_rows'          => true,
		'update_post_term_cache' => false,
		'update_post_meta_cache' => false,
		'suppress_filters'       => true,
	)
);

foreach ( $posts as $post_id ) {
	wp_delete_post( $post_id, true );
}

delete_option( 'codenagi_delete_on_uninstall' );
delete_option( 'codenagi_post_slug' );
delete_option( 'codenagi_flush_rewrite' );


