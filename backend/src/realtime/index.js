// 실시간 반영 (api.md 6.8). 서버 → 화면만. 이벤트는 무엇이 바뀌었는지만 알린다
import { Server } from 'socket.io';
import { getPool, sql } from '../config/db.js';
import { SESSION_COOKIE_NAME, findSessionUser } from '../services/sessionService.js';

let io = null;

const userRoom = (userId) => `user:${userId}`;
const teamRoom = (teamId) => `team:${teamId}`;

function readCookie(header, name) {
  const found = (header ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function attachRealtime(httpServer) {
  // CORS 를 열지 않는다 (같은 출처에서만 연결, Vite 프록시)
  io = new Server(httpServer, { path: '/socket.io', serveClient: false });

  // 연결할 때 로그인 쿠키 확인. 없거나 만료면 거부
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
      const user = await findSessionUser(token);
      if (!user) {
        next(new Error('UNAUTHORIZED'));
        return;
      }
      const pool = await getPool();
      const expire = await pool.request().input('userId', sql.BigInt, user.userId)
        .query(`SELECT DATEDIFF(SECOND, SYSUTCDATETIME(), MAX(expire_date)) AS remaining_seconds
                FROM login_tokens WHERE user_id = @userId`);
      socket.data.userId = user.userId;
      socket.data.remainingSeconds = expire.recordset[0].remaining_seconds ?? 0;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, remainingSeconds } = socket.data;
    socket.join(userRoom(userId));
    // 토큰 만료 시각이 되면 끊는다
    const expireTimer = setTimeout(() => socket.disconnect(true), Math.max(0, remainingSeconds) * 1000);
    socket.on('disconnect', () => clearTimeout(expireTimer));
    try {
      const pool = await getPool();
      const teams = await pool.request().input('userId', sql.BigInt, userId)
        .query('SELECT team_id FROM team_members WHERE user_id = @userId');
      teams.recordset.forEach((row) => socket.join(teamRoom(Number(row.team_id))));
    } catch (error) {
      console.error('실시간 연결의 팀 방 넣기 실패:', error?.name);
    }
  });
  return io;
}

// 보내다 실패해도 API 는 성공으로 둔다 (api.md 6.8)
function safely(work) {
  try {
    if (io) {
      work(io);
    }
  } catch (error) {
    console.error('실시간 이벤트 보내기 실패:', error?.name);
  }
}

export function emitToUser(userId, event, data) {
  safely((server) => server.to(userRoom(userId)).emit(event, data));
}

export function emitToTeam(teamId, event, data) {
  safely((server) => server.to(teamRoom(teamId)).emit(event, data));
}

// 팀을 만들거나 초대를 수락하면 그 회원의 연결을 팀 방에 넣는다
export function joinTeamRoom(userId, teamId) {
  safely((server) => server.in(userRoom(userId)).socketsJoin(teamRoom(teamId)));
}

// 탈퇴·내보내기되면 그 회원의 연결을 팀 방에서 뺀다
export function leaveTeamRoom(userId, teamId) {
  safely((server) => server.in(userRoom(userId)).socketsLeave(teamRoom(teamId)));
}

// 해체되면 그 팀 방을 비운다
export function closeTeamRoom(teamId) {
  safely((server) => server.in(teamRoom(teamId)).socketsLeave(teamRoom(teamId)));
}

// 로그아웃하거나 다른 곳에서 새로 로그인하면 그 회원의 연결을 모두 끊는다
export function disconnectUser(userId) {
  safely((server) => server.in(userRoom(userId)).disconnectSockets(true));
}
