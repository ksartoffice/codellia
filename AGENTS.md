WordPress HTML CSS ライブ編集エディタプラグインの開発
WP LiveCode

管理画面内で.php?action=●●独自編集画面を持つ。
WordPressの記事をHTMLとCSSを実際のフロント画面を見ながらライブ編集が出来るプラグイン。
GutenbergやクラシックエディタやElementorなどどんなエディタを使っていようと関係なし。HTMLとCSSでゴリゴリとページを作ることが出来る。ライブ編集で便利。
ニッチ寄り

●機能
・右側がプレビューエリアでフロント画面の実際の記事の様子をiframeで表示する。
・左側がmonaco editorでHTML CSSタブ切り替え
・ツールバーにはundo redo 保存機能がある。
・HTMLタブではショートコードが利用できる。
・プレビュー画面ではリアルタイムDOMセレクターの機能を持つ。要素をホバーでハイライトする。ハイライト中の要素をクリックするとエディタ側該当行のハイライトを行う。
・クラシックエディタ、ブロックエディタ側からリンクで独自編集画面に飛ばす。
・HTML（ソース）はpost_contentコードに保存。
・CSS（ソース）はpost_metaに保存。_lc_css

●リアルタイムDOMセレクターの実装
・canonical htmlをデータとして保持。
・canonical htmlは入力されたHTML内の全ての要素にdata-lc-idという独自属性を付与する。
post_contentに保存するのは“素のHTML（data-lc-idなし）”
・このdata-lc-idという属性を使って該当要素をHTMLから探すが、monaco-editor内のHTMLのコード内ではその属性は見えないようにする。
・ショートコードはブロック単位で1要素として扱う。ショートコード内部はどこをクリックしてもショートコードをハイライト。

## アーキテクチャ（3コンポーネント）

### 1) 管理画面（親ウィンドウ：Monaco + 状態管理）

* Monaco（HTML/CSS）を持つ
* HTML変更のたびに **canonical化 + ソースマップ生成**。**“ソース位置を保持できるHTMLパーサ”**を使う。parse5
* iframeに `postMessage` で canonical HTML と CSS を送る
* iframeから返ってきた `lc-id` で Monaco をハイライト

### 2) フロント iframe（プレビュー表示 + DOMセレクタ）

* WPの実フロントを `?lc_preview=1&post_id=...&token=...` で読み込む
* `lc_preview=1` のときだけ、**注入用の固定ルート**（例：`<div id="lc-root"></div>`）を用意
* `postMessage` を受けて `#lc-root.innerHTML = canonicalHTML` / `<style>` 差し替え
* hover/clickをイベント委譲で拾い、要素の `data-lc-id` を親へ返す

### 3) WordPress（サーバ側：プレビュー専用モードの提供）

* `lc_preview=1` のときだけ

  * 余計なキャッシュや最適化を抑止
  * `#lc-root` を確実に出す（テーマ差に依存させない）
  * `postMessage` 受信用スクリプトを enqueue


monaco editorは npm i monaco-editor して node_modules/monaco-editor/min/vs を assets/monaco/vsフォルダにコピーした。

●プラグインの対象
中級者（制作会社、フリーランス、企業のIT担当）






以下は、あなたの要件（WP LiveCode：管理画面の独自編集＋iframeプレビュー＋Monaco＋parse5でcanonical化＋DOMセレクタ）を前提にした「開発の手順（現実的に詰まらない順）」です。MVP→製品版の順で進められるようにしています。

---

## 0) 先に決める（後戻りしやすい論点だけ先に固定）

### 保存形式（推奨）

* **HTML（ソース）**：`post_content`（要件通り）
* **CSS（ソース）**：**post_meta推奨**（例：`_lc_css`）
  ※`post_content`に`<style>`を混ぜると、権限や環境によってはフィルタで削られたり、エディタが整形して壊すリスクがあります。
  それでも「post_contentに全部」を貫くなら、`<!--lc:css ... -->` のような**コメント埋め込み**にして、表示時に抽出する方式が安全寄りです。

