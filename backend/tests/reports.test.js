// 일일보고 API (api.md 6.12): 현황·초안·저장 흐름·이어받기·양식 권한·실시간 이벤트
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { addDays, koreaToday } from '../src/utils/koreaDate.js';
import { cleanupTestRows, loginTestUser, runSql, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user?.cookie ?? '').send(body);
const today = koreaToday();
const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

async function addMember(teamId, user, role = 'member', joinedDaysAgo = 0) {
  await runSql(`INSERT INTO team_members (role, sort_order, team_id, user_id, create_date)
                VALUES (@role, 0, @teamId, @userId, DATEADD(DAY, -@days, SYSUTCDATETIME()))`,
  { role: [sql.NVarChar(10), role], teamId: [sql.BigInt, teamId], userId: [sql.BigInt, user.userId], days: [sql.Int, joinedDaysAgo] });
}

async function setupTeam() {
  const owner = await loginTestUser(app);
  const member = await loginTestUser(app);
  const team = (await post('/api/teams', owner, { name: 'vt보고팀' })).body.data;
  await runSql('UPDATE team_members SET create_date = DATEADD(DAY, -30, create_date) WHERE team_id = @teamId',
    { teamId: [sql.BigInt, team.teamId] });
  await addMember(team.teamId, member, 'member', 20);
  return { owner, member, teamId: team.teamId, base: `/api/teams/${team.teamId}` };
}

async function insertTask(teamId, assignee, { title, status, sortOrder = 0, doneHoursAgo = 0, start = null, end = null }) {
  const result = await runSql(
    `INSERT INTO tasks (title, content, start_date, end_date, status, sort_order, team_id, is_period_undecided, done_date)
     OUTPUT inserted.id VALUES (@title, N'내용', @start, @end, @status, @order, @teamId, @undecided,
       CASE WHEN @status = 'done' THEN DATEADD(HOUR, -@hours, SYSUTCDATETIME()) END)`,
    {
      title: [sql.NVarChar(50), title], start: [sql.VarChar(10), start], end: [sql.VarChar(10), end], status: [sql.NVarChar(10), status],
      order: [sql.Int, sortOrder], teamId: [sql.BigInt, teamId], undecided: [sql.Bit, start === null], hours: [sql.Int, doneHoursAgo],
    },
  );
  const taskId = Number(result.recordset[0].id);
  await runSql('INSERT INTO task_assignees (task_id, user_id) VALUES (@taskId, @userId)',
    { taskId: [sql.BigInt, taskId], userId: [sql.BigInt, assignee.userId] });
  return taskId;
}

async function insertReport(teamId, user, { date, status, sections, submitHoursAgo = 24, nickname = '테스트' }) {
  const result = await runSql(
    `INSERT INTO daily_reports (report_date, status, nickname, header, sections, team_id, user_id, draft_date, submit_date)
     OUTPUT inserted.id VALUES (@date, @status, @nickname, N'', @sections, @teamId, @userId, SYSUTCDATETIME(),
       CASE WHEN @status = 'submitted' THEN DATEADD(HOUR, -@hours, SYSUTCDATETIME()) END)`,
    {
      date: [sql.VarChar(10), date], status: [sql.NVarChar(10), status], nickname: [sql.NVarChar(8), nickname],
      sections: [sql.NVarChar(sql.MAX), JSON.stringify(sections)], teamId: [sql.BigInt, teamId],
      userId: [sql.BigInt, user?.userId ?? null], hours: [sql.Int, submitHoursAgo],
    },
  );
  return Number(result.recordset[0].id);
}

const textSection = (title, html) => ({ title, type: 'text', statuses: [], doneRange: null, html });
const saveBody = (report, action, over = {}) => ({
  reportDate: report.reportDate, action, header: report.header, sections: report.sections, ...over,
});

