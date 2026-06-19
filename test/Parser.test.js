const { loadGasFiles } = require('./helpers/gas-loader');

describe('Parser.gs', () => {
  let gas;

  beforeEach(() => {
    gas = loadGasFiles();
  });

  describe('parseAttendanceMailBody_', () => {
    it('should parse valid set and delete commands', () => {
      const body = `
        set, 2026/06/20, テレワーク
        delete, 2026/06/21
      `;
      const result = gas.parseAttendanceMailBody_(body);
      expect(result).toEqual([
        { type: 'set', dateStr: '2026/06/20', title: 'テレワーク' },
        { type: 'delete', dateStr: '2026/06/21' }
      ]);
    });

    it('should prioritize the last command for the same date', () => {
      const body = `
        set, 2026/06/20, テレワーク
        set, 2026/06/20, 有給休暇
      `;
      const result = gas.parseAttendanceMailBody_(body);
      expect(result).toEqual([
        { type: 'set', dateStr: '2026/06/20', title: '有給休暇' }
      ]);
    });

    it('should throw an error for invalid command', () => {
      const body = 'invalid, 2026/06/20';
      expect(() => {
        gas.parseAttendanceMailBody_(body);
      }).toThrow('本文のコマンドが不正です');
    });

    it('should throw an error for invalid date format', () => {
      const body = 'set, 2026-06-20, テレワーク';
      expect(() => {
        gas.parseAttendanceMailBody_(body);
      }).toThrow('日付形式が不正です');
    });

    it('should throw an error for empty label in set command', () => {
      const body = 'set, 2026/06/20, ';
      expect(() => {
        gas.parseAttendanceMailBody_(body);
      }).toThrow('set の label が空です');
    });
  });

  describe('parseDateJst_', () => {
    it('should parse valid date string into Date object', () => {
      const date = gas.parseDateJst_('2026/06/20');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(5); // 0-indexed, so 5 is June
      expect(date.getDate()).toBe(20);
    });
  });
});
