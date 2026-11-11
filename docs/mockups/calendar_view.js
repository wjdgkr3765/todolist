// 캘린더 시안 동작 (D-146, D-149). CalendarView_screen.md "4. 동작"을 서버 없이 흉내 낸다. 오늘은 2026-11-11 로 본다
const isTeam = pageParams.get('space') === 'team';
renderLayout({ space: isTeam ? 'team' : 'personal', tab: 'calendar', hideTabs: false });
if (!isTeam) { $('detail-assignee').remove(); }

const STATUS_LABEL = { waiting: '대기', progress: '진행', done: '완료', history: '히스토리' };
// 상태: waiting / progress / done / history. 시간이 있으면 startTime·endTime (D-135)
const TASKS = [
  { title: 'DB 설계', start: '2026-11-01', end: '2026-11-07', status: 'done', assignees: ['홍길동'], content: '테이블과 컬럼을 정한다.' },
  { title: '기획 회의 정리', start: '2026-10-29', end: '2026-11-03', status: 'history', assignees: ['이영희'], content: '기획 회의 내용을 정리한다.' },
  { title: 'API 명세 검토', start: '2026-11-05', end: '2026-11-09', startTime: '09:00', endTime: '18:00', status: 'waiting', assignees: ['김민수', '홍길동'], content: '회원·팀 API 의 요청과 응답 형식을 다시 확인한다.' },
  { title: '메인 화면 시안 정리', start: '2026-11-10', end: '2026-11-20', startTime: '09:00', endTime: '18:00', status: 'waiting', assignees: ['홍길동', '이영희', '김민수'], content: '메인 화면 시안을 정리해 공유한다.' },
  { title: '로그인 화면 구현', start: '2026-11-11', end: '2026-11-14', status: 'progress', assignees: ['홍길동'], content: '로그인 화면을 시안대로 만든다.\n로그인 실패·잠김 문구를 확인한다.' },
  { title: '주간 보고서 작성', start: '2026-11-12', end: '2026-11-12', startTime: '09:00', endTime: '18:00', status: 'progress', assignees: ['이영희'], content: '이번 주 보고서를 쓴다.' },
  { title: '디자인 리뷰', start: '2026-11-12', end: '2026-11-12', status: 'waiting', assignees: [], content: '디자인 리뷰를 한다.' },
  { title: '코드 리뷰', start: '2026-11-12', end: '2026-11-12', startTime: '14:00', endTime: '15:00', status: 'done', assignees: ['박지성'], content: '로그인 코드 리뷰.' },
  { title: '배포 준비', start: '2026-11-24', end: '2026-12-02', status: 'waiting', assignees: ['김민수'], content: '배포 순서를 정리한다.' },
  { title: '연말 회고', start: '2026-12-28', end: '2026-12-30', status: 'waiting', assignees: ['홍길동', '박지성'], content: '올해를 돌아본다.' },
];
const HOLIDAYS = { '2026-12-25': '성탄절', '2027-01-01': '신정' };
const TODAY = '2026-11-11';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dot = (date) => date.replaceAll('-', '.');
function periodText(task) {
  if (task.startTime) {
    return task.start === task.end ? `${dot(task.start)} ${task.startTime} ~ ${task.endTime}` : `${dot(task.start)} ${task.startTime} ~ ${dot(task.end)} ${task.endTime}`;
  }
  return task.start === task.end ? dot(task.start) : `${dot(task.start)} ~ ${dot(task.end)}`;
}
// 하루짜리이고 시간이 있으면 제목 앞에 시작 시각 (D-140)
const barLabel = (task) => `${task.start === task.end && task.startTime ? `${task.startTime} ` : ''}${task.title}`;
const barClass = (task) => (task.start === task.end ? `is-single single-${task.status}` : `bar-${task.status}`);

let view = { year: 2026, month: 11, holidays: true, empty: false };