beforeAll(cleanupTestRows);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('내 오늘 보고 (초안)', () => {
  test('기본 양식 초안: 머리말 날짜, 내가 작업자인 작업만, 저장하지 않는다', async () => {
    const { owner, member, teamId, base } = await setupTeam();
    await insertTask(teamId, owner, { title: '진행A', status: 'progress', start: today, end: addDays(today, 3) });
    await insertTask(teamId, owner, { title: '대기A', status: 'waiting' });
    await insertTask(teamId, owner, { title: '완료A', status: 'done', doneHoursAgo: 2, start: today, end: today });
    await insertTask(teamId, owner, { title: '히스토리', status: 'done', doneHoursAgo: 24 * 8 });
    await insertTask(teamId, member, { title: '남의작업', status: 'progress' });
    const { report, isCarryOver } = (await get(`${base}/reports/today`, owner)).body.data;
    expect(isCarryOver).toBe(false);
    expect(report).toMatchObject({ reportId: null, reportDate: today, status: 'new', isMine: true, header: `${md(today)} 진행 사항입니다.` });
    expect(report.sections.map((s) => s.title)).toEqual(['◆ 통계', '◆ 진행', '◆ 대기', '◆ 완료', '◆ 기타']);
    expect(report.sections[0].html).toBe('<p>: 완료 1건, 진행 1건, 대기 1건</p>');
    expect(report.sections[1].html).toContain('진행A - [진행]');
    expect(report.sections[1].html).not.toContain('남의작업');
    expect(report.sections[2].html).toBe('<ul><li><p>[미정] 대기A - [대기]</p></li></ul>');
    expect(report.sections[3].html).toBe(`<ul><li><p>[${md(today)}] 완료A - [완료]</p></li></ul>`);
    expect(report.sections[4]).toEqual({ title: '◆ 기타', type: 'text', statuses: [], doneRange: null, html: '' });
    const rows = await runSql('SELECT COUNT(*) AS n FROM daily_reports WHERE team_id = @teamId', { teamId: [sql.BigInt, teamId] });
    expect(rows.recordset[0].n).toBe(0);
  });
  test('지난 보고 이후: 마지막 제출 보고의 처음 제출 시각 이후 완료만 (히스토리 포함)', async () => {
    const { owner, teamId, base } = await setupTeam();
    await insertReport(teamId, owner, { date: addDays(today, -1), status: 'submitted', sections: [], submitHoursAgo: 24 * 9 });
    await insertTask(teamId, owner, { title: '이후히스토리', status: 'done', doneHoursAgo: 24 * 8 });
    await insertTask(teamId, owner, { title: '이전', status: 'done', doneHoursAgo: 24 * 10 });
    const { report } = (await get(`${base}/reports/today`, owner)).body.data;
    expect(report.sections[3].html).toContain('이후히스토리');
    expect(report.sections[3].html).not.toContain('이전');
  });
  test('이어받기: 켜면 마지막 보고(임시저장 포함)의 같은 제목 글 구역, 꺼지면 기본 내용', async () => {
    const { owner, teamId, base } = await setupTeam();
    await insertReport(teamId, owner, { date: addDays(today, -3), status: 'submitted', sections: [textSection('◆ 기타', '<p>오래된</p>')] });
    await insertReport(teamId, owner, { date: addDays(today, -1), status: 'draft', sections: [textSection('◆ 기타', '<p>어제</p>')] });
    expect((await post('/api/users/me/report-carry-over', owner, { isOn: true })).body.data).toEqual({ isCarryOver: true });
    const on = (await get(`${base}/reports/today`, owner)).body.data;
    expect(on.isCarryOver).toBe(true);
    expect(on.report.sections[4].html).toBe('<p>어제</p>');
    expect((await get(`${base}/reports/today/fresh`, owner)).body.data.report.sections[4].html).toBe('');
    await post('/api/users/me/report-carry-over', owner, { isOn: false });
    expect((await get(`${base}/reports/today`, owner)).body.data.report.sections[4].html).toBe('');
    expect((await post('/api/users/me/report-carry-over', owner, { isOn: 'true' })).status).toBe(400);
  });
});

