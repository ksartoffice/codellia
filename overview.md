WP LiveCode - WordPress HTML/CSS/JS ライブエディタ
===============================================

概要
----
- LiveCode専用のカスタム投稿タイプ `wp_livecode` を登録し、通常の投稿/固定ページは対象外。
- `post-new.php`/`post.php` から専用エディタ (`admin.php?page=wp-livecode`) へ自動リダイレクト。
- HTML/CSS/JavaScript を Monaco Editor で編集し、右側の iframe に実フロントを即時プレビュー。

編集UI (React)
-------------
- ツールバー: Back, Undo/Redo, エディタ表示切替, Save, Export, Settings。
- エディタ: HTML と CSS/JS タブ、JS は Run ボタンでプレビューへ即時実行。
- ペインは左右/上下リサイズ、設定パネルはスライド開閉。
- 設定パネル (投稿): タイトル、ステータス/公開設定、公開日時、スラッグ、作者、
  テンプレート、フォーマット、コメント/ピン、カテゴリー、タグ、アイキャッチを編集。
- 設定パネル (デザイン): JavaScript/Shadow DOM/ショートコード/ライブハイライトのON/OFF、
  外部スクリプトの管理。

セットアップ/インポート
----------------------
- 初回はセットアップウィザードで「Normal」か「Tailwind」か「Import JSON」を選択。
- 選択したモードは `_lc_tailwind_locked` で固定。
- Import/Export JSON v1: HTML/CSS/JS、Tailwind 有無、生成CSS、外部スクリプト、
  Shadow DOM/Shortcode/Live Highlight 設定を保存・復元。

プレビューと DOM セレクタ
--------------------------
- 実フロントを `?lc_preview=1&post_id=...&token=...` で読み込み。
- `<!--wp-livecode:start-->...<!--wp-livecode:end-->` を差し替え対象にして canonical HTML を注入。
- parse5 で `data-lc-id` を付与し、クリックした要素を Monaco 側の該当行へハイライト。
- ライブハイライトは設定でON/OFF可能（ホバー/クリックで矩形表示）。

Tailwind CSS
------------
- Tailwind モードでは TailwindPHP で CSS を自動コンパイル。
- 生成CSSは `_lc_generated_css`、ユーザーCSSは `_lc_css` に保存。
- プレビューは `LC_SET_CSS` で CSS だけ差し替え可能。

JavaScript / 外部スクリプト
---------------------------
- JavaScript エディタと有効化トグルを提供。`unfiltered_html` 権限が必要。
- プレビューでは JS を即時実行 (DOMReady シム、外部スクリプトのロード順保証)。
- 外部スクリプトは https:// のみ、最大 5 件。

Shadow DOM
----------
- 設定で Shadow DOM を有効化すると `<template shadowrootmode="open">` で隔離。
- フロント表示でもプレビューでも CSS/JS を Shadow root 内に適用。

ショートコード
--------------
- 設定で有効化すると `[livecode post_id="123"]` で埋め込み可能。
- 公開状態と権限を確認し、Shadow DOM の設定も尊重。

フロント表示
------------
- LiveCode 投稿の本文に HTML を出力し、CSS/JS をインラインまたは enqueue。
- Shadow DOM 有効時はホスト要素にテンプレートを差し込み。

REST API
--------
- `/wp-livecode/v1/save`: HTML/CSS/JS の保存、Tailwind コンパイル。
- `/wp-livecode/v1/compile-tailwind`: プレビュー用コンパイル。
- `/wp-livecode/v1/setup`: セットアップモード決定。
- `/wp-livecode/v1/import`: JSON インポート。
- `/wp-livecode/v1/settings`: 投稿設定/デザイン設定の更新。
- `/wp-livecode/v1/render-shortcodes`: ショートコードをサーバでレンダリング。

保存データ (post_meta)
----------------------
- `_lc_css`, `_lc_js`, `_lc_js_enabled`
- `_lc_tailwind`, `_lc_tailwind_locked`, `_lc_generated_css`
- `_lc_shadow_dom`, `_lc_shortcode_enabled`
- `_lc_external_scripts` (JSON)
- `_lc_live_highlight`, `_lc_setup_required`

postMessage プロトコル
----------------------
- 親 -> iframe: `LC_INIT`, `LC_RENDER`, `LC_SET_CSS`, `LC_RUN_JS`, `LC_DISABLE_JS`,
  `LC_EXTERNAL_SCRIPTS`, `LC_SET_HIGHLIGHT`
- iframe -> 親: `LC_READY`, `LC_SELECT`

権限/セキュリティ
-----------------
- LiveCode 投稿かつ `edit_post` を満たす場合のみ編集可能。
- JS/外部スクリプト/Shadow DOM/ショートコードの更新は `unfiltered_html` が必要。
- プレビューは nonce 付きの token で検証し、`event.origin` をチェック。
