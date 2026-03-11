<?php
/**
 * Standalone layout template for CazeArt.
 *
 * @package CazeArt
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<?php wp_head(); ?>
	<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body <?php body_class( 'cazeart-layout-standalone' ); ?>>
	<?php wp_body_open(); ?>
	<?php
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	?>
	<?php wp_footer(); ?>
</body>
</html>
