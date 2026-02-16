<?php
/**
 * Editor bridge behavior tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Editor_Bridge;
use Codellia\Post_Type;

class Test_Editor_Bridge extends WP_UnitTestCase {
	private array $original_get = array();

	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}

		if ( ! function_exists( 'set_current_screen' ) ) {
			require_once ABSPATH . 'wp-admin/includes/screen.php';
		}

		$this->original_get = $_GET;
	}

	protected function tearDown(): void {
		$_GET = $this->original_get;
		unset( $GLOBALS['post'] );
		set_current_screen( 'front' );
		$this->reset_assets();
		parent::tearDown();
	}

	public function test_maybe_mark_setup_required_sets_meta_for_new_codellia_post(): void {
		$post_id = $this->create_post( Post_Type::POST_TYPE );
		$post    = get_post( $post_id );
		$this->assertInstanceOf( WP_Post::class, $post );

		delete_post_meta( $post_id, '_codellia_setup_required' );
		Editor_Bridge::maybe_mark_setup_required( $post_id, $post, false );

		$this->assertSame( '1', get_post_meta( $post_id, '_codellia_setup_required', true ) );
	}

	public function test_maybe_mark_setup_required_skips_updates_and_non_codellia_posts(): void {
		$codellia_id = $this->create_post( Post_Type::POST_TYPE );
		$codellia    = get_post( $codellia_id );
		$this->assertInstanceOf( WP_Post::class, $codellia );

		delete_post_meta( $codellia_id, '_codellia_setup_required' );
		Editor_Bridge::maybe_mark_setup_required( $codellia_id, $codellia, true );
		$this->assertSame( '', get_post_meta( $codellia_id, '_codellia_setup_required', true ) );

		$normal_id = $this->create_post( 'post' );
		$normal    = get_post( $normal_id );
		$this->assertInstanceOf( WP_Post::class, $normal );

		delete_post_meta( $normal_id, '_codellia_setup_required' );
		Editor_Bridge::maybe_mark_setup_required( $normal_id, $normal, false );
		$this->assertSame( '', get_post_meta( $normal_id, '_codellia_setup_required', true ) );
	}

	public function test_resolve_post_id_prefers_query_post_and_falls_back_to_global_post(): void {
		$first_id = $this->create_post( Post_Type::POST_TYPE );
		$_GET['post'] = (string) $first_id;

		$this->assertSame( $first_id, $this->invoke_private_int_method( 'resolve_post_id' ) );

		unset( $_GET['post'] );

		$second_id        = $this->create_post( Post_Type::POST_TYPE );
		$GLOBALS['post']  = get_post( $second_id );
		$this->assertInstanceOf( WP_Post::class, $GLOBALS['post'] );
		$this->assertSame( $second_id, $this->invoke_private_int_method( 'resolve_post_id' ) );
	}

	public function test_enqueue_classic_assets_enqueues_only_for_codellia_classic_editor(): void {
		$post_id = $this->create_post( Post_Type::POST_TYPE );
		$_GET['post'] = (string) $post_id;

		set_current_screen( 'post' );
		$screen                  = get_current_screen();
		$screen->post_type       = Post_Type::POST_TYPE;
		$screen->is_block_editor = false;

		Editor_Bridge::enqueue_classic_assets( 'post.php' );

		$this->assertTrue( wp_script_is( Editor_Bridge::SCRIPT_HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( Editor_Bridge::STYLE_HANDLE, 'enqueued' ) );

		$this->reset_assets();
		Editor_Bridge::enqueue_classic_assets( 'edit.php' );
		$this->assertFalse( wp_script_is( Editor_Bridge::SCRIPT_HANDLE, 'enqueued' ) );
	}

	public function test_enqueue_block_assets_runs_only_for_codellia_screen(): void {
		set_current_screen( 'post' );
		$screen            = get_current_screen();
		$screen->post_type = Post_Type::POST_TYPE;

		Editor_Bridge::enqueue_block_assets();
		$this->assertTrue( wp_script_is( Editor_Bridge::SCRIPT_HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( Editor_Bridge::STYLE_HANDLE, 'enqueued' ) );

		$this->reset_assets();
		$screen->post_type = 'post';
		Editor_Bridge::enqueue_block_assets();
		$this->assertFalse( wp_script_is( Editor_Bridge::SCRIPT_HANDLE, 'enqueued' ) );
	}

	private function create_post( string $post_type ): int {
		$author_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		return (int) self::factory()->post->create(
			array(
				'post_type'   => $post_type,
				'post_status' => 'draft',
				'post_author' => $author_id,
			)
		);
	}

	private function invoke_private_int_method( string $method_name ): int {
		$method = new ReflectionMethod( Editor_Bridge::class, $method_name );
		$method->setAccessible( true );
		return (int) $method->invoke( null );
	}

	private function reset_assets(): void {
		wp_dequeue_script( Editor_Bridge::SCRIPT_HANDLE );
		wp_deregister_script( Editor_Bridge::SCRIPT_HANDLE );
		wp_dequeue_style( Editor_Bridge::STYLE_HANDLE );
		wp_deregister_style( Editor_Bridge::STYLE_HANDLE );
	}
}
