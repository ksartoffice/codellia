# Style Guide

This document captures project-wide naming conventions. Keep it in sync with the codebase.

## PHP
- Namespace: Codellia
- Class names: StudlyCaps with underscores for compound words (e.g., Post_Type, Rest_Save)
- Methods and variables: snake_case
- Constants: UPPER_SNAKE
- Files: class-codellia-*.php for classes, includes/rest for REST handlers
- CPT: codellia (slug: codellia)
- Option keys: codellia_*
- Post meta keys: _codellia_*

## JS/TS
- Local variables and functions: camelCase
- React components: PascalCase
- File names: kebab-case

## API / Payload Keys
- Identifiers: post_id
- Booleans: *Enabled suffix (jsEnabled, shadowDomEnabled, shortcodeEnabled, liveHighlightEnabled, tailwindEnabled)
- Tailwind flag: tailwindEnabled (not tailwind)

## JS Internal vs API Boundary
- JS/TS internal identifiers use camelCase (postId).
- API boundary (REST payloads, URLs, shortcode attrs) uses snake_case (post_id).

## Shortcodes
- Attributes: post_id

