<?php
/**
 * Admin route permission tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Admin;
use Codellia\Post_Type;

class Codellia_Admin_Die_Exception extends Exception {
}

class Test_Admin_Permissions extends WP_UnitTestCase {
	private string $wp_die_message = '';

	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_action_redirect_denies_user_without_edit_permission(): void {
		$author_id     = self::factory()->user->create( array( 'role' => 'author' ) );
		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$post_id       = $this->create_codellia_post( $author_id );

		wp_set_current_user( $subscriber_id );

		$original_get       = $_GET;
		$_GET['post_id']    = (string) $post_id;

		$message = $this->capture_wp_die(
			function () {
				Admin::action_redirect();
			}
		);

		$_GET = $original_get;

		$this->assertStringContainsString( __( 'Permission denied.', 'codellia' ), $message );
	}

	public function test_maybe_redirect_new_post_denies_user_without_create_posts(): void {
		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );

		wp_set_current_user( $subscriber_id );

		$original_get         = $_GET;
		$_GET['post_type']    = Post_Type::POST_TYPE;

		$message = $this->capture_wp_die(
			function () {
				Admin::maybe_redirect_new_post();
			}
		);

		$_GET = $original_get;

		$this->assertStringContainsString( __( 'Permission denied.', 'codellia' ), $message );
	}

	private function create_codellia_post( int $author_id ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => Post_Type::POST_TYPE,
				'post_status' => 'draft',
				'post_author' => $author_id,
			)
		);
	}

	public function provide_wp_die_handler( $handler ) {
		return array( $this, 'handle_wp_die' );
	}

	public function handle_wp_die( $message, $title = '', $args = array() ) {
		if ( is_wp_error( $message ) ) {
			$this->wp_die_message = $message->get_error_message();
		} else {
			$this->wp_die_message = (string) $message;
		}
		throw new Codellia_Admin_Die_Exception();
	}

	private function capture_wp_die( callable $callback ): string {
		$this->wp_die_message = '';
		add_filter( 'wp_die_handler', array( $this, 'provide_wp_die_handler' ) );

		try {
			$callback();
			$this->fail( 'Expected wp_die to be called.' );
		} catch ( Codellia_Admin_Die_Exception $e ) {
			// Expected.
		} finally {
			remove_filter( 'wp_die_handler', array( $this, 'provide_wp_die_handler' ) );
		}

		return $this->wp_die_message;
	}
}
