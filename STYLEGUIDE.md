# Style Guide

This document captures project-wide naming conventions. Keep it in sync with the codebase.

## PHP
- Namespace: WPLiveCode
- Class names: StudlyCaps with underscores for compound words (e.g., Post_Type, Rest_Save)
- Methods and variables: snake_case
- Constants: UPPER_SNAKE
- Files: class-wp-livecode-*.php for classes, includes/rest for REST handlers
- CPT: wp_livecode, slug wp-livecode
- Option keys: wp_livecode_*
- Post meta keys: _lc_*

## JS/TS
- Local variables and functions: camelCase
- React components: PascalCase
- File names: kebab-case

## API / Payload Keys
- Identifiers: post_id
- Booleans: *Enabled suffix (jsEnabled, shadowDomEnabled, shortcodeEnabled, liveHighlightEnabled, tailwindEnabled)
- Tailwind flag: tailwindEnabled (not tailwind)

## Shortcodes
- Attributes: post_id
