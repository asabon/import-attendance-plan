/**
 * @file Parser.gs
 * @description Gmailのメール本文（CSV風の指示）のパース、重複排除、および日付フォーマット検証などの処理。
 */

/**
 * メール本文をパースし、登録・削除の操作配列を返します。
 * 同一日付に対する操作が複数ある場合は最後の操作を優先します。
 * 
 * [テストされている仕様]:
 * - `set` (登録) と `delete` (削除) コマンドが正しくパースされること
 * - 同一日付に対する指示が複数ある場合、最後の指示が優先されること（重複排除）
 * - 不正なコマンド（`set`/`delete`以外）がある場合、エラーをスローすること
 * - 日付形式が不正な場合（`YYYY/MM/DD`以外）にエラーをスローすること
 * - `set` コマンドで登録名（ラベル）が空の場合にエラーをスローすること
 * 
 * @param {string} body - メールの本文
 * @returns {Object[]} パースされた操作オブジェクトの配列
 */
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

/**
 * 操作の配列から、同一日付の重複を排除し、日付順にソートして返します。
 * 同一日付の重複は最後の指示を優先します。
 * 
 * @param {Object[]} ops - 操作オブジェクトの配列
 * @returns {Object[]} 正規化・ソートされた操作オブジェクトの配列
 */
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

/**
 * 日付文字列（YYYY/MM/DD）をスクリプトのタイムゾーンに基づく Date オブジェクトに変換します。
 * 
 * [テストされている仕様]:
 * - `YYYY/MM/DD` 形式の文字列が正しく Date オブジェクト（年・月・日）に変換されること
 * - 形式が不正な場合にエラーをスローすること
 * 
 * @param {string} dateStr - 日付文字列
 * @returns {Date} Date オブジェクト
 */
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
