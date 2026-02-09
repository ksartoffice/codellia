<?php
/**
 * Bridge the default editor screen to the Codellia editor.
 *
 * @package Codellia
 */

namespace Codellia;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles the default editor experience for Codellia posts.
 */
class Editor_Bridge {
	const SCRIPT_HANDLE = 'codellia-editor-bridge';
	const STYLE_HANDLE  = 'codellia-editor-bridge';

	/**
	 * Register hooks for the editor bridge.
	 */
	public static function init(): void {
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_block_assets' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_classic_assets' ) );
		add_action( 'save_post_' . Post_Type::POST_TYPE, array( __CLASS__, 'maybe_mark_setup_required' ), 10, 3 );
	}

	/**
	 * Enqueue assets for the block editor.
	 */
	public static function enqueue_block_assets(): void {
		$screen = get_current_screen();
		if ( ! self::is_codellia_screen( $screen ) ) {
			return;
		}

		self::enqueue_assets();
	}

	/**
	 * Enqueue assets for the classic editor.
	 *
	 * @param string $hook_suffix Current admin hook.
	 */
	public static function enqueue_classic_assets( string $hook_suffix ): void {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( ! self::is_codellia_screen( $screen ) ) {
			return;
		}

		if ( $screen && method_exists( $screen, 'is_block_editor' ) && $screen->is_block_editor() ) {
			return;
		}

		self::enqueue_assets();
	}

	/**
	 * Set up the enqueue data for both editors.
	 */
	private static function enqueue_assets(): void {
		wp_register_script(
			self::SCRIPT_HANDLE,
			CODELLIA_URL . 'assets/admin/editor-bridge.js',
			array( 'wp-i18n', 'wp-dom-ready', 'wp-data' ),
			CODELLIA_VERSION,
			true
		);

		wp_register_style(
			self::STYLE_HANDLE,
			CODELLIA_URL . 'assets/admin/editor-bridge.css',
			array(),
			CODELLIA_VERSION
		);

		wp_enqueue_script( self::SCRIPT_HANDLE );
		wp_enqueue_style( self::STYLE_HANDLE );

		$data = array(
			'postId'    => self::resolve_post_id(),
			'postType'  => Post_Type::POST_TYPE,
			'actionUrl' => admin_url( 'admin.php?action=codellia' ),
		);

		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.CODELLIA_EDITOR = ' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . ';',
			'before'
		);

		wp_set_script_translations(
			self::SCRIPT_HANDLE,
			'codellia',
			CODELLIA_PATH . 'languages'
		);
	}

	/**
	 * Mark new Codellia posts as requiring setup.
	 *
	 * @param int      $post_id Post ID.
	 * @param \WP_Post $post Post object.
	 * @param bool     $update Whether this is an existing post.
	 */
	public static function maybe_mark_setup_required( int $post_id, \WP_Post $post, bool $update ): void {
		if ( $update ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		if ( Post_Type::POST_TYPE !== $post->post_type ) {
			return;
		}

		if ( get_post_meta( $post_id, '_codellia_setup_required', true ) === '1' ) {
			return;
		}

		update_post_meta( $post_id, '_codellia_setup_required', '1' );
	}

	/**
	 * Resolve the current post ID for editor screens.
	 *
	 * @return int
	 */
	private static function resolve_post_id(): int {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( ! $post_id ) {
			$post = get_post();
			if ( $post && Post_Type::POST_TYPE === $post->post_type ) {
				$post_id = (int) $post->ID;
			}
		}

		return $post_id;
	}

	/**
	 * Check if the screen is for the Codellia CPT.
	 *
	 * @param \WP_Screen|null $screen Current screen.
	 * @return bool
	 */
	private static function is_codellia_screen( $screen ): bool {
		return $screen && Post_Type::POST_TYPE === $screen->post_type;
	}
}
