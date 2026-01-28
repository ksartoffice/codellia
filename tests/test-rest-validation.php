<?php
/**
 * REST validation tests for WP LiveCode.
 *
 * @package WP_LiveCode
 */

use WPLiveCode\Frontend;
use WPLiveCode\Post_Type;

class Test_Rest_Validation extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();
		rest_get_server();
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_import_rejects_invalid_version(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$payload               = $this->get_import_payload_base();
		$payload['version']    = 2;
		$response              = $this->dispatch_route(
			'/wp-livecode/v1/import',
			array(
				'post_id' => $post_id,
				'payload' => $payload,
			)
		);

		$this->assertSame( 400, $response->get_status(), 'Invalid import version should fail.' );
	}

	public function test_import_rejects_invalid_tailwind_enabled_type(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$payload                    = $this->get_import_payload_base();
		$payload['tailwindEnabled'] = 'yes';
		$response                   = $this->dispatch_route(
			'/wp-livecode/v1/import',
			array(
				'post_id' => $post_id,
				'payload' => $payload,
			)
		);

		$this->assertSame( 400, $response->get_status(), 'tailwindEnabled must be boolean.' );
	}

	public function test_import_rejects_invalid_external_scripts_url(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$payload                    = $this->get_import_payload_base();
		$payload['externalScripts'] = array( 'http://example.com/script.js' );
		$response                   = $this->dispatch_route(
			'/wp-livecode/v1/import',
			array(
				'post_id' => $post_id,
				'payload' => $payload,
			)
		);

		$this->assertSame( 400, $response->get_status(), 'External scripts must be https URLs.' );
	}

	public function test_settings_rejects_non_array_updates(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route(
			'/wp-livecode/v1/settings',
			array(
				'post_id' => $post_id,
				'updates' => 'nope',
			)
		);

		$this->assertSame( 400, $response->get_status(), 'Updates payload must be array.' );
	}

	public function test_settings_rejects_external_scripts_over_limit(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route(
			'/wp-livecode/v1/settings',
			array(
				'post_id' => $post_id,
				'updates' => array(
					'externalScripts' => array(
						'https://example.com/1.js',
						'https://example.com/2.js',
						'https://example.com/3.js',
						'https://example.com/4.js',
						'https://example.com/5.js',
						'https://example.com/6.js',
					),
				),
			)
		);

		$this->assertSame( 400, $response->get_status(), 'External scripts should respect the max limit.' );
	}

	public function test_settings_rejects_external_styles_invalid_url(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );

		wp_set_current_user( $admin_id );
		$response = $this->dispatch_route(
			'/wp-livecode/v1/settings',
			array(
				'post_id' => $post_id,
				'updates' => array(
					'externalStyles' => array( 'javascript:alert(1)' ),
				),
			)
		);

		$this->assertSame( 400, $response->get_status(), 'External styles must be https URLs.' );
	}

	public function test_save_strips_xss_from_html_for_author(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_livecode_post( $author_id );

		wp_set_current_user( $author_id );

		$response = $this->dispatch_route(
			'/wp-livecode/v1/save',
			array(
				'post_id' => $post_id,
				'html'    => '<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
			)
		);

		$this->assertSame( 200, $response->get_status(), 'Author saves should succeed without JS capability.' );

		$post    = get_post( $post_id );
		$content = $post ? (string) $post->post_content : '';

		$this->assertStringNotContainsString( '<script', $content, 'Script tags should be stripped.' );
		$this->assertStringNotContainsString( 'onerror', $content, 'Event handler attributes should be stripped.' );
		$this->assertStringNotContainsString( 'javascript:', $content, 'javascript: URLs should be stripped.' );
	}

	public function test_save_strips_style_breakout_from_css_for_author(): void {
		$author_id = self::factory()->user->create( array( 'role' => 'author' ) );
		$post_id   = $this->create_livecode_post( $author_id );

		wp_set_current_user( $author_id );

		$response = $this->dispatch_route(
			'/wp-livecode/v1/save',
			array(
				'post_id' => $post_id,
				'html'    => '<p>CSS test</p>',
				'css'     => '</style><script>alert("test2");</script>body{color:red;}',
			)
		);

		$this->assertSame( 200, $response->get_status(), 'Author saves should succeed without JS capability.' );

		$stored_css = (string) get_post_meta( $post_id, '_lc_css', true );
		$this->assertStringNotContainsString( '</style', $stored_css, 'CSS should not contain closing style tags.' );
		$this->assertStringContainsString( '&lt;/style', $stored_css, 'Closing style tags should be escaped.' );
	}

	public function test_frontend_escapes_style_breakout_in_css_output(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );
		$post     = get_post( $post_id );

		$this->assertInstanceOf( WP_Post::class, $post );

		update_post_meta( $post_id, '_lc_shadow_dom', '1' );
		update_post_meta( $post_id, '_lc_css', '</style><script>alert("test2");</script>body{color:red;}' );

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

		$this->assertStringNotContainsString( '</style><script', $output, 'Inline scripts should not be injected via CSS.' );
		$this->assertStringContainsString( '&lt;/style', $output, 'Output should escape closing style tags.' );
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

	private function get_import_payload_base(): array {
		return array(
			'version'         => 1,
			'html'            => '<p>Import</p>',
			'css'             => '',
			'tailwindEnabled' => false,
		);
	}
}