### プレビューモードの作り方（あなたのアーキテクチャに沿う）

* フロントURL：`?lc_preview=1&post_id=...&token=...`
* `lc_preview=1` の時だけ **the_content を `<div id="lc-root"></div>` に差し替え**（テーマ差を最小化）
  `the_content` フィルタは「メインループ/メインクエリのみ」等の条件付けが重要です。 ([WordPress Developer Resources][1])

---

## 1) プラグイン雛形を作る（最小で動く骨格）

1. `wp-livecode/` を作成

   * `wp-livecode.php`（メイン）
   * `includes/`（PHPクラス）
   * `assets/`（ビルド成果物：JS/CSS）
2. 管理画面メニュー登録

   * `admin_menu` で **独自編集画面（サブメニュー）** を追加
     `add_submenu_page()` の公式手順通りでOKです。 ([WordPress Developer Resources][2])
3. 管理画面用アセットを enqueue

   * 管理画面は `admin_enqueue_scripts` から `wp_enqueue_script()` するのが定石です。 ([WordPress Developer Resources][3])

---

## 2) 管理画面（親）を作る：Monaco + iframe + 最低限のUI

### 画面構成（MVP）

* 左：Monaco（HTML/CSSタブ）
* 上：ツールバー（Undo/Redo/保存）
* 右：iframe（フロントURL `lc_preview=1...` を読み込み）

### 初期データの受け渡し

* PHP側で `post_id` を受け取り、初期 `post_content` と `css(meta)` を取得して JS に渡す（`wp_localize_script` / `wp_add_inline_script` 等）

---

## 3) フロントiframe側（プレビュー専用モード）を作る

### 3-1. `lc_preview` クエリを受けられるようにする

* `query_vars` フィルタで `lc_preview`, `post_id`, `token` を許可 ([WordPress Developer Resources][4])

### 3-2. トークン検証（最低限）

* `token` は nonce を使うのが手堅いです（例：action=`lc_preview_{post_id}`）
  nonce生成：`wp_create_nonce()` ([WordPress Developer Resources][5])
  検証：`wp_verify_nonce()`（※nonceだけに頼らず `current_user_can()` で権限確認が必要、という注意も公式にあります） ([WordPress Developer Resources][6])

### 3-3. キャッシュ抑止

* `lc_preview=1` の時は `nocache_headers()` を呼び、プレビューの取り違えを避ける ([WordPress Developer Resources][7])
  （加えて `DONOTCACHEPAGE` 定数なども併用するとより堅いですが、まずは `nocache_headers()` でMVPは十分）

### 3-4. `#lc-root` を確実に出す

* `the_content` を `<div id="lc-root"></div>` に差し替える（メインループ限定） ([WordPress Developer Resources][1])
* さらに `lc_preview` の時だけ、`postMessage` を受けるJSを enqueue

---

## 4) postMessage プロトコル（親⇄iframe）を固める

### メッセージ設計（例）

* 親 → iframe

  * `LC_INIT`：handshake
  * `LC_RENDER`：`{ canonicalHTML, cssText }`
* iframe → 親

  * `LC_READY`
  * `LC_SELECT`：`{ lcId }`

### セキュリティ必須

* `event.origin` を必ずチェックし、送信先にも正しい `targetOrigin` を指定（MDNの推奨） ([MDN Web Docs][8])

---

## 5) canonical化 + ソースマップ生成（ここが肝）

### 5-1. parse5 を「位置情報付き」で使う

* `sourceCodeLocationInfo` を有効にすると、各ノードに `sourceCodeLocation` が付いて「元ソースの開始/終了位置」を取れます。 ([Parse5][9])

### 5-2. canonical HTML を生成

* 入力HTMLを parse → 全要素に `data-lc-id="..."` を付与 → serialize
* **保存するのは素のHTML（data-lc-idなし）**
  `data-lc-id` はあくまで「プレビュー用の内部表現」

