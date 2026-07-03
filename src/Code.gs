/**
 * @file Code.gs
 * @description 処理のエントリーポイント。Gmailから未読の出社予定メールを検索し、パースしてGoogleカレンダーへ反映します。
 */

function runImport() {
  Logger.log('import-attendance-plan version=%s', IMPORT_ATTENDANCE_PLAN_VERSION);
  var config = getConfig_();

  var calendar = CalendarApp.getCalendarById(config.calendarId);
  if (!calendar) {
    throw new Error('カレンダーが見つかりません: ' + config.calendarId);
  }

  var threads = GmailApp.search(config.gmailQuery, 0, 50);
  Logger.log('threads=%s query=%s', threads.length, config.gmailQuery);

  var results = [];

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var messages = thread.getMessages();

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      if (!msg.isUnread()) {
        continue;
      }

      var subject = msg.getSubject() || '';
      if (config.mailSubject && subject !== config.mailSubject) {
        // query 側で絞れていないケースの保険
        continue;
      }

      var from = msg.getFrom();
      var date = msg.getDate();
      var messageId = msg.getId();
      var body = msg.getPlainBody();

      var result = {
        messageId: messageId,
        date: date,
        from: from,
        subject: subject,
        body: body,
        success: false,
        errorMsg: ''
      };

      try {
        var ops = parseAttendanceMailBody_(body);
        applyOpsToCalendar_(calendar, ops, config.managedTitles);

        msg.markRead();
        result.success = true;
        Logger.log('imported: %s (%s ops)', subject, ops.length);
      } catch (e) {
        result.success = false;
        result.errorMsg = e.message || String(e);

        console.error(JSON.stringify({
          message: 'Error processing mail: ' + result.errorMsg,
          messageId: messageId,
          from: from,
          subject: subject,
          date: date.toISOString(),
          errorStack: e.stack || ''
        }));

        msg.markRead();
        msg.star();
      }

      results.push(result);
    }
  }

  if (results.length > 0) {
    writeLogsAndNotify_(results, config);
  }
}

function showVersion() {
  Logger.log('import-attendance-plan version=%s', IMPORT_ATTENDANCE_PLAN_VERSION);
}

function debugParseSample() {
  var sample = [
    'set,2026/05/11,拠点A出社',
    'delete,2026/05/12',
    'set,2026/05/15,拠点B出社'
  ].join('\n');

  var ops = parseAttendanceMailBody_(sample);
  Logger.log(JSON.stringify(ops, null, 2));
}
