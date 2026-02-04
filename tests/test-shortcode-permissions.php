<?php
/**
 * Shortcode permission tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Frontend;
use Codellia\Post_Type;

class Test_Shortcode_Permissions extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}

		if ( ! shortcode_exists( 'codellia' ) ) {
			Frontend::init();
		}
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_shortcode_returns_empty_for_draft_without_read_post(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'draft' );

		update_post_meta( $post_id, '_codellia_shortcode_enabled', '1' );

		wp_set_current_user( 0 );

		$output = do_shortcode( '[codellia post_id="' . $post_id . '"]' );

		$this->assertSame( '', $output, 'Draft shortcode should not render for visitors.' );
	}

	public function test_shortcode_returns_empty_for_private_without_read_post(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'private' );

		update_post_meta( $post_id, '_codellia_shortcode_enabled', '1' );

		wp_set_current_user( 0 );

		$output = do_shortcode( '[codellia post_id="' . $post_id . '"]' );

		$this->assertSame( '', $output, 'Private shortcode should not render for visitors.' );
	}

	public function test_shortcode_returns_empty_when_disabled_even_if_published(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'publish' );

		update_post_meta( $post_id, '_codellia_shortcode_enabled', '0' );

		wp_set_current_user( $admin_id );

		$output = do_shortcode( '[codellia post_id="' . $post_id . '"]' );

		$this->assertSame( '', $output, 'Shortcode should not render when disabled.' );
	}

	private function create_codellia_post( int $author_id, string $status ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'    => Post_Type::POST_TYPE,
				'post_status'  => $status,
				'post_author'  => $author_id,
				'post_content' => '<p>Codellia content</p>',
			)
		);
	}
}
