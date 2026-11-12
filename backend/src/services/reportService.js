// 일일보고 (api.md 6.12, D-151~D-161)
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError, invalidInput, notFound } from '../utils/appError.js';
import { koreaToday } from '../utils/koreaDate.js';
import { getMyTeam } from './teamService.js';
import { autoSectionHtml, loadReportContext, monthDayText } from './reportContent.js';
import { emitToTeam } from '../realtime/index.js';

const REPORT_COLUMNS = `id, report_date, status, nickname, header, sections, team_id, user_id,
  draft_date, submit_date, update_date`;
const MANAGER_ROLES = ['owner', 'manager'];

const requestOf = (runner) => (runner.request ? runner.request() : new sql.Request(runner));
const isoOrNull = (value) => (value ? value.toISOString() : null);

function toReport(row, userId) {
  const isMine = row.user_id !== null && Number(row.user_id) === userId;
  return {
    reportId: Number(row.id),
    reportDate: row.report_date.toISOString().slice(0, 10),
    status: row.status,
    nickname: row.nickname,
    isMine,
    header: row.header,
    sections: JSON.parse(row.sections),
    draftDate: isMine ? isoOrNull(row.draft_date) : null,
    submitDate: isoOrNull(row.submit_date),
    updateDate: isoOrNull(row.update_date),
  };
}

async function findMyReportRow(runner, teamId, userId, reportDate, { isLocked = false } = {}) {
  const result = await requestOf(runner)
    .input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, userId).input('date', sql.VarChar(10), reportDate)
    .query(`SELECT ${REPORT_COLUMNS} FROM daily_reports ${isLocked ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
            WHERE team_id = @teamId AND user_id = @userId AND report_date = CAST(@date AS DATE)`);
  return result.recordset[0] ?? null;
}

async function loadTemplate(runner, teamId) {
  const result = await requestOf(runner).input('teamId', sql.BigInt, teamId)
    .query('SELECT header, sections FROM report_templates WHERE team_id = @teamId');
  const row = result.recordset[0];
  return { header: row.header, sections: JSON.parse(row.sections) };
}

async function loadMe(runner, userId) {
  const result = await requestOf(runner).input('userId', sql.BigInt, userId)
    .query('SELECT nickname, is_report_carry_over FROM users WHERE id = @userId');
  return { nickname: result.recordset[0].nickname, isCarryOver: Boolean(result.recordset[0].is_report_carry_over) };
}

// 오늘 전 보고일 중 가장 마지막 내 보고(draft·submitted)의 글 구역: 제목 → html
async function loadCarrySections(pool, teamId, userId, today) {
  const result = await pool.request()
    .input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, userId).input('today', sql.VarChar(10), today)
    .query(`SELECT TOP 1 sections FROM daily_reports
            WHERE team_id = @teamId AND user_id = @userId AND report_date < CAST(@today AS DATE)
            ORDER BY report_date DESC`);
  const row = result.recordset[0];
  const sections = row ? JSON.parse(row.sections) : [];
  return new Map(sections.filter((section) => section.type === 'text').map((section) => [section.title, section.html]));
}

// 저장하지 않은 초안 (status = new). 글 구역은 이어받은 내용 또는 기본 내용
async function buildDraft(pool, teamId, userId, { nickname, isCarryOver }) {
  const today = koreaToday();
  const template = await loadTemplate(pool, teamId);
  const context = await loadReportContext(pool, teamId, userId, today);
  const carried = isCarryOver ? await loadCarrySections(pool, teamId, userId, today) : new Map();
  const sections = template.sections.map(({ defaultHtml, ...section }) => ({
    ...section,
    html: section.type === 'text' ? (carried.get(section.title) ?? defaultHtml) : autoSectionHtml(context, section),
  }));
  return {
    reportId: null,
    reportDate: today,
    status: 'new',
    nickname,
    isMine: true,
    header: template.header.replaceAll('{날짜}', monthDayText(today)),
    sections,
    draftDate: null,
    submitDate: null,
    updateDate: null,
  };
}

