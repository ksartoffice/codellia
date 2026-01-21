WP LiveCode - WordPress HTML/CSS/JS ライブエディタ
===============================================

概要
----
- LiveCode専用のカスタム投稿タイプ `wp_livecode` を登録し、通常の投稿/固定ページは対象外。
- `post-new.php`/`post.php` から専用エディタ (`admin.php?page=wp-livecode`) へ自動リダイレクトし、ブロック/クラシックは無効。
- Monaco Editor で HTML/CSS/JavaScript を編集し、右側 iframe に実フロントを即時プレビュー。
- 管理一覧には TailwindCSS 使用状態を表示。

編集UI (React)
-------------
- ツールバー: Back, Undo/Redo, エディタ表示切替, Save, Export, Settings。未保存の変更を表示し、離脱時に警告。
- エディタ: HTML と CSS/JS タブ、JS は Run ボタンでプレビューへ即時実行。
- ペインは左右/上下リサイズ、設定パネルはタブ式 (投稿/デザイン/要素) で開閉。
- 要素タブ: 選択した要素のテキスト/属性を編集（安全なテキストノードのみ）。

プレビューと DOM セレクタ
--------------------------
- `?lc_preview=1&post_id=...&token=...` で実フロントを表示し、`<!--wp-livecode:start-->...<!--wp-livecode:end-->` 内を差し替え。
- parse5 で `data-lc-id` を付与し、ホバー/クリックで該当要素をハイライト。
- 選択時に要素タブを開くアクションボタンを表示し、エディタ/設定と選択状態を同期。

セットアップ/インポート
----------------------
- 初回はセットアップウィザードで「Normal」/「Tailwind」/「Import JSON」を選択し、`_lc_tailwind_locked` で固定。
- Import/Export JSON v1: HTML/CSS/JS、Tailwind、生成CSS、外部スクリプト/スタイル、Shadow DOM/Shortcode/Live Highlight。
- Import時に外部画像をメディアライブラリへ取り込み、警告/取り込み結果を返却（`upload_files` 権限が必要）。

Tailwind CSS
------------
- Tailwind モードでは TailwindPHP で CSS を自動コンパイル。
- 生成CSSは `_lc_generated_css`、ユーザーCSSは `_lc_css` に保存。
- プレビューは `LC_SET_CSS` で CSS だけ差し替え可能。

外部アセット (Script / Style)
------------------------------
- 外部スクリプト: https:// のみ、最大 5 件。JS 有効時のみ読み込み。
- 外部スタイル: https:// のみ、最大 5 件。プレビュー/フロントに `<link>` で読み込み。

Shadow DOM
----------
- 有効化時は `<template shadowrootmode="open">` で隔離し、CSS/JS/外部スタイルを Shadow root 内に適用。

ショートコード
--------------
- `[livecode post_id="123"]` で埋め込み可能。公開状態/権限をチェックし、Shadow DOM 設定も尊重。

フロント表示
------------
- LiveCode 投稿の本文を出力し、CSS/JS/外部アセットをインラインまたは enqueue。
- Shadow DOM 有効時はホスト要素にテンプレートを差し込み。

REST API
--------
- `/wp-livecode/v1/save`: HTML/CSS/JS の保存、Tailwind コンパイル。
- `/wp-livecode/v1/compile-tailwind`: プレビュー用コンパイル。
- `/wp-livecode/v1/setup`: セットアップモード決定。
- `/wp-livecode/v1/import`: JSON インポート（外部画像の取り込み）。
- `/wp-livecode/v1/settings`: 投稿/デザイン設定の更新。
- `/wp-livecode/v1/render-shortcodes`: ショートコードのサーバレンダリング。

保存データ (post_meta)
----------------------
- `_lc_css`, `_lc_js`, `_lc_js_enabled`
- `_lc_tailwind`, `_lc_tailwind_locked`, `_lc_generated_css`
- `_lc_shadow_dom`, `_lc_shortcode_enabled`
- `_lc_external_scripts`, `_lc_external_styles`
- `_lc_live_highlight`, `_lc_setup_required`
- 添付メディアには `_lc_source_url` を保存（外部画像取り込み時）。

postMessage プロトコル
----------------------
- 親 -> iframe: `LC_INIT`, `LC_RENDER`, `LC_SET_CSS`, `LC_RUN_JS`, `LC_DISABLE_JS`,
  `LC_EXTERNAL_SCRIPTS`, `LC_EXTERNAL_STYLES`, `LC_SET_HIGHLIGHT`, `LC_SET_ELEMENTS_TAB_OPEN`
- iframe -> 親: `LC_READY`, `LC_SELECT`, `LC_OPEN_ELEMENTS_TAB`

権限/セキュリティ
-----------------
- LiveCode 投稿かつ `edit_post` を満たす場合のみ編集可能。
- JS/外部スクリプト/外部スタイル/Shadow DOM/ショートコードの更新は `unfiltered_html` が必要。
- 画像取り込みは `upload_files` が必要。
- プレビューは nonce 付き token と `event.origin` を検証。
