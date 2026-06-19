# import-attendance-plan

## 目的

- 決められたフォーマット（本文に `set,YYYY/MM/DD,label` / `delete,YYYY/MM/DD` を含む）のメールを Gmail で受信し
- Google Apps Script（GAS）を定期実行して **未開封メール** を対象に本文をパースし
- Google カレンダーへ反映する

---

## 概要（処理）

1. Gmail で未開封メールを検索（件名などで絞り込み）
2. メール本文の各行をパースして、日付ごとの操作（set/delete）に変換
3. Google カレンダーに反映
   - `set`: 指定日の既存（管理対象）イベントを削除してから、終日イベントを作成
   - `delete`: 指定日の既存（管理対象）イベントを削除
4. 反映が成功したメールは既読化

---

## セットアップ（clasp）

### 1) clasp の準備

- `clasp` をインストール（例: `npm i -g @google/clasp`）
- `clasp login` でログイン

### 2) Apps Script プロジェクト作成

このディレクトリで以下を実行:

```bash
cd import-attendance-plan
clasp create --type standalone --title "import-attendance-plan"
```

- 生成される `.clasp.json` は環境依存なので Git 管理しません（`.gitignore` 済み）

### 3) Push

```bash
clasp push
```

---

## セットアップ（Webブラウザでコピペ）

`clasp` を使わずに、Apps Script のWebエディタに手動で登録する手順です。

### 1) Apps Script プロジェクト作成

1. https://script.google.com/ を開く
2. 「新しいプロジェクト」を作成
3. プロジェクト名を `import-attendance-plan` などに変更

### 2) ファイル作成（.gs / マニフェスト）

左ペインの「ファイル」から、以下のファイルを作成して中身を貼り付けます。

- Code.gs ← [import-attendance-plan/src/Code.gs](import-attendance-plan/src/Code.gs)
- Config.gs ← [import-attendance-plan/src/Config.gs](import-attendance-plan/src/Config.gs)
- Parser.gs ← [import-attendance-plan/src/Parser.gs](import-attendance-plan/src/Parser.gs)
- Calendar.gs ← [import-attendance-plan/src/Calendar.gs](import-attendance-plan/src/Calendar.gs)

マニフェスト（`appsscript.json`）も反映します。

1. 左ペインの「プロジェクトの設定」へ移動
2. 「マニフェスト ファイルをエディタで表示」をON
3. 表示された `appsscript.json` を [import-attendance-plan/src/appsscript.json](import-attendance-plan/src/appsscript.json) の内容で置き換え

### 3) Script Properties を設定

Apps Script エディタで「プロジェクトの設定」→「スクリプト プロパティ」に以下を設定します。

- `ATTENDANCE_CALENDAR_ID`: `primary` または対象カレンダーID
- `ATTENDANCE_MANAGED_TITLES`: 削除対象とみなす予定タイトル（カンマ区切り）
  - 例: `厚木出社,大崎出社`

任意:

- `ATTENDANCE_MAIL_SUBJECT`（デフォルト: `出社予定`）
- `ATTENDANCE_GMAIL_QUERY`（例: `is:unread subject:"出社予定" from:example@example.com`）
- `ATTENDANCE_GMAIL_MAX_AGE_DAYS`（例: `14`）
  - `ATTENDANCE_GMAIL_QUERY` を未指定のときにのみ有効
  - 古い未開封メールを検索対象から外すための設定（Gmail 検索の `newer_than:Nd` を付与）

### 4) 初回実行（権限承認）

1. 関数として `runImport` を選択
2. 実行
3. ダイアログに従って、Gmail/Calendar へのアクセス権限を承認

### 5) 定期実行トリガーの設定

1. 左ペインの「トリガー」（時計アイコン）
2. 「トリガーを追加」
3. 実行する関数: `runImport`
4. イベントのソース: 時間主導型
5. 実行頻度を選んで作成

---

## 設定（Script Properties）

Apps Script エディタで「プロジェクトの設定」→「スクリプト プロパティ」に設定します。

必須:

- `ATTENDANCE_CALENDAR_ID`
  - `primary` または対象カレンダーID
- `ATTENDANCE_MANAGED_TITLES`
  - 削除対象とみなす予定タイトルの一覧（カンマ区切り）
  - 例: `厚木出社,大崎出社`

任意:

- `ATTENDANCE_MAIL_SUBJECT`（デフォルト: `出社予定`）
- `ATTENDANCE_GMAIL_QUERY`
  - 未指定なら `is:unread subject:"<ATTENDANCE_MAIL_SUBJECT>"` を使います
  - 例: `is:unread subject:"出社予定" from:example@example.com`
- `ATTENDANCE_GMAIL_MAX_AGE_DAYS`
  - `ATTENDANCE_GMAIL_QUERY` 未指定時のみ、`newer_than:Nd` を自動で付けます
  - 例: `14`（直近14日より古い未開封メールは無視）

---

## 実行

- 手動実行: `runImport()`
- 定期実行: Apps Script の「トリガー」から `runImport` を時間主導型で設定

---

## バージョン管理（コピペ運用向け）

Webエディタへコピペして運用する場合、どの版のコードが貼られているか判別しやすいように、各 `.gs` の先頭に `Version: ...` をコメントで入れています。

- バージョンの基準: [import-attendance-plan/src/Version.gs](import-attendance-plan/src/Version.gs)
- Webエディタに貼り付けた後、`showVersion()` を実行するとログにバージョンが出ます

---

## メール本文フォーマット

- set:

```text
set,2026/05/11,厚木出社
```

- delete:

```text
delete,2026/05/11
```

- 1通に複数行可
