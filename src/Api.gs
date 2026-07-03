/**
 * @file Api.gs
 * @description GAS Webアプリ用のAPIエンドポイントを提供し、AIや外部ツールからエラーメールとログを直接取得できるようにします。
 */

/**
 * HTTP GETリクエストを処理します（Web Appとして公開された場合）。
 * アクセストークンの認証を行い、スターのついた処理未完了メールとスプレッドシートのエラーログを紐付けて返却します。
 * 
 * @param {Object} e - HTTPリクエストイベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のレスポンス
 */
function doGet(e) {
  var config = getConfig_();
  var token = e ? e.parameter.token : null;

  // トークンが設定されていない、または一致しない場合はUnauthorized
  if (!config.apiToken || token !== config.apiToken) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }

  // Gmailからスター付きメールを検索
  var query = 'is:starred subject:"' + config.mailSubject.replace(/"/g, '\\"') + '"';
  var threads = GmailApp.search(query, 0, 50);
  
  var activeErrors = [];
  var logMap = {};

  // スプレッドシートから最新のエラーログをマップ化
  if (config.logSheetId) {
    try {
      var sheet = SpreadsheetApp.openById(config.logSheetId).getSheets()[0];
      var data = sheet.getDataRange().getValues();
      // ヘッダー: 0:実行日時, 1:メール受信日時, 2:送信元, 3:件名, 4:結果, 5:エラー内容, 6:Message-ID
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var runTime = row[0];
        var msgId = row[6];
        var result = row[4];
        var errMsg = row[5];
        if (msgId && result === 'エラー') {
          // 重複時は上書きし、最新のものを保持
          logMap[msgId] = {
            errMsg: errMsg,
            runTime: runTime instanceof Date ? runTime.toISOString() : String(runTime)
          };
        }
      }
    } catch (err) {
      console.error('API処理中のログシート読み込みエラー: ' + err.message);
    }
  }

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      if (msg.isStarred()) {
        var messageId = msg.getId();
        var logInfo = logMap[messageId] || { errMsg: 'エラー詳細がログシートから見つかりませんでした。', runTime: '' };
        activeErrors.push({
          messageId: messageId,
          mailDate: msg.getDate().toISOString(),
          runDate: logInfo.runTime,
          from: msg.getFrom(),
          subject: msg.getSubject(),
          errorMsg: logInfo.errMsg,
          body: msg.getPlainBody()
        });
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    errors: activeErrors
  }))
  .setMimeType(ContentService.MimeType.JSON);
}
