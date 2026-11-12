<!-- 캘린더 화면 (CalendarView_screen.md, 시안 docs/mockups/calendar_view.html). FullCalendar v7 월간 보기 (D-002, D-088) -->
<script setup>
import '@fullcalendar/vue3/skeleton.css';
import '../assets/styles/CalendarView.css';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/vue3/daygrid';
import koLocale from '@fullcalendar/vue3/locales/ko';
import TaskInfoModal from '../components/TaskInfoModal.vue';
import { apiRequest } from '../api/client.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';

const route = useRoute();
const router = useRouter();
const teamsStore = useTeamsStore();
const toastStore = useToastStore();

const teamId = computed(() => (route.params.teamId ? Number(route.params.teamId) : null));
const isTeam = computed(() => teamId.value !== null);
const base = computed(() => (isTeam.value ? `/api/teams/${teamId.value}` : '/api/personal'));

const calendarRef = ref(null);
const tasks = ref([]);
const isLoading = ref(false);
const title = ref('');
const isTodayInView = ref(true);
const openTask = ref(null);
// 해마다 불러온 공휴일 { 'YYYY-MM-DD': 이름 }. 이미 불러온 해는 다시 부르지 않는다
const holidays = reactive({});
const loadedYears = new Set();
let visibleRange = null;
let loadSeq = 0;

const pad = (value) => String(value).padStart(2, '0');
const dateText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function addDays(text, days) {
  const date = new Date(`${text}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateText(date);
}

// 576px 미만은 칸마다 막대 2줄, 이상은 3줄 (넘치면 +N)
const isNarrow = ref(window.innerWidth < 576);
function onResize() {
  isNarrow.value = window.innerWidth < 576;
}

const events = computed(() => tasks.value.map((task) => {
  const kind = task.isHistory ? 'history' : task.status;
  const isSingle = task.startDate === task.endDate;
  return {
    id: String(task.taskId),
    title: task.title,
    start: task.startDate,
    // 종일 일정의 end 는 다음 날 (포함하지 않음)
    end: addDays(task.endDate, 1),
    allDay: true,
    className: isSingle ? `cal-bar is-single single-${kind}` : `cal-bar bar-${kind}`,
    extendedProps: { task, isSingle },
  };
}));

const options = computed(() => ({
  plugins: [dayGridPlugin],
  initialView: 'dayGridMonth',
  locale: koLocale,
  firstDay: 0,
  // 칸마다 보이는 작업 수, 넘치면 +N (576px 미만 2개)
  dayMaxEvents: isNarrow.value ? 2 : 3,
  moreLinkClass: 'cal-more',
  height: 'auto',
  eventOrder: 'extendedProps.order',
  eventOrderStrict: true,
  events: events.value.map((event, order) => ({ ...event, extendedProps: { ...event.extendedProps, order } })),
  datesSet: onDatesSet,
  eventClick: (info) => {
    info.jsEvent.preventDefault();
    openTask.value = info.event.extendedProps.task;
  },
}));

async function loadHolidays(years) {
  const missing = years.filter((year) => !loadedYears.has(year));
  await Promise.all(missing.map(async (year) => {
    loadedYears.add(year);
    try {
      const data = await apiRequest('GET', '/api/holidays', { query: { year: String(year) } });
      if (!data.isAvailable) {
        loadedYears.delete(year);
      }
      data.holidays.forEach((holiday) => { holidays[holiday.date] = holiday.name; });
    } catch {
      // 공휴일이 없어도 캘린더는 보인다 (D-107)
      loadedYears.delete(year);
    }
  }));
}

async function loadTasks() {
  if (!visibleRange) {
    return;
  }
  const seq = ++loadSeq;
  isLoading.value = true;
  try {
    const data = await apiRequest('GET', `${base.value}/calendar`, { query: visibleRange });
    if (seq === loadSeq) {
      tasks.value = data.tasks;
    }
  } catch (error) {
    if (seq === loadSeq) {
      tasks.value = [];
    }
    if (isTeam.value && error.status === 404) {
      toastStore.show('error', '팀을 찾을 수 없습니다.');
      await teamsStore.fetchTeams().catch(() => {});
      await router.replace('/personal/tasks');
    }
  } finally {
    if (seq === loadSeq) {
      isLoading.value = false;
    }
  }
}

function onDatesSet(info) {
  const current = info.view.currentStart;
  title.value = `${current.getFullYear()}.${pad(current.getMonth() + 1)}`;
  const today = new Date();
  isTodayInView.value = today.getFullYear() === current.getFullYear() && today.getMonth() === current.getMonth();
  // 보이는 첫 칸 ~ 마지막 칸 (end 는 포함하지 않으므로 하루 뺀다)
  visibleRange = { from: dateText(info.start), to: addDays(dateText(info.end), -1) };
  loadHolidays([...new Set([info.start.getFullYear(), new Date(info.end.getTime() - 1).getFullYear()])]);
  loadTasks();
}

const api = () => calendarRef.value?.getApi();

function dayClass(arg) {
  const text = dateText(arg.date);
  return {
    'is-sun': arg.dow === 0,
    'is-sat': arg.dow === 6,
    'is-holiday': Boolean(holidays[text]),
    'is-other': arg.isOther,
    'is-today': arg.isToday,
  };
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    openTask.value = null;
  }
}
onMounted(() => {
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  document.removeEventListener('keydown', onKeydown);
});
watch(() => route.params.teamId, () => loadTasks());
</script>

<template>
  <section class="cal-card">
    <div class="cal-head">
      <button type="button" class="cal-nav" aria-label="이전 달" @click="api()?.prev()"><i class="bi bi-chevron-left"></i></button>
      <span class="cal-month">{{ title }}</span>
      <button type="button" class="cal-today" :disabled="isTodayInView" @click="api()?.today()"><i class="bi bi-arrow-counterclockwise"></i>오늘</button>
      <button type="button" class="cal-nav" aria-label="다음 달" @click="api()?.next()"><i class="bi bi-chevron-right"></i></button>
      <span v-if="isLoading" class="cal-loading spinner-border spinner-border-sm" aria-label="불러오는 중"></span>
      <div class="cal-legend">
        <span><i class="legend-dot" style="background: var(--color-waiting)"></i>대기</span>
        <span><i class="legend-dot" style="background: var(--color-progress)"></i>진행</span>
        <span><i class="legend-dot" style="background: var(--color-done)"></i>완료</span>
        <span><i class="legend-dot legend-history"></i>히스토리</span>
      </div>
    </div>
    <FullCalendar ref="calendarRef" :options="options">
      <template #dayHeaderContent="arg">
        <span :class="{ 'is-sun': arg.dow === 0, 'is-sat': arg.dow === 6 }">{{ arg.text }}</span>
      </template>
      <template #dayCellTopContent="arg">
        <span class="cal-date">
          <span class="date-num" :class="dayClass(arg)">{{ arg.date.getDate() }}</span>
          <span v-if="holidays[dateText(arg.date)]" class="holiday-name">{{ holidays[dateText(arg.date)] }}</span>
        </span>
      </template>
      <template #moreLinkContent="arg">+{{ arg.num }}</template>
      <template #eventContent="arg">
        <span class="cal-bar-text"><template v-if="arg.event.extendedProps.isSingle && arg.event.extendedProps.task.startTime">{{ arg.event.extendedProps.task.startTime }} </template>{{ arg.event.title }}</span>
      </template>
    </FullCalendar>
    <TaskInfoModal v-if="openTask" :task="openTask" :is-team="isTeam" :is-history="openTask.isHistory" @close="openTask = null" />
  </section>
</template>
