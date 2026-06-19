// import-attendance-plan
// Version: 0.1.0

function runImport() {
  Logger.log('import-attendance-plan version=%s', IMPORT_ATTENDANCE_PLAN_VERSION);
  var config = getConfig_();

  var calendar = CalendarApp.getCalendarById(config.calendarId);
  if (!calendar) {
    throw new Error('カレンダーが見つかりません: ' + config.calendarId);
  }

  var threads = GmailApp.search(config.gmailQuery, 0, 50);
  Logger.log('threads=%s query=%s', threads.length, config.gmailQuery);

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

      var body = msg.getPlainBody();
      var ops = parseAttendanceMailBody_(body);

      applyOpsToCalendar_(calendar, ops, config.managedTitles);

      msg.markRead();
      Logger.log('imported: %s (%s ops)', subject, ops.length);
    }
  }
}

function showVersion() {
  Logger.log('import-attendance-plan version=%s', IMPORT_ATTENDANCE_PLAN_VERSION);
}

function debugParseSample() {
  var sample = [
    'set,2026/05/11,厚木出社',
    'delete,2026/05/12',
    'set,2026/05/15,大崎出社'
  ].join('\n');

  var ops = parseAttendanceMailBody_(sample);
  Logger.log(JSON.stringify(ops, null, 2));
}
