<?php
/**
 * PHPUnit bootstrap for WP LiveCode.
 *
 * @package WP_LiveCode
 */

$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
	$_tests_dir = dirname( __DIR__ ) . '/.wordpress-tests-lib';
}

$autoload = dirname( __DIR__ ) . '/vendor/autoload.php';
if ( file_exists( $autoload ) ) {
	require_once $autoload;
}

if ( ! defined( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills' );
}

if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	echo "WP tests not found. Run bin/install-wp-tests.sh first.\n";
	exit( 1 );
}

require_once $_tests_dir . '/includes/functions.php';

/**
 * Manually load the plugin for the test suite.
 */
function wp_livecode_manually_load_plugin() {
	require dirname( __DIR__ ) . '/wp-livecode.php';
}
tests_add_filter( 'muplugins_loaded', 'wp_livecode_manually_load_plugin' );

require $_tests_dir . '/includes/bootstrap.php';
