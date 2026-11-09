import { parseDurationToSeconds } from './duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['12h', 43200],
    ['7d', 604800],
  ])('%s = %i giây', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it.each(['15', 'm15', '1.5h', '15 phút', ''])('từ chối "%s"', (input) => {
    expect(() => parseDurationToSeconds(input)).toThrow('Thời lượng không hợp lệ');
  });
});
