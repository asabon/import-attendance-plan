const { loadGasFiles } = require('./helpers/gas-loader');

describe('Api.gs', () => {
  let gas;
  let mockProperties;
  let mockPropertiesService;
  let mockMessages;
  let mockThreads;
  let mockGmailApp;
  let mockSheet;
  let mockSpreadsheet;
  let mockSpreadsheetApp;
  let mockContentService;
  let mockTextOutput;

  beforeEach(() => {
    mockProperties = {
      ATTENDANCE_CALENDAR_ID: 'primary',
      ATTENDANCE_MANAGED_TITLES: '拠点A出社,拠点B出社',
      ATTENDANCE_MAIL_SUBJECT: '出社予定',
      ATTENDANCE_LOG_SHEET_ID: 'sheet-123',
      ATTENDANCE_API_TOKEN: 'secret-token'
    };

    mockPropertiesService = {
      getScriptProperties: jest.fn().mockReturnValue({
        getProperty: jest.fn().mockImplementation((key) => mockProperties[key])
      })
    };

    mockMessages = [
      {
        isStarred: jest.fn().mockReturnValue(true),
        getId: jest.fn().mockReturnValue('msg-1'),
        getSubject: jest.fn().mockReturnValue('出社予定'),
        getFrom: jest.fn().mockReturnValue('user@example.com'),
        getDate: jest.fn().mockReturnValue(new Date('2026-07-04T05:00:00Z')),
        getPlainBody: jest.fn().mockReturnValue('error body')
      }
    ];

    mockThreads = [
      {
        getMessages: jest.fn().mockReturnValue(mockMessages)
      }
    ];

    mockGmailApp = {
      search: jest.fn().mockReturnValue(mockThreads)
    };

    // ログデータ（ヘッダーとデータ1行）
    // 0:実行日時, 1:メール受信日時, 2:送信元, 3:件名, 4:結果, 5:エラー内容, 6:Message-ID
    const logData = [
      ['実行日時', 'メール受信日時', '送信元', '件名', '結果', 'エラー内容', 'Message-ID'],
      [new Date(), new Date(), 'user@example.com', '出社予定', 'エラー', 'パースエラー詳細', 'msg-1']
    ];

    mockSheet = {
      getDataRange: jest.fn().mockReturnValue({
        getValues: jest.fn().mockReturnValue(logData)
      })
    };
    mockSpreadsheet = {
      getSheets: jest.fn().mockReturnValue([mockSheet])
    };
    mockSpreadsheetApp = {
      openById: jest.fn().mockReturnValue(mockSpreadsheet)
    };

    mockTextOutput = {
      setMimeType: jest.fn().mockReturnThis()
    };

    mockContentService = {
      MimeType: { JSON: 'json' },
      createTextOutput: jest.fn().mockReturnValue(mockTextOutput)
    };

    gas = loadGasFiles({
      PropertiesService: mockPropertiesService,
      GmailApp: mockGmailApp,
      SpreadsheetApp: mockSpreadsheetApp,
      ContentService: mockContentService,
      IMPORT_ATTENDANCE_PLAN_VERSION: '1.0.0'
    });
  });

  it('should return Unauthorized if token does not match', () => {
    const e = { parameter: { token: 'wrong-token' } };
    gas.doGet(e);

    expect(mockContentService.createTextOutput).toHaveBeenCalledWith(
      expect.stringContaining('"error":"Unauthorized"')
    );
  });

  it('should return matched errors if token is valid', () => {
    const e = { parameter: { token: 'secret-token' } };
    gas.doGet(e);

    expect(mockGmailApp.search).toHaveBeenCalledWith('is:starred subject:"出社予定"', 0, 50);
    expect(mockContentService.createTextOutput).toHaveBeenCalledWith(
      expect.stringContaining('"success":true')
    );
    
    // 引数の JSON データを解析して確認
    const jsonStr = mockContentService.createTextOutput.mock.calls[0][0];
    const data = JSON.parse(jsonStr);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toEqual({
      messageId: 'msg-1',
      date: '2026-07-04T05:00:00.000Z',
      from: 'user@example.com',
      subject: '出社予定',
      errorMsg: 'パースエラー詳細',
      body: 'error body'
    });
  });
});
