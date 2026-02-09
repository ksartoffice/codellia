=== Codellia Editor ===
Contributors: yourname
Tags: live preview, code editor, monaco, tailwind, shortcode
Requires at least: 6.6
Tested up to: 6.9
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Codellia Editor - Live HTML/CSS/JS Editor with Tailwind CSS.

== Description ==
Codellia Editor provides a dedicated editor for building HTML, CSS, and JavaScript snippets with a live preview. It adds a "Codellia" custom post type, opens new Codellia posts in the editor, and adds an "Edit with Codellia" button to the standard editor.

Features:
* Custom Codellia post type and dedicated editor
* Monaco Editor with HTML/CSS/JS tabs and live iframe preview
* Tailwind mode with on-demand compilation
* Import/export JSON projects
* External scripts/styles (https only), live edit highlight, and optional Shadow DOM isolation
* Shortcode embedding (enable in settings): [codellia post_id="123"]
* Optional single-page disable for shortcode-based output

== Installation ==
1. Upload the plugin folder to /wp-content/plugins/codellia/.
2. Activate Codellia Editor through the Plugins screen.
3. Go to Codellia in the admin menu and create a new Codellia item.

== Frequently Asked Questions ==
= Who can edit Codellia posts? =
Users who can edit the post can use the editor. JavaScript, external scripts/styles, shadow DOM, shortcode, and single-page settings require the unfiltered_html capability.

= How do I embed a Codellia on a page? =
Enable the shortcode in Codellia settings, then use: [codellia post_id="123"].

= Can I disable the single page view? =
Yes. Enable the shortcode and turn on "Do not publish as single page." Disabled single pages are marked noindex and excluded from search/archives, and the single-page request is redirected (or can be forced to 404 via the codellia_single_page_redirect filter).

= Can I switch between Normal and Tailwind modes? =
The setup wizard lets you choose Normal or Tailwind. The choice is locked per Codellia post.

= Can I change the Codellia URL slug? =
Yes. Go to Codellia > Settings and update the Codellia slug.

= Does the plugin delete data on uninstall? =
By default, Codellia posts are kept when the plugin is uninstalled. You can enable data removal from the Codellia > Settings screen.

= Where is the code stored? =
HTML is stored in the post content. CSS/JS and other settings are stored in post meta.

== Screenshots ==
1. Codellia editor with live preview.
2. Settings panel and Tailwind mode.
3. Embedded Codellia via shortcode.

== Changelog ==
= 1.0.0 =
* Initial release.

== Credits ==
This plugin bundles third-party libraries:
* Monaco Editor - MIT License (see assets/monaco/LICENSE) - https://github.com/microsoft/monaco-editor
* TailwindPHP - MIT License - https://github.com/dnnsjsk/tailwindphp
