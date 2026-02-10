<?php
/**
 * Shared numeric limits for Codellia.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Centralized limits used across REST and admin UI.
 */
class Limits {
	public const MAX_EXTERNAL_SCRIPTS = 10;
	public const MAX_EXTERNAL_STYLES  = 10;
}
