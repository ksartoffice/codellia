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
		add_filter( 'get_edit_post_link', array( __CLASS__, 'filter_edit_post_link' ), 10, 3 );
		add_filter( 'post_row_actions', array( __CLASS__, 'add_livecode_row_action' ), 10, 2 );
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
		$slug = self::get_slug();
		$labels = array(
			'name'               => _x( 'LiveCode', 'post type general name', 'wp-livecode' ),
			'singular_name'      => _x( 'LiveCode', 'post type singular name', 'wp-livecode' ),
			'add_new'            => _x( 'Add New', 'livecode', 'wp-livecode' ),
			'add_new_item'       => __( 'Add New LiveCode', 'wp-livecode' ),
			'edit_item'          => __( 'Edit LiveCode', 'wp-livecode' ),
			'new_item'           => __( 'New LiveCode', 'wp-livecode' ),
			'view_item'          => __( 'View on front end', 'wp-livecode' ),
			'view_items'         => __( 'View on front end', 'wp-livecode' ),
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
				'slug'       => $slug,
				'with_front' => false,
			),
			'supports'            => array( 'title', 'editor', 'author', 'thumbnail' ),
			'show_in_rest'        => true,
			'menu_position'       => 21,
			'menu_icon'           => 'dashicons-editor-code',
		);

		register_post_type( self::POST_TYPE, $args );
	}

	/**
	 * Resolve the current slug for the LiveCode post type.
	 *
	 * @return string
	 */
	public static function get_slug(): string {
		$value = get_option( Admin::OPTION_POST_SLUG, self::SLUG );
		$slug  = sanitize_title( (string) $value );

		return '' !== $slug ? $slug : self::SLUG;
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
	 * Check whether single page view is enabled for a LiveCode post.
	 *
	 * @param int $post_id LiveCode post ID.
	 * @return bool
	 */
	public static function is_single_page_enabled( int $post_id ): bool {
		$value = get_post_meta( $post_id, '_lc_single_page_enabled', true );
		if ( '' === $value ) {
			return true;
		}

		return '1' === $value;
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

	/**
	 * Add a LiveCode editor link to post row actions.
	 *
	 * @param array    $actions Row actions.
	 * @param \WP_Post $post Post object.
	 * @return array
	 */
	public static function add_livecode_row_action( array $actions, \WP_Post $post ): array {
		if ( self::POST_TYPE !== $post->post_type ) {
			return $actions;
		}

		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return $actions;
		}

		$actions['livecode_edit'] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( self::get_editor_url( $post->ID ) ),
			esc_html__( 'Edit in LiveCode', 'wp-livecode' )
		);

		return $actions;
	}

	/**
	 * Override the edit link to point to the LiveCode editor on the front end.
	 *
	 * @param string $link Default edit link.
	 * @param int    $post_id Post ID.
	 * @param string $context Context.
	 * @return string
	 */
	public static function filter_edit_post_link( string $link, int $post_id, string $context ): string {
		if ( is_admin() ) {
			return $link;
		}

		if ( ! self::is_livecode_post( $post_id ) ) {
			return $link;
		}

		return self::get_editor_url( $post_id );
	}

}
