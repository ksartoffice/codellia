<?php
/**
 * Full width layout template for Codellia.
 *
 * @package Codellia
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<style>
	.codellia-layout-fullwidth {
		width: 100%;
		max-width: none;
		margin: 0;
		padding: 0;
	}
	.codellia-layout-fullwidth .codellia-content {
		width: 100%;
		max-width: none;
		margin: 0 auto;
		padding: 0;
	}
</style>
<main class="codellia-layout-fullwidth">
	<div class="codellia-content">
		<?php
		while ( have_posts() ) :
			the_post();
			the_content();
		endwhile;
		?>
	</div>
</main>
<?php
get_footer();
