const { loadGasFiles } = require('./helpers/gas-loader');

describe('Code.gs', () => {
  let gas;
  let mockProperties;
  let mockPropertiesService;
  let mockCalendar;
  let mockCalendarApp;
  let mockMessages;
  let mockThreads;
  let mockGmailApp;
  let mockSheet;
  let mockSpreadsheet;
  let mockSpreadsheetApp;
  let mockMailApp;
  let mockSession;
  let mockLogger;

  beforeEach(() => {
    // スクリプトプロパティのモック
    mockProperties = {
      ATTENDANCE_CALENDAR_ID: 'primary',
      ATTENDANCE_MANAGED_TITLES: '拠点A出社,拠点B出社',
      ATTENDANCE_MAIL_SUBJECT: '出社予定',
      ATTENDANCE_LOG_SHEET_ID: 'sheet-123',
      ATTENDANCE_ERROR_NOTIFY_EMAIL: 'admin@example.com'
    };

    mockPropertiesService = {
      getScriptProperties: jest.fn().mockReturnValue({
        getProperty: jest.fn().mockImplementation((key) => mockProperties[key]),
        setProperty: jest.fn().mockImplementation((key, val) => { mockProperties[key] = val; })
      })
    };

    // カレンダーのモック
    mockCalendar = {
      createAllDayEvent: jest.fn(),
      getEventsForDay: jest.fn().mockReturnValue([])
    };
    mockCalendarApp = {
      getCalendarById: jest.fn().mockReturnValue(mockCalendar)
    };

    // Gmailメッセージのモック (1通目はエラー、2通目は成功するデータ)
    mockMessages = [
      {
        isUnread: jest.fn().mockReturnValue(true),
        getSubject: jest.fn().mockReturnValue('出社予定'),
        getFrom: jest.fn().mockReturnValue('user1@example.com'),
        getDate: jest.fn().mockReturnValue(new Date('2026-07-04T05:00:00Z')),
        getId: jest.fn().mockReturnValue('msg-error'),
        getPlainBody: jest.fn().mockReturnValue('invalid command,2026/05/11'), // パースエラーになる
        markRead: jest.fn(),
        star: jest.fn()
      },
      {
        isUnread: jest.fn().mockReturnValue(true),
        getSubject: jest.fn().mockReturnValue('出社予定'),
        getFrom: jest.fn().mockReturnValue('user2@example.com'),
        getDate: jest.fn().mockReturnValue(new Date('2026-07-04T05:10:00Z')),
        getId: jest.fn().mockReturnValue('msg-success'),
        getPlainBody: jest.fn().mockReturnValue('set,2026/05/12,拠点A出社'), // 成功する
        markRead: jest.fn(),
        star: jest.fn()
      }
    ];

    mockThreads = [
      {
        getMessages: jest.fn().mockReturnValue(mockMessages),
        moveToArchive: jest.fn()
      }
    ];

    mockGmailApp = {
      search: jest.fn().mockReturnValue(mockThreads)
    };

    // スプレッドシートのモック
    mockSheet = {
      appendRow: jest.fn(),
      getLastRow: jest.fn().mockReturnValue(1),
      getRange: jest.fn().mockReturnValue({
        getValues: jest.fn().mockReturnValue([])
      })
    };
    mockSpreadsheet = {
      getSheets: jest.fn().mockReturnValue([mockSheet])
    };
    mockSpreadsheetApp = {
      openById: jest.fn().mockReturnValue(mockSpreadsheet)
    };

    // メール送信・セッション・ロガーのモック
    mockMailApp = {
      sendEmail: jest.fn()
    };
    mockSession = {
      getActiveUser: jest.fn().mockReturnValue({
        getEmail: jest.fn().mockReturnValue('executor@example.com')
      })
    };
    mockLogger = {
      log: jest.fn()
    };

    // GASファイルをロードしてモックを注入
    gas = loadGasFiles({
      PropertiesService: mockPropertiesService,
      CalendarApp: mockCalendarApp,
      GmailApp: mockGmailApp,
      SpreadsheetApp: mockSpreadsheetApp,
      MailApp: mockMailApp,
      Session: mockSession,
      Logger: mockLogger,
      IMPORT_ATTENDANCE_PLAN_VERSION: '1.0.0'
    });
  });

  it('should process individual emails with try-catch and continue after an error', () => {
    gas.runImport();

    // 1通目（エラー）の検証：エラーマーク処理 (既読化とスター) が呼び出されていること
    expect(mockMessages[0].markRead).toHaveBeenCalled();
    expect(mockMessages[0].star).toHaveBeenCalled();

    // 2通目（正常）の検証：正常にカレンダー追加され、既読になり、スターは付かないこと
    expect(mockMessages[1].markRead).toHaveBeenCalled();
    expect(mockMessages[1].star).not.toHaveBeenCalled();
    expect(mockCalendar.createAllDayEvent).toHaveBeenCalledWith('拠点A出社', expect.any(Date));

    // ログ記録の検証：2件ともスプレッドシートへ追記されること
    expect(mockSheet.appendRow).toHaveBeenCalledTimes(2);
    expect(mockSheet.appendRow).toHaveBeenNthCalledWith(1, [
      expect.any(Date),
      mockMessages[0].getDate(),
      'user1@example.com',
      '出社予定',
      'エラー',
      '本文のコマンドが不正です: invalid command,2026/05/11',
      'msg-error'
    ]);
    expect(mockSheet.appendRow).toHaveBeenNthCalledWith(2, [
      expect.any(Date),
      mockMessages[1].getDate(),
      'user2@example.com',
      '出社予定',
      '成功',
      '',
      'msg-success'
    ]);

    // エラーメール送信の検証：エラーがあったため、管理者に通知が届くこと
    expect(mockMailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockMailApp.sendEmail).toHaveBeenCalledWith(
      'admin@example.com',
      '【エラー発生】出社予定登録処理',
      expect.stringContaining('invalid command,2026/05/11')
    );

    // アーカイブ処理の検証
    expect(mockThreads[0].moveToArchive).toHaveBeenCalled();
  });

  it('should skip messages that have already been processed (exists in log sheet)', () => {
    // 既に 'msg-error' が処理済み（ログシートに存在）であるようにモックを設定
    mockSheet.getLastRow.mockReturnValue(3);
    mockSheet.getRange.mockReturnValue({
      getValues: jest.fn().mockReturnValue([
        ['msg-error'],
        ['msg-already-done']
      ])
    });

    gas.runImport();

    // 1通目（エラー、既に処理済み）の検証：処理がスキップされ、既読化やエラー処理が呼ばれないこと
    expect(mockMessages[0].markRead).not.toHaveBeenCalled();
    expect(mockMessages[0].star).not.toHaveBeenCalled();

    // 2通目（正常、未処理）の検証：正常に処理（カレンダー追加、既読化）されること
    expect(mockMessages[1].markRead).toHaveBeenCalled();
    expect(mockCalendar.createAllDayEvent).toHaveBeenCalledWith('拠点A出社', expect.any(Date));

    // ログ記録の検証：2通目のみがスプレッドシートへ追記されること
    expect(mockSheet.appendRow).toHaveBeenCalledTimes(1);
    expect(mockSheet.appendRow).toHaveBeenCalledWith([
      expect.any(Date),
      mockMessages[1].getDate(),
      'user2@example.com',
      '出社予定',
      '成功',
      '',
      'msg-success'
    ]);
  });
});