function renderMonth() {
  const { year, month } = view;
  $('cal-month').textContent = `${year}.${pad(month)}`;
  $('btn-today').disabled = `${year}-${pad(month)}` === TODAY.slice(0, 7);
  const maxLanes = window.innerWidth < 576 ? 2 : 3;
  const first = new Date(year, month - 1, 1);
  const cursor = new Date(first);
  cursor.setDate(1 - first.getDay());
  let html = '';
  do {
    const days = [];
    for (let i = 0; i < 7; i += 1) { days.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    const weekStart = ymd(days[0]);
    const weekEnd = ymd(days[6]);
    let cells = days.map((day, i) => {
      const key = ymd(day);
      const holiday = view.holidays ? HOLIDAYS[key] : null;
      const classes = ['date-num'];
      if (key === TODAY) { classes.push('is-today'); } else {
        if (day.getMonth() !== month - 1) { classes.push('is-other'); }
        if (i === 0 || holiday) { classes.push(holiday ? 'is-holiday' : 'is-sun'); } else if (i === 6) { classes.push('is-sat'); }
      }
      return `<div class="cal-date" style="grid-column:${i + 1}"><span class="${classes.join(' ')}">${day.getDate()}</span>${holiday ? `<span class="holiday-name">${holiday}</span>` : ''}</div>`;
    }).join('');
    // 이 주에 걸친 작업을 줄(lane)에 배치한다. 칸마다 maxLanes 줄까지, 넘치면 +N
    const lanes = [];
    const hidden = [0, 0, 0, 0, 0, 0, 0];
    const tasks = view.empty ? [] : TASKS.filter((task) => task.start <= weekEnd && task.end >= weekStart);
    tasks.forEach((task) => {
      const from = Math.max(0, days.findIndex((day) => ymd(day) >= task.start));
      let to = days.findIndex((day) => ymd(day) > task.end) - 1;
      if (to < 0) { to = 6; }
      let lane = lanes.findIndex((used) => used.every((n, i) => i < from || i > to || !n));
      if (lane === -1) { lanes.push([0, 0, 0, 0, 0, 0, 0]); lane = lanes.length - 1; }
      for (let i = from; i <= to; i += 1) { lanes[lane][i] = 1; }
      if (lane >= maxLanes) { for (let i = from; i <= to; i += 1) { hidden[i] += 1; } return; }
      cells += `<button type="button" class="cal-bar ${barClass(task)}" data-task="${TASKS.indexOf(task)}" style="grid-row:${lane + 2};grid-column:${from + 1} / ${to + 2}">${escapeHtml(barLabel(task))}</button>`;
    });
    hidden.forEach((count, i) => { if (count) { cells += `<button type="button" class="cal-more" data-day="${ymd(days[i])}" style="grid-row:${maxLanes + 2};grid-column:${i + 1}">+${count}</button>`; } });
    html += `<div class="cal-week">${cells}</div>`;
  } while (cursor.getMonth() === month - 1);
  $('cal-body').innerHTML = html;
  hide('more-pop');
}

function moveMonth(delta) {
  const date = new Date(view.year, view.month - 1 + delta, 1);
  view = { ...view, year: date.getFullYear(), month: date.getMonth() + 1 };
  renderMonth();
}

// 상세 모달 (D-108): 상태(히스토리면 "히스토리"), 제목, 기간, 작업자(팀만), 내용
function openDetail(task) {
  hide('more-pop');
  const badge = $('detail-status');
  badge.className = `badge-x badge-${task.status}`;
  badge.textContent = STATUS_LABEL[task.status];
  $('detail-title').textContent = task.title;
  $('detail-period').textContent = periodText(task);
  if (isTeam) { $('detail-assignee-value').innerHTML = task.assignees.length ? escapeHtml(task.assignees.join(', ')) : '<span style="color:var(--color-muted)">없음</span>'; }
  $('detail-content').textContent = task.content;
  show('detail-modal');
}

// 더보기 창: 그 날 작업 전체 (FullCalendar 기본 더보기 창)
function openMore(button, day) {
  const tasks = TASKS.filter((task) => task.start <= day && task.end >= day);
  $('more-pop-title').textContent = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
  $('more-pop-list').innerHTML = tasks.map((task) => `<button type="button" class="cal-bar ${barClass(task)}" data-task="${TASKS.indexOf(task)}">${escapeHtml(barLabel(task))}</button>`).join('');
  const card = document.querySelector('.cal-card').getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  const pop = $('more-pop');
  pop.style.top = `${rect.bottom - card.top + 4}px`;
  pop.style.left = `${Math.min(rect.left - card.left, card.width - 230)}px`;
  show('more-pop');
}

$('btn-prev').addEventListener('click', () => moveMonth(-1));
$('btn-next').addEventListener('click', () => moveMonth(1));
$('btn-today').addEventListener('click', () => { view = { ...view, year: 2026, month: 11 }; renderMonth(); });
document.querySelector('.cal-card').addEventListener('click', (event) => {
  const bar = event.target.closest('[data-task]');
  const more = event.target.closest('.cal-more');
  if (bar) { openDetail(TASKS[Number(bar.dataset.task)]); return; }
  if (more) { event.stopPropagation(); openMore(more, more.dataset.day); return; }
  if (!event.target.closest('#more-pop')) { hide('more-pop'); }
});
['detail-x', 'detail-close'].forEach((id) => $(id).addEventListener('click', () => hide('detail-modal')));
closeOnBackdrop('detail-modal');
escapeHandlers.push(() => hide('detail-modal', 'more-pop'));

// ---------- 시안 상태 막대 ----------
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
function resetState() {
  clearFlash();
  hide('detail-modal', 'more-pop', 'cal-spinner');
  view = { year: 2026, month: 11, holidays: true, empty: false };
  renderMonth();
}
const STATES = {
  'default': { label: '기본 (직접 눌러 보세요)', run: () => {} },
  'loading': { label: '로딩 중', run: () => { show('cal-spinner'); view.empty = true; renderMonth(); } },
  'empty': { label: '작업 없음', run: () => { view.empty = true; renderMonth(); } },
  'other-month': { label: '다른 달 보기 + 공휴일 (2026.12)', run: () => moveMonth(1) },
  'no-holiday': { label: '공휴일 정보 없음 (2026.12)', run: () => { view.holidays = false; moveMonth(1); } },
  'more': { label: '더보기 창 (+N 클릭)', run: () => document.querySelector('.cal-more').click() },
  'detail': { label: '상세 모달 (진행)', run: () => openDetail(TASKS[4]) },
  'detail-history': { label: '상세 모달 (히스토리)', run: () => openDetail(TASKS[1]) },
  'server-error': { label: '서버 오류', run: () => { view.empty = true; renderMonth(); show('toast-server'); } },
};
setupStates(STATES, resetState);
