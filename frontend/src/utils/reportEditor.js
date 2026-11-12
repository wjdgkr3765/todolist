// 일일보고 리치 에디터 Tiptap 설정 (D-155, D-163). 시안 daily_report_view.js 와 같은 구성
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Color, TextStyle } from '@tiptap/extension-text-style';

export const MAX_SECTION_TEXT = 5000;
export const WARN_SECTION_TEXT = 4500;

// 7. 디자인 값
export const TEXT_COLORS = [
  { value: '#E5484D', label: '빨강' }, { value: '#F59E0B', label: '주황' }, { value: '#1FAA59', label: '초록' },
  { value: '#2563EB', label: '파랑' }, { value: '#7C3AED', label: '보라' }, { value: '#6B7280', label: '회색' },
];
export const CELL_COLORS = [
  { value: '#FDECEC', label: '연한 빨강' }, { value: '#FEF3C7', label: '연한 노랑' }, { value: '#E8F6EE', label: '연한 초록' },
  { value: '#EFF6FF', label: '연한 파랑' }, { value: '#F3E8FF', label: '연한 보라' }, { value: '#F3F4F6', label: '연한 회색' },
];

// 링크: http·https·mailto 만 (D-155)
export const LINK_PATTERN = /^(https?:\/\/|mailto:)\S+$/i;

const styleOf = (element, pattern) => ((element.getAttribute('style') ?? '').match(pattern) ?? [])[1] ?? null;

// 표 셀 배경색·정렬 (D-163). 브라우저는 #RRGGBB 를 rgb(r, g, b) 로 바꿔 적으므로 둘 다 읽어 #RRGGBB 로 맞춘다
const CELL_ATTRS = {
  backgroundColor: {
    default: null,
    parseHTML: (element) => {
      const rgb = element.style.backgroundColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (rgb) {
        return `#${rgb.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      }
      return styleOf(element, /background-color:\s*(#[0-9a-fA-F]{6})/);
    },
    renderHTML: (attrs) => (attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {}),
  },
  textAlign: {
    default: null,
    parseHTML: (element) => styleOf(element, /text-align:\s*(center|right)/),
    renderHTML: (attrs) => (attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {}),
  },
};

const StyledCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...CELL_ATTRS }; } });
const StyledHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...CELL_ATTRS }; } });

export function reportExtensions(isEditable) {
  return [
    StarterKit.configure({
      heading: false, code: false, codeBlock: false, blockquote: false, underline: false,
      link: { openOnClick: !isEditable, autolink: true, protocols: ['mailto'], HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    StyledHeader,
    StyledCell,
    TextStyle,
    Color,
  ];
}

// 지금 셀(머리 칸 또는 보통 칸)의 속성
export function cellAttrs(editor) {
  return editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell');
}
