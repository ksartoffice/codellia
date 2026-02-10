<?php
/**
 * Frame layout template for Codellia.
 *
 * @package Codellia
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter(
	'body_class',
	static function ( $classes ) {
		$classes[] = 'codellia-layout-frame';
		return $classes;
	}
);

get_header();
while ( have_posts() ) :
	the_post();
	the_content();
endwhile;

get_footer();