### 5-3. Monacoに返す“マッピング”を作る（実装のコツ）

* `lcId -> {startOffset,endOffset}` を持ち、Monaco側で `model.getPositionAt(offset)` から Range を作って装飾（highlight）
* parse5はツリー補正で暗黙ノードが混ざり、`sourceCodeLocation` が無い場合があるので、その時は「親の範囲に寄せる」等のフォールバックを用意

---

## 6) DOMセレクタ（hoverハイライト＋clickで該当行へ）

### iframe側（イベント委譲）

* `mousemove`/`mouseover` で `event.target.closest('[data-lc-id]')`
* ハイライトは「outlineを当てる」か「オーバーレイdivを1枚置いて位置合わせ」がおすすめ
* `click` で `lcId` を親へ返す（`LC_SELECT`）

### 親側（Monacoをハイライト）

* `lcId` から range を引き、該当行へスクロール + デコレーション

---

## 7) ショートコードの扱い（MVPで詰まりやすいので最初から方針を）

あなたの要件だと **「HTMLタブでショートコード利用」＋「ショートコードはブロック単位で1要素扱い」** がポイントですが、注意点があります：

* そのまま `#lc-root.innerHTML = canonicalHTML` すると、**ショートコードは実行されず文字列のまま**になりがちです。

### 現実的な解決策（おすすめ順）

1. **ショートコード部分だけサーバでレンダリングするREST**を用意

* 親がHTMLを解析し、ショートコードブロックごとに「プレースホルダ要素（例：`<lc-sc data-lc-id=... data-sc="...">`）」へ置換してiframeに送る
* iframeは受信後、`data-sc` をまとめてRESTへ投げ、返ってきたHTMLで差し替える（デバウンス＆キャッシュで快適に）

2. MVPでは割り切り

* 「ショートコードはプレビューでは簡易表示（プレースホルダ）」として、保存/公開時にWordPress標準レンダリングに任せる

---

## 8) 保存（Undo/Redoと別物）：RESTエンドポイントで確実に

### 8-1. RESTルート作成

* `register_rest_route()` で `/wp-livecode/v1/save` を作り、`permission_callback` で権限チェック ([WordPress Developer Resources][10])
* 管理画面JS→RESTは **nonce** を送って保護（`X-WP-Nonce` 等）
  ※RESTでのnonce受け渡しの説明として日本語ドキュメントがまとまっています。 ([WP REST API][11])

### 8-2. 保存処理

* `wp_update_post()` で `post_content` 更新
* CSSは `update_post_meta($post_id,'_lc_css',$css)`（推奨）
* 将来：リビジョンや自動保存、差分保存（patch）も検討

---

## 9) 既存エディタから「WP LiveCodeで編集」リンクを出す

最短で効く順に：

1. 投稿一覧（行アクション）に「LiveCodeで編集」追加
2. クラシックエディタ：メタボックスでリンク
3. Gutenberg：サイドバー/ツールバーにボタン（Block Editor拡張JS）

---

## 10) 公開表示（フロントでの最終レンダリング）

* `the_content` フィルタで「この投稿がLiveCodeで管理されているなら」HTML/CSSを組み立てて返す
  ※ここも `the_content` の使い方（適用範囲の条件付け）が重要です。 ([WordPress Developer Resources][1])
* CSSは `<style>` を head/footer に出す（スコープを `#lc-root` や `.lc-content` に寄せると、テーマCSSと衝突しにくい）

---

## 11) テスト項目（最低限ここだけは先に潰す）

* テーマ差：`the_content` の位置が崩れないか / `#lc-root` が確実に入るか
* キャッシュ系：`lc_preview=1` で別投稿が出ないか（`nocache_headers` 動作） ([WordPress Developer Resources][7])
* postMessage：`origin` チェックが正しいか ([MDN Web Docs][8])
* parse5：不正HTMLでも落ちないか（補正ノードで位置情報が欠けるケース）
* ショートコード：クリック範囲が「ブロック単位」になっているか

---
