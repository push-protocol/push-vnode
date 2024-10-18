import {expect} from "chai";
import DateUtil from "../../src/utilz/dateUtil";

describe('DateUtil.parseUnixFloatAsDouble', () => {
  const MAX_UNIX_TS = DateUtil.MAX_UNIX_TS;

  it('should parse valid timestamps correctly', () => {
    console.log('max: ' + DateUtil.MAX_UNIX_TS);
    const validTimestamps = [
      '1661214142.000000',
      '1661214142.00000',
      '1661214142.0000',
      '1661214142.000',
      '1661214142.00',
      '1661214142.0',
      '1661214142.',
      '1661214142',
    ];
    validTimestamps.forEach((timestamp) => {
      const result = DateUtil.parseUnixFloatOrFail(timestamp);
      expect(result).to.equal(Number.parseFloat(timestamp));
    });
  });


  it('should parse timestamp zero correctly 1', () => {
    const timestamp = '0';
    const result = DateUtil.parseUnixFloatOrFail(timestamp);
    expect(result).to.equal(0);
  });

  it('should parse timestamp zero correctly 2', () => {
    const timestamp = '0.0';
    const result = DateUtil.parseUnixFloatOrFail(timestamp);
    expect(result).to.equal(0);
  });

  it('should accept timestamps equal to MAX_UNIX_TS', () => {
    const timestamp = `${MAX_UNIX_TS}.0`;
    const result = DateUtil.parseUnixFloatOrFail(timestamp);
    expect(result).to.equal(Number.parseFloat(timestamp));
  });

  it('should reject timestamps exceeding MAX_UNIX_TS', () => {
    const invalidTimestamps = [
      `${MAX_UNIX_TS }.1`,
      `${MAX_UNIX_TS + 1}.0`,
      `${MAX_UNIX_TS + 1000}.0`,
    ];
    invalidTimestamps.forEach((timestamp) => {
      expect(() => DateUtil.parseUnixFloatOrFail(timestamp)).to.throw();
    });
  });

  it('should reject negative timestamps', () => {
    const invalidTimestamps = [
      '-1.0',
      '-1661214142.0',
    ];
    invalidTimestamps.forEach((timestamp) => {
      expect(() => DateUtil.parseUnixFloatOrFail(timestamp)).to.throw('timestamp must be a positive integer');
    });
  });

  it('should reject timestamps with more than 6 fractional digits', () => {
    const invalidTimestamps = [
      '1661214142.1234567', // 7 fractional digits
      '1661214142.123456789', // 9 fractional digits
    ];
    invalidTimestamps.forEach((timestamp) => {
      expect(() => DateUtil.parseUnixFloatOrFail(timestamp)).to.throw();
    });
  });

  it('should accept timestamps with up to 6 fractional digits', () => {
    const validTimestamps = [
      '1661214142.1',
      '1661214142.12',
      '1661214142.123',
      '1661214142.1234',
      '1661214142.12345',
      '1661214142.123456',
    ];
    validTimestamps.forEach((timestamp) => {
      const result = DateUtil.parseUnixFloatOrFail(timestamp);
      expect(result).to.equal(Number.parseFloat(timestamp));
    });
  });

  it('should accept timestamps with zero fractional digits after dot', () => {
    const validTimestamps = [
      '1661214142.',
    ];
    validTimestamps.forEach((timestamp) => {
      const result = DateUtil.parseUnixFloatOrFail(timestamp);
      expect(result).to.equal(Number.parseFloat(timestamp));
    });
  });


  it('should reject timestamps with invalid characters', () => {
    const invalidTimestamps = [
      'abc.123456',
      '1661214142.abc',
      '1661214142.123abc',
      '16612abc142.123456',
      '1661214142.12 3456',
    ];
    invalidTimestamps.forEach((timestamp) => {
      expect(() => DateUtil.parseUnixFloatOrFail(timestamp)).to.throw();
    });
  });

  it('should reject timestamps with missing digits before the dot', () => {
    const invalidTimestamps = [
      '.123456',
      '.',
    ];
    invalidTimestamps.forEach((timestamp) => {
      expect(() => DateUtil.parseUnixFloatOrFail(timestamp)).to.throw('timestamp format should be XXXXXXXX.YYYYYY where XXXXXXXX is the unit timestamp and YYYYYY is the sub-second precision');
    });
  });

  it('should handle timestamps with leading zeros', () => {
    const validTimestamps = [
      '0001661214142.000000',
      '0000.000000',
    ];
    validTimestamps.forEach((timestamp) => {
      const result = DateUtil.parseUnixFloatOrFail(timestamp);
      expect(result).to.equal(Number.parseFloat(timestamp));
    });
  });
});