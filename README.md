# import-attendance-plan

## 目的

- [決められたフォーマット](#メール本文フォーマット)（本文に `set,YYYY/MM/DD,label` や `delete,YYYY/MM/DD` を含む形式）のメールを Gmail で受信し
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

本リポジトリには `clasp` が開発用依存関係として含まれています。ローカルにインストールして使用することをおすすめします。

```bash
# 依存関係のインストール (初回のみ)
npm install

# Googleアカウントへのログイン
npx clasp login
```

*(※グローバルにインストールして使用したい場合は `npm i -g @google/clasp` を実行し、以降のコマンドは `npx` なしで実行してください。)*

### 2) Apps Script プロジェクト作成

このディレクトリで以下を実行してプロジェクトを作成します。

```bash
# ※既存のGASプロジェクトがある場合は、 `npx clasp clone <Script-ID>` でクローンすることも可能です
# （その場合は自動生成された .clasp.json の rootDir を "src" に手動で修正してください）
npx clasp create --type standalone --title "import-attendance-plan"
```

- 生成される `.clasp.json` は環境依存であるため Git 管理から除外されています（`.gitignore` 済み）
- 設定のサンプルとして [`.clasp.json.sample`](.clasp.json.sample) が同梱されています

### 3) Push

```bash
npx clasp push
```

### 4) バージョンアップデート時の反映方法

最新のリリースコードを Google Apps Script に反映し、新しいバージョンをデプロイするには以下のコマンドを実行します。

```bash
# 1. 最新のソースコードをローカルに取得
git pull

# 2. 最新コードを GAS にプッシュ (差分を強制同期する場合は --force を指定)
npx clasp push --force

# 3. 新しいスクリプトバージョンを作成 (例: v0.2.0)
npx clasp version "v0.2.0"

# 4. 作成されたバージョン番号（上のコマンド出力に表示されます）を指定してデプロイ
npx clasp deploy --versionNumber <バージョン番号> --description "v0.2.0"
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
  - 例: `拠点A出社,拠点B出社`

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
  - 例: `拠点A出社,拠点B出社`

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

バージョン情報は [import-attendance-plan/src/Version.gs](import-attendance-plan/src/Version.gs) に一元管理されています。

- Webエディタに貼り付けた後、`showVersion()` を実行すると実行ログに全体のバージョンが出力されます。

---

## メール本文フォーマット

Google カレンダーへの反映処理は、以下のCSV風フォーマットで記述されたメール本文をパースします。

### 予定の登録・更新 (`set`)
```text
set,YYYY/MM/DD,予定のタイトル
```
- **例**: `set,2026/05/11,拠点A出社`
- 指定された日付にある既存のイベント（管理対象タイトルに一致するもの）を削除した上で、新しく終日イベントを登録します。

### 予定の削除 (`delete`)
```text
delete,YYYY/MM/DD
```
- **例**: `delete,2026/05/11`
- 指定された日付にある既存のイベント（管理対象タイトルに一致するもの）を削除します。

### 補足仕様
- 1通のメール本文に、改行区切りで複数行記述することができます。
- 同一メール内に同じ日付に対する操作が複数ある場合は、下部（最後）の指示が優先されます。
