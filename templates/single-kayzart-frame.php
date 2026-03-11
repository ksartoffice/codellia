<?php
/**
 * Frame layout template for KayzArt.
 *
 * @package KayzArt
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter(
	'body_class',
	static function ( $classes ) {
		$classes[] = 'kayzart-layout-frame';
		return $classes;
	}
);

get_header();
while ( have_posts() ) :
	the_post();
	the_content();
endwhile;

get_footer();
