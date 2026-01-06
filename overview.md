WP LiveCode — WordPress HTML/CSS ライブ編集プラグイン
==============================================

[NEW SPEC – CPT ONLY]
- カスタム投稿タイプ `wp_livecode`（管理画面ラベル: LiveCode Pages）をプラグインで登録。
- LiveCode の独自編集はこの投稿タイプ専用。通常の投稿/固定ページは対象外。
- LiveCode Page の「新規追加」「編集」は post-new.php / post.php から自動リダイレクトし、独自編集画面のみを使う（ブロック/クラシックエディタは非使用）。
- 保存先は HTML=post_content, CSS=post_meta `_lc_css`。

概要
----
- 管理画面に独自編集ページ（admin.php?page=wp-livecode）を持つ。
- 右: プレビュー (iframe, フロント実体を表示)。左: Monaco Editor (HTML/CSS タブ)。
- ツールバー: Undo/Redo/保存。HTML タブではショートコードを利用可。
- プレビューは DOM セレクタ付き（hover でハイライト、click でエディタ該当行をハイライト）。
- リンク経由で独自編集画面へ遷移。HTML は post_content、CSS は post_meta `_lc_css` に保存。

リアルタイム DOM セレクタ
------------------------
- canonical HTML を保持し、全要素に `data-lc-id` を付与（保存する post_content には付けない）。
- `data-lc-id` をキーにエディタ上のソース位置へマッピング。Monaco 側では属性を非表示で扱う。
- ショートコードはブロック単位で 1 要素扱い。内部をクリックしてもショートコード全体をハイライト。

アーキテクチャ（3 コンポーネント）
-------------------------------
1) 管理画面（親ウィンドウ: Monaco + 状態管理）
   - Monaco (HTML/CSS) を持つ。
   - HTML 変更のたびに canonical 化 + ソースマップ生成。parse5 を使用（sourceCodeLocationInfo で位置保持）。
   - iframe へ postMessage で canonical HTML と CSS を送信。
   - iframe から返る `lc-id` で Monaco をハイライト。

2) フロント iframe（プレビュー表示 + DOM セレクタ）
   - 実フロントを `?lc_preview=1&post_id=...&token=...` で読み込む。
   - `lc_preview=1` のときだけ、編集範囲を `<!--wp-livecode:start-->...<!--wp-livecode:end-->` で囲む。
   - postMessage を受けてコメント区間を canonicalHTML で差し替え、`<style>` も差し替え。
   - `<p>` 包含を防ぐためプレビューモードで `wpautop` 等の自動整形を外す。
   - hover/click を委譲で拾い、要素の `data-lc-id` を親へ返す。

3) WordPress（サーバ側: プレビュー専用モード）
   - `lc_preview=1` のときのみ:
     - キャッシュ/最適化を抑止。
     - `<!--wp-livecode:start-->...<!--wp-livecode:end-->` を確実に出す（テーマ依存を最小化）。
     - postMessage 受信用スクリプトを enqueue。

postMessage プロトコル
--------------------
- 親 → iframe: `LC_INIT` (handshake), `LC_RENDER` `{ canonicalHTML, cssText }`
- iframe → 親: `LC_READY`, `LC_SELECT` `{ lcId }`
- `event.origin` / `targetOrigin` を必ずチェック。

ショートコードの扱い
-------------------
- canonical 差し替えではショートコードが文字列のままになりやすい。
- 推奨: サーバでショートコードのみレンダリングする REST を用意し、プレビューでプレースホルダを差し替える。
- MVP 割り切り: プレビューではプレースホルダ表示、本番は WP 標準レンダリング。

保存と REST
-----------
- `register_rest_route()` で `/wp-livecode/v1/save` 等を用意し、permission_callback で権限チェック。
- 管理画面 JS → REST は nonce（例: X-WP-Nonce）を送る。
- 保存: `wp_update_post()` で post_content 更新。CSS は `update_post_meta($post_id, '_lc_css', $css)`。

プレビュー表示と本番表示
----------------------
- `the_content` フィルタで LiveCode 管理の投稿だけ HTML/CSS を組み立てて返す（適用範囲はメインクエリ等に限定）。
- CSS は `<style>` を head/footer に出す。必要なら `.lc-content` などでスコープを絞るとテーマ衝突を低減。

テスト観点（抜粋）
----------------
- テーマ差: `the_content` の位置ズレやコメントマーカーの有無。
- キャッシュ系: `lc_preview=1` で別投稿が出ないか（nocache_headers など）。
- postMessage: origin チェックが正しいか。
- parse5: 不正 HTML でも落ちないか（補正ノードの位置情報欠落のフォールバック）。
- ショートコード: クリック範囲がブロック単位になっているか。