// 팀원 보고 현황: 나 → 지금 팀원(합류 순, 그 날짜 뒤 합류는 뺌) → 그날 제출했지만 목록에 없는 사람(제출 순)
export async function listReportStatus(userId, teamId, date) {
  if (date > koreaToday()) {
    throw invalidInput();
  }
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const result = await pool.request().input('teamId', sql.BigInt, teamId).input('date', sql.VarChar(10), date)
    .query(`SELECT m.user_id, u.nickname, m.create_date FROM team_members m JOIN users u ON u.id = m.user_id
            WHERE m.team_id = @teamId ORDER BY m.create_date, m.id;
            SELECT id, user_id, nickname, status, submit_date, update_date FROM daily_reports
            WHERE team_id = @teamId AND report_date = CAST(@date AS DATE) ORDER BY submit_date, id;`);
  const [members, reports] = result.recordsets;
  const reportOf = new Map(reports.filter((row) => row.user_id !== null).map((row) => [Number(row.user_id), row]));
  const toItem = (memberUserId, nickname) => {
    const isMe = memberUserId === userId;
    const row = reportOf.get(memberUserId);
    const isVisible = row && (row.status === 'submitted' || isMe);
    return {
      userId: memberUserId,
      nickname,
      isMe,
      status: isVisible ? row.status : 'none',
      reportId: isVisible ? Number(row.id) : null,
      submitDate: isVisible ? isoOrNull(row.submit_date) : null,
      isEdited: Boolean(isVisible && row.update_date),
    };
  };
  const me = members.find((row) => Number(row.user_id) === userId);
  const items = [toItem(userId, me.nickname)];
  members.filter((row) => Number(row.user_id) !== userId && koreaToday(row.create_date) <= date)
    .forEach((row) => items.push(toItem(Number(row.user_id), row.nickname)));
  const listed = new Set(items.map((item) => item.userId));
  reports.filter((row) => row.status === 'submitted' && (row.user_id === null || !listed.has(Number(row.user_id))))
    .forEach((row) => items.push({
      userId: row.user_id === null ? null : Number(row.user_id),
      nickname: row.nickname,
      isMe: false,
      status: 'submitted',
      reportId: Number(row.id),
      submitDate: isoOrNull(row.submit_date),
      isEdited: Boolean(row.update_date),
    }));
  return { date, isToday: date === koreaToday(), items };
}

// 보고 하나: submitted 보고, 또는 내 draft 보고
export async function getReport(userId, teamId, reportId) {
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const result = await pool.request().input('id', sql.BigInt, reportId).input('teamId', sql.BigInt, teamId)
    .query(`SELECT ${REPORT_COLUMNS} FROM daily_reports WHERE id = @id AND team_id = @teamId`);
  const row = result.recordset[0];
  if (!row || (row.status === 'draft' && Number(row.user_id) !== userId)) {
    throw notFound();
  }
  return toReport(row, userId);
}

// 내 오늘 보고: 저장한 것이 있으면 그것, 없으면 초안 (저장하지 않음)
export async function getTodayReport(userId, teamId) {
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const me = await loadMe(pool, userId);
  const row = await findMyReportRow(pool, teamId, userId, koreaToday());
  const report = row ? toReport(row, userId) : await buildDraft(pool, teamId, userId, me);
  return { report, isCarryOver: me.isCarryOver };
}

// [새 양식 적용] 초안: 글 구역은 언제나 기본 내용
export async function getFreshReport(userId, teamId) {
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const me = await loadMe(pool, userId);
  return { report: await buildDraft(pool, teamId, userId, { ...me, isCarryOver: false }) };
}

// 자동 구역 [다시 불러오기]
export async function getSectionContent(userId, teamId, section) {
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const context = await loadReportContext(pool, teamId, userId, koreaToday());
  return { html: autoSectionHtml(context, section) };
}

