// 일일보고 자동 채우기와 완료 범위 (api.md 6.12 "완료 범위", "자동 채우기", D-153, D-154)
import { sql } from '../config/db.js';
import { HISTORY_SQL } from './taskCore.js';
import { addDays, toDateText } from '../utils/koreaDate.js';

const STATUS_LABEL = { waiting: '대기', progress: '진행', done: '완료' };
const LIST_ORDER = ['progress', 'waiting', 'done'];

const requestOf = (runner) => (runner.request ? runner.request() : new sql.Request(runner));

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// 'YYYY-MM-DD' → 'M/D'
export function monthDayText(dateText) {
  const [, month, day] = dateText.split('-').map(Number);
  return `${month}/${day}`;
}

// 한국 시간 그 날짜 0시 (한국은 UTC+9, 일광 절약 시간 없음)
const koreaMidnight = (dateText) => new Date(`${dateText}T00:00:00+09:00`);
// 0(일)~6(토)
const weekdayOf = (dateText) => new Date(`${dateText}T00:00:00Z`).getUTCDay();

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 그 해·달(1~12, 넘치면 해를 옮김)의 day 일. 그 달에 없는 날짜는 그 달 마지막 날
function monthDate(year, month, day) {
  const base = new Date(Date.UTC(year, month - 1, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = Math.min(day, lastDayOfMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 완료 범위 → { from: Date|null, to: Date|null, isHistoryExcluded: boolean } (sinceLastReport 는 lastSubmitDate 가 필요)
export function resolveDoneRange(range, today, lastSubmitDate) {
  const [year, month] = today.split('-').map(Number);
  switch (range.kind) {
    case 'sinceLastReport':
      return lastSubmitDate
        ? { from: lastSubmitDate, to: null, isHistoryExcluded: false }
        : { from: null, to: null, isHistoryExcluded: true };
    case 'weekday': {
      const target = range.weekday % 7;
      let date = addDays(today, -1);
      while (weekdayOf(date) !== target) {
        date = addDays(date, -1);
      }
      return { from: koreaMidnight(date), to: null, isHistoryExcluded: false };
    }
    case 'monthDay': {
      let date = monthDate(year, month, range.day);
      if (date >= today) {
        date = monthDate(year, month - 1, range.day);
      }
      return { from: koreaMidnight(date), to: null, isHistoryExcluded: false };
    }
    case 'lastWeek': {
      const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
      return { from: koreaMidnight(addDays(monday, -7)), to: koreaMidnight(monday), isHistoryExcluded: false };
    }
    default:
      return { from: koreaMidnight(monthDate(year, month - 1, 1)), to: koreaMidnight(monthDate(year, month, 1)), isHistoryExcluded: false };
  }
}

// 자동 채우기에 쓰는 값: 이 팀에서 내가 작업자인 작업, 오늘 전 마지막 제출 보고의 처음 제출 시각
export async function loadReportContext(runner, teamId, userId, today) {
  const result = await requestOf(runner)
    .input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, userId).input('today', sql.VarChar(10), today)
    .query(`SELECT t.id, t.title, t.start_date, t.end_date, t.status, t.sort_order, t.done_date, t.is_period_undecided,
              CASE WHEN ${HISTORY_SQL} THEN 1 ELSE 0 END AS is_history
            FROM tasks t
            WHERE t.team_id = @teamId AND EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = @userId);
            SELECT TOP 1 submit_date FROM daily_reports
            WHERE team_id = @teamId AND user_id = @userId AND status = 'submitted' AND report_date < CAST(@today AS DATE)
            ORDER BY report_date DESC;`);
  const tasks = result.recordsets[0].map((row) => ({
    taskId: Number(row.id),
    title: row.title,
    startDate: toDateText(row.start_date),
    endDate: toDateText(row.end_date),
    status: row.status,
    sortOrder: row.sort_order,
    doneDate: row.done_date,
    isHistory: Boolean(row.is_history),
  }));
  return { today, tasks, lastSubmitDate: result.recordsets[1][0]?.submit_date ?? null };
}

function doneTasks(context, doneRange) {
  const { from, to, isHistoryExcluded } = resolveDoneRange(doneRange, context.today, context.lastSubmitDate);
  return context.tasks.filter((task) => task.status === 'done'
    && (!isHistoryExcluded || !task.isHistory)
    && (from === null || task.doneDate >= from)
    && (to === null || task.doneDate < to));
}

// 같은 상태 안은 칸반 순서. 완료 중 히스토리 작업은 완료 시각 늦은 순으로 뒤에
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.isHistory !== b.isHistory) {
      return a.isHistory ? 1 : -1;
    }
    if (a.isHistory) {
      return b.doneDate - a.doneDate || b.taskId - a.taskId;
    }
    return a.sortOrder - b.sortOrder || a.taskId - b.taskId;
  });
}

// [기간]: 월/일, 보고일과 해가 다르면 YYYY/M/D, 같은 날이면 하나, 미정이면 [미정]
export function periodText(task, reportDate) {
  if (!task.startDate) {
    return '[미정]';
  }
  const year = reportDate.slice(0, 4);
  const one = (dateText) => (dateText.slice(0, 4) === year ? monthDayText(dateText) : `${dateText.slice(0, 4)}/${monthDayText(dateText)}`);
  return task.startDate === task.endDate ? `[${one(task.startDate)}]` : `[${one(task.startDate)}~${one(task.endDate)}]`;
}

// 자동 구역(stats / tasks) 내용. 해당 작업이 없으면 빈 문자열
export function autoSectionHtml(context, section) {
  const byStatus = (status) => context.tasks.filter((task) => task.status === status);
  if (section.type === 'stats') {
    return `<p>: 완료 ${doneTasks(context, section.doneRange).length}건, 진행 ${byStatus('progress').length}건, 대기 ${byStatus('waiting').length}건</p>`;
  }
  const items = LIST_ORDER.filter((status) => section.statuses.includes(status)).flatMap((status) => {
    const tasks = sortTasks(status === 'done' ? doneTasks(context, section.doneRange) : byStatus(status));
    return tasks.map((task) => `<li><p>${periodText(task, context.today)} ${escapeHtml(task.title)} - [${STATUS_LABEL[status]}]</p></li>`);
  });
  return items.length > 0 ? `<ul>${items.join('')}</ul>` : '';
}
