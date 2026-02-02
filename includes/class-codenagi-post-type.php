<?php
/**
 * Custom post type registration for CodeNagi.
 *
 * @package CodeNagi
 */

namespace CodeNagi;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and manages the CodeNagi custom post type.
 */
class Post_Type {
	const POST_TYPE = 'codenagi';
	const SLUG      = 'codenagi';

	/**
	 * Register hooks for the post type.
	 */
	public static function init(): void {
		add_action( 'init', array( __CLASS__, 'register' ) );
		add_filter( 'display_post_states', array( __CLASS__, 'add_tailwind_state' ), 10, 2 );
		add_filter( 'get_edit_post_link', array( __CLASS__, 'filter_edit_post_link' ), 10, 3 );
		add_filter( 'post_row_actions', array( __CLASS__, 'add_codenagi_row_action' ), 10, 2 );
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
			'name'               => _x( 'CodeNagi', 'post type general name', 'codenagi' ),
			'singular_name'      => _x( 'CodeNagi', 'post type singular name', 'codenagi' ),
			'add_new'            => _x( 'Add New', 'codenagi', 'codenagi' ),
			'add_new_item'       => __( 'Add New CodeNagi', 'codenagi' ),
			'edit_item'          => __( 'Edit CodeNagi', 'codenagi' ),
			'new_item'           => __( 'New CodeNagi', 'codenagi' ),
			'view_item'          => __( 'View on front end', 'codenagi' ),
			'view_items'         => __( 'View on front end', 'codenagi' ),
			'search_items'       => __( 'Search CodeNagi', 'codenagi' ),
			'not_found'          => __( 'No CodeNagi found', 'codenagi' ),
			'not_found_in_trash' => __( 'No CodeNagi found in Trash', 'codenagi' ),
			'all_items'          => __( 'CodeNagi', 'codenagi' ),
			'archives'           => __( 'CodeNagi Archives', 'codenagi' ),
		);

		$args = array(
			'label'               => __( 'CodeNagi', 'codenagi' ),
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
	 * Resolve the current slug for the CodeNagi post type.
	 *
	 * @return string
	 */
	public static function get_slug(): string {
		$value = get_option( Admin::OPTION_POST_SLUG, self::SLUG );
		$slug  = sanitize_title( (string) $value );

		return '' !== $slug ? $slug : self::SLUG;
	}

	/**
	 * Check whether a post is a CodeNagi post.
	 *
	 * @param int|\WP_Post $post Post ID or object.
	 * @return bool
	 */
	public static function is_codenagi_post( $post ): bool {
		$post = get_post( $post );
		return $post && self::POST_TYPE === $post->post_type;
	}

	/**
	 * Check whether single page view is enabled for a CodeNagi post.
	 *
	 * @param int $post_id CodeNagi post ID.
	 * @return bool
	 */
	public static function is_single_page_enabled( int $post_id ): bool {
		$value = get_post_meta( $post_id, '_codenagi_single_page_enabled', true );
		if ( '' === $value ) {
			return true;
		}

		return '1' === $value;
	}

	/**
	 * Build the editor URL for a CodeNagi post.
	 *
	 * @param int $post_id CodeNagi post ID.
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

		$is_tailwind = '1' === get_post_meta( $post->ID, '_codenagi_tailwind', true );
		if ( $is_tailwind ) {
			$states['codenagi_tailwind'] = __( 'TailwindCSS', 'codenagi' );
		}

		return $states;
	}

	/**
	 * Add a CodeNagi editor link to post row actions.
	 *
	 * @param array    $actions Row actions.
	 * @param \WP_Post $post Post object.
	 * @return array
	 */
	public static function add_codenagi_row_action( array $actions, \WP_Post $post ): array {
		if ( self::POST_TYPE !== $post->post_type ) {
			return $actions;
		}

		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return $actions;
		}

		$actions['codenagi_edit'] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( self::get_editor_url( $post->ID ) ),
			esc_html__( 'Edit in CodeNagi', 'codenagi' )
		);

		return $actions;
	}

	/**
	 * Override the edit link to point to the CodeNagi editor on the front end.
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

		if ( ! self::is_codenagi_post( $post_id ) ) {
			return $link;
		}

		return self::get_editor_url( $post_id );
	}

}


