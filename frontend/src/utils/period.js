// 기간 표시·검사 (TaskView_screen.md "기간 표시", D-135~D-142)
const dot = (dateText) => dateText.replaceAll('-', '.');
const pad = (value) => String(value).padStart(2, '0');

// 작업 카드·할일 목록: "~ 2026.11.20" / "~ 2026.11.20 18:00" (D-142). 미정이면 null (배지로 표시)
export function formatPeriodShort(item) {
  if (item.isPeriodUndecided) {
    return null;
  }
  return `~ ${dot(item.endDate)}${item.endTime ? ` ${item.endTime}` : ''}`;
}

// 상세·수정 내역·마우스 올림: 시작~종료 전체 (D-139). 미정이면 null
export function formatPeriodFull(item) {
  if (item.isPeriodUndecided) {
    return null;
  }
  if (!item.startTime) {
    return item.startDate === item.endDate ? dot(item.startDate) : `${dot(item.startDate)} ~ ${dot(item.endDate)}`;
  }
  if (item.startDate === item.endDate) {
    return `${dot(item.startDate)} ${item.startTime} ~ ${item.endTime}`;
  }
  return `${dot(item.startDate)} ${item.startTime} ~ ${dot(item.endDate)} ${item.endTime}`;
}

function localDateText(now) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 기한 지남 (D-125, D-137): 대기·진행이고, 시간이 있으면 종료 시각 < 지금, 없으면 종료일 < 오늘 (브라우저 기준)
export function isOverdue(task, now = new Date()) {
  if (task.isPeriodUndecided || (task.status !== 'waiting' && task.status !== 'progress')) {
    return false;
  }
  const today = localDateText(now);
  if (!task.endTime) {
    return task.endDate < today;
  }
  const nowText = `${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${task.endDate} ${task.endTime}` < nowText;
}

export const STATUS_LABELS = { waiting: '대기', progress: '진행', done: '완료' };

// 수정 내역 종류 문구 (D-067, D-100)
export function logTypeText(log) {
  if (log.logType === 'create') {
    return '작업 생성';
  }
  const parts = [];
  if (log.isContentChanged) {
    parts.push('작업 수정');
  }
  if (log.isAssigneeChanged) {
    parts.push('작업자 변경');
  }
  if (log.beforeStatus) {
    parts.push(`상태 변경 (${STATUS_LABELS[log.beforeStatus]} → ${STATUS_LABELS[log.status]})`);
  }
  return parts.join(' · ');
}

// 작업자 요약: 1명 닉네임 / 2명 이상 "첫 닉네임" + "외 N명" (D-098)
export function assigneeSummary(names) {
  if (names.length === 0) {
    return null;
  }
  return { first: names[0], more: names.length > 1 ? ` 외 ${names.length - 1}명` : '' };
}

// 입력 UI 값 → 요청 형식
export function toPeriodRequest(form) {
  const undecided = form.isPeriodUndecided;
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    isPeriodUndecided: undecided,
    startDate: undecided ? null : form.startDate,
    endDate: undecided ? null : form.endDate,
    startTime: undecided || !form.hasTime ? null : form.startTime,
    endTime: undecided || !form.hasTime ? null : form.endTime,
  };
}

// 화면 검사 (TaskView_screen.md 4. 동작 "화면 검사"). 오류가 없으면 빈 객체
export function validatePeriodForm(form) {
  const errors = {};
  if (!form.title.trim()) {
    errors.title = '제목을 입력해 주세요.';
  }
  if (!form.content.trim()) {
    errors.content = '내용을 입력해 주세요.';
  }
  if (!form.isPeriodUndecided) {
    if (!form.startDate || !form.endDate) {
      errors.period = '시작일과 종료일을 선택해 주세요.';
    } else if (form.endDate < form.startDate) {
      errors.period = '종료일은 시작일과 같거나 뒤여야 합니다.';
    } else if (form.hasTime) {
      if (!form.startTime || !form.endTime) {
        errors.period = '시작 시각과 종료 시각을 선택해 주세요.';
      } else if ([form.startTime, form.endTime].some((time) => Number(time.slice(3, 5)) % 5 !== 0)) {
        errors.period = '시간은 5분 단위로 선택해 주세요.';
      } else if (form.startDate === form.endDate && form.endTime < form.startTime) {
        errors.period = '종료 시각은 시작 시각과 같거나 뒤여야 합니다.';
      }
    }
  }
  return errors;
}

// Todo·Task → 입력 UI 값
export function toPeriodForm(item) {
  return {
    title: item?.title ?? '',
    content: item?.content ?? '',
    isPeriodUndecided: item?.isPeriodUndecided ?? false,
    startDate: item?.startDate ?? '',
    endDate: item?.endDate ?? '',
    hasTime: Boolean(item?.startTime),
    startTime: item?.startTime ?? '',
    endTime: item?.endTime ?? '',
  };
}
