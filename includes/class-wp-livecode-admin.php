<?php
/**
 * Admin screen integration for WP LiveCode.
 *
 * @package WP_LiveCode
 */

namespace WPLiveCode;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles admin UI routes and assets.
 */
class Admin {

	const MENU_SLUG                  = 'wp-livecode';
	const SETTINGS_SLUG              = 'wp-livecode-settings';
	const SETTINGS_GROUP             = 'wp_livecode_settings';
	const OPTION_POST_SLUG           = 'wp_livecode_post_slug';
	const OPTION_FLUSH_REWRITE       = 'wp_livecode_flush_rewrite';
	const OPTION_DELETE_ON_UNINSTALL = 'wp_livecode_delete_on_uninstall';
	/**
	 * Register admin hooks.
	 */
	public static function init(): void {

		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_action_wp_livecode', array( __CLASS__, 'action_redirect' ) ); // admin.php?action=wp_livecode.
		add_action( 'load-post-new.php', array( __CLASS__, 'maybe_redirect_new_post' ) );
		add_action( 'update_option_' . self::OPTION_POST_SLUG, array( __CLASS__, 'handle_post_slug_update' ), 10, 2 );
		add_action( 'add_option_' . self::OPTION_POST_SLUG, array( __CLASS__, 'handle_post_slug_add' ), 10, 2 );
		add_action( 'init', array( __CLASS__, 'maybe_flush_rewrite_rules' ), 20 );
	}
	/**
	 * Redirect from admin.php?action=wp_livecode to the custom editor page.
	 */
	public static function action_redirect(): void {
		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id ) {
			wp_die( esc_html__( 'post_id is required.', 'wp-livecode' ) );
		}
		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			wp_die( esc_html__( 'This editor is only available for LiveCode posts.', 'wp-livecode' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'Permission denied.', 'wp-livecode' ) );
		}
		wp_safe_redirect( Post_Type::get_editor_url( $post_id ) );
		exit;
	}

	/**
	 * Redirect new LiveCode posts directly to the custom editor.
	 */
	public static function maybe_redirect_new_post(): void {
		$post_type = isset( $_GET['post_type'] ) ? sanitize_key( $_GET['post_type'] ) : 'post'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( Post_Type::POST_TYPE !== $post_type ) {
			return;
		}

		$post_type_object = get_post_type_object( $post_type );
		if ( ! $post_type_object || ! current_user_can( $post_type_object->cap->create_posts ) ) {
			wp_die( esc_html__( 'Permission denied.', 'wp-livecode' ) );
		}

		$post = get_default_post_to_edit( $post_type, true );
		if ( ! $post || is_wp_error( $post ) ) {
			return;
		}

		wp_safe_redirect( Post_Type::get_editor_url( (int) $post->ID ) );
		exit;
	}

	/**
	 * Register the hidden admin page entry.
	 */
	public static function register_menu(): void {

		// Hidden admin page (no menu entry). Accessed via redirects only.
		add_submenu_page(
			null,
			__( 'WP LiveCode', 'wp-livecode' ),
			__( 'WP LiveCode', 'wp-livecode' ),
			'edit_posts',
			self::MENU_SLUG,
			array( __CLASS__, 'render_page' )
		);

		add_submenu_page(
			'edit.php?post_type=' . Post_Type::POST_TYPE,
			__( 'Settings', 'wp-livecode' ),
			__( 'Settings', 'wp-livecode' ),
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
			'wp_livecode_permalink',
			__( 'Permalink', 'wp-livecode' ),
			array( __CLASS__, 'render_permalink_section' ),
			self::SETTINGS_SLUG
		);

		add_settings_field(
			self::OPTION_POST_SLUG,
			__( 'LiveCode slug', 'wp-livecode' ),
			array( __CLASS__, 'render_post_slug_field' ),
			self::SETTINGS_SLUG,
			'wp_livecode_permalink'
		);

		add_settings_section(
			'wp_livecode_cleanup',
			__( 'Cleanup', 'wp-livecode' ),
			array( __CLASS__, 'render_cleanup_section' ),
			self::SETTINGS_SLUG
		);

		add_settings_field(
			self::OPTION_DELETE_ON_UNINSTALL,
			__( 'Delete data on uninstall', 'wp-livecode' ),
			array( __CLASS__, 'render_delete_on_uninstall_field' ),
			self::SETTINGS_SLUG,
			'wp_livecode_cleanup'
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
		echo '<p>' . esc_html__( 'Change the URL slug for LiveCode posts. Existing URLs will change after saving.', 'wp-livecode' ) . '</p>';
	}

	/**
	 * Render post slug input field.
	 */
	public static function render_post_slug_field(): void {
		$value = get_option( self::OPTION_POST_SLUG, Post_Type::SLUG );
		echo '<input type="text" class="regular-text" name="' . esc_attr( self::OPTION_POST_SLUG ) . '" value="' . esc_attr( $value ) . '" />';
		echo '<p class="description">' . esc_html__( 'Allowed: lowercase letters, numbers, and hyphens. Default: wp-livecode.', 'wp-livecode' ) . '</p>';
	}

	/**
	 * Render cleanup section description.
	 */
	public static function render_cleanup_section(): void {

		echo '<p>' . esc_html__( 'Choose whether LiveCode posts should be deleted when the plugin is uninstalled.', 'wp-livecode' ) . '</p>';
	}

	/**
	 * Render delete-on-uninstall checkbox field.
	 */
	public static function render_delete_on_uninstall_field(): void {

		$value = get_option( self::OPTION_DELETE_ON_UNINSTALL, '0' );
		echo '<label>';
		echo '<input type="checkbox" name="' . esc_attr( self::OPTION_DELETE_ON_UNINSTALL ) . '" value="1" ' . checked( '1', $value, false ) . ' />';
		echo ' ' . esc_html__( 'Delete all LiveCode posts on uninstall (imported media is kept).', 'wp-livecode' );
		echo '</label>';
	}

	/**
	 * Render the admin editor container.
	 */
	public static function render_page(): void {
		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id ) {
			echo '<div class="wrap"><h1>' . esc_html__( 'WP LiveCode', 'wp-livecode' ) . '</h1><p>' . esc_html__( 'post_id is required.', 'wp-livecode' ) . '</p></div>';
			return;
		}
		if ( ! Post_Type::is_livecode_post( $post_id ) ) {
			wp_die( esc_html__( 'This editor is only available for LiveCode posts.', 'wp-livecode' ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'Permission denied.', 'wp-livecode' ) );
		}

		echo '<div id="wp-livecode-app" data-post-id="' . esc_attr( $post_id ) . '"></div>';
	}

	/**
	 * Render settings page.
	 */
	public static function render_settings_page(): void {

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		echo '<div class="wrap">';
		echo '<h1>' . esc_html__( 'WP LiveCode Settings', 'wp-livecode' ) . '</h1>';
		echo '<form action="options.php" method="post">';
		settings_fields( self::SETTINGS_GROUP );
		do_settings_sections( self::SETTINGS_SLUG );
		submit_button();
		echo '</form>';
		echo '</div>';
	}
	/**
	 * Enqueue admin assets for the LiveCode editor.
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public static function enqueue_assets( string $hook_suffix ): void {
		// Only load on our hidden page.
		if ( 'admin_page_' . self::MENU_SLUG !== $hook_suffix ) {
			return;
		}

		$post_id = isset( $_GET['post_id'] ) ? absint( $_GET['post_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $post_id || ! Post_Type::is_livecode_post( $post_id ) ) {
			return;
		}

		// Monaco AMD loader lives in assets/monaco/vs/loader.js.
		wp_register_script(
			'wp-livecode-monaco-loader',
			WP_LIVECODE_URL . 'assets/monaco/vs/loader.js',
			array(),
			WP_LIVECODE_VERSION,
			true
		);
		wp_add_inline_script(
			'wp-livecode-monaco-loader',
			'if (typeof window.define === "function" && window.define.amd) { window.__lcDefineAmd = window.define.amd; window.define.amd = undefined; }',
			'after'
		);

		// Admin app bundle (Vite output).
		wp_register_script(
			'wp-livecode-admin',
			WP_LIVECODE_URL . 'assets/dist/main.js',
			array( 'wp-livecode-monaco-loader', 'wp-api-fetch', 'wp-element', 'wp-i18n' ),
			WP_LIVECODE_VERSION,
			true
		);

		wp_register_style(
			'wp-livecode-admin',
			WP_LIVECODE_URL . 'assets/dist/style.css',
			array(),
			WP_LIVECODE_VERSION
		);

		wp_enqueue_script( 'wp-livecode-admin' );
		wp_enqueue_style( 'wp-livecode-admin' );
		wp_enqueue_media();

		wp_set_script_translations(
			'wp-livecode-admin',
			'wp-livecode',
			WP_LIVECODE_PATH . 'languages'
		);

		// Inject initial data for the admin app.
		$post       = $post_id ? get_post( $post_id ) : null;
		$html       = $post ? (string) $post->post_content : '';
		$css        = $post_id ? (string) get_post_meta( $post_id, '_lc_css', true ) : '';
		$js         = $post_id ? (string) get_post_meta( $post_id, '_lc_js', true ) : '';
		$js_enabled = $post_id ? get_post_meta( $post_id, '_lc_js_enabled', true ) === '1' : false;
		$back_url   = $post_id ? get_edit_post_link( $post_id, 'raw' ) : admin_url( 'edit.php?post_type=' . Post_Type::POST_TYPE );

		$preview_token      = $post_id ? wp_create_nonce( 'lc_preview_' . $post_id ) : '';
		$preview_url        = $post_id ? add_query_arg( 'preview', 'true', get_permalink( $post_id ) ) : home_url( '/' );
		$iframe_preview_url = $post_id
			? add_query_arg(
				array(
					'lc_preview' => 1,
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
			'jsEnabled'           => $js_enabled,
			'canEditJs'           => current_user_can( 'unfiltered_html' ),
			'previewUrl'          => $preview_url,
			'iframePreviewUrl'    => $iframe_preview_url,
			'monacoVsPath'        => WP_LIVECODE_URL . 'assets/monaco/vs',
			'restUrl'             => rest_url( 'wp-livecode/v1/save' ),
			'restCompileUrl'      => rest_url( 'wp-livecode/v1/compile-tailwind' ),
			'renderShortcodesUrl' => rest_url( 'wp-livecode/v1/render-shortcodes' ),
			'setupRestUrl'        => rest_url( 'wp-livecode/v1/setup' ),
			'importRestUrl'       => rest_url( 'wp-livecode/v1/import' ),
			'backUrl'             => $back_url,
			'settingsRestUrl'     => rest_url( 'wp-livecode/v1/settings' ),
			'settingsData'        => Rest::build_settings_payload( $post_id ),
			'tailwindEnabled'     => (bool) get_post_meta( $post_id, '_lc_tailwind', true ),
			'setupRequired'       => get_post_meta( $post_id, '_lc_setup_required', true ) === '1',
			'restNonce'           => wp_create_nonce( 'wp_rest' ),
		);

		wp_add_inline_script(
			'wp-livecode-admin',
			'window.WP_LIVECODE = ' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . ';',
			'before'
		);
	}
}
