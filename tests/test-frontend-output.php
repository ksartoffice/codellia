<?php
/**
 * Front-end rendering success tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Frontend;
use Codellia\Post_Type;

class Test_Frontend_Output extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}

		if ( ! shortcode_exists( 'codellia' ) ) {
			Frontend::init();
		}

		$this->reset_shortcode_state();
	}

	protected function tearDown(): void {
		$this->reset_shortcode_state();
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_filter_content_wraps_shadow_dom_with_assets(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'publish' );
		$post     = get_post( $post_id );

		$this->assertInstanceOf( WP_Post::class, $post );

		update_post_meta( $post_id, '_codellia_shadow_dom', '1' );
		update_post_meta( $post_id, '_codellia_css', 'body{color:red;}' );
		update_post_meta( $post_id, '_codellia_js', 'console.log("x");' );
		update_post_meta(
			$post_id,
			'_codellia_external_styles',
			wp_json_encode( array( 'https://example.com/app.css' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
		update_post_meta(
			$post_id,
			'_codellia_external_scripts',
			wp_json_encode( array( 'https://example.com/app.js' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);

		$original_wp_query = $this->set_query_for_post( $post_id, $post );
		$output            = Frontend::filter_content( (string) $post->post_content );
		$this->restore_query( $original_wp_query );

		$this->assertStringContainsString( '<div id="cd-shadow-host">', $output );
		$this->assertStringContainsString( '<template shadowrootmode="open">', $output );
		$this->assertStringContainsString( '<link rel="stylesheet" href="https://example.com/app.css">', $output );
		$this->assertStringContainsString( '<style id="cd-style">body{color:red;}</style>', $output );
		$this->assertStringContainsString( '<p>Codellia content</p>', $output );
		$this->assertStringContainsString( '<script src="https://example.com/app.js"></script>', $output );
		$this->assertStringContainsString( '<script id="cd-script">console.log("x");</script>', $output );
		$this->assertStringContainsString( '</template></div>', $output );
	}

	public function test_shortcode_renders_shadow_dom_with_unique_ids(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'publish' );

		update_post_meta( $post_id, '_codellia_shadow_dom', '1' );
		update_post_meta( $post_id, '_codellia_shortcode_enabled', '1' );
		update_post_meta( $post_id, '_codellia_css', 'body{background:#000;}' );
		update_post_meta( $post_id, '_codellia_js', 'console.log("shortcode");' );
		update_post_meta(
			$post_id,
			'_codellia_external_styles',
			wp_json_encode( array( 'https://example.com/shortcode.css' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
		update_post_meta(
			$post_id,
			'_codellia_external_scripts',
			wp_json_encode( array( 'https://example.com/shortcode.js' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);

		wp_set_current_user( $admin_id );

		$output = do_shortcode( '[codellia post_id="' . $post_id . '"]' );

		$this->assertStringContainsString( 'id="cd-shadow-host-' . $post_id . '-1"', $output );
		$this->assertStringContainsString( '<link rel="stylesheet" href="https://example.com/shortcode.css">', $output );
		$this->assertStringContainsString( 'id="cd-style-' . $post_id . '-1"', $output );
		$this->assertStringContainsString( '<p>Codellia content</p>', $output );
		$this->assertStringContainsString( '<script src="https://example.com/shortcode.js"></script>', $output );
		$this->assertStringContainsString( 'id="cd-script-' . $post_id . '-1"', $output );
	}

	public function test_shortcode_non_shadow_inlines_assets_once(): void {
		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_codellia_post( $admin_id, 'publish' );

		update_post_meta( $post_id, '_codellia_shortcode_enabled', '1' );
		update_post_meta( $post_id, '_codellia_css', 'body{font-size:16px;}' );
		update_post_meta( $post_id, '_codellia_js', 'console.log("inline");' );
		update_post_meta(
			$post_id,
			'_codellia_external_styles',
			wp_json_encode( array( 'https://example.com/inline.css' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
		update_post_meta(
			$post_id,
			'_codellia_external_scripts',
			wp_json_encode( array( 'https://example.com/inline.js' ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);

		wp_set_current_user( $admin_id );

		$first  = do_shortcode( '[codellia post_id="' . $post_id . '"]' );
		$second = do_shortcode( '[codellia post_id="' . $post_id . '"]' );

		$this->assertStringContainsString( '<link rel="stylesheet" href="https://example.com/inline.css">', $first );
		$this->assertStringContainsString( 'id="cd-style-' . $post_id . '"', $first );
		$this->assertStringContainsString( '<p>Codellia content</p>', $first );
		$this->assertStringContainsString( '<script src="https://example.com/inline.js"></script>', $first );
		$this->assertStringContainsString( 'id="cd-script-' . $post_id . '"', $first );

		$this->assertStringNotContainsString( '<link rel="stylesheet" href="https://example.com/inline.css">', $second );
		$this->assertStringNotContainsString( 'id="cd-style-' . $post_id . '"', $second );
		$this->assertStringContainsString( '<p>Codellia content</p>', $second );
		$this->assertStringNotContainsString( '<script src="https://example.com/inline.js"></script>', $second );
		$this->assertStringNotContainsString( 'id="cd-script-' . $post_id . '"', $second );
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

	private function set_query_for_post( int $post_id, WP_Post $post ): ?WP_Query {
		global $wp_query;
		$original_wp_query = $wp_query ?? null;

		$wp_query                       = new WP_Query();
		$wp_query->queried_object_id    = $post_id;
		$wp_query->queried_object       = $post;
		$wp_query->is_singular          = true;
		$wp_query->is_single            = true;
		$wp_query->set( 'codellia_preview', '' );

		return $original_wp_query;
	}

	private function restore_query( ?WP_Query $original_wp_query ): void {
		global $wp_query;
		if ( null !== $original_wp_query ) {
			$wp_query = $original_wp_query;
		} else {
			unset( $wp_query );
		}
	}

	private function reset_shortcode_state(): void {
		$instance_property = new ReflectionProperty( Frontend::class, 'shortcode_instance' );
		$instance_property->setAccessible( true );
		$instance_property->setValue( null, 0 );

		$assets_property = new ReflectionProperty( Frontend::class, 'shortcode_assets_loaded' );
		$assets_property->setAccessible( true );
		$assets_property->setValue( null, array() );
	}
}
