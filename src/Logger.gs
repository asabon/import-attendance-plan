/**
 * @file Logger.gs
 * @description 処理結果のログ（スプレッドシートへの記録）およびエラー通知メールの送信を担当します。
 */

/**
 * 処理結果をスプレッドシートに書き込み、エラーが発生した場合は通知メールを送信します。
 * 
 * @param {Object[]} results - メール処理結果の配列
 * @param {Object} config - 設定情報オブジェクト
 */
function writeLogsAndNotify_(results, config) {
  writeSpreadsheetLogs_(results, config);
  sendErrorNotification_(results, config);
}

/**
 * 処理結果をスプレッドシートに記録します。
 * スプレッドシートが存在しない、またはアクセスできない場合は新規作成します。
 * 
 * @param {Object[]} results - メール処理結果の配列
 * @param {Object} config - 設定情報オブジェクト
 */
function writeSpreadsheetLogs_(results, config) {
  try {
    var sheet = getOrCreateLogSheet_(config);
    var now = new Date();
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      sheet.appendRow([
        now,
        r.date,
        r.from,
        r.subject,
        r.success ? '成功' : 'エラー',
        r.errorMsg,
        r.messageId
      ]);
    }
  } catch (e) {
    console.error('スプレッドシートへのログ書き込み中にエラーが発生しました: ' + (e.stack || e.message || String(e)));
  }
}

/**
 * ログ記録用のスプレッドシート（の最初のシート）を取得します。
 * スプレッドシートが未設定または開けない場合、新規作成してIDをスクリプトプロパティに保存します。
 * 
 * @param {Object} config - 設定情報オブジェクト
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} ログを書き込むシートオブジェクト
 */
function getOrCreateLogSheet_(config) {
  var sheetId = config.logSheetId;
  var ss;

  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log('スプレッドシート (ID: %s) を開けませんでした。新規作成します: %s', sheetId, e.message);
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('import-attendance-plan 処理ログ');
    var sheet = ss.getSheets()[0];
    sheet.appendRow(['実行日時', 'メール受信日時', '送信元', '件名', '結果', 'エラー内容', 'Message-ID']);
    
    var newSheetId = ss.getId();
    PropertiesService.getScriptProperties().setProperty('ATTENDANCE_LOG_SHEET_ID', newSheetId);
    config.logSheetId = newSheetId; // メモリ上の設定値も更新
    Logger.log('新規ログ用スプレッドシートを作成しました: %s', ss.getUrl());
    return sheet;
  }

  return ss.getSheets()[0];
}

/**
 * 処理が失敗したメールがある場合、管理者に通知メールを送信します。
 * 
 * @param {Object[]} results - メール処理結果の配列
 * @param {Object} config - 設定情報オブジェクト
 */
function sendErrorNotification_(results, config) {
  var errors = results.filter(function (r) { return !r.success; });
  if (errors.length === 0) {
    return;
  }

  var to = config.errorNotifyEmail || Session.getActiveUser().getEmail();
  if (!to) {
    console.error('エラー通知メールの送信先アドレスを特定できませんでした。');
    return;
  }

  var subject = '【エラー発生】出社予定登録処理';
  var body = '出社予定の登録処理中にエラーが発生しました。\n\n' +
    '詳細は以下の通りです。エラーメールは既読化され、スターが付与されています。\n\n' +
    '--------------------------------------------------\n';

  for (var i = 0; i < errors.length; i++) {
    var err = errors[i];
    body += '■ エラー ' + (i + 1) + '\n' +
      '  - 受信日時: ' + err.date + '\n' +
      '  - 送信元: ' + err.from + '\n' +
      '  - 件名: ' + err.subject + '\n' +
      '  - エラー内容: ' + err.errorMsg + '\n' +
      '  - メッセージID: ' + err.messageId + '\n' +
      '  - 本文抜粋:\n' + err.body.substring(0, 300) + (err.body.length > 300 ? '\n... (省略)' : '') + '\n' +
      '--------------------------------------------------\n';
  }

  try {
    MailApp.sendEmail(to, subject, body);
    Logger.log('エラー通知メールを送信しました: %s', to);
  } catch (e) {
    console.error('エラー通知メールの送信中にエラーが発生しました: ' + (e.stack || e.message || String(e)));
  }
}

/**
 * ログ記録用スプレッドシートから、既に処理されたメッセージのID一覧を取得します。
 * 
 * @param {Object} config - 設定情報オブジェクト
 * @returns {Object} 既処理メッセージIDをキー、値を true としたマップオブジェクト
 */
function getProcessedMessageIds_(config) {
  var ids = {};
  var sheetId = config.logSheetId;
  if (!sheetId) {
    return ids;
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ids;
    }
    // Message-ID は7列目 (G列)
    var range = sheet.getRange(2, 7, lastRow - 1, 1);
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var id = values[i][0];
      if (id) {
        ids[id] = true;
      }
    }
  } catch (e) {
    console.error('既処理Message-IDの取得中にエラーが発生しました: ' + (e.stack || e.message || String(e)));
  }

  return ids;
}
