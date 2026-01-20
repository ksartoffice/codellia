<?php
namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) exit;

class Post_Type {
	const POST_TYPE = 'wp_livecode';
	const SLUG = 'wp-livecode';

	public static function init(): void {
		add_action( 'init', [ __CLASS__, 'register' ] );
		add_action( 'admin_init', [ __CLASS__, 'maybe_redirect_to_editor' ] );
		add_action( 'current_screen', [ __CLASS__, 'maybe_hide_classic_and_block' ] );
		add_filter( 'use_block_editor_for_post_type', [ __CLASS__, 'disable_block_editor' ], 10, 2 );
		add_filter( 'redirect_post_location', [ __CLASS__, 'redirect_after_save' ], 10, 2 );
		add_filter( 'display_post_states', [ __CLASS__, 'add_tailwind_state' ], 10, 2 );
	}

	public static function activation(): void {
		self::register();
		flush_rewrite_rules();
	}

	public static function deactivation(): void {
		flush_rewrite_rules();
	}

	public static function register(): void {
		$labels = [
			'name'               => 'LiveCode',
			'singular_name'      => 'LiveCode',
			'add_new'            => 'Add New',
			'add_new_item'       => 'Add New LiveCode',
			'edit_item'          => 'Edit LiveCode',
			'new_item'           => 'New LiveCode',
			'view_item'          => 'View LiveCode',
			'view_items'         => 'View LiveCode',
			'search_items'       => 'Search LiveCode',
			'not_found'          => 'No LiveCode found',
			'not_found_in_trash' => 'No LiveCode found in Trash',
			'all_items'          => 'LiveCode',
			'archives'           => 'LiveCode Archives',
		];

		$args = [
			'label'               => 'LiveCode',
			'labels'              => $labels,
			'public'              => true,
			'exclude_from_search' => false,
			'publicly_queryable'  => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_nav_menus'   => true,
			'show_in_admin_bar'   => true,
			'has_archive'         => true,
			'rewrite'             => [ 'slug' => self::SLUG, 'with_front' => false ],
			'supports'            => [ 'title', 'author', 'thumbnail' ],
			'taxonomies'          => [ 'category', 'post_tag' ],
			'show_in_rest'        => false,
			'menu_position'       => 21,
			'menu_icon'           => 'dashicons-editor-code',
		];

		register_post_type( self::POST_TYPE, $args );
	}

	public static function is_livecode_post( $post ): bool {
		$post = get_post( $post );
		return $post && $post->post_type === self::POST_TYPE;
	}

	public static function get_editor_url( int $post_id ): string {
		return add_query_arg(
			[
				'page'    => Admin::MENU_SLUG,
				'post_id' => $post_id,
			],
			admin_url( 'admin.php' )
		);
	}

	/**
	 * Redirect LiveCode CPT edit/new screens to our custom editor.
	 */
	public static function maybe_redirect_to_editor(): void {
		global $pagenow;

		if ( ! in_array( $pagenow, [ 'post-new.php', 'post.php' ], true ) ) {
			return;
		}

		$post_type = isset( $_GET['post_type'] ) ? sanitize_key( $_GET['post_type'] ) : '';
		$post_id   = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
		$action    = isset( $_GET['action'] ) ? sanitize_key( $_GET['action'] ) : '';

		// New post for our CPT.
		if ( $pagenow === 'post-new.php' ) {
			if ( $post_type === self::POST_TYPE ) {
				$post_id = self::maybe_create_draft();
				if ( $post_id ) {
					wp_safe_redirect( self::get_editor_url( $post_id ) );
					exit;
				}
			}
			return;
		}

		if ( $action && $action !== 'edit' ) {
			return;
		}

		if ( $post_id && self::is_livecode_post( $post_id ) ) {
			wp_safe_redirect( self::get_editor_url( $post_id ) );
			exit;
		}
	}

	/**
	 * Ensure the default editors stay disabled for the CPT.
	 */
	public static function maybe_hide_classic_and_block( $screen ): void {
		if ( ! $screen || $screen->post_type !== self::POST_TYPE ) {
			return;
		}
		remove_meta_box( 'submitdiv', self::POST_TYPE, 'side' );
	}

	public static function disable_block_editor( bool $use_block, string $post_type ): bool {
		if ( $post_type === self::POST_TYPE ) {
			return false;
		}
		return $use_block;
	}

	public static function redirect_after_save( $location, $post_id ) {
		if ( self::is_livecode_post( $post_id ) ) {
			return self::get_editor_url( $post_id );
		}
		return $location;
	}

	public static function add_tailwind_state( array $states, \WP_Post $post ): array {
		if ( $post->post_type !== self::POST_TYPE ) {
			return $states;
		}

		$is_tailwind = get_post_meta( $post->ID, '_lc_tailwind', true ) === '1';
		if ( $is_tailwind ) {
			$states['livecode_tailwind'] = 'TailwindCSS';
		}

		return $states;
	}

	private static function maybe_create_draft(): int {
		$post_id = wp_insert_post( [
			'post_type'   => self::POST_TYPE,
			'post_status' => 'draft',
			'post_title'  => 'Untitled LiveCode',
		], true );

		if ( is_wp_error( $post_id ) ) {
			return 0;
		}

		update_post_meta( $post_id, '_lc_setup_required', '1' );

		return (int) $post_id;
	}
}

