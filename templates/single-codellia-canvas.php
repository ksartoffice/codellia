<?php
/**
 * Canvas layout template for Codellia.
 *
 * @package Codellia
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'codellia-layout-canvas' ); ?>>
	<?php wp_body_open(); ?>
	<main class="codellia-canvas">
		<?php
		while ( have_posts() ) :
			the_post();
			the_content();
		endwhile;
		?>
	</main>
	<?php wp_footer(); ?>
</body>
</html>
