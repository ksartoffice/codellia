<?php
/**
 * REST setup route tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Post_Type;

class Test_Rest_Setup extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();
		rest_get_server();
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_setup_rejects_invalid_mode(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		wp_set_current_user( $admin_id );

		$response = $this->dispatch_setup(
			array(
				'post_id' => $post_id,
				'mode'    => 'invalid-mode',
			)
		);

		$this->assertSame( 400, $response->get_status(), 'Invalid setup mode should be rejected.' );
	}

	public function test_setup_sets_tailwind_and_locks_when_unlocked(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		update_post_meta( $post_id, '_codellia_tailwind', '0' );
		update_post_meta( $post_id, '_codellia_tailwind_locked', '0' );
		update_post_meta( $post_id, '_codellia_setup_required', '1' );

		wp_set_current_user( $admin_id );

		$response = $this->dispatch_setup(
			array(
				'post_id' => $post_id,
				'mode'    => 'tailwind',
			)
		);

		$this->assertSame( 200, $response->get_status(), 'Setup should succeed for valid request.' );
		$data = $response->get_data();
		$this->assertSame( true, $data['tailwindEnabled'] ?? null );
		$this->assertSame( '1', get_post_meta( $post_id, '_codellia_tailwind', true ) );
		$this->assertSame( '1', get_post_meta( $post_id, '_codellia_tailwind_locked', true ) );
		$this->assertSame( '', get_post_meta( $post_id, '_codellia_setup_required', true ) );
	}

	public function test_setup_sets_normal_mode_when_unlocked(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		update_post_meta( $post_id, '_codellia_tailwind', '1' );
		update_post_meta( $post_id, '_codellia_tailwind_locked', '0' );

		wp_set_current_user( $admin_id );

		$response = $this->dispatch_setup(
			array(
				'post_id' => $post_id,
				'mode'    => 'normal',
			)
		);

		$this->assertSame( 200, $response->get_status(), 'Setup should accept normal mode.' );
		$data = $response->get_data();
		$this->assertSame( false, $data['tailwindEnabled'] ?? null );
		$this->assertSame( '0', get_post_meta( $post_id, '_codellia_tailwind', true ) );
		$this->assertSame( '1', get_post_meta( $post_id, '_codellia_tailwind_locked', true ) );
	}

	public function test_setup_preserves_existing_mode_when_locked(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id );

		update_post_meta( $post_id, '_codellia_tailwind', '0' );
		update_post_meta( $post_id, '_codellia_tailwind_locked', '1' );
		update_post_meta( $post_id, '_codellia_setup_required', '1' );

		wp_set_current_user( $admin_id );

		$response = $this->dispatch_setup(
			array(
				'post_id' => $post_id,
				'mode'    => 'tailwind',
			)
		);

		$this->assertSame( 200, $response->get_status(), 'Locked setup should still return success.' );
		$data = $response->get_data();
		$this->assertSame( false, $data['tailwindEnabled'] ?? null, 'Locked mode should remain unchanged.' );
		$this->assertSame( '0', get_post_meta( $post_id, '_codellia_tailwind', true ) );
		$this->assertSame( '1', get_post_meta( $post_id, '_codellia_tailwind_locked', true ) );
		$this->assertSame( '', get_post_meta( $post_id, '_codellia_setup_required', true ) );
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

	private function dispatch_setup( array $params ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', '/codellia/v1/setup' );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = rest_do_request( $request );
		if ( is_wp_error( $response ) ) {
			$this->fail( $response->get_error_message() );
		}

		return $response;
	}
}

