// 일일보고 기본 양식 (api.md 6.12 "기본 양식", D-152). 팀을 만들 때 함께 저장한다
const SINCE_LAST_REPORT = { kind: 'sinceLastReport', weekday: null, day: null };

export const DEFAULT_REPORT_HEADER = '{날짜} 진행 사항입니다.';

export const DEFAULT_REPORT_SECTIONS = [
  { title: '◆ 통계', type: 'stats', statuses: [], doneRange: SINCE_LAST_REPORT, defaultHtml: '' },
  { title: '◆ 진행', type: 'tasks', statuses: ['progress'], doneRange: null, defaultHtml: '' },
  { title: '◆ 대기', type: 'tasks', statuses: ['waiting'], doneRange: null, defaultHtml: '' },
  { title: '◆ 완료', type: 'tasks', statuses: ['done'], doneRange: SINCE_LAST_REPORT, defaultHtml: '' },
  { title: '◆ 기타', type: 'text', statuses: [], doneRange: null, defaultHtml: '' },
];
