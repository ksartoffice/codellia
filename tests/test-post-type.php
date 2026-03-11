<?php
/**
 * Tests for the KayzArt post type.
 *
 * @package KayzArt
 */

use KayzArt\Post_Type;

class Test_Post_Type extends WP_UnitTestCase {
	public function test_post_type_is_registered() {
		$this->assertTrue( post_type_exists( Post_Type::POST_TYPE ) );
	}
}


