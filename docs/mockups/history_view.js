// 히스토리 시안 동작 (D-146, D-149). HistoryView_screen.md "4. 동작"을 서버 없이 흉내 낸다
const isTeam = pageParams.get('space') === 'team';
renderLayout({ space: isTeam ? 'team' : 'personal', tab: 'history', hideTabs: false });
if (!isTeam) { document.querySelectorAll('.team-only').forEach((el) => el.remove()); }

const PAGE_SIZE = 20;
const dot = (date) => date.replaceAll('-', '.');
// 가짜 히스토리 47개. 앞 4개는 예시를 보여주려고 직접 적었다. 최근에 완료한 것이 위 (D-111)
const SAMPLES = [
  { title: 'DB 설계', start: '2026-10-20', end: '2026-10-27', startTime: '09:00', endTime: '18:00', done: '2026.10.28 17:40', assignees: ['홍길동', '김민수'], content: '회원·팀·작업 테이블을 정한다.\n이름 규칙을 맞춘다.' },
  { title: '요구사항 정리 회의록 공유와 다음 회의 일정 잡기까지 마무리', start: '2026-10-15', end: '2026-10-15', done: '2026.10.24 09:15', assignees: ['이영희'], content: '회의록을 공유한다.' },
  { title: '참고 사이트 조사', start: null, end: null, done: '2026.10.21 18:02', assignees: [], content: '비슷한 서비스를 찾아본다.' },
  { title: '개발 환경 준비', start: '2026-10-10', end: '2026-10-14', done: '2026.10.15 13:30', assignees: ['홍길동', '이영희', '박지성'], content: 'Node.js 와 DB 를 설치한다.' },
];
const ALL = [...SAMPLES];
for (let i = 5; i <= 47; i += 1) {
  const day = String(Math.max(1, 14 - Math.floor(i / 4))).padStart(2, '0');
  ALL.push({ title: `완료한 작업 ${i}`, start: `2026-10-${day}`, end: `2026-10-${day}`, done: `2026.10.${day} 1${i % 10}:00`, assignees: i % 3 ? ['홍길동'] : [], content: `완료한 작업 ${i} 의 내용.` });
}

let page = 1;
let total = ALL.length;

// 표의 기간: 시작일~종료일, 날짜만, 두 줄. 하루면 한 줄 (D-144)
function periodCell(row) {
  if (!row.start) { return '<span class="badge-x badge-undecided">미정</span>'; }
  return row.start === row.end ? dot(row.start) : `${dot(row.start)} ~<br />${dot(row.end)}`;
}
const periodLine = (row) => (!row.start ? '미정' : (row.start === row.end ? dot(row.start) : `${dot(row.start)} ~ ${dot(row.end)}`));
// 상세 모달의 기간: 시간 포함 전체 (D-139)
function periodFull(row) {
  if (!row.start) { return null; }
  if (row.startTime) {
    return row.start === row.end ? `${dot(row.start)} ${row.startTime} ~ ${row.endTime}` : `${dot(row.start)} ${row.startTime} ~ ${dot(row.end)} ${row.endTime}`;
  }
  return periodLine(row);
}
function assigneeText(list) {
  if (!list.length) { return '<span class="muted">없음</span>'; }
  return escapeHtml(list.length === 1 ? list[0] : `${list[0]} 외 ${list.length - 1}명`);
}

