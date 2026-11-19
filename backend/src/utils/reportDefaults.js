// 일일보고 기본 양식 (api.md 6.12 "기본 양식", D-152, D-176). 팀을 만들 때 함께 저장한다
export const DEFAULT_REPORT_HEADER = '{날짜} 진행 사항입니다.';

export const DEFAULT_REPORT_SECTIONS = [
  { title: '기본', type: 'text', statuses: [], doneRange: null, defaultHtml: '' },
];
