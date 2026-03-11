<?php
/**
 * Uninstall behavior tests for CazeArt.
 *
 * @package CazeArt
 */

use CazeArt\Post_Type;

class Test_Uninstall extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}
	}

	protected function tearDown(): void {
		delete_option( 'cazeart_delete_on_uninstall' );
		delete_option( 'cazeart_post_slug' );
		delete_option( 'cazeart_flush_rewrite' );
		parent::tearDown();
	}

	public function test_uninstall_keeps_data_when_delete_option_is_disabled(): void {
		$cazeart_post_id = $this->create_post( Post_Type::POST_TYPE );

		update_option( 'cazeart_delete_on_uninstall', '0' );
		update_option( 'cazeart_post_slug', 'cazeart-custom' );
		update_option( 'cazeart_flush_rewrite', '1' );

		$this->run_uninstall_script();

		$this->assertInstanceOf( WP_Post::class, get_post( $cazeart_post_id ) );
		$this->assertSame( '0', get_option( 'cazeart_delete_on_uninstall', '' ) );
		$this->assertSame( 'cazeart-custom', get_option( 'cazeart_post_slug', '' ) );
		$this->assertSame( '1', get_option( 'cazeart_flush_rewrite', '' ) );
	}

	public function test_uninstall_deletes_cazeart_posts_and_plugin_options_when_enabled(): void {
		$cazeart_post_id = $this->create_post( Post_Type::POST_TYPE );
		$normal_post_id   = $this->create_post( 'post' );

		update_option( 'cazeart_delete_on_uninstall', '1' );
		update_option( 'cazeart_post_slug', 'cazeart-custom' );
		update_option( 'cazeart_flush_rewrite', '1' );

		$this->run_uninstall_script();

		$this->assertNull( get_post( $cazeart_post_id ), 'CazeArt posts should be deleted on uninstall.' );
		$this->assertInstanceOf( WP_Post::class, get_post( $normal_post_id ), 'Non-CazeArt posts must remain.' );
		$this->assertFalse( get_option( 'cazeart_delete_on_uninstall', false ) );
		$this->assertFalse( get_option( 'cazeart_post_slug', false ) );
		$this->assertFalse( get_option( 'cazeart_flush_rewrite', false ) );
	}

	private function create_post( string $post_type ): int {
		$author_id = self::factory()->user->create( array( 'role' => 'administrator' ) );

		return (int) self::factory()->post->create(
			array(
				'post_type'   => $post_type,
				'post_status' => 'publish',
				'post_author' => $author_id,
			)
		);
	}

	private function run_uninstall_script(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			define( 'WP_UNINSTALL_PLUGIN', true );
		}

		require CAZEART_PATH . 'uninstall.php';
	}
}

