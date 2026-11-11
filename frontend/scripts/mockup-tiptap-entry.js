// 시안 전용 (D-162): 서버 없이 연 시안(file://)은 ES 모듈을 불러올 수 없어서,
// 실제 화면과 같은 Tiptap 을 일반 스크립트 하나로 묶어 window.Tiptap 으로 내보낸다.
export { Editor } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { TableKit, Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
export { TextStyle, Color } from '@tiptap/extension-text-style';
