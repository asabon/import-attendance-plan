// import-attendance-plan
// Version: 0.1.0

function parseAttendanceMailBody_(body) {
  var lines = body.split(/\r?\n/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });

  var ops = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var parts = line.split(',');

    var cmd = (parts[0] || '').trim();
    if (cmd !== 'set' && cmd !== 'delete') {
      throw new Error('本文のコマンドが不正です: ' + line);
    }

    var dateStr = (parts[1] || '').trim();
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
      throw new Error('日付形式が不正です (YYYY/MM/DD): ' + line);
    }

    if (cmd === 'delete') {
      ops.push({ type: 'delete', dateStr: dateStr });
      continue;
    }

    var title = parts.slice(2).join(',').trim();
    if (!title) {
      throw new Error('set の label が空です: ' + line);
    }

    ops.push({ type: 'set', dateStr: dateStr, title: title });
  }

  return normalizeOps_(ops);
}

function normalizeOps_(ops) {
  // 同一日付が複数回出たら「最後の指示を優先」
  var byDate = {};
  for (var i = 0; i < ops.length; i++) {
    byDate[ops[i].dateStr] = ops[i];
  }

  var keys = Object.keys(byDate);
  keys.sort();

  return keys.map(function (k) { return byDate[k]; });
}

function parseDateJst_(dateStr) {
  // Apps Script は Date がスクリプトタイムゾーンとして扱われる前提
  var m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) {
    throw new Error('日付形式が不正です: ' + dateStr);
  }
  var y = Number(m[1]);
  var mo = Number(m[2]) - 1;
  var d = Number(m[3]);
  return new Date(y, mo, d);
}
