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