function renderTable() {
  const rows = ALL.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $('history-count').textContent = `(${total}개)`;
  $('history-body').innerHTML = rows.map((row) => `<tr data-index="${ALL.indexOf(row)}">
    <td><div class="title-cell">${escapeHtml(row.title)}</div><div class="row-sub">${periodLine(row)}${isTeam ? ` · ${row.assignees.length ? escapeHtml(row.assignees.join(', ')) : '없음'}` : ''}</div></td>
    <td class="col-period">${periodCell(row)}</td><td class="col-done">${row.done.slice(0, 10)}</td>
    ${isTeam ? `<td class="col-assignee">${assigneeText(row.assignees)}</td>` : ''}</tr>`).join('');
  renderPager();
}
// 페이지 번호: 현재 페이지 주변 최대 5개, 1페이지뿐이면 숨김 (D-111)
function renderPager() {
  const pages = Math.ceil(total / PAGE_SIZE);
  $('pager').classList.toggle('is-hidden', pages <= 1);
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = [];
  for (let n = from; n <= Math.min(pages, from + 4); n += 1) { numbers.push(n); }
  $('pager').innerHTML = `<button type="button" data-page="${page - 1}" aria-label="이전 페이지" ${page === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
    ${numbers.map((n) => `<button type="button" data-page="${n}" class="${n === page ? 'is-current' : ''}">${n}</button>`).join('')}
    <button type="button" data-page="${page + 1}" aria-label="다음 페이지" ${page === pages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;
}
async function goPage(n) {
  page = n;
  hide('history-table');
  show('history-loading');
  await wait(300);
  hide('history-loading');
  show('history-table');
  renderTable();
  document.querySelector('.content').scrollTop = 0;
}

// 상세 모달 (D-112): 상태 히스토리, 제목, 기간, 완료일, 작업자(팀만), 내용, 수정 내역(보기만)
async function openDetail(row) {
  $('h-title').textContent = row.title;
  const full = periodFull(row);
  $('h-period').innerHTML = full ? escapeHtml(full) : '<span class="badge-x badge-undecided">미정</span>';
  $('h-done').textContent = row.done;
  if (isTeam) { $('h-assignee').innerHTML = row.assignees.length ? escapeHtml(row.assignees.join(', ')) : '<span class="muted">없음</span>'; }
  $('h-content').textContent = row.content;
  const logs = [
    { type: '상태 변경 (진행 → 완료)', at: row.done, actor: `수정한 사람 ${row.assignees[0] || '홍길동'}` },
    { type: '작업 생성', at: `${row.start ? dot(row.start) : '2026.10.01'} 09:00`, actor: '만든 사람 홍길동' },
  ];
  $('log-count').textContent = `(${logs.length})`;
  $('log-list').innerHTML = logs.map((log) => `<div class="log-row"><div class="log-type">${escapeHtml(log.type)}</div><div class="log-meta">${escapeHtml(log.at)} · ${escapeHtml(log.actor)}</div></div>`).join('');
  hide('log-list');
  show('log-loading', 'detail-modal');
  await wait(300);
  hide('log-loading');
  show('log-list');
}

$('history-body').addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-index]');
  if (row) { openDetail(ALL[Number(row.dataset.index)]); }
});
$('pager').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-page]');
  if (button && !button.disabled) { goPage(Number(button.dataset.page)); }
});
['h-x', 'h-close'].forEach((id) => $(id).addEventListener('click', () => hide('detail-modal')));
closeOnBackdrop('detail-modal');
escapeHandlers.push(() => hide('detail-modal'));

// ---------- 시안 상태 막대 ----------
addToast('toast-not-found', 'error', '작업을 찾을 수 없습니다.', '');
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
function resetState() {
  clearFlash();
  hide('history-empty', 'history-loading', 'detail-modal', 'log-loading');
  show('history-table', 'log-list');
  page = 1;
  total = ALL.length;
  renderTable();
}
const STATES = {
  'default': { label: '기본 (직접 눌러 보세요)', run: () => {} },
  'loading': { label: '로딩 중', run: () => { hide('history-table', 'pager'); show('history-loading'); } },
  'empty': { label: '데이터 없음', run: () => { total = 0; hide('history-table', 'pager'); show('history-empty'); $('history-count').textContent = '(0개)'; } },
  'one-page': { label: '1페이지뿐 (페이지 번호 숨김)', run: () => { total = 4; renderTable(); } },
  'detail': { label: '상세 모달 (수정 내역 포함)', run: () => openDetail(ALL[0]) },
  'detail-loading': { label: '상세 모달 (수정 내역 로딩 중)', run: () => { openDetail(ALL[0]); show('log-loading'); hide('log-list'); } },
  'not-found': { label: '수정 내역 404 (작업 없음)', run: () => show('toast-not-found') },
  'server-error': { label: '서버 오류', run: () => show('toast-server') },
};
setupStates(STATES, resetState);
