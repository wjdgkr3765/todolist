// 공통 레이아웃 시안: 알람 (MainLayout_screen.md, D-177~D-180). 서버 없이 시안 안에서만 흉내 낸다.
// mockup_common.js 다음에 불러온다. renderLayout() 이 renderAlarmUi() 를 부른다.
// 시안 규칙: 지금은 2026-11-11 (수) 14:30. 공휴일은 12.25, 1.1 만 있다고 본다. 새로고침하면 처음 상태
const ALARM_NOW = new Date(2026, 10, 11, 14, 30);
const ALARM_HOLIDAYS = { '2026-12-25': '성탄절', '2027-01-01': '1월1일' };
const ALARM_LIMIT = 30;
const ALARM_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const ALARM_WEEK_ORDER = [7, 1, 2, 3, 4, 5, 6]; // 화면 순서 일~토 (값은 1(월)~7(일))
const ALARM_SAMPLE = () => [
  { id: 1, title: '출근', time: '06:00', date: null, weekdays: [1, 2, 3, 4, 5], isHolidayOff: true, isOn: true },
  { id: 2, title: '', time: '21:00', date: null, weekdays: [1, 2, 3, 4, 5, 6, 7], isHolidayOff: false, isOn: true },
  { id: 3, title: '병원 예약', time: '10:30', date: '2026-11-20', weekdays: [], isHolidayOff: false, isOn: true },
  { id: 4, title: '주간 회의 자료 보내기', time: '09:00', date: '2026-11-10', weekdays: [], isHolidayOff: false, isOn: false },
];

let alarms = ALARM_SAMPLE();
let alarmNextId = 10;
let alarmPermission = 'default'; // default / denied / granted / unsupported
let isBrowserAlarmOn = false; // 이 브라우저에 저장한 켜기/끄기 (D-182)
let alarmForm = null;

