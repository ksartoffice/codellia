<?php
/**
 * Front-end external asset safety tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Frontend;
use Codellia\Post_Type;

class Test_Frontend_Assets_Safety extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}
	}

	public function test_frontend_filters_invalid_external_assets(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );
		$post     = get_post( $post_id );

		$this->assertInstanceOf( WP_Post::class, $post );

		update_post_meta( $post_id, '_codellia_shadow_dom', '1' );

		update_post_meta(
			$post_id,
			'_codellia_external_scripts',
			wp_json_encode(
				array(
					'http://example.com/bad.js',
					'https://example.com/good.js',
					'javascript:alert(1)',
				),
				JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
			)
		);

		update_post_meta(
			$post_id,
			'_codellia_external_styles',
			wp_json_encode(
				array(
					'http://example.com/bad.css',
					'https://example.com/good.css',
					'javascript:alert(2)',
				),
				JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
			)
		);

		global $wp_query;
		$original_wp_query = $wp_query ?? null;
		$wp_query          = new WP_Query();
		$wp_query->queried_object_id = $post_id;
		$wp_query->queried_object    = $post;

		$output = Frontend::filter_content( (string) $post->post_content );

		if ( null !== $original_wp_query ) {
			$wp_query = $original_wp_query;
		} else {
			unset( $wp_query );
		}

		$this->assertStringContainsString( 'https://example.com/good.js', $output, 'Valid https scripts should render.' );
		$this->assertStringContainsString( 'https://example.com/good.css', $output, 'Valid https styles should render.' );
		$this->assertStringNotContainsString( 'http://example.com/bad.js', $output, 'Invalid script URLs should be filtered.' );
		$this->assertStringNotContainsString( 'http://example.com/bad.css', $output, 'Invalid style URLs should be filtered.' );
		$this->assertStringNotContainsString( 'javascript:', $output, 'javascript: URLs should be filtered.' );
	}

	private function create_codellia_post( int $author_id ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'    => Post_Type::POST_TYPE,
				'post_status'  => 'publish',
				'post_author'  => $author_id,
				'post_content' => '<p>Codellia content</p>',
			)
		);
	}
}
