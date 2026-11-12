// 칸반 드래그 결과를 move 로 알리는지 (브라우저 확인에서 찾은 버그: 놓은 카드를 찾지 못해 API 를 부르지 않음)
import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import draggable from 'vuedraggable';
import KanbanBoard from '../src/components/KanbanBoard.vue';

const task = (taskId, status, sortOrder) => ({
  taskId, title: `작업${taskId}`, content: '', startDate: null, endDate: null, startTime: null, endTime: null,
  isPeriodUndecided: true, status, sortOrder, assignees: [], doneDate: null, updateDate: null, createDate: '',
});

describe('KanbanBoard 드래그', () => {
  const tasks = [task(1, 'waiting', 0), task(2, 'waiting', 1), task(3, 'progress', 0)];

  test('다른 칸에 들어옴(added) → 그 칸 상태와 자리로 move', async () => {
    const wrapper = mount(KanbanBoard, { props: { tasks, isTeam: false } });
    const lists = wrapper.findAllComponents(draggable);
    await lists[1].vm.$emit('change', { added: { element: tasks[0], newIndex: 1 } });
    expect(wrapper.emitted('move')).toEqual([[{ taskId: 1, status: 'progress', index: 1 }]]);
  });
  test('같은 칸 안에서 옮김(moved) → 같은 상태로 move, 떠난 칸(removed)은 무시', async () => {
    const wrapper = mount(KanbanBoard, { props: { tasks, isTeam: false } });
    const lists = wrapper.findAllComponents(draggable);
    await lists[0].vm.$emit('change', { moved: { element: tasks[1], oldIndex: 1, newIndex: 0 } });
    await lists[0].vm.$emit('change', { removed: { element: tasks[0], oldIndex: 0 } });
    expect(wrapper.emitted('move')).toEqual([[{ taskId: 2, status: 'waiting', index: 0 }]]);
  });
  test('처리 중이면 드래그를 막는다', () => {
    const wrapper = mount(KanbanBoard, { props: { tasks, isTeam: false, isMoving: true } });
    expect(wrapper.findAllComponents(draggable).every((list) => list.vm.$attrs.disabled === true)).toBe(true);
  });
});
