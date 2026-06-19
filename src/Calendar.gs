// import-attendance-plan
// Version: 0.1.0

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
