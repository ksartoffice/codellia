<?php
/**
 * REST permission tests for CodeNagi.
 *
 * @package CodeNagi
 */

use CodeNagi\Post_Type;

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
		$post_id   = $this->create_codenagi_post( $author_id );

		wp_set_current_user( 0 );

		foreach ( $this->get_rest_routes_with_params( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 401, $response->get_status(), $route . ' should require auth.' );
		}
	}

	public function test_rest_routes_forbid_subscriber(): void {
		$author_id     = self::factory()->user->create( array( 'role' => 'author' ) );
		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$post_id       = $this->create_codenagi_post( $author_id );

		wp_set_current_user( $subscriber_id );

		foreach ( $this->get_rest_routes_with_params( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 403, $response->get_status(), $route . ' should forbid subscribers.' );
		}
	}

	public function test_rest_routes_allow_author_for_editable_post(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_codenagi_post( $author_id );

		wp_set_current_user( $author_id );

		foreach ( $this->get_author_allowed_routes( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 200, $response->get_status(), $route . ' should allow authors.' );
		}
	}

	public function test_rest_routes_allow_editor_for_others_post(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$editor_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		$post_id   = $this->create_codenagi_post( $author_id );

		wp_set_current_user( $editor_id );

		foreach ( $this->get_author_allowed_routes( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 200, $response->get_status(), $route . ' should allow editors.' );
		}
	}

	public function test_rest_routes_forbid_author_for_others_post(): void {
		$author_id       = self::factory()->user->create( array( 'role' => 'author' ) );
		$other_author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id         = $this->create_codenagi_post( $author_id );

		wp_set_current_user( $other_author_id );

		foreach ( $this->get_author_allowed_routes( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 403, $response->get_status(), $route . ' should forbid other authors.' );
		}
	}

	public function test_rest_routes_forbid_non_codenagi_post(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_non_codenagi_post( $author_id );

		wp_set_current_user( $author_id );

		foreach ( $this->get_rest_routes_with_params( $post_id ) as $route => $params ) {
			$response = $this->dispatch_route( $route, $params );
			$this->assertSame( 403, $response->get_status(), $route . ' should forbid non-codenagi posts.' );
		}
	}

	public function test_rest_import_requires_unfiltered_html(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id   = $this->create_codenagi_post( $author_id );

		$import_params = $this->get_import_params( $post_id );

		wp_set_current_user( $author_id );
		$response = $this->dispatch_route( '/codenagi/v1/import', $import_params );
		$this->assertSame( 403, $response->get_status(), 'Import should require unfiltered_html.' );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route( '/codenagi/v1/import', $import_params );
		$this->assertSame( 200, $response->get_status(), 'Admins should be able to import.' );
	}

	public function test_rest_save_requires_unfiltered_html_for_js_payload(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id   = $this->create_codenagi_post( $author_id );

		$params = array(
			'post_id' => $post_id,
			'html'    => '<p>Test</p>',
			'js'      => 'console.log("x");',
		);

		wp_set_current_user( $author_id );
		$response = $this->dispatch_route( '/codenagi/v1/save', $params );
		$this->assertSame( 403, $response->get_status(), 'Saving JS should require unfiltered_html.' );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route( '/codenagi/v1/save', $params );
		$this->assertSame( 200, $response->get_status(), 'Admins should be able to save JS.' );
	}

	public function test_rest_settings_requires_unfiltered_html_for_js_related_updates(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$admin_id  = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id   = $this->create_codenagi_post( $author_id );

		$updates = array(
			'shadowDomEnabled'  => true,
			'shortcodeEnabled'  => true,
			'externalScripts'   => array( 'https://example.com/app.js' ),
			'externalStyles'    => array( 'https://example.com/app.css' ),
		);

		wp_set_current_user( $author_id );
		$response = $this->dispatch_route(
			'/codenagi/v1/settings',
			array(
				'post_id' => $post_id,
				'updates' => $updates,
			)
		);
		$this->assertSame( 403, $response->get_status(), 'Settings updates should require unfiltered_html.' );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route(
			'/codenagi/v1/settings',
			array(
				'post_id' => $post_id,
				'updates' => $updates,
			)
		);
		$this->assertSame( 200, $response->get_status(), 'Admins should be able to update JS settings.' );
	}

	private function create_codenagi_post( int $author_id ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => Post_Type::POST_TYPE,
				'post_status' => 'draft',
				'post_author' => $author_id,
			)
		);
	}

	private function create_non_codenagi_post( int $author_id ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => 'post',
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
			'/codenagi/v1/save' => array(
				'post_id' => $post_id,
				'html'    => '<p>Test</p>',
			),
			'/codenagi/v1/compile-tailwind' => array(
				'post_id' => $post_id,
				'html'    => '<div class="text-sm"></div>',
				'css'     => $tailwind_css,
			),
			'/codenagi/v1/setup' => array(
				'post_id' => $post_id,
				'mode'    => 'normal',
			),
			'/codenagi/v1/settings' => array(
				'post_id' => $post_id,
				'updates' => array(),
			),
			'/codenagi/v1/render-shortcodes' => array(
				'post_id'    => $post_id,
				'shortcodes' => array(
					array(
						'id'        => 'item-1',
						'shortcode' => '',
					),
				),
			),
			'/codenagi/v1/import' => $this->get_import_params( $post_id ),
		);
	}

	private function get_author_allowed_routes( int $post_id ): array {
		$routes = $this->get_rest_routes_with_params( $post_id );
		unset( $routes['/codenagi/v1/import'] );
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



