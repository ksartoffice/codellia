<?php
/**
 * REST permission tests for WP LiveCode.
 *
 * @package WP_LiveCode
 */

use WPLiveCode\Post_Type;

class Test_Rest_Permissions extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();
		rest_get_server();
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_rest_routes_require_authentication(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_livecode_post( $author_id );

		wp_set_current_user( 0 );

		foreach ( $this->get_rest_routes_with_params( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 401, $response->get_status(), $route . ' should require auth.' );
		}
	}

	public function test_rest_routes_forbid_subscriber(): void {
		$author_id     = self::factory()->user->create( array( 'role' => 'author' ) );
		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$post_id       = $this->create_livecode_post( $author_id );

		wp_set_current_user( $subscriber_id );

		foreach ( $this->get_rest_routes_with_params( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 403, $response->get_status(), $route . ' should forbid subscribers.' );
		}
	}

	public function test_rest_routes_allow_author_for_editable_post(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_livecode_post( $author_id );

		wp_set_current_user( $author_id );

		foreach ( $this->get_author_allowed_routes( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 200, $response->get_status(), $route . ' should allow authors.' );
		}
	}

	public function test_rest_import_requires_unfiltered_html(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id   = $this->create_livecode_post( $author_id );

		$import_params = $this->get_import_params( $post_id );

		wp_set_current_user( $author_id );
		$response = $this->dispatch_route( '/wp-livecode/v1/import', $import_params );
		$this->assertSame( 403, $response->get_status(), 'Import should require unfiltered_html.' );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route( '/wp-livecode/v1/import', $import_params );
		$this->assertSame( 200, $response->get_status(), 'Admins should be able to import.' );
	}

	private function create_livecode_post( int $author_id ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => Post_Type::POST_TYPE,
				'post_status' => 'draft',
				'post_author' => $author_id,
			)
		);
	}

	private function dispatch_route( string $route, array $params ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', $route );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		$response = rest_do_request( $request );
		if ( is_wp_error( $response ) ) {
			$this->fail( $response->get_error_message() );
		}
		return $response;
	}

	private function get_rest_routes_with_params( int $post_id ): array {
		$tailwind_css = "@tailwind base;\n@tailwind components;\n@tailwind utilities;";
		return array(
			'/wp-livecode/v1/save' => array(
				'post_id' => $post_id,
				'html'    => '<p>Test</p>',
			),
			'/wp-livecode/v1/compile-tailwind' => array(
				'post_id' => $post_id,
				'html'    => '<div class="text-sm"></div>',
				'css'     => $tailwind_css,
			),
			'/wp-livecode/v1/setup' => array(
				'post_id' => $post_id,
				'mode'    => 'normal',
			),
			'/wp-livecode/v1/settings' => array(
				'post_id' => $post_id,
				'updates' => array(),
			),
			'/wp-livecode/v1/render-shortcodes' => array(
				'post_id'    => $post_id,
				'shortcodes' => array(
					array(
						'id'        => 'item-1',
						'shortcode' => '',
					),
				),
			),
			'/wp-livecode/v1/import' => $this->get_import_params( $post_id ),
		);
	}

	private function get_author_allowed_routes( int $post_id ): array {
		$routes = $this->get_rest_routes_with_params( $post_id );
		unset( $routes['/wp-livecode/v1/import'] );
		return $routes;
	}

	private function get_import_params( int $post_id ): array {
		return array(
			'post_id' => $post_id,
			'payload' => array(
				'version'         => 1,
				'html'            => '<p>Import</p>',
				'css'             => '',
				'tailwindEnabled' => false,
			),
		);
	}
}
