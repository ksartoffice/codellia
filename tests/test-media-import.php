<?php
/**
 * Media import SSRF/validation tests for WP LiveCode.
 *
 * @package WP_LiveCode
 */

use WPLiveCode\Media_Import;
use WPLiveCode\Post_Type;

class Test_Media_Import extends WP_UnitTestCase {
	protected function setUp(): void {
		parent::setUp();
	}

	protected function tearDown(): void {
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function test_external_image_skipped_without_upload_files(): void {
		$this->skip_if_no_tag_processor();

		$subscriber_id = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$post_id       = $this->create_livecode_post( $subscriber_id );
		$html          = '<img src="https://example.com/image.jpg" alt="demo" />';
		$warnings      = array();
		$imported      = array();

		$request_count = 0;
		$filter        = function ( $preempt, $args, $url ) use ( &$request_count ) {
			$request_count++;
			return new WP_Error( 'http_blocked', 'blocked' );
		};

		add_filter( 'pre_http_request', $filter, 10, 3 );
		wp_set_current_user( $subscriber_id );
		$result = Media_Import::localize_external_images( $html, $post_id, $warnings, $imported );
		remove_filter( 'pre_http_request', $filter, 10 );

		$this->assertSame( 0, $request_count, 'Should not attempt download without upload_files.' );
		$this->assertSame( $html, $result, 'HTML should be unchanged when skipped.' );
		$this->assertEmpty( $imported, 'No images should be imported.' );
		$this->assertNotEmpty( $warnings, 'Missing capability should add a warning.' );
		$this->assertStringContainsString( 'upload_files', $warnings[0] );
	}

	public function test_internal_image_is_not_imported(): void {
		$this->skip_if_no_tag_processor();

		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );
		$html     = sprintf( '<img src="%s" alt="internal" />', esc_url( home_url( '/wp-content/uploads/internal.jpg' ) ) );
		$warnings = array();
		$imported = array();

		$request_count = 0;
		$filter        = function ( $preempt, $args, $url ) use ( &$request_count ) {
			$request_count++;
			return new WP_Error( 'http_blocked', 'blocked' );
		};

		add_filter( 'pre_http_request', $filter, 10, 3 );
		wp_set_current_user( $admin_id );
		$result = Media_Import::localize_external_images( $html, $post_id, $warnings, $imported );
		remove_filter( 'pre_http_request', $filter, 10 );

		$this->assertSame( 0, $request_count, 'Internal URLs should not be fetched.' );
		$this->assertSame( $html, $result, 'HTML should be unchanged for internal URLs.' );
		$this->assertEmpty( $imported, 'No images should be imported.' );
	}

	public function test_non_http_url_is_ignored(): void {
		$this->skip_if_no_tag_processor();

		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );
		$html     = '<img src="file:///etc/passwd" alt="bad" />';
		$warnings = array();
		$imported = array();

		$request_count = 0;
		$filter        = function ( $preempt, $args, $url ) use ( &$request_count ) {
			$request_count++;
			return new WP_Error( 'http_blocked', 'blocked' );
		};

		add_filter( 'pre_http_request', $filter, 10, 3 );
		wp_set_current_user( $admin_id );
		$result = Media_Import::localize_external_images( $html, $post_id, $warnings, $imported );
		remove_filter( 'pre_http_request', $filter, 10 );

		$this->assertSame( 0, $request_count, 'Non-http URLs should not be fetched.' );
		$this->assertSame( $html, $result, 'HTML should be unchanged for non-http URLs.' );
		$this->assertEmpty( $imported, 'No images should be imported.' );
	}

	public function test_download_failure_adds_warning(): void {
		$this->skip_if_no_tag_processor();

		$admin_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$post_id  = $this->create_livecode_post( $admin_id );
		$html     = '<img src="https://example.com/image.jpg" alt="demo" />';
		$warnings = array();
		$imported = array();

		$request_count = 0;
		$filter        = function ( $preempt, $args, $url ) use ( &$request_count ) {
			$request_count++;
			return new WP_Error( 'http_blocked', 'blocked' );
		};

		add_filter( 'pre_http_request', $filter, 10, 3 );
		wp_set_current_user( $admin_id );
		$result = Media_Import::localize_external_images( $html, $post_id, $warnings, $imported );
		remove_filter( 'pre_http_request', $filter, 10 );

		$this->assertSame( 1, $request_count, 'External URLs should attempt download.' );
		$this->assertSame( $html, $result, 'HTML should remain when download fails.' );
		$this->assertEmpty( $imported, 'No images should be imported on failure.' );
		$this->assertNotEmpty( $warnings, 'Download failure should add a warning.' );
		$this->assertStringContainsString( 'Failed to download image', $warnings[0] );
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

	private function skip_if_no_tag_processor(): void {
		if ( ! class_exists( '\WP_HTML_Tag_Processor' ) ) {
			$this->markTestSkipped( 'WP_HTML_Tag_Processor not available in this WordPress version.' );
		}
	}
}
