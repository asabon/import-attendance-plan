/**
 * @file Config.gs
 * @description スクリプトプロパティから設定値を取得・検証し、オブジェクトとして提供します。
 */

function getConfig_() {
  var props = PropertiesService.getScriptProperties();

  var mailSubject = props.getProperty('ATTENDANCE_MAIL_SUBJECT') || '出社予定';
  var gmailQuery = props.getProperty('ATTENDANCE_GMAIL_QUERY');

  var maxAgeDaysRaw = props.getProperty('ATTENDANCE_GMAIL_MAX_AGE_DAYS');
  var maxAgeDays = null;
  if (maxAgeDaysRaw) {
    maxAgeDays = Number(maxAgeDaysRaw);
    if (!isFinite(maxAgeDays) || maxAgeDays <= 0 || Math.floor(maxAgeDays) !== maxAgeDays) {
      throw new Error('Script property ATTENDANCE_GMAIL_MAX_AGE_DAYS が不正です: ' + maxAgeDaysRaw);
    }
  }

  if (!gmailQuery) {
    gmailQuery = 'is:unread subject:"' + mailSubject.replace(/"/g, '\\"') + '"';
    if (maxAgeDays) {
      gmailQuery += ' newer_than:' + maxAgeDays + 'd';
    }
  }

  var calendarId = props.getProperty('ATTENDANCE_CALENDAR_ID');
  if (!calendarId) {
    throw new Error('Script property ATTENDANCE_CALENDAR_ID が未設定です');
  }

  var managedTitlesRaw = props.getProperty('ATTENDANCE_MANAGED_TITLES');
  if (!managedTitlesRaw) {
    throw new Error('Script property ATTENDANCE_MANAGED_TITLES が未設定です');
  }
  var managedTitles = managedTitlesRaw
    .split(/[,\r\n]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });

  if (managedTitles.length === 0) {
    throw new Error('ATTENDANCE_MANAGED_TITLES が空です');
  }

  var logSheetId = props.getProperty('ATTENDANCE_LOG_SHEET_ID') || '';
  var errorNotifyEmail = props.getProperty('ATTENDANCE_ERROR_NOTIFY_EMAIL') || '';
  var apiToken = props.getProperty('ATTENDANCE_API_TOKEN') || '';

  return {
    mailSubject: mailSubject,
    gmailQuery: gmailQuery,
    calendarId: calendarId,
    managedTitles: managedTitles,
    logSheetId: logSheetId,
    errorNotifyEmail: errorNotifyEmail,
    apiToken: apiToken
  };
}

