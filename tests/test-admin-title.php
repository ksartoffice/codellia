<?php
/**
 * Admin title tests for Codellia.
 *
 * @package Codellia
 */

use Codellia\Admin;
use Codellia\Post_Type;

class Test_Admin_Title extends WP_UnitTestCase {
	private array $original_get = array();

	protected function setUp(): void {
		parent::setUp();

		if ( ! post_type_exists( Post_Type::POST_TYPE ) ) {
			Post_Type::register();
		}

		$this->original_get = $_GET;
	}

	protected function tearDown(): void {
		$_GET = $this->original_get;
		parent::tearDown();
	}

	public function test_filter_admin_title_replaces_left_side_for_codellia_editor(): void {
		$post_id = $this->create_codellia_post( 'Foo' );

		$_GET['page']    = Admin::MENU_SLUG;
		$_GET['post_id'] = (string) $post_id;

		$filtered = Admin::filter_admin_title(
			'Codellia &lsaquo; Test Site - WordPress',
			'Codellia'
		);

		$this->assertSame( 'Codellia Editor: Foo &lsaquo; Test Site - WordPress', $filtered );
	}

	public function test_filter_admin_title_uses_untitled_fallback_for_empty_post_title(): void {
		$post_id = $this->create_codellia_post( '' );

		$_GET['page']    = Admin::MENU_SLUG;
		$_GET['post_id'] = (string) $post_id;

		$filtered = Admin::filter_admin_title(
			'Codellia &lsaquo; Test Site - WordPress',
			'Codellia'
		);

		$this->assertSame( 'Codellia Editor: Untitled &lsaquo; Test Site - WordPress', $filtered );
	}

	public function test_filter_admin_title_supports_utf8_separator_suffix(): void {
		$post_id = $this->create_codellia_post( 'Foo' );

		$_GET['page']    = Admin::MENU_SLUG;
		$_GET['post_id'] = (string) $post_id;

		$filtered = Admin::filter_admin_title(
			'Codellia ' . "\xE2\x80\xB9" . ' Test Site - WordPress',
			'Codellia'
		);

		$this->assertSame( 'Codellia Editor: Foo ' . "\xE2\x80\xB9" . ' Test Site - WordPress', $filtered );
	}

	public function test_filter_admin_title_does_not_change_other_admin_pages(): void {
		$_GET['page'] = Admin::SETTINGS_SLUG;

		$original = 'Settings &lsaquo; Test Site - WordPress';
		$filtered = Admin::filter_admin_title( $original, 'Settings' );

		$this->assertSame( $original, $filtered );
	}

	public function test_filter_admin_title_returns_left_label_when_suffix_is_not_available(): void {
		$post_id = $this->create_codellia_post( 'Foo' );

		$_GET['page']    = Admin::MENU_SLUG;
		$_GET['post_id'] = (string) $post_id;

		$filtered = Admin::filter_admin_title( 'Codellia', 'Codellia' );

		$this->assertSame( 'Codellia Editor: Foo', $filtered );
	}

	private function create_codellia_post( string $title ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => Post_Type::POST_TYPE,
				'post_status' => 'draft',
				'post_title'  => $title,
			)
		);
	}
}
