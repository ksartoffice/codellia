プロジェクトの概要はoverview.mdに記載があります。



Naming conventions: STYLEGUIDE.md

翻訳ファイル(.po/.pot/.json)を編集する場合はUTF-8を維持し、PowerShellの既定エンコーディングで書き戻さないこと。必要ならUTF-8指定で保存するか、apply_patchを使う。
文字化け防止のため、PowerShellで保存する場合は必ず -Encoding utf8 を指定する。
翻訳ファイルの更新は .pot/.po のみ編集し、JSON は手動更新しない。変更後は以下をコマンドで生成する。
- wp i18n make-mo languages
- wp i18n make-json languages --no-purge
