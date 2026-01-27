<?php
/**
 * Uninstall handler for WP LiveCode.
 *
 * @package WP_LiveCode
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$delete_data = get_option( 'wp_livecode_delete_on_uninstall', '0' );
if ( '1' !== $delete_data ) {
	return;
}

$posts = get_posts(
	array(
		'post_type'              => 'wp_livecode',
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

delete_option( 'wp_livecode_delete_on_uninstall' );
delete_option( 'wp_livecode_post_slug' );
delete_option( 'wp_livecode_flush_rewrite' );
