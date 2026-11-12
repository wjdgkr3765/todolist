// 일일보고 요청 형식 검사 (api.md 6.12 "구역 형식", "완료 범위", D-152, D-154, D-161). 틀리면 400 INVALID_INPUT
import { invalidInput } from './appError.js';
import { isRealDate } from './todoInput.js';
import {
  MAX_REPORT_HTML, MAX_SECTION_HTML, MAX_SECTION_TEXT, sanitizeReportHtml, textLengthOf,
} from './reportHtml.js';

const TYPES = ['stats', 'tasks', 'text'];
const STATUSES = ['waiting', 'progress', 'done'];
const DONE_KINDS = ['sinceLastReport', 'weekday', 'monthDay', 'lastWeek', 'lastMonth'];
const MAX_SECTIONS = 20;
const MAX_TITLE = 30;
const MAX_HEADER = 100;

function isIntBetween(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

// { kind, weekday, day }. weekday 는 1(월)~7(일), day 는 1~31
export function readDoneRange(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !DONE_KINDS.includes(value.kind)) {
    throw invalidInput();
  }
  const weekday = value.kind === 'weekday' ? value.weekday : null;
  const day = value.kind === 'monthDay' ? value.day : null;
  if ((weekday !== null && !isIntBetween(weekday, 1, 7)) || (day !== null && !isIntBetween(day, 1, 31))) {
    throw invalidInput();
  }
  return { kind: value.kind, weekday, day };
}

function readStatuses(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > STATUSES.length
    || value.some((status) => !STATUSES.includes(status)) || new Set(value).size !== value.length) {
    throw invalidInput();
  }
  return value;
}

// 통계, 그리고 완료가 있는 작업 목록만 완료 범위를 쓴다
export function needsDoneRange(type, statuses) {
  return type === 'stats' || (type === 'tasks' && statuses.includes('done'));
}

// 정화한 HTML 의 길이 검사: 글자 5,000자, HTML 20,000자
function readHtml(value) {
  if (typeof value !== 'string') {
    throw invalidInput();
  }
  const html = sanitizeReportHtml(value);
  if (html.length > MAX_SECTION_HTML || textLengthOf(html) > MAX_SECTION_TEXT) {
    throw invalidInput();
  }
  return html;
}

// 구역 공통 (title, type, statuses, doneRange)
function readSectionBase(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.title !== 'string'
    || !TYPES.includes(value.type)) {
    throw invalidInput();
  }
  const title = value.title.trim();
  if (title.length < 1 || title.length > MAX_TITLE) {
    throw invalidInput();
  }
  const statuses = value.type === 'tasks' ? readStatuses(value.statuses) : [];
  const doneRange = needsDoneRange(value.type, statuses) ? readDoneRange(value.doneRange) : null;
  return { title, type: value.type, statuses, doneRange };
}

function readSectionList(value, readSection) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SECTIONS) {
    throw invalidInput();
  }
  const sections = value.map(readSection);
  if (new Set(sections.map((section) => section.title)).size !== sections.length) {
    throw invalidInput();
  }
  return sections;
}

function readHeader(value, isTrimmed) {
  if (typeof value !== 'string') {
    throw invalidInput();
  }
  const header = isTrimmed ? value.trim() : value;
  if (header.length > MAX_HEADER) {
    throw invalidInput();
  }
  return header;
}

// 양식 저장: header 는 앞뒤 공백을 지우고 0~100자, 글 구역만 defaultHtml
export function readTemplateInput(body) {
  const sections = readSectionList(body.sections, (value) => {
    const base = readSectionBase(value);
    return { ...base, defaultHtml: base.type === 'text' ? readHtml(value.defaultHtml) : '' };
  });
  return { header: readHeader(body.header, true), sections };
}

// 보고 저장: 구역마다 html, 보고 HTML 합계 100,000자 이하
export function readReportSaveInput(body) {
  const { reportDate, action } = body;
  if (!isRealDate(reportDate) || (action !== 'draft' && action !== 'submit')) {
    throw invalidInput();
  }
  const sections = readSectionList(body.sections, (value) => ({ ...readSectionBase(value), html: readHtml(value.html) }));
  if (sections.reduce((sum, section) => sum + section.html.length, 0) > MAX_REPORT_HTML) {
    throw invalidInput();
  }
  return { reportDate, action, header: readHeader(body.header, false), sections };
}

function readQueryInt(value, min, max) {
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || !isIntBetween(Number(value), min, max)) {
    throw invalidInput();
  }
  return Number(value);
}

// [다시 불러오기] 쿼리: type, statuses(쉼표), doneKind, doneWeekday, doneDay
export function readSectionQuery(query) {
  const { type } = query;
  if (type !== 'stats' && type !== 'tasks') {
    throw invalidInput();
  }
  let statuses = [];
  if (type === 'tasks') {
    if (typeof query.statuses !== 'string') {
      throw invalidInput();
    }
    statuses = readStatuses(query.statuses.split(','));
  }
  let doneRange = null;
  if (needsDoneRange(type, statuses)) {
    const kind = query.doneKind;
    doneRange = readDoneRange({
      kind,
      weekday: kind === 'weekday' ? readQueryInt(query.doneWeekday, 1, 7) : null,
      day: kind === 'monthDay' ? readQueryInt(query.doneDay, 1, 31) : null,
    });
  }
  return { type, statuses, doneRange };
}
