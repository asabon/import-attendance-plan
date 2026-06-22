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

### 4) スクリプトプロパティとトリガーの設定

コードをプッシュした後、Google Apps Script 側で以下の設定を行います。

1. `npx clasp open` を実行して、作成した GAS プロジェクトをブラウザで開きます。
2. 「プロジェクトの設定」（歯車アイコン）→「スクリプト プロパティ」に移動し、必要な設定値を追加します。詳細は後述の [設定（Script Properties）](#設定script-properties) を参照してください。
3. 初回実行時のみ、エディタから `runImport` を手動実行し、Gmail やカレンダーへのアクセス権限を承認します。
4. 「トリガー」（時計アイコン）から `runImport` を時間主導型で定期実行するトリガーを設定します。詳細は後述の [実行](#実行) を参照してください。

---

## アップデート手順（clasp）

GitHub上で新しいリリース公開（タグ生成）を行った後、最新リリースを Google Apps Script に安全に反映し、バージョンデプロイを行うには、以下の自動デプロイコマンドを使用します。

```bash
# 1. リモートから最新のコードおよび Git タグを取得
git fetch
git pull

# 2. リリース対象のバージョン（Git タグ）にチェックアウト
# 例: v0.1.0 をデプロイしたい場合
git checkout v0.1.0

# 3. 自動デプロイコマンドを実行
npm run deploy

# 4. デプロイ完了後、作業ブランチ（main）に戻る
git checkout main
```

*(※自動デプロイスクリプト `npm run deploy` は、現在のコミットに正しいリリース用の Git タグが打たれており、かつ `src/Version.gs` のバージョン定義と一致している場合のみ安全にプッシュおよびデプロイを実行します。)*

---

## セットアップ・運用（Webブラウザでコピペ）

`clasp` や Git を使用せず、Webブラウザ上の Google Apps Script エディタに直接コードをコピー＆ペーストして利用したい場合は、以下の手順書を参照してください。

*   👉 **[手動コピペでのセットアップ・運用手順 (MANUAL_SETUP.md)](MANUAL_SETUP.md)**

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
