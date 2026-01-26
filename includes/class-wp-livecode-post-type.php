<?php
/**
 * Custom post type registration for LiveCode.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and manages the LiveCode custom post type.
 */
class Post_Type {
	const POST_TYPE = 'wp_livecode';
	const SLUG      = 'wp-livecode';

	/**
	 * Register hooks for the post type.
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register' ) );
		add_filter( 'display_post_states', array( __CLASS__, 'add_tailwind_state' ), 10, 2 );
	}

	/**
	 * Activation handler.
	 */
	public static function activation(): void {
		self::register();
		flush_rewrite_rules();
	}

	/**
	 * Deactivation handler.
	 */
	public static function deactivation(): void {
		flush_rewrite_rules();
	}

	/**
	 * Register the custom post type.
	 */
	public static function register(): void {
		$labels = array(
			'name'               => _x( 'LiveCode', 'post type general name', 'wp-livecode' ),
			'singular_name'      => _x( 'LiveCode', 'post type singular name', 'wp-livecode' ),
			'add_new'            => _x( 'Add New', 'livecode', 'wp-livecode' ),
			'add_new_item'       => __( 'Add New LiveCode', 'wp-livecode' ),
			'edit_item'          => __( 'Edit LiveCode', 'wp-livecode' ),
			'new_item'           => __( 'New LiveCode', 'wp-livecode' ),
			'view_item'          => __( 'View LiveCode', 'wp-livecode' ),
			'view_items'         => __( 'View LiveCode', 'wp-livecode' ),
			'search_items'       => __( 'Search LiveCode', 'wp-livecode' ),
			'not_found'          => __( 'No LiveCode found', 'wp-livecode' ),
			'not_found_in_trash' => __( 'No LiveCode found in Trash', 'wp-livecode' ),
			'all_items'          => __( 'LiveCode', 'wp-livecode' ),
			'archives'           => __( 'LiveCode Archives', 'wp-livecode' ),
		);

		$args = array(
			'label'               => __( 'LiveCode', 'wp-livecode' ),
			'labels'              => $labels,
			'public'              => true,
			'exclude_from_search' => false,
			'publicly_queryable'  => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_nav_menus'   => true,
			'show_in_admin_bar'   => true,
			'has_archive'         => true,
			'rewrite'             => array(
				'slug'       => self::SLUG,
				'with_front' => false,
			),
			'supports'            => array( 'title', 'editor', 'author', 'thumbnail' ),
			'taxonomies'          => array( 'category', 'post_tag' ),
			'show_in_rest'        => true,
			'menu_position'       => 21,
			'menu_icon'           => 'dashicons-editor-code',
		);

		register_post_type( self::POST_TYPE, $args );
	}

	/**
	 * Check whether a post is a LiveCode post.
	 *
	 * @param int|\WP_Post $post Post ID or object.
	 * @return bool
	 */
	public static function is_livecode_post( $post ): bool {
		$post = get_post( $post );
		return $post && self::POST_TYPE === $post->post_type;
	}

	/**
	 * Build the editor URL for a LiveCode post.
	 *
	 * @param int $post_id LiveCode post ID.
	 * @return string
	 */
	public static function get_editor_url( int $post_id ): string {
		return add_query_arg(
			array(
				'page'    => Admin::MENU_SLUG,
				'post_id' => $post_id,
			),
			admin_url( 'admin.php' )
		);
	}

	/**
	 * Add TailwindCSS label in the post list.
	 *
	 * @param array    $states Post states.
	 * @param \WP_Post $post Post object.
	 * @return array
	 */
	public static function add_tailwind_state( array $states, \WP_Post $post ): array {
		if ( self::POST_TYPE !== $post->post_type ) {
			return $states;
		}

		$is_tailwind = '1' === get_post_meta( $post->ID, '_lc_tailwind', true );
		if ( $is_tailwind ) {
			$states['livecode_tailwind'] = __( 'TailwindCSS', 'wp-livecode' );
		}

		return $states;
	}

}
