// 일일보고 단위 검사: HTML 정화·글자 수, 완료 범위 경계, 기간 글, 입력 검사 (api.md 6.12, D-154, D-155, D-161, D-163)
import { describe, expect, test } from 'vitest';
import { sanitizeReportHtml, textLengthOf } from '../src/utils/reportHtml.js';
import { autoSectionHtml, periodText, resolveDoneRange } from '../src/services/reportContent.js';
import { readReportSaveInput, readSectionQuery, readTemplateInput } from '../src/utils/reportInput.js';

const kst = (text) => new Date(`${text}+09:00`);
const fromOf = (range, today, last = null) => resolveDoneRange(range, today, last);

describe('HTML 정화 (D-155, D-163)', () => {
  test('허용하지 않은 태그·속성·스크립트는 지운다', () => {
    expect(sanitizeReportHtml('<p onclick="x">a<script>alert(1)</script><img src=x onerror=alert(1)></p><h1>b</h1>'))
      .toBe('<p>a</p>b');
  });
  test('글자 색: #RRGGBB, rgb(0~255) 만. 다른 style 은 지운다', () => {
    expect(sanitizeReportHtml('<span style="color: #E5484D; font-size: 40px">a</span>')).toBe('<span style="color:#E5484D">a</span>');
    expect(sanitizeReportHtml('<span style="color: rgb(255, 0, 0)">a</span>')).toBe('<span style="color:rgb(255, 0, 0)">a</span>');
    expect(sanitizeReportHtml('<span style="color: rgb(256, 0, 0)">a</span>')).toBe('<span>a</span>');
    expect(sanitizeReportHtml('<span style="color: red">a</span>')).toBe('<span>a</span>');
  });
  test('셀: colspan·rowspan 1~10, 배경색·정렬만', () => {
    expect(sanitizeReportHtml('<table><tbody><tr><td colspan="10" rowspan="1" style="background-color: rgb(232, 246, 238); text-align: center; width: 9px">a</td><td colspan="11" rowspan="0" style="text-align: justify">b</td></tr></tbody></table>'))
      .toBe('<table><tbody><tr><td colspan="10" rowspan="1" style="background-color:rgb(232, 246, 238);text-align:center">a</td><td>b</td></tr></tbody></table>');
  });
  test('링크: http·https·mailto 만, target·rel 은 서버가 붙인다. 아니면 글자만', () => {
    expect(sanitizeReportHtml('<a href="https://a.com" target="_self" rel="x">a</a>'))
      .toBe('<a href="https://a.com" target="_blank" rel="noopener noreferrer">a</a>');
    expect(sanitizeReportHtml('<a href="mailto:a@b.com">m</a>')).toContain('href="mailto:a@b.com"');
    expect(sanitizeReportHtml('<p><a href="javascript:alert(1)">x</a> y <a href="http://b.com">b</a></p>'))
      .toBe('<p><span>x</span> y <a href="http://b.com" target="_blank" rel="noopener noreferrer">b</a></p>');
  });
  test('글자 수는 태그를 빼고 엔티티를 풀어 센다', () => {
    expect(textLengthOf('<p>a &amp; &lt;b&gt;</p><p>가나</p>')).toBe(9);
    expect(textLengthOf('')).toBe(0);
  });
});

describe('완료 범위 (D-154). 오늘 2026-11-11 (수)', () => {
  const today = '2026-11-11';
  test('지난 보고 이후: 제출 시각 이후, 없으면 히스토리 제외', () => {
    const last = new Date('2026-11-10T00:05:00Z');
    expect(fromOf({ kind: 'sinceLastReport' }, today, last)).toEqual({ from: last, to: null, isHistoryExcluded: false });
    expect(fromOf({ kind: 'sinceLastReport' }, today)).toEqual({ from: null, to: null, isHistoryExcluded: true });
  });
  test.each([
    [1, '2026-11-09'], [2, '2026-11-10'], [3, '2026-11-04'], [4, '2026-11-05'], [7, '2026-11-08'],
  ])('요일 %i → %s 0시 (오늘이 그 요일이면 7일 전)', (weekday, date) => {
    expect(fromOf({ kind: 'weekday', weekday }, today).from).toEqual(kst(`${date}T00:00:00`));
  });
  test.each([
    ['2026-11-11', 10, '2026-11-10'], ['2026-11-11', 11, '2026-10-11'], ['2026-11-11', 12, '2026-10-12'],
    ['2026-03-15', 31, '2026-02-28'], ['2026-01-05', 5, '2025-12-05'], ['2026-03-31', 31, '2026-02-28'],
  ])('오늘 %s, 매달 %i일 → %s 0시', (day, monthDay, date) => {
    expect(fromOf({ kind: 'monthDay', day: monthDay }, day).from).toEqual(kst(`${date}T00:00:00`));
  });
  test.each([
    ['2026-11-11', '2026-11-02', '2026-11-09'], ['2026-11-09', '2026-11-02', '2026-11-09'], ['2026-11-15', '2026-11-02', '2026-11-09'],
  ])('지난 주: 오늘 %s → %s ~ %s', (day, from, to) => {
    expect(fromOf({ kind: 'lastWeek' }, day)).toEqual({ from: kst(`${from}T00:00:00`), to: kst(`${to}T00:00:00`), isHistoryExcluded: false });
  });
  test.each([
    ['2026-11-11', '2026-10-01', '2026-11-01'], ['2026-01-01', '2025-12-01', '2026-01-01'],
  ])('지난 달: 오늘 %s → %s ~ %s', (day, from, to) => {
    expect(fromOf({ kind: 'lastMonth' }, day)).toEqual({ from: kst(`${from}T00:00:00`), to: kst(`${to}T00:00:00`), isHistoryExcluded: false });
  });
});

