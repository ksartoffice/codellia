CodeNagi – Live HTML/CSS/JS Editor with Tailwind CSS
===============================================

概要
----
- CodeNagi専用のカスタム投稿タイプ `codenagi` を登録し、通常の投稿/固定ページは対象外。
- `post-new.php`/`post.php` から専用エディタ (`admin.php?page=codenagi`) へ自動リダイレクトし、ブロック/クラシックは無効。
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
- `?codenagi_preview=1&post_id=...&token=...` で実フロントを表示し、`<!--codenagi:start-->...<!--codenagi:end-->` 内を差し替え。
- parse5 で `data-codenagi-id` を付与し、ホバー/クリックで該当要素をハイライト。
- 選択時に要素タブを開くアクションボタンを表示し、エディタ/設定と選択状態を同期。

セットアップ/インポート
----------------------
- 初回はセットアップウィザードで「Normal」/「Tailwind」/「Import JSON」を選択し、`_codenagi_tailwind_locked` で固定。
- Import/Export JSON v1: HTML/CSS/JS、Tailwind、生成CSS、外部スクリプト/スタイル、Shadow DOM/Shortcode/Live Highlight。
- Import時はHTMLをそのまま反映（外部画像の取り込みは行わない）。

Tailwind CSS
------------
- Tailwind モードでは TailwindPHP で CSS を自動コンパイル。
- 生成CSSは `_codenagi_generated_css`、ユーザーCSSは `_codenagi_css` に保存。
- プレビューは `CODENAGI_SET_CSS` で CSS だけ差し替え可能。

外部アセット (Script / Style)
------------------------------
- 外部スクリプト: https:// のみ、最大 5 件。JS 有効時のみ読み込み。
- 外部スタイル: https:// のみ、最大 5 件。プレビュー/フロントに `<link>` で読み込み。

Shadow DOM
----------
- 有効化時は `<template shadowrootmode="open">` で隔離し、CSS/JS/外部スタイルを Shadow root 内に適用。

ショートコード
--------------
- `[codenagi post_id="123"]` で埋め込み可能。公開状態/権限をチェックし、Shadow DOM 設定も尊重。

フロント表示
------------
- CodeNagi 投稿の本文を出力し、CSS/JS/外部アセットをインラインまたは enqueue。
- Shadow DOM 有効時はホスト要素にテンプレートを差し込み。

REST API
--------
- `/codenagi/v1/save`: HTML/CSS/JS の保存、Tailwind コンパイル。
- `/codenagi/v1/compile-tailwind`: プレビュー用コンパイル。
- `/codenagi/v1/setup`: セットアップモード決定。
- `/codenagi/v1/import`: JSON インポート。
- `/codenagi/v1/settings`: 投稿/デザイン設定の更新。
- `/codenagi/v1/render-shortcodes`: ショートコードのサーバレンダリング。

保存データ (post_meta)
----------------------
- `_codenagi_css`, `_codenagi_js`, `_codenagi_js_enabled`
- `_codenagi_tailwind`, `_codenagi_tailwind_locked`, `_codenagi_generated_css`
- `_codenagi_shadow_dom`, `_codenagi_shortcode_enabled`
- `_codenagi_external_scripts`, `_codenagi_external_styles`
- `_codenagi_live_highlight`, `_codenagi_setup_required`

postMessage プロトコル
----------------------
- 親 -> iframe: `CODENAGI_INIT`, `CODENAGI_RENDER`, `CODENAGI_SET_CSS`, `CODENAGI_RUN_JS`, `CODENAGI_DISABLE_JS`,
  `CODENAGI_EXTERNAL_SCRIPTS`, `CODENAGI_EXTERNAL_STYLES`, `CODENAGI_SET_HIGHLIGHT`, `CODENAGI_SET_ELEMENTS_TAB_OPEN`
- iframe -> 親: `CODENAGI_READY`, `CODENAGI_SELECT`, `CODENAGI_OPEN_ELEMENTS_TAB`

権限/セキュリティ
-----------------
- CodeNagi 投稿かつ `edit_post` を満たす場合のみ編集可能。
- JS/外部スクリプト/外部スタイル/Shadow DOM/ショートコードの更新は `unfiltered_html` が必要。
- プレビューは nonce 付き token と `event.origin` を検証。



