const { loadGasFiles } = require('./helpers/gas-loader');

describe('Calendar.gs', () => {
  let gas;
  let mockCalendar;
  let mockEvent;

  beforeEach(() => {
    gas = loadGasFiles();

    mockEvent = {
      getTitle: jest.fn(),
      deleteEvent: jest.fn(),
    };

    mockCalendar = {
      createAllDayEvent: jest.fn(),
      getEventsForDay: jest.fn().mockReturnValue([mockEvent]),
    };
  });

  describe('deleteManagedEventsForDay_', () => {
    it('should delete event if title matches titleSet', () => {
      mockEvent.getTitle.mockReturnValue('テレワーク');
      const titleSet = { 'テレワーク': true };
      const day = new Date(2026, 5, 20);

      gas.deleteManagedEventsForDay_(mockCalendar, day, titleSet);

      expect(mockCalendar.getEventsForDay).toHaveBeenCalledWith(day);
      expect(mockEvent.deleteEvent).toHaveBeenCalled();
    });

    it('should not delete event if title does not match titleSet', () => {
      mockEvent.getTitle.mockReturnValue('別件ミーティング');
      const titleSet = { 'テレワーク': true };
      const day = new Date(2026, 5, 20);

      gas.deleteManagedEventsForDay_(mockCalendar, day, titleSet);

      expect(mockCalendar.getEventsForDay).toHaveBeenCalledWith(day);
      expect(mockEvent.deleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('applyOpsToCalendar_', () => {
    it('should handle set operation by deleting old events and creating new ones', () => {
      mockEvent.getTitle.mockReturnValue('テレワーク');
      const ops = [{ type: 'set', dateStr: '2026/06/20', title: '有給休暇' }];
      const managedTitles = ['テレワーク', '有給休暇'];
      
      const expectedDay = gas.parseDateJst_('2026/06/20');

      gas.applyOpsToCalendar_(mockCalendar, ops, managedTitles);

      expect(mockCalendar.getEventsForDay).toHaveBeenCalledWith(expectedDay);
      expect(mockEvent.deleteEvent).toHaveBeenCalled();
      expect(mockCalendar.createAllDayEvent).toHaveBeenCalledWith('有給休暇', expectedDay);
    });

    it('should handle delete operation by deleting old events only', () => {
      mockEvent.getTitle.mockReturnValue('テレワーク');
      const ops = [{ type: 'delete', dateStr: '2026/06/20' }];
      const managedTitles = ['テレワーク'];
      const expectedDay = gas.parseDateJst_('2026/06/20');

      gas.applyOpsToCalendar_(mockCalendar, ops, managedTitles);

      expect(mockCalendar.getEventsForDay).toHaveBeenCalledWith(expectedDay);
      expect(mockEvent.deleteEvent).toHaveBeenCalled();
      expect(mockCalendar.createAllDayEvent).not.toHaveBeenCalled();
    });
  });
});