describe('저장 흐름 (D-157)', () => {
  test('임시저장 → 제출 → 수정 제출, 제출 뒤 임시저장은 409, 정화해서 저장', async () => {
    const { owner, member, base } = await setupTeam();
    const draft = (await get(`${base}/reports/today`, owner)).body.data.report;
    draft.sections[4].html = '<p>메모<script>alert(1)</script></p>';
    const saved = (await post(`${base}/reports/today/save`, owner, saveBody(draft, 'draft'))).body.data;
    expect(saved).toMatchObject({ status: 'draft', isMine: true, draftDate: expect.any(String), submitDate: null });
    expect(saved.sections[4].html).toBe('<p>메모</p>');
    // 남의 draft 는 404, 현황에도 미제출
    expect((await get(`${base}/reports/${saved.reportId}`, member)).status).toBe(404);
    const memberView = (await get(`${base}/reports?date=${today}`, member)).body.data.items;
    expect(memberView.find((i) => i.userId === owner.userId)).toMatchObject({ status: 'none', reportId: null });
    expect((await get(`${base}/reports/today`, owner)).body.data.report.reportId).toBe(saved.reportId);

    const submitted = (await post(`${base}/reports/today/save`, owner, saveBody(saved, 'submit'))).body.data;
    expect(submitted).toMatchObject({ reportId: saved.reportId, status: 'submitted', submitDate: expect.any(String), updateDate: null });
    const draftAgain = await post(`${base}/reports/today/save`, owner, saveBody(saved, 'draft'));
    expect(draftAgain.status).toBe(409);
    expect(draftAgain.body.error.code).toBe('REPORT_ALREADY_SUBMITTED');
    const updated = (await post(`${base}/reports/today/save`, owner, saveBody(saved, 'submit'))).body.data;
    expect(updated.submitDate).toBe(submitted.submitDate);
    expect(updated.updateDate).toEqual(expect.any(String));
    const read = (await get(`${base}/reports/${saved.reportId}`, member)).body.data;
    expect(read).toMatchObject({ isMine: false, draftDate: null, status: 'submitted' });
  });
  test('빈 초안도 바로 제출된다, 오늘이 아니면 409 REPORT_NOT_TODAY', async () => {
    const { owner, base } = await setupTeam();
    const draft = (await get(`${base}/reports/today`, owner)).body.data.report;
    const notToday = await post(`${base}/reports/today/save`, owner, saveBody(draft, 'submit', { reportDate: addDays(today, -1) }));
    expect(notToday.status).toBe(409);
    expect(notToday.body.error.code).toBe('REPORT_NOT_TODAY');
    expect((await post(`${base}/reports/today/save`, owner, saveBody(draft, 'submit'))).body.data.status).toBe('submitted');
  });
  test('입력 오류 400, 512kb 까지 받고 넘으면 400', async () => {
    const { owner, base } = await setupTeam();
    const draft = (await get(`${base}/reports/today`, owner)).body.data.report;
    expect((await post(`${base}/reports/today/save`, owner, saveBody(draft, 'submit', { sections: [] }))).status).toBe(400);
    // 100kb 를 넘는 본문(정화 뒤에는 짧아짐)도 저장 API 는 받는다
    const padded = `<p>a</p>${'<img>'.repeat(30000)}`;
    const ok = await post(`${base}/reports/today/save`, owner, saveBody(draft, 'draft', { sections: [textSection('a', padded)] }));
    expect(ok.status).toBe(200);
    const tooBig = await post(`${base}/reports/today/save`, owner, saveBody(draft, 'draft', { sections: [textSection('a', 'x'.repeat(530 * 1024))] }));
    expect(tooBig.status).toBe(400);
    expect((await post(`${base}/update`, owner, { name: 'x'.repeat(110 * 1024) })).status).toBe(400);
  });
});

