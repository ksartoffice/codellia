<?php
/**
 * Admin screen integration for CodeNagi.
 *
 * @package CodeNagi
 */

namespace CodeNagi;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles admin UI routes and assets.
 */
class Admin {

	const MENU_SLUG                  = 'codenagi';
	const SETTINGS_SLUG              = 'codenagi-settings';
	const SETTINGS_GROUP             = 'codenagi_settings';
	const OPTION_POST_SLUG           = 'codenagi_post_slug';
	const OPTION_FLUSH_REWRITE       = 'codenagi_flush_rewrite';
	const OPTION_DELETE_ON_UNINSTALL = 'codenagi_delete_on_uninstall';
	/**
	 * Register admin hooks.
	 */
	public static function init(): void {

		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_action_codenagi', array( __CLASS__, 'action_redirect' ) ); // admin.php?action=codenagi.
		add_action( 'load-post-new.php', array( __CLASS__, 'maybe_redirect_new_post' ) );
		add_action( 'update_option_' . self::OPTION_POST_SLUG, array( __CLASS__, 'handle_post_slug_update' ), 10, 2 );
		add_action( 'add_option_' . self::OPTION_POST_SLUG, array( __CLASS__, 'handle_post_slug_add' ), 10, 2 );
		add_action( 'init', array( __CLASS__, 'maybe_flush_rewrite_rules' ), 20 );
	}
	/**
	 * Redirect from admin.php?action=codenagi to the custom editor page.
	 */
	public static function action_redirect(): void {
		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id ) {
			wp_die( esc_html__( 'post_id is required.', 'codenagi' ) );
		}
		if ( ! Post_Type::is_codenagi_post( $post_id ) ) {
			wp_die( esc_html__( 'This editor is only available for CodeNagi posts.', 'codenagi' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'Permission denied.', 'codenagi' ) );
		}
		wp_safe_redirect( Post_Type::get_editor_url( $post_id ) );
		exit;
	}

	/**
	 * Redirect new CodeNagi posts directly to the custom editor.
	 */
	public static function maybe_redirect_new_post(): void {
		$post_type = isset( $_GET['post_type'] ) ? sanitize_key( $_GET['post_type'] ) : 'post'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( Post_Type::POST_TYPE !== $post_type ) {
			return;
		}

		$post_type_object = get_post_type_object( $post_type );
		if ( ! $post_type_object || ! current_user_can( $post_type_object->cap->create_posts ) ) {
			wp_die( esc_html__( 'Permission denied.', 'codenagi' ) );
		}

		$post_id = wp_insert_post(
			array(
				'post_type'   => $post_type,
				'post_status' => 'draft',
				'post_title'  => __( 'Untitled CodeNagi', 'codenagi' ),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return;
		}

		wp_safe_redirect( Post_Type::get_editor_url( (int) $post_id ) );
		exit;
	}

	/**
	 * Register the hidden admin page entry.
	 */
	public static function register_menu(): void {

		// Hidden admin page (no menu entry). Accessed via redirects only.
		add_submenu_page(
			null,
			__( 'CodeNagi', 'codenagi' ),
			__( 'CodeNagi', 'codenagi' ),
			'edit_posts',
			self::MENU_SLUG,
			array( __CLASS__, 'render_page' )
		);

		add_submenu_page(
			'edit.php?post_type=' . Post_Type::POST_TYPE,
			__( 'Settings', 'codenagi' ),
			__( 'Settings', 'codenagi' ),
			'manage_options',
			self::SETTINGS_SLUG,
			array( __CLASS__, 'render_settings_page' )
		);
	}

	/**
	 * Register settings for the plugin.
	 */
	public static function register_settings(): void {

		register_setting(
			self::SETTINGS_GROUP,
			self::OPTION_POST_SLUG,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( __CLASS__, 'sanitize_post_slug' ),
				'default'           => Post_Type::SLUG,
			)
		);

		register_setting(
			self::SETTINGS_GROUP,
			self::OPTION_DELETE_ON_UNINSTALL,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( __CLASS__, 'sanitize_delete_on_uninstall' ),
				'default'           => '0',
			)
		);

		add_settings_section(
			'codenagi_permalink',
			__( 'Permalink', 'codenagi' ),
			array( __CLASS__, 'render_permalink_section' ),
			self::SETTINGS_SLUG
		);

		add_settings_field(
			self::OPTION_POST_SLUG,
			__( 'CodeNagi slug', 'codenagi' ),
			array( __CLASS__, 'render_post_slug_field' ),
			self::SETTINGS_SLUG,
			'codenagi_permalink'
		);

		add_settings_section(
			'codenagi_cleanup',
			__( 'Cleanup', 'codenagi' ),
			array( __CLASS__, 'render_cleanup_section' ),
			self::SETTINGS_SLUG
		);

		add_settings_field(
			self::OPTION_DELETE_ON_UNINSTALL,
			__( 'Delete data on uninstall', 'codenagi' ),
			array( __CLASS__, 'render_delete_on_uninstall_field' ),
			self::SETTINGS_SLUG,
			'codenagi_cleanup'
		);
	}

	/**
	 * Sanitize delete-on-uninstall value.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_delete_on_uninstall( $value ): string {

		return '1' === $value ? '1' : '0';
	}

	/**
	 * Sanitize post slug value.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function sanitize_post_slug( $value ): string {
		$slug = sanitize_title( (string) $value );
		return '' !== $slug ? $slug : Post_Type::SLUG;
	}

	/**
	 * Flush rewrite rules when the post slug changes.
	 *
	 * @param string $old_value Old value.
	 * @param string $new_value New value.
	 */
	public static function handle_post_slug_update( $old_value, $new_value ): void {
		if ( (string) $old_value !== (string) $new_value ) {
			update_option( self::OPTION_FLUSH_REWRITE, '1' );
		}
	}

	/**
	 * Flush rewrite rules when the post slug is added for the first time.
	 *
	 * @param string $option Option name.
	 * @param string $value Option value.
	 */
	public static function handle_post_slug_add( $option, $value ): void {
		if ( (string) $value !== '' ) {
			update_option( self::OPTION_FLUSH_REWRITE, '1' );
		}
	}

	/**
	 * Flush rewrite rules after the post type is registered.
	 */
	public static function maybe_flush_rewrite_rules(): void {
		$should_flush = get_option( self::OPTION_FLUSH_REWRITE, '0' );
		if ( '1' !== $should_flush ) {
			return;
		}

		flush_rewrite_rules( false );
		delete_option( self::OPTION_FLUSH_REWRITE );
	}

	/**
	 * Render permalink section description.
	 */
	public static function render_permalink_section(): void {
		echo '<p>' . esc_html__( 'Change the URL slug for CodeNagi posts. Existing URLs will change after saving.', 'codenagi' ) . '</p>';
	}

	/**
	 * Render post slug input field.
	 */
	public static function render_post_slug_field(): void {
		$value = get_option( self::OPTION_POST_SLUG, Post_Type::SLUG );
		echo '<input type="text" class="regular-text" name="' . esc_attr( self::OPTION_POST_SLUG ) . '" value="' . esc_attr( $value ) . '" />';
		echo '<p class="description">' . esc_html__( 'Allowed: lowercase letters, numbers, and hyphens. Default: codenagi.', 'codenagi' ) . '</p>';
	}

	/**
	 * Render cleanup section description.
	 */
	public static function render_cleanup_section(): void {

		echo '<p>' . esc_html__( 'Choose whether CodeNagi posts should be deleted when the plugin is uninstalled.', 'codenagi' ) . '</p>';
	}

	/**
	 * Render delete-on-uninstall checkbox field.
	 */
	public static function render_delete_on_uninstall_field(): void {

		$value = get_option( self::OPTION_DELETE_ON_UNINSTALL, '0' );
		echo '<label>';
		echo '<input type="checkbox" name="' . esc_attr( self::OPTION_DELETE_ON_UNINSTALL ) . '" value="1" ' . checked( '1', $value, false ) . ' />';
		echo ' ' . esc_html__( 'Delete all CodeNagi posts on uninstall (imported media is kept).', 'codenagi' );
		echo '</label>';
	}

	/**
	 * Render the admin editor container.
	 */
	public static function render_page(): void {
		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id ) {
			echo '<div class="wrap"><h1>' . esc_html__( 'CodeNagi', 'codenagi' ) . '</h1><p>' . esc_html__( 'post_id is required.', 'codenagi' ) . '</p></div>';
			return;
		}
		if ( ! Post_Type::is_codenagi_post( $post_id ) ) {
			wp_die( esc_html__( 'This editor is only available for CodeNagi posts.', 'codenagi' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'Permission denied.', 'codenagi' ) );
		}

		echo '<div id="codenagi-app" data-post-id="' . esc_attr( $post_id ) . '"></div>';
	}

	/**
	 * Render settings page.
	 */
	public static function render_settings_page(): void {

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		echo '<div class="wrap">';
		echo '<h1>' . esc_html__( 'CodeNagi Settings', 'codenagi' ) . '</h1>';
		echo '<form action="options.php" method="post">';
		settings_fields( self::SETTINGS_GROUP );
		do_settings_sections( self::SETTINGS_SLUG );
		submit_button();
		echo '</form>';
		echo '</div>';
	}
	/**
	 * Enqueue admin assets for the CodeNagi editor.
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public static function enqueue_assets( string $hook_suffix ): void {
		// Only load on our hidden page.
		if ( 'admin_page_' . self::MENU_SLUG !== $hook_suffix ) {
			return;
		}

		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id || ! Post_Type::is_codenagi_post( $post_id ) ) {
			return;
		}

		// Monaco AMD loader lives in assets/monaco/vs/loader.js.
		wp_register_script(
			'codenagi-monaco-loader',
			CODENAGI_URL . 'assets/monaco/vs/loader.js',
			array(),
			CODENAGI_VERSION,
			true
		);
		wp_add_inline_script(
			'codenagi-monaco-loader',
			'if (typeof window.define === "function" && window.define.amd) { window.__codenagiDefineAmd = window.define.amd; window.define.amd = undefined; }',
			'after'
		);

		// Admin app bundle (Vite output).
		wp_register_script(
			'codenagi-admin',
			CODENAGI_URL . 'assets/dist/main.js',
			array( 'codenagi-monaco-loader', 'wp-api-fetch', 'wp-element', 'wp-i18n', 'wp-data', 'wp-components', 'wp-notices' ),
			CODENAGI_VERSION,
			true
		);

		wp_register_style(
			'codenagi-admin',
			CODENAGI_URL . 'assets/dist/style.css',
			array(),
			CODENAGI_VERSION
		);

		wp_enqueue_script( 'codenagi-admin' );
		wp_enqueue_style( 'codenagi-admin' );
		wp_enqueue_style( 'wp-components' );
		wp_enqueue_media();

		wp_set_script_translations(
			'codenagi-admin',
			'codenagi',
			CODENAGI_PATH . 'languages'
		);

		// Inject initial data for the admin app.
		$post       = $post_id ? get_post( $post_id ) : null;
		$html       = $post ? (string) $post->post_content : '';
		$css        = $post_id ? (string) get_post_meta( $post_id, '_codenagi_css', true ) : '';
		$js         = $post_id ? (string) get_post_meta( $post_id, '_codenagi_js', true ) : '';
		$back_url   = $post_id ? get_edit_post_link( $post_id, 'raw' ) : admin_url( 'edit.php?post_type=' . Post_Type::POST_TYPE );

		$preview_token      = $post_id ? wp_create_nonce( 'codenagi_preview_' . $post_id ) : '';
		$preview_url        = $post_id ? add_query_arg( 'preview', 'true', get_permalink( $post_id ) ) : home_url( '/' );
		$iframe_preview_url = $post_id
			? add_query_arg(
				array(
					'codenagi_preview' => 1,
					'post_id'    => $post_id,
					'token'      => $preview_token,
				),
				get_permalink( $post_id )
			)
			: $preview_url;

		$data = array(
			'post_id'             => $post_id,
			'initialHtml'         => $html,
			'initialCss'          => $css,
			'initialJs'           => $js,
			'canEditJs'           => current_user_can( 'unfiltered_html' ),
			'previewUrl'          => $preview_url,
			'iframePreviewUrl'    => $iframe_preview_url,
			'monacoVsPath'        => CODENAGI_URL . 'assets/monaco/vs',
			'restUrl'             => rest_url( 'codenagi/v1/save' ),
			'restCompileUrl'      => rest_url( 'codenagi/v1/compile-tailwind' ),
			'renderShortcodesUrl' => rest_url( 'codenagi/v1/render-shortcodes' ),
			'setupRestUrl'        => rest_url( 'codenagi/v1/setup' ),
			'importRestUrl'       => rest_url( 'codenagi/v1/import' ),
			'backUrl'             => $back_url,
			'settingsRestUrl'     => rest_url( 'codenagi/v1/settings' ),
			'settingsData'        => Rest::build_settings_payload( $post_id ),
			'tailwindEnabled'     => (bool) get_post_meta( $post_id, '_codenagi_tailwind', true ),
			'setupRequired'       => get_post_meta( $post_id, '_codenagi_setup_required', true ) === '1',
			'restNonce'           => wp_create_nonce( 'wp_rest' ),
		);

		wp_add_inline_script(
			'codenagi-admin',
			'window.CODENAGI = ' . wp_json_encode(
				$data,
				JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
			) . ';',
			'before'
		);
	}
}


