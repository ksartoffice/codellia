=== WP LiveCode ===
Contributors: yourname
Tags: live preview, html, css, javascript, code editor, monaco, tailwind, shortcode
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
WP LiveCode provides a dedicated editor for building HTML, CSS, and JavaScript snippets with a live preview. It adds a "LiveCode" custom post type and redirects the standard editor to a Monaco-based UI.

Features:
* Custom LiveCode post type and dedicated editor
* Monaco Editor with HTML/CSS/JS tabs and live iframe preview
* Tailwind mode with on-demand compilation
* Import/export JSON projects
* External scripts/styles (https only) and optional Shadow DOM isolation
* Shortcode embedding: [livecode post_id="123"]

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/wp-livecode/.
2. Activate WP LiveCode through the Plugins screen.
3. Go to LiveCode in the admin menu and create a new LiveCode item.

== Frequently Asked Questions ==
= Who can edit LiveCode posts? =
Users who can edit the post can use the editor. JavaScript, external scripts/styles, shadow DOM, and shortcode settings require the unfiltered_html capability. Importing external images requires upload_files.

= How do I embed a LiveCode on a page? =
Use the shortcode: [livecode post_id="123"].

= Can I switch between Normal and Tailwind modes? =
The setup wizard lets you choose Normal or Tailwind. The choice is locked per LiveCode post.

= Where is the code stored? =
HTML is stored in the post content. CSS/JS and other settings are stored in post meta.

== Screenshots ==
1. LiveCode editor with live preview.
2. Settings panel and Tailwind mode.
3. Embedded LiveCode via shortcode.

== Changelog ==
= 1.0.0 =
* Initial release.

== Credits ==
This plugin bundles third-party libraries:
* Monaco Editor - MIT License - https://github.com/microsoft/monaco-editor
* TailwindPHP - MIT License - https://github.com/dnnsjsk/tailwindphp
