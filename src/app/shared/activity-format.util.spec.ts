import {
  getItemDateSource,
  getItemTimestamp,
  formatActivityMoment,
} from './activity-format.util';

describe('activity-format.util', () => {
  describe('getItemDateSource', () => {
    it('should return null for a nullish item', () => {
      expect(getItemDateSource(null)).toBeNull();
    });

    it('should use the default field list when none is provided', () => {
      expect(getItemDateSource({ updated_at: '2024-01-01' })).toBe(
        '2024-01-01'
      );
    });

    it('should skip blank candidates and fall back to the next field', () => {
      expect(
        getItemDateSource(
          { updated_at: '', created_at: '2024-02-02' },
          ['updated_at', 'created_at']
        )
      ).toBe('2024-02-02');
    });

    it('should return null when no candidate field has a value', () => {
      expect(getItemDateSource({}, ['updated_at', 'created_at'])).toBeNull();
    });

    it('should respect the order of the provided field list', () => {
      expect(
        getItemDateSource(
          { fecha_ingreso: '2024-03-03', fecha: '2024-04-04' },
          ['fecha_ingreso', 'fecha']
        )
      ).toBe('2024-03-03');
    });
  });

  describe('getItemTimestamp', () => {
    it('should return 0 when there is no usable date', () => {
      expect(getItemTimestamp({}, ['updated_at'])).toBe(0);
    });

    it('should return the parsed timestamp for a valid date', () => {
      const timestamp = getItemTimestamp(
        { updated_at: '2024-01-01T00:00:00Z' },
        ['updated_at']
      );
      expect(timestamp).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('should return 0 for an unparsable date string', () => {
      expect(getItemTimestamp({ updated_at: 'not-a-date' }, ['updated_at'])).toBe(
        0
      );
    });
  });

  describe('formatActivityMoment', () => {
    it('should return a dash when there is no input', () => {
      expect(formatActivityMoment(undefined)).toBe('-');
    });

    it('should return a dash for an invalid date string', () => {
      expect(formatActivityMoment('not-a-date')).toBe('-');
    });

    it('should format a date-only value using the day/month/year pattern', () => {
      const result = formatActivityMoment('2024-05-20');
      expect(result).toMatch(/^\d{2}\/\d{2}\/2024$/);
    });

    it('should format a full timestamp including hour and minute', () => {
      const result = formatActivityMoment('2024-05-20T15:30:00Z');
      expect(result).toContain('12:30');
    });
  });
});
