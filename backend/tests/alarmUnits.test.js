// 알람 단위 검사: 입력 검사, 다음 울릴 시각·마지막으로 울렸어야 할 시각 (api.md 6.13, D-178, D-179)
import { describe, expect, test } from 'vitest';
import { readAlarmInput, readToggleInput } from '../src/utils/alarmInput.js';
import {
  autoDate, bitsToWeekdays, koreaDateTime, lastRepeatFire, nextRepeatFire, weekdaysToBits,
} from '../src/utils/alarmSchedule.js';

const today = '2026-11-11'; // 수요일
const input = (over = {}) => ({ title: '출근', time: '06:00', date: null, weekdays: [], isHolidayOff: false, ...over });
const read = (over) => readAlarmInput(input(over), today);
const kst = (text) => new Date(`${text}+09:00`);
const NOW = kst('2026-11-11T14:30:00'); // 수요일 14:30

describe('알람 입력 검사', () => {
  test('이름: 없음·빈 값은 null, 앞뒤 공백 제거, 30자까지', () => {
    expect(read({ title: undefined }).title).toBeNull();
    expect(read({ title: null }).title).toBeNull();
    expect(read({ title: '   ' }).title).toBeNull();
    expect(read({ title: ` ${'가'.repeat(30)} ` }).title).toBe('가'.repeat(30));
    expect(() => read({ title: '가'.repeat(31) })).toThrow();
    expect(() => read({ title: 1 })).toThrow();
  });
  test.each([['00:00'], ['23:59'], ['09:05']])('시각 %s 은 된다', (time) => {
    expect(read({ time }).time).toBe(time);
  });
  test.each([['24:00'], ['9:00'], ['12:60'], ['12:00:00'], [''], [900], [null]])('시각 %j 은 400', (time) => {
    expect(() => read({ time })).toThrow();
  });
  test('요일: 0~7개, 1~7, 겹침 없음, 작은 순으로 정리', () => {
    expect(read({ weekdays: [] }).weekdays).toEqual([]);
    expect(read({ weekdays: [7, 1, 3] }).weekdays).toEqual([1, 3, 7]);
    expect(read({ weekdays: [1, 2, 3, 4, 5, 6, 7] }).weekdays).toHaveLength(7);
    [[0], [8], [1, 1], [1.5], ['1'], [1, 2, 3, 4, 5, 6, 7, 1]].forEach((weekdays) => expect(() => read({ weekdays })).toThrow());
    expect(() => read({ weekdays: '1' })).toThrow();
    expect(() => read({ weekdays: undefined })).toThrow();
  });
  test('날짜: 오늘~365일 뒤, 실제 있는 날짜만', () => {
    expect(read({ date: today }).date).toBe(today);
    expect(read({ date: '2027-11-11' }).date).toBe('2027-11-11');
    expect(() => read({ date: '2027-11-12' })).toThrow();
    expect(() => read({ date: '2026-11-10' })).toThrow();
    expect(() => read({ date: '2027-02-30' })).toThrow();
    expect(() => read({ date: '2026/11/20' })).toThrow();
  });
  test('날짜와 요일은 둘 중 하나, 공휴일에는 끄기는 요일 알람만', () => {
    expect(() => read({ date: '2026-11-20', weekdays: [1] })).toThrow();
    expect(() => read({ isHolidayOff: true })).toThrow();
    expect(read({ weekdays: [1], isHolidayOff: true }).isHolidayOff).toBe(true);
    expect(() => read({ isHolidayOff: 'true' })).toThrow();
  });
  test('본문이 객체가 아니면 400, 켜기/끄기는 boolean 만', () => {
    expect(() => readAlarmInput(null, today)).toThrow();
    expect(() => readAlarmInput([], today)).toThrow();
    expect(readToggleInput({ isOn: false })).toBe(false);
    expect(() => readToggleInput({ isOn: 1 })).toThrow();
  });
});

describe('울릴 시각 계산 (지금 2026-11-11 수 14:30)', () => {
  test.each([['14:31', '2026-11-11'], ['14:30', '2026-11-12'], ['14:29', '2026-11-12'], ['23:59', '2026-11-11'], ['00:00', '2026-11-12']])(
    '날짜·요일 없음: %s → %s (지나거나 같으면 내일)', (time, date) => {
      expect(autoDate(time, NOW)).toBe(date);
    },
  );
  test('요일 비트: 월 1 ~ 일 64, 매일 127', () => {
    expect(weekdaysToBits([1, 3, 7])).toBe(1 + 4 + 64);
    expect(weekdaysToBits([1, 2, 3, 4, 5, 6, 7])).toBe(127);
    expect(bitsToWeekdays(69)).toEqual([1, 3, 7]);
  });
  test('요일 알람: 오늘 그 요일이고 시각 전이면 오늘, 지났으면 다음 주', () => {
    expect(nextRepeatFire({ time: '14:31', weekdays: [3], isHolidayOff: false }, NOW, new Set())).toEqual(kst('2026-11-11T14:31:00'));
    expect(nextRepeatFire({ time: '14:30', weekdays: [3], isHolidayOff: false }, NOW, new Set())).toEqual(kst('2026-11-18T14:30:00'));
    expect(nextRepeatFire({ time: '06:00', weekdays: [7], isHolidayOff: false }, NOW, new Set())).toEqual(kst('2026-11-15T06:00:00'));
  });
  test('공휴일에는 끄기: 공휴일은 건너뛰고, 꺼져 있으면 공휴일에도 울린다', () => {
    const holidays = new Set(['2026-11-12']);
    expect(nextRepeatFire({ time: '09:00', weekdays: [1, 2, 3, 4, 5], isHolidayOff: true }, NOW, holidays)).toEqual(kst('2026-11-13T09:00:00'));
    expect(nextRepeatFire({ time: '09:00', weekdays: [1, 2, 3, 4, 5], isHolidayOff: false }, NOW, holidays)).toEqual(kst('2026-11-12T09:00:00'));
  });
  test('400일 안이 모두 공휴일이면 공휴일을 보지 않고 다시 찾는다', () => {
    const holidays = new Set(Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 10, 11 + i)).toISOString().slice(0, 10)));
    expect(nextRepeatFire({ time: '09:00', weekdays: [4], isHolidayOff: true }, NOW, holidays)).toEqual(kst('2026-11-12T09:00:00'));
  });
  test('마지막으로 울렸어야 할 시각: 지금 이하 가장 최근, from 보다 앞은 없음', () => {
    const daily = { time: '06:00', weekdays: [1, 2, 3, 4, 5, 6, 7], isHolidayOff: false };
    expect(lastRepeatFire(daily, NOW, kst('2026-11-08T06:00:00'), new Set())).toEqual(kst('2026-11-11T06:00:00'));
    expect(lastRepeatFire({ ...daily, time: '14:30' }, NOW, kst('2026-11-08T14:30:00'), new Set())).toEqual(kst('2026-11-11T14:30:00'));
    expect(lastRepeatFire({ ...daily, time: '14:31' }, NOW, kst('2026-11-10T14:31:00'), new Set())).toEqual(kst('2026-11-10T14:31:00'));
    expect(lastRepeatFire({ ...daily, isHolidayOff: true }, NOW, kst('2026-11-08T06:00:00'), new Set(['2026-11-11']))).toEqual(kst('2026-11-10T06:00:00'));
    expect(lastRepeatFire(daily, NOW, kst('2026-11-12T06:00:00'), new Set())).toBeNull();
    expect(koreaDateTime('2026-11-11', '00:00')).toEqual(new Date('2026-11-10T15:00:00Z'));
  });
});
