<?php
/**
 * Tests for the CodeNagi post type.
 *
 * @package CodeNagi
 */

use CodeNagi\Post_Type;

class Test_Post_Type extends WP_UnitTestCase {
	public function test_post_type_is_registered() {
		$this->assertTrue( post_type_exists( Post_Type::POST_TYPE ) );
	}
}