// ---------- 날짜·시각 ----------
const alarmYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const alarmParse = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
const alarmAddDays = (ymd, n) => { const d = alarmParse(ymd); d.setDate(d.getDate() + n); return alarmYmd(d); };
const alarmAt = (ymd, time) => { const d = alarmParse(ymd); const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
const isoWeekday = (ymd) => alarmParse(ymd).getDay() || 7;
const alarmToday = () => alarmYmd(ALARM_NOW);
const dayLabel = (ymd) => { const d = alarmParse(ymd); return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${ALARM_DAY_NAMES[d.getDay()]})`; };
// 24시간제 HH:mm (D-181)
const timeLabel = (time) => time;
// 날짜·요일을 고르지 않았을 때: 고른 시각이 지금보다 뒤면 오늘, 아니면 내일 (D-178)
const autoDate = (time) => (alarmAt(alarmToday(), time) > ALARM_NOW ? alarmToday() : alarmAddDays(alarmToday(), 1));
// 다음 울릴 시각 (api.md 6.13). 요일 알람은 공휴일에는 끄기면 공휴일을 건너뛴다
function nextFireOf(alarm) {
  if (!alarm.isOn) { return null; }
  if (!alarm.weekdays.length) { return alarmAt(alarm.date, alarm.time); }
  for (let i = 0; i < 400; i += 1) {
    const ymd = alarmAddDays(alarmToday(), i);
    if (alarm.weekdays.includes(isoWeekday(ymd)) && alarmAt(ymd, alarm.time) > ALARM_NOW && !(alarm.isHolidayOff && ALARM_HOLIDAYS[ymd])) {
      return alarmAt(ymd, alarm.time);
    }
  }
  return null;
}
const fireText = (date) => `${dayLabel(alarmYmd(date))} ${timeLabel(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`)}`;
// 반복 요약: 한 번 "11.20 (금)" / 7개 "매일" / 일부 "매주 월, 수" (D-178)
function repeatSummary(weekdays, date) {
  if (!weekdays.length) { return dayLabel(date); }
  if (weekdays.length === 7) { return '매일'; }
  return `매주 ${ALARM_WEEK_ORDER.filter((w) => weekdays.includes(w)).map((w) => ALARM_DAY_NAMES[w % 7]).join(', ')}`;
}

// ---------- 그리기 ----------
function renderAlarmUi() {
  const bell = $('bell');
  const group = document.createElement('div');
  group.className = 'nav-top-actions';
  bell.before(group);
  group.append(bell);
  group.insertAdjacentHTML('beforeend', '<button id="btn-alarm" type="button" class="bell-button" aria-label="알람"><i class="bi bi-alarm"></i></button>');
  $('notification-box').insertAdjacentHTML('afterend', `
    <div id="alarm-box" class="popover-box notification-box is-hidden" role="dialog" aria-label="알람">
      <div class="notification-title alarm-title">알람
        <div class="alarm-title-tools">
          <span id="alarm-browser" class="alarm-browser">
            <span class="alarm-browser-label">브라우저 알림</span>
            <span class="form-check form-switch m-0"><input id="alarm-browser-switch" class="form-check-input" type="checkbox" role="switch" aria-label="브라우저 알림" /></span>
          </span>
          <button id="btn-alarm-add" type="button" class="nav-add" aria-label="알람 추가"><i class="bi bi-plus-lg"></i></button>
        </div>
      </div>
      <div id="alarm-denied" class="alarm-denied is-hidden">브라우저에서 알림이 차단되어 있습니다. 주소창 왼쪽 아이콘에서 허용해 주세요.</div>
      <div id="alarm-loading" class="notification-empty is-hidden"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
      <div id="alarm-list" class="notification-list"></div>
      <div id="alarm-empty" class="notification-empty is-hidden"><i class="bi bi-alarm"></i>알람이 없습니다.</div>
    </div>`);
  ['alarm-modal', 'alarm-confirm', 'alarm-popup'].forEach((id) => { if ($(id)) { $(id).remove(); } });
  document.body.insertAdjacentHTML('beforeend', `
    <div id="alarm-modal" class="modal-backdrop-x is-hidden">
      <div class="modal-x" role="dialog" aria-labelledby="alarm-modal-title">
        <div id="alarm-modal-title" class="modal-title-x">알람 추가</div>
        <div class="alarm-time">
          <select id="alarm-hour" aria-label="시">${Array.from({ length: 24 }, (_, i) => `<option value="${i}">${i}시</option>`).join('')}</select>
          <select id="alarm-minute" aria-label="분">${Array.from({ length: 60 }, (_, i) => `<option value="${i}">${String(i).padStart(2, '0')}분</option>`).join('')}</select>
        </div>
        <div id="alarm-time-error" class="message is-error is-hidden"><i class="bi bi-exclamation-circle"></i>이미 지난 시각입니다. 시간이나 날짜를 바꿔 주세요.</div>
        <div class="alarm-date-line">
          <span id="alarm-date-text"></span>
          <button id="btn-alarm-date" type="button" class="alarm-date-button" aria-label="날짜 고르기"><i class="bi bi-calendar3"></i></button>
          <input id="alarm-date-input" type="date" class="alarm-date-input" tabindex="-1" aria-hidden="true" />
        </div>
        <div id="alarm-weekdays" class="alarm-weekdays">${ALARM_WEEK_ORDER.map((w) => `<button type="button" class="alarm-day${w === 7 ? ' is-sun' : ''}${w === 6 ? ' is-sat' : ''}" data-day="${w}">${ALARM_DAY_NAMES[w % 7]}</button>`).join('')}</div>
        <div id="alarm-holiday-row" class="alarm-switch-row">
          <div><div class="alarm-switch-label">공휴일에는 끄기</div><div id="alarm-holiday-help" class="alarm-switch-help"></div></div>
          <div class="form-check form-switch m-0"><input id="alarm-holiday" class="form-check-input" type="checkbox" role="switch" aria-label="공휴일에는 끄기" /></div>
        </div>
        <div class="field" style="margin-bottom:0">
          <div id="ctl-alarm-title" class="control no-icon"><input id="alarm-title-input" type="text" maxlength="30" placeholder="알람 이름" aria-label="알람 이름" /></div>
          <div id="alarm-title-error" class="message is-error is-hidden"><i class="bi bi-exclamation-circle"></i>알람 이름은 30자 이하로 입력해 주세요.</div>
        </div>
        <div class="modal-actions alarm-actions">
          <button type="button" id="btn-alarm-delete" class="btn-x btn-danger-soft-x">삭제</button>
          <span class="flex-grow-1"></span>
          <button type="button" id="btn-alarm-cancel" class="btn-x btn-outline-x">취소</button>
          <button type="button" id="btn-alarm-save" class="btn-x btn-primary-x">저장</button>
        </div>
      </div>
    </div>
    <div id="alarm-confirm" class="modal-backdrop-x is-hidden">
      <div class="modal-x" role="alertdialog" aria-label="알람 삭제">
        <div class="modal-title-x">알람 삭제</div>
        <p class="m-0">알람을 삭제할까요?</p>
        <div class="modal-actions">
          <button type="button" id="btn-alarm-confirm-cancel" class="btn-x btn-outline-x">취소</button>
          <button type="button" id="btn-alarm-confirm-ok" class="btn-x btn-danger-x">삭제</button>
        </div>
      </div>
    </div>
    <div id="alarm-popup" class="modal-backdrop-x is-hidden">
      <div class="modal-x alarm-popup" role="alertdialog" aria-label="알람">
        <i class="bi bi-alarm alarm-popup-icon"></i>
        <div id="alarm-popup-list"></div>
        <button type="button" id="btn-alarm-popup-ok" class="btn-x btn-primary-x alarm-popup-ok">확인</button>
      </div>
    </div>`);
  bindAlarmUi();
  renderAlarmList();
}

// 제목 줄 "브라우저 알림" 스위치. 차단됨이면 비활성 + 제목 줄 아래 안내 (D-182~D-184)
function renderAlarmPermission() {
  const isDenied = alarmPermission === 'denied';
  $('alarm-browser').classList.toggle('is-hidden', alarmPermission === 'unsupported');
  $('alarm-browser-switch').checked = alarmPermission === 'granted' && isBrowserAlarmOn;
  $('alarm-browser-switch').disabled = isDenied;
  $('alarm-denied').classList.toggle('is-hidden', !isDenied);
}
function renderAlarmList() {
  renderAlarmPermission();
  const sorted = [...alarms].sort((a, b) => (a.time === b.time ? a.id - b.id : (a.time < b.time ? -1 : 1)));
  // 왼쪽: 시각 (+ 공휴일에는 끄기) / 이름 / 반복 요약, 오른쪽: 스위치. 이름·요약은 넘치면 … (D-186, D-187)
  $('alarm-list').innerHTML = sorted.map((a) => `<div class="alarm-item${a.isOn ? '' : ' is-off'}" data-id="${a.id}">
      <button type="button" class="alarm-item-main" data-edit="${a.id}">
        <span class="alarm-item-time-line"><span class="alarm-item-time">${timeLabel(a.time)}</span>${a.isHolidayOff ? '<span class="alarm-item-holiday">공휴일에는 끄기</span>' : ''}</span>
        ${a.title ? `<span class="alarm-item-name">${escapeHtml(a.title)}</span>` : ''}
        <span class="alarm-item-sub">${repeatSummary(a.weekdays, a.date)}</span>
      </button>
      <span class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" data-toggle="${a.id}"${a.isOn ? ' checked' : ''} aria-label="알람 켜기" /></span>
    </div>`).join('');
  hide('alarm-loading');
  $('alarm-list').classList.toggle('is-hidden', !alarms.length);
  $('alarm-empty').classList.toggle('is-hidden', alarms.length > 0);
}

// ---------- 알람 창 ----------
function closeAlarmBox() {
  if (!$('alarm-box')) { return; }
  hide('alarm-box');
  $('btn-alarm').classList.remove('is-open');
}
function openAlarmBox() {
  closePopovers();
  show('alarm-box');
  $('btn-alarm').classList.add('is-open');
  renderAlarmList();
}

// ---------- 설정 모달 ----------
const formTime = () => `${String($('alarm-hour').value).padStart(2, '0')}:${String($('alarm-minute').value).padStart(2, '0')}`;
function setFormTime(time) {
  const [h, m] = time.split(':').map(Number);
  $('alarm-hour').value = String(h);
  $('alarm-minute').value = String(m);
}
function renderAlarmForm() {
  const weekdays = [...alarmForm.weekdays];
  let text;
  if (weekdays.length) { text = repeatSummary(weekdays, null); }
  else if (alarmForm.date) { text = dayLabel(alarmForm.date); }
  else { const auto = autoDate(formTime()); text = `${auto === alarmToday() ? '오늘' : '내일'} · ${dayLabel(auto)}`; }
  $('alarm-date-text').textContent = text;
  document.querySelectorAll('#alarm-weekdays .alarm-day').forEach((b) => b.classList.toggle('is-on', alarmForm.weekdays.has(Number(b.dataset.day))));
  const canHoliday = weekdays.length > 0;
  if (!canHoliday) { alarmForm.isHolidayOff = false; }
  $('alarm-holiday').checked = alarmForm.isHolidayOff;
  $('alarm-holiday').disabled = !canHoliday;
  $('alarm-holiday-row').classList.toggle('is-disabled', !canHoliday);
  $('alarm-holiday-help').textContent = canHoliday ? '고른 요일이 공휴일이면 건너뜁니다.' : '요일을 고르면 켤 수 있습니다.';
}
function openAlarmForm(alarm) {
  closeAlarmBox();
  alarmForm = alarm
    ? { id: alarm.id, date: alarm.weekdays.length ? null : alarm.date, weekdays: new Set(alarm.weekdays), isHolidayOff: alarm.isHolidayOff }
    : { id: null, date: null, weekdays: new Set(), isHolidayOff: false };
  $('alarm-modal-title').textContent = alarm ? '알람 수정' : '알람 추가';
  setFormTime(alarm ? alarm.time : '09:00');
  $('alarm-title-input').value = alarm ? alarm.title : '';
  $('btn-alarm-delete').classList.toggle('is-hidden', !alarm);
  $('ctl-alarm-title').classList.remove('is-invalid');
  hide('alarm-title-error', 'alarm-time-error');
  setLabel($('btn-alarm-save'), '저장');
  $('alarm-date-input').min = alarmToday();
  $('alarm-date-input').max = alarmAddDays(alarmToday(), 365);
  renderAlarmForm();
  show('alarm-modal');
}
function closeAlarmForm() { hide('alarm-modal', 'alarm-confirm'); alarmForm = null; }
function pickAlarmDate(ymd) {
  alarmForm.date = ymd;
  alarmForm.weekdays.clear(); // 날짜를 고르면 요일을 푼다 (D-178)
  hide('alarm-time-error');
  renderAlarmForm();
}
async function saveAlarm() {
  const title = $('alarm-title-input').value.trim();
  const time = formTime();
  let isValid = true;
  if (title.length > 30) { $('ctl-alarm-title').classList.add('is-invalid'); show('alarm-title-error'); isValid = false; }
  if (alarmForm.date && !alarmForm.weekdays.size && alarmAt(alarmForm.date, time) <= ALARM_NOW) { show('alarm-time-error'); isValid = false; }
  if (!isValid) { return; }
  setLoading($('btn-alarm-save'), '저장 중...');
  await wait(500);
  const weekdays = [...alarmForm.weekdays].sort((a, b) => a - b);
  const saved = { title, time, weekdays, date: weekdays.length ? null : (alarmForm.date || autoDate(time)), isHolidayOff: alarmForm.isHolidayOff, isOn: true };
  if (alarmForm.id) { Object.assign(alarms.find((a) => a.id === alarmForm.id), saved); } else { alarms.push({ id: alarmNextId += 1, ...saved }); }
  closeAlarmForm();
  renderAlarmList();
  flash('success', '알람을 저장했습니다.', `${fireText(nextFireOf(saved))}에 울립니다.`);
}
async function deleteAlarm() {
  setLoading($('btn-alarm-confirm-ok'), '삭제 중...');
  await wait(400);
  setLabel($('btn-alarm-confirm-ok'), '삭제');
  alarms = alarms.filter((a) => a.id !== alarmForm.id);
  closeAlarmForm();
  renderAlarmList();
  flash('success', '알람을 삭제했습니다.');
}
function toggleAlarm(id, isOn) {
  const alarm = alarms.find((a) => a.id === id);
  // 한 번 알람을 다시 켤 때 그 날 시각이 지났으면 오늘/내일을 다시 정한다 (D-178)
  if (isOn && !alarm.weekdays.length && alarmAt(alarm.date, alarm.time) <= ALARM_NOW) { alarm.date = autoDate(alarm.time); }
  alarm.isOn = isOn;
  renderAlarmList();
  if (isOn) { flash('success', `${fireText(nextFireOf(alarm))}에 울립니다.`); }
}

// ---------- 알람 팝업 (D-179) ----------
function showAlarmPopup(list) {
  $('alarm-popup-list').innerHTML = list.map((a) => `<div class="alarm-popup-item"><div class="alarm-popup-time">${timeLabel(a.time)}</div><div class="alarm-popup-name">${a.title ? escapeHtml(a.title) : '알람'}</div></div>`).join('');
  show('alarm-popup');
}

// ---------- 동작 연결 ----------
function bindAlarmUi() {
  $('btn-alarm').addEventListener('click', (event) => {
    event.stopPropagation();
    if ($('alarm-box').classList.contains('is-hidden')) { openAlarmBox(); } else { closeAlarmBox(); }
  });
  $('alarm-box').addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('#btn-alarm-add')) {
      if (alarms.length >= ALARM_LIMIT) { flash('error', '알람은 30개까지 만들 수 있습니다.'); return; }
      openAlarmForm(null);
      return;
    }
    const edit = event.target.closest('[data-edit]');
    if (edit) { openAlarmForm(alarms.find((a) => a.id === Number(edit.dataset.edit))); }
  });
  // …로 줄어든 이름·요약만 마우스를 올리면 전체 글자 (title, D-188)
  $('alarm-box').addEventListener('mouseover', (event) => {
    const text = event.target.closest('.alarm-item-name, .alarm-item-sub');
    if (!text) { return; }
    if (text.scrollWidth > text.clientWidth) { text.title = text.textContent; } else { text.removeAttribute('title'); }
  });
  $('alarm-box').addEventListener('change', (event) => {
    // 시안에서는 브라우저에 묻지 않고 허용한 것으로 본다 (D-183)
    if (event.target.id === 'alarm-browser-switch') {
      isBrowserAlarmOn = event.target.checked;
      if (isBrowserAlarmOn) { alarmPermission = 'granted'; flash('success', '다른 탭을 보고 있어도 알려 드립니다.'); }
      return;
    }
    const toggle = event.target.closest('[data-toggle]');
    if (toggle) { toggleAlarm(Number(toggle.dataset.toggle), toggle.checked); }
  });
  ['alarm-hour', 'alarm-minute'].forEach((id) => $(id).addEventListener('change', () => { hide('alarm-time-error'); renderAlarmForm(); }));
  $('btn-alarm-date').addEventListener('click', () => { try { $('alarm-date-input').showPicker(); } catch { $('alarm-date-input').focus(); } });
  $('alarm-date-input').addEventListener('change', () => { if ($('alarm-date-input').value) { pickAlarmDate($('alarm-date-input').value); } });
  $('alarm-weekdays').addEventListener('click', (event) => {
    const day = event.target.closest('[data-day]');
    if (!day) { return; }
    const value = Number(day.dataset.day);
    if (alarmForm.weekdays.has(value)) { alarmForm.weekdays.delete(value); } else { alarmForm.weekdays.add(value); alarmForm.date = null; }
    hide('alarm-time-error');
    renderAlarmForm();
  });
  $('alarm-holiday').addEventListener('change', () => { alarmForm.isHolidayOff = $('alarm-holiday').checked; });
  $('alarm-title-input').addEventListener('input', () => { $('ctl-alarm-title').classList.remove('is-invalid'); hide('alarm-title-error'); });
  $('btn-alarm-save').addEventListener('click', saveAlarm);
  $('btn-alarm-cancel').addEventListener('click', closeAlarmForm);
  $('btn-alarm-delete').addEventListener('click', () => show('alarm-confirm'));
  $('btn-alarm-confirm-cancel').addEventListener('click', () => hide('alarm-confirm'));
  $('btn-alarm-confirm-ok').addEventListener('click', deleteAlarm);
  $('btn-alarm-popup-ok').addEventListener('click', () => hide('alarm-popup'));
  closeOnBackdrop('alarm-modal', () => { alarmForm = null; });
  closeOnBackdrop('alarm-confirm');
  escapeHandlers.push(() => {
    if (!$('alarm-popup').classList.contains('is-hidden')) { hide('alarm-popup'); return; }
    if (!$('alarm-confirm').classList.contains('is-hidden')) { hide('alarm-confirm'); return; }
    if (!$('alarm-modal').classList.contains('is-hidden')) { closeAlarmForm(); return; }
    closeAlarmBox();
  });
}
// 놓친 알람 알림을 누르면 알림 창을 닫고 알람 창을 연다
document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-open-alarms]')) { return; }
  event.preventDefault();
  event.stopPropagation();
  openAlarmBox();
}, true);

// 시안 상태 막대용: 처음 상태로
function resetAlarmUi() {
  alarms = ALARM_SAMPLE();
  alarmPermission = 'default';
  isBrowserAlarmOn = false;
  closeAlarmForm();
  hide('alarm-popup', 'alarm-loading');
  setLabel($('btn-alarm-confirm-ok'), '삭제');
  closeAlarmBox();
  renderAlarmList();
}
