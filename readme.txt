=== CodeNagi ===
Contributors: yourname
Tags: live preview, code editor, monaco, tailwind, shortcode
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

CodeNagi – Live HTML/CSS/JS Editor with Tailwind CSS.

== Description ==
CodeNagi provides a dedicated editor for building HTML, CSS, and JavaScript snippets with a live preview. It adds a "CodeNagi" custom post type and redirects the standard editor to a Monaco-based UI.

Features:
* Custom CodeNagi post type and dedicated editor
* Monaco Editor with HTML/CSS/JS tabs and live iframe preview
* Tailwind mode with on-demand compilation
* Import/export JSON projects
* External scripts/styles (https only) and optional Shadow DOM isolation
* Shortcode embedding: [codenagi post_id="123"]

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/codenagi/.
2. Activate CodeNagi through the Plugins screen.
3. Go to CodeNagi in the admin menu and create a new CodeNagi item.

== Frequently Asked Questions ==
= Who can edit CodeNagi posts? =
Users who can edit the post can use the editor. JavaScript, external scripts/styles, shadow DOM, and shortcode settings require the unfiltered_html capability. Importing external images requires upload_files.

= How do I embed a CodeNagi on a page? =
Use the shortcode: [codenagi post_id="123"].

= Can I switch between Normal and Tailwind modes? =
The setup wizard lets you choose Normal or Tailwind. The choice is locked per CodeNagi post.

= Does the plugin delete data on uninstall? =
By default, CodeNagi posts are kept when the plugin is uninstalled. You can enable data removal from the CodeNagi > Settings screen.

= Where is the code stored? =
HTML is stored in the post content. CSS/JS and other settings are stored in post meta.

== Screenshots ==
1. CodeNagi editor with live preview.
2. Settings panel and Tailwind mode.
3. Embedded CodeNagi via shortcode.

== Changelog ==
= 1.0.0 =
* Initial release.

== Credits ==
This plugin bundles third-party libraries:
* Monaco Editor - MIT License (see assets/monaco/LICENSE) - https://github.com/microsoft/monaco-editor
* TailwindPHP - MIT License - https://github.com/dnnsjsk/tailwindphp
