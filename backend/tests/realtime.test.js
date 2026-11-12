// 실시간 연결 (api.md 6.8): 쿠키 인증, user·team 방, 로그아웃·새 로그인 때 끊기
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from 'node:http';
import request from 'supertest';
import { io as connectClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachRealtime } from '../src/realtime/index.js';
import { closePool } from '../src/config/db.js';
import { cleanupTestRows, loginTestUser } from './helpers.js';

const app = createApp();
const httpServer = createServer(app);
let baseUrl;
const sockets = [];

function connect(cookie) {
  const socket = connectClient(baseUrl, {
    path: '/socket.io', transports: ['websocket'], reconnection: false, extraHeaders: cookie ? { cookie } : {},
  });
  sockets.push(socket);
  return socket;
}

const once = (socket, event, timeout = 4000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${event} 를 받지 못함`)), timeout);
  socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
});

beforeAll(async () => {
  await cleanupTestRows();
  attachRealtime(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${httpServer.address().port}`;
});
afterAll(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await new Promise((resolve) => httpServer.close(resolve));
  await cleanupTestRows();
  await closePool();
});

describe('실시간 연결', () => {
  test.each([[null], ['todo_session=abc']])('쿠키 %s → 연결 거부', async (cookie) => {
    const error = await once(connect(cookie), 'connect_error');
    expect(error.message).toBe('UNAUTHORIZED');
  });
  test('로그인 쿠키 → 연결, 팀 만들면 teams:changed(joined), 팀 방 이벤트도 받는다', async () => {
    const user = await loginTestUser(app);
    const socket = connect(user.cookie);
    await once(socket, 'connect');
    const changed = once(socket, 'teams:changed');
    const team = (await request(app).post('/api/teams').set('Cookie', user.cookie).send({ name: 'vt실시간팀' })).body.data;
    expect(await changed).toEqual({ teamId: team.teamId, reason: 'joined' });
    const { emitToTeam } = await import('../src/realtime/index.js');
    const teamEvent = once(socket, 'team:todos-changed');
    emitToTeam(team.teamId, 'team:todos-changed', { teamId: team.teamId });
    expect(await teamEvent).toEqual({ teamId: team.teamId });
  });
  test('일일보고: 제출 submit, 수정 제출 update 를 팀 방에 보낸다. 임시저장은 보내지 않는다 (D-159)', async () => {
    const user = await loginTestUser(app);
    const team = (await request(app).post('/api/teams').set('Cookie', user.cookie).send({ name: 'vt보고실시간' })).body.data;
    const socket = connect(user.cookie);
    await once(socket, 'connect');
    const events = [];
    socket.on('team:reports-changed', (data) => events.push(data));
    const base = `/api/teams/${team.teamId}/reports`;
    const { report } = (await request(app).get(`${base}/today`).set('Cookie', user.cookie)).body.data;
    const body = (action) => ({ reportDate: report.reportDate, action, header: report.header, sections: report.sections });
    await request(app).post(`${base}/today/save`).set('Cookie', user.cookie).send(body('draft'));
    const submitted = once(socket, 'team:reports-changed');
    const saved = (await request(app).post(`${base}/today/save`).set('Cookie', user.cookie).send(body('submit'))).body.data;
    expect(await submitted).toEqual({
      teamId: team.teamId, reportDate: report.reportDate, reportId: saved.reportId, userId: user.userId, action: 'submit', actorUserId: user.userId,
    });
    const updated = once(socket, 'team:reports-changed');
    await request(app).post(`${base}/today/save`).set('Cookie', user.cookie).send(body('submit'));
    expect((await updated).action).toBe('update');
    expect(events.map((event) => event.action)).toEqual(['submit', 'update']);
  });
  test('읽음 처리 → notifications:changed', async () => {
    const user = await loginTestUser(app);
    const socket = connect(user.cookie);
    await once(socket, 'connect');
    const changed = once(socket, 'notifications:changed');
    await request(app).post('/api/notifications/read').set('Cookie', user.cookie);
    expect(await changed).toEqual({ unreadCount: 0 });
  });
  test('로그아웃하면 그 회원의 연결을 끊는다', async () => {
    const user = await loginTestUser(app);
    const socket = connect(user.cookie);
    await once(socket, 'connect');
    const disconnected = once(socket, 'disconnect');
    await request(app).post('/api/sessions/logout').set('Cookie', user.cookie);
    expect(await disconnected).toBe('io server disconnect');
  });
  test('다른 곳에서 새로 로그인하면 이전 연결을 끊는다 (D-050)', async () => {
    const user = await loginTestUser(app);
    const socket = connect(user.cookie);
    await once(socket, 'connect');
    const disconnected = once(socket, 'disconnect');
    await request(app).post('/api/sessions').send({ loginId: user.loginId, password: user.password });
    expect(await disconnected).toBe('io server disconnect');
  });
});