describe('자동 채우기 (D-153)', () => {
  const task = (over) => ({ taskId: 1, title: 't', startDate: '2026-11-10', endDate: '2026-11-24', status: 'progress', sortOrder: 0, doneDate: null, isHistory: false, ...over });
  test.each([
    [{}, '[11/10~11/24]'], [{ endDate: '2026-11-10' }, '[11/10]'], [{ startDate: null, endDate: null }, '[미정]'],
    [{ startDate: '2025-12-29', endDate: '2026-01-05' }, '[2025/12/29~1/5]'], [{ startDate: '2026-12-29', endDate: '2027-01-05' }, '[12/29~2027/1/5]'],
  ])('기간 %o → %s', (over, text) => {
    expect(periodText(task(over), '2026-11-11')).toBe(text);
  });
  test('진행 → 대기 → 완료, 같은 상태는 칸반 순서, 히스토리 완료는 늦은 순으로 뒤, 제목 이스케이프', () => {
    const context = {
      today: '2026-11-11',
      lastSubmitDate: new Date('2026-11-01T00:00:00Z'),
      tasks: [
        task({ taskId: 1, title: '대기2', status: 'waiting', sortOrder: 1 }),
        task({ taskId: 2, title: '<b>', status: 'waiting', sortOrder: 0 }),
        task({ taskId: 3, title: '진행', status: 'progress' }),
        task({ taskId: 4, title: '히1', status: 'done', doneDate: new Date('2026-11-02T00:00:00Z'), isHistory: true }),
        task({ taskId: 5, title: '히2', status: 'done', doneDate: new Date('2026-11-03T00:00:00Z'), isHistory: true }),
        task({ taskId: 6, title: '완료', status: 'done', sortOrder: 0, doneDate: new Date('2026-11-10T00:00:00Z') }),
        task({ taskId: 7, title: '오래됨', status: 'done', doneDate: new Date('2026-10-01T00:00:00Z'), isHistory: true }),
      ],
    };
    const html = autoSectionHtml(context, { type: 'tasks', statuses: ['done', 'waiting', 'progress'], doneRange: { kind: 'sinceLastReport' } });
    expect(html).toBe('<ul><li><p>[11/10~11/24] 진행 - [진행]</p></li><li><p>[11/10~11/24] &lt;b&gt; - [대기]</p></li>'
      + '<li><p>[11/10~11/24] 대기2 - [대기]</p></li><li><p>[11/10~11/24] 완료 - [완료]</p></li>'
      + '<li><p>[11/10~11/24] 히2 - [완료]</p></li><li><p>[11/10~11/24] 히1 - [완료]</p></li></ul>');
    expect(autoSectionHtml(context, { type: 'stats', statuses: [], doneRange: { kind: 'sinceLastReport' } }))
      .toBe('<p>: 완료 3건, 진행 1건, 대기 2건</p>');
    expect(autoSectionHtml({ ...context, tasks: [] }, { type: 'tasks', statuses: ['progress'], doneRange: null })).toBe('');
  });
});

