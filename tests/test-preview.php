<?php
/**
 * Preview/nonce tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Post_Type;
use Codellia\Preview;

class Codellia_Die_Exception extends Exception {
}

class Test_Preview extends WP_UnitTestCase {
	private string $wp_die_message = '';

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_preview_requires_post_id(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );

		wp_set_current_user( $admin_id );
		$this->set_preview_query_vars( null, 'token' );

		$message = $this->capture_wp_die(
			function () {
				Preview::maybe_handle_preview();
			}
		);

		$this->assertStringContainsString( __( 'post_id is required.', 'codellia' ), $message );
	}

	public function test_preview_denies_invalid_token(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		wp_set_current_user( $admin_id );
		$this->set_preview_query_vars( $post_id, 'invalid' );

		$message = $this->capture_wp_die(
			function () {
				Preview::maybe_handle_preview();
			}
		);

		$this->assertStringContainsString( __( 'Invalid preview token.', 'codellia' ), $message );
	}

	public function test_preview_denies_user_without_edit_permission(): void {
		$author_id     = self::factory()->user->create( array( 'role' => 'author' ) );
		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$post_id       = $this->create_codellia_post( $author_id );
		$token         = wp_create_nonce( 'codellia_preview_' . $post_id );

		wp_set_current_user( $subscriber_id );
		$this->set_preview_query_vars( $post_id, $token );

		$message = $this->capture_wp_die(
			function () {
				Preview::maybe_handle_preview();
			}
		);

		$this->assertStringContainsString( __( 'Permission denied.', 'codellia' ), $message );
	}

	public function test_preview_denies_non_codellia_post(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = self::factory()->post->create(
			array(
				'post_type'   => 'post',
				'post_status' => 'draft',
				'post_author' => $admin_id,
			)
		);

		wp_set_current_user( $admin_id );
		$token = wp_create_nonce( 'codellia_preview_' . $post_id );
		$this->set_preview_query_vars( (int) $post_id, $token );

		$message = $this->capture_wp_die(
			function () {
				Preview::maybe_handle_preview();
			}
		);

		$this->assertStringContainsString( __( 'Invalid post type.', 'codellia' ), $message );
	}

	public function test_preview_allows_valid_request(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		wp_set_current_user( $admin_id );
		$token = wp_create_nonce( 'codellia_preview_' . $post_id );
		$this->set_preview_query_vars( $post_id, $token );

		Preview::maybe_handle_preview();

		$this->assertTrue( defined( 'DONOTCACHEPAGE' ) );
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

	private function set_preview_query_vars( ?int $post_id, ?string $token ): void {
		global $wp_query;
		if ( ! $wp_query ) {
			$wp_query = new WP_Query();
		}

		$wp_query->set( 'codellia_preview', '1' );
		$wp_query->set( 'post_id', $post_id ? (string) $post_id : '' );
		$wp_query->set( 'token', $token ?? '' );
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
		throw new Codellia_Die_Exception();
	}

	private function capture_wp_die( callable $callback ): string {
		$this->wp_die_message = '';
		add_filter( 'wp_die_handler', array( $this, 'provide_wp_die_handler' ) );

		try {
			$callback();
			$this->fail( 'Expected wp_die to be called.' );
		} catch ( Codellia_Die_Exception $e ) {
			// Expected.
		} finally {
			remove_filter( 'wp_die_handler', array( $this, 'provide_wp_die_handler' ) );
		}

		return $this->wp_die_message;
	}
}


