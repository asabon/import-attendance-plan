// import-attendance-plan
// Version: 0.1.0

/**
 * 解析された操作（登録・削除）を Google カレンダーへ適用します。
 * 
 * [テストされている仕様]:
 * - `set` 指示：該当日の古い管理対象イベントを削除した上で、新しく終日イベントが登録されること
 * - `delete` 指示：該当日の古い管理対象イベントが削除されるだけで、新規登録はされないこと
 * 
 * @param {GoogleAppsScript.Calendar.Calendar} calendar - 対象のカレンダーオブジェクト
 * @param {Object[]} ops - 操作オブジェクトの配列
 * @param {string[]} managedTitles - 管理対象とするイベントのタイトル配列
 */
function applyOpsToCalendar_(calendar, ops, managedTitles) {
  var titleSet = {};
  for (var i = 0; i < managedTitles.length; i++) {
    titleSet[managedTitles[i]] = true;
  }

  for (var j = 0; j < ops.length; j++) {
    var op = ops[j];
    var day = parseDateJst_(op.dateStr);

    if (op.type === 'delete') {
      deleteManagedEventsForDay_(calendar, day, titleSet);
      continue;
    }

    if (op.type === 'set') {
      deleteManagedEventsForDay_(calendar, day, titleSet);
      calendar.createAllDayEvent(op.title, day);
      continue;
    }

    throw new Error('未知の操作タイプです: ' + JSON.stringify(op));
  }
}

/**
 * 指定された日付のイベントの中から、管理対象タイトルに一致するもののみを削除します。
 * 
 * [テストされている仕様]:
 * - その日のイベントの中に管理対象（テレワーク、有給休暇など）に一致するタイトルがある場合、該当イベントが削除されること
 * - 管理対象外の別イベント（定例会議など）は削除されずに残ること
 * 
 * @param {GoogleAppsScript.Calendar.Calendar} calendar - 対象のカレンダーオブジェクト
 * @param {Date} day - 対象の日付
 * @param {Object} titleSet - 管理対象タイトルのセット（キーがタイトル、値が true）
 */
function deleteManagedEventsForDay_(calendar, day, titleSet) {
  var events = calendar.getEventsForDay(day);
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var title = e.getTitle();
    if (!titleSet[title]) {
      continue;
    }
    e.deleteEvent();
  }
}