describe('입력 검사 (D-161)', () => {
  const section = (over = {}) => ({ title: '◆ 글', type: 'text', statuses: [], doneRange: null, defaultHtml: '', html: '', ...over });
  const save = (over = {}) => ({ reportDate: '2026-11-11', action: 'draft', header: '', sections: [section()], ...over });
  test('구역 1~20개, 제목 1~30자(앞뒤 공백 제거), 제목 겹침 금지', () => {
    expect(readTemplateInput({ header: ' h ', sections: [section({ title: ` ${'가'.repeat(30)} ` })] }).header).toBe('h');
    expect(() => readTemplateInput({ header: '', sections: [] })).toThrow();
    expect(() => readTemplateInput({ header: '', sections: Array.from({ length: 21 }, (_, i) => section({ title: `t${i}` })) })).toThrow();
    expect(readTemplateInput({ header: '', sections: Array.from({ length: 20 }, (_, i) => section({ title: `t${i}` })) }).sections).toHaveLength(20);
    expect(() => readTemplateInput({ header: '', sections: [section({ title: '가'.repeat(31) })] })).toThrow();
    expect(() => readTemplateInput({ header: '', sections: [section({ title: '  ' })] })).toThrow();
    expect(() => readTemplateInput({ header: '', sections: [section({ title: 'a' }), section({ title: ' a' })] })).toThrow();
  });
  test('머리말 0~100자', () => {
    expect(readTemplateInput({ header: 'a'.repeat(100), sections: [section()] }).header).toHaveLength(100);
    expect(() => readTemplateInput({ header: 'a'.repeat(101), sections: [section()] })).toThrow();
    expect(() => readReportSaveInput(save({ header: 'a'.repeat(101) }))).toThrow();
  });
  test('작업 목록은 상태 1개 이상·중복 없음, 완료가 있으면 완료 범위 필요', () => {
    const tasks = (over) => readTemplateInput({ header: '', sections: [section({ type: 'tasks', ...over })] }).sections[0];
    expect(tasks({ statuses: ['progress'], doneRange: { kind: 'weekday', weekday: 1 } }).doneRange).toBeNull();
    expect(tasks({ statuses: ['done'], doneRange: { kind: 'weekday', weekday: 7, day: 3 } }).doneRange).toEqual({ kind: 'weekday', weekday: 7, day: null });
    expect(() => tasks({ statuses: [] })).toThrow();
    expect(() => tasks({ statuses: ['done', 'done'] })).toThrow();
    expect(() => tasks({ statuses: ['done'], doneRange: null })).toThrow();
    expect(() => tasks({ statuses: ['done'], doneRange: { kind: 'weekday', weekday: 0 } })).toThrow();
    expect(() => tasks({ statuses: ['done'], doneRange: { kind: 'monthDay', day: 32 } })).toThrow();
    expect(tasks({ statuses: ['done'], doneRange: { kind: 'monthDay', day: 31 } }).doneRange.day).toBe(31);
  });
  test('구역 글자 5,000자까지, 보고 HTML 합계 100,000자까지', () => {
    expect(readReportSaveInput(save({ sections: [section({ html: `<p>${'a'.repeat(5000)}</p>` })] })).sections[0].html).toHaveLength(5007);
    expect(() => readReportSaveInput(save({ sections: [section({ html: `<p>${'a'.repeat(5001)}</p>` })] }))).toThrow();
    // 글자는 적어도 HTML 이 20,000자를 넘으면 안 된다 (한 묶음 25자 × 800 = 20,000 은 된다)
    expect(readReportSaveInput(save({ sections: [section({ html: '<p><strong>a</strong></p>'.repeat(800) })] })).sections[0].html).toHaveLength(20000);
    expect(() => readReportSaveInput(save({ sections: [section({ html: '<p><strong>a</strong></p>'.repeat(801) })] }))).toThrow();
    const big = Array.from({ length: 6 }, (_, i) => section({ title: `t${i}`, html: '<p><strong>a</strong></p>'.repeat(700) }));
    expect(() => readReportSaveInput(save({ sections: big }))).toThrow();
    expect(() => readReportSaveInput(save({ action: 'publish' }))).toThrow();
    expect(() => readReportSaveInput(save({ reportDate: '2026-02-30' }))).toThrow();
  });
  test('다시 불러오기 쿼리', () => {
    expect(readSectionQuery({ type: 'tasks', statuses: 'progress,done', doneKind: 'monthDay', doneDay: '31' }))
      .toEqual({ type: 'tasks', statuses: ['progress', 'done'], doneRange: { kind: 'monthDay', weekday: null, day: 31 } });
    expect(readSectionQuery({ type: 'stats', doneKind: 'lastWeek' }).doneRange.kind).toBe('lastWeek');
    expect(() => readSectionQuery({ type: 'text' })).toThrow();
    expect(() => readSectionQuery({ type: 'tasks', statuses: 'progress,' })).toThrow();
    expect(() => readSectionQuery({ type: 'stats' })).toThrow();
    expect(() => readSectionQuery({ type: 'stats', doneKind: 'weekday', doneWeekday: '8' })).toThrow();
  });
});