// 임시저장(draft) / 제출·수정 제출(submit). 한 트랜잭션에서 그날 내 보고 행을 잠그고 읽는다
export async function saveTodayReport(userId, teamId, input) {
  const saved = await withTransaction(async (transaction) => {
    await getMyTeam(userId, teamId, transaction);
    if (input.reportDate !== koreaToday()) {
      throw new AppError(409, 'REPORT_NOT_TODAY', '날짜가 바뀌어 지난 보고는 고칠 수 없습니다.');
    }
    const row = await findMyReportRow(transaction, teamId, userId, input.reportDate, { isLocked: true });
    if (input.action === 'draft' && row?.status === 'submitted') {
      throw new AppError(409, 'REPORT_ALREADY_SUBMITTED', '이미 제출한 보고입니다.');
    }
    const { nickname } = await loadMe(transaction, userId);
    const request = new sql.Request(transaction)
      .input('nickname', sql.NVarChar(8), nickname)
      .input('header', sql.NVarChar(100), input.header)
      .input('sections', sql.NVarChar(sql.MAX), JSON.stringify(input.sections));
    let eventAction = null;
    if (!row) {
      const status = input.action === 'draft' ? 'draft' : 'submitted';
      eventAction = status === 'submitted' ? 'submit' : null;
      await request.input('date', sql.VarChar(10), input.reportDate).input('status', sql.NVarChar(10), status)
        .input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, userId)
        .query(`INSERT INTO daily_reports (report_date, status, nickname, header, sections, team_id, user_id, draft_date, submit_date)
                VALUES (CAST(@date AS DATE), @status, @nickname, @header, @sections, @teamId, @userId,
                  CASE WHEN @status = 'draft' THEN SYSUTCDATETIME() END, CASE WHEN @status = 'submitted' THEN SYSUTCDATETIME() END)`);
    } else {
      let change = 'draft_date = SYSUTCDATETIME()';
      if (input.action === 'submit') {
        eventAction = row.status === 'submitted' ? 'update' : 'submit';
        change = row.status === 'submitted' ? 'update_date = SYSUTCDATETIME()' : "status = 'submitted', submit_date = SYSUTCDATETIME()";
      }
      await request.input('id', sql.BigInt, row.id)
        .query(`UPDATE daily_reports SET nickname = @nickname, header = @header, sections = @sections, ${change} WHERE id = @id`);
    }
    const report = toReport(await findMyReportRow(transaction, teamId, userId, input.reportDate), userId);
    return { report, eventAction };
  });
  if (saved.eventAction) {
    emitToTeam(teamId, 'team:reports-changed', {
      teamId, reportDate: saved.report.reportDate, reportId: saved.report.reportId, userId, action: saved.eventAction, actorUserId: userId,
    });
  }
  return saved.report;
}

export async function getReportTemplate(userId, teamId) {
  const team = await getMyTeam(userId, teamId);
  const template = await loadTemplate(await getPool(), teamId);
  return { ...template, canEdit: MANAGER_ROLES.includes(team.myRole) };
}

// 양식 저장: 관리자·부관리자만. 이미 저장한 보고는 바꾸지 않는다
export async function updateReportTemplate(userId, teamId, input) {
  return withTransaction(async (transaction) => {
    const team = await getMyTeam(userId, teamId, transaction);
    if (!MANAGER_ROLES.includes(team.myRole)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.');
    }
    await new sql.Request(transaction)
      .input('header', sql.NVarChar(100), input.header)
      .input('sections', sql.NVarChar(sql.MAX), JSON.stringify(input.sections))
      .input('teamId', sql.BigInt, teamId)
      .query('UPDATE report_templates SET header = @header, sections = @sections, update_date = SYSUTCDATETIME() WHERE team_id = @teamId');
    return { ...input, canEdit: true };
  });
}

export async function setReportCarryOver(userId, isOn) {
  const pool = await getPool();
  await pool.request().input('userId', sql.BigInt, userId).input('isOn', sql.Bit, isOn)
    .query('UPDATE users SET is_report_carry_over = @isOn WHERE id = @userId');
  return { isCarryOver: isOn };
}