describe('팀원 보고 현황 (D-158)', () => {
  test('나 → 팀원(합류 순) → 지금 없는 제출자, 그 날짜 뒤 합류자는 뺀다, 오늘 뒤 날짜 400', async () => {
    const { owner, member, teamId, base } = await setupTeam();
    const late = await loginTestUser(app);
    await addMember(teamId, late, 'member', 0);
    const yesterday = addDays(today, -1);
    await insertReport(teamId, null, { date: yesterday, status: 'submitted', sections: [], nickname: '나간사람', submitHoursAgo: 5 });
    const memberReport = await insertReport(teamId, member, { date: yesterday, status: 'submitted', sections: [], submitHoursAgo: 10 });
    await insertReport(teamId, owner, { date: yesterday, status: 'draft', sections: [] });
    const past = (await get(`${base}/reports?date=${yesterday}`, owner)).body.data;
    expect(past).toMatchObject({ date: yesterday, isToday: false });
    expect(past.items.map((i) => [i.userId, i.status, i.isMe])).toEqual([
      [owner.userId, 'draft', true], [member.userId, 'submitted', false], [null, 'submitted', false],
    ]);
    expect(past.items[1]).toMatchObject({ reportId: memberReport, isEdited: false, submitDate: expect.any(String) });
    expect(past.items[2].nickname).toBe('나간사람');
    const now = (await get(`${base}/reports?date=${today}`, member)).body.data;
    expect(now.isToday).toBe(true);
    expect(now.items.map((i) => i.userId)).toEqual([member.userId, owner.userId, late.userId]);
    expect((await get(`${base}/reports?date=${addDays(today, 1)}`, owner)).status).toBe(400);
    expect((await get(`${base}/reports?date=2026-13-01`, owner)).status).toBe(400);
  });
  test('로그인 필요, 남의 팀·다른 팀 보고 404', async () => {
    const { owner, teamId, base } = await setupTeam();
    const other = await setupTeam();
    const reportId = await insertReport(teamId, owner, { date: addDays(today, -1), status: 'submitted', sections: [] });
    expect((await get(`${base}/reports/today`)).status).toBe(401);
    expect((await get(`${base}/reports/today`, other.owner)).status).toBe(404);
    expect((await get(`${other.base}/reports/${reportId}`, other.owner)).status).toBe(404);
    expect((await get(`${base}/reports/abc`, owner)).status).toBe(400);
  });
});

describe('다시 불러오기·양식 (D-152)', () => {
  test('다시 불러오기: 그 구역 설정으로 지금 칸반 내용', async () => {
    const { owner, teamId, base } = await setupTeam();
    await insertTask(teamId, owner, { title: '진행B', status: 'progress' });
    const res = (await get(`${base}/reports/section-content?type=tasks&statuses=progress`, owner)).body.data;
    expect(res.html).toBe('<ul><li><p>[미정] 진행B - [진행]</p></li></ul>');
    expect((await get(`${base}/reports/section-content?type=stats&doneKind=lastMonth`, owner)).body.data.html)
      .toBe('<p>: 완료 0건, 진행 1건, 대기 0건</p>');
    expect((await get(`${base}/reports/section-content?type=stats`, owner)).status).toBe(400);
  });
  test('양식: 팀원은 읽기만(canEdit false, 저장 403), 관리자 저장은 새 초안부터 적용', async () => {
    const { owner, member, base } = await setupTeam();
    const before = (await get(`${base}/reports/today`, owner)).body.data.report;
    await post(`${base}/reports/today/save`, owner, saveBody(before, 'draft'));
    const template = (await get(`${base}/report-template`, member)).body.data;
    expect(template).toMatchObject({ header: '{날짜} 진행 사항입니다.', canEdit: false });
    expect(template.sections).toHaveLength(5);
    const next = {
      header: ' {날짜} 보고 ',
      sections: [
        { title: '◆ 모니터링', type: 'text', statuses: [], doneRange: null, defaultHtml: '<table><tbody><tr><td>틀</td></tr></tbody></table>' },
        { title: '◆ 완료', type: 'tasks', statuses: ['done'], doneRange: { kind: 'weekday', weekday: 1 }, defaultHtml: '<p>무시</p>' },
      ],
    };
    expect((await post(`${base}/report-template/update`, member, next)).status).toBe(403);
    const saved = (await post(`${base}/report-template/update`, owner, next)).body.data;
    expect(saved).toMatchObject({ header: '{날짜} 보고', canEdit: true });
    expect(saved.sections[1]).toEqual({ title: '◆ 완료', type: 'tasks', statuses: ['done'], doneRange: { kind: 'weekday', weekday: 1, day: null }, defaultHtml: '' });
    // 이미 저장한 내 보고는 그대로, 팀원의 새 초안은 새 양식
    expect((await get(`${base}/reports/today`, owner)).body.data.report.sections).toHaveLength(5);
    const fresh = (await get(`${base}/reports/today`, member)).body.data.report;
    expect(fresh.header).toBe(`${md(today)} 보고`);
    expect(fresh.sections[0].html).toBe('<table><tbody><tr><td>틀</td></tr></tbody></table>');
    expect(fresh.sections[0]).not.toHaveProperty('defaultHtml');
    expect((await post(`${base}/report-template/update`, owner, { header: '', sections: [] })).status).toBe(400);
  });
});
