// 일일보고 HTML 정화와 글자 수 (api.md 6.12 "HTML 정화", "글자 수", D-155, D-161, D-163)
import sanitizeHtml from 'sanitize-html';

export const MAX_SECTION_TEXT = 5000;
export const MAX_SECTION_HTML = 20000;
export const MAX_REPORT_HTML = 100000;

const RGB_PART = '\\s*(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\s*';
const COLOR_PATTERNS = [/^#[0-9A-Fa-f]{6}$/, new RegExp(`^rgb\\(${RGB_PART},${RGB_PART},${RGB_PART}\\)$`)];
const SPAN_VALUES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const LINK_PATTERN = /^(https?:\/\/|mailto:)/i;

// colspan·rowspan 은 1~10 정수만 남긴다
function cellTransform(tagName, attribs) {
  const kept = {};
  ['colspan', 'rowspan'].forEach((name) => {
    if (SPAN_VALUES.has(attribs[name])) {
      kept[name] = attribs[name];
    }
  });
  if (attribs.style !== undefined) {
    kept.style = attribs.style;
  }
  return { tagName, attribs: kept };
}

// href 가 http·https·mailto 가 아니면 a 를 속성 없는 span 으로 바꿔 글자만 남긴다
// (허용하지 않은 태그 이름으로 바꾸면 sanitize-html 이 닫는 태그를 잘못 쓰는 문제가 있어 span 을 쓴다)
function linkTransform(tagName, attribs) {
  const href = (attribs.href ?? '').trim();
  if (!LINK_PATTERN.test(href)) {
    return { tagName: 'span', attribs: {} };
  }
  return { tagName: 'a', attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
}

const OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'em', 's', 'span', 'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'th', 'td', 'hr', 'a'],
  allowedAttributes: {
    span: ['style'],
    th: ['colspan', 'rowspan', 'style'],
    td: ['colspan', 'rowspan', 'style'],
    a: ['href', 'target', 'rel'],
  },
  allowedStyles: {
    span: { color: COLOR_PATTERNS },
    th: { 'background-color': COLOR_PATTERNS, 'text-align': [/^(left|center|right)$/] },
    td: { 'background-color': COLOR_PATTERNS, 'text-align': [/^(left|center|right)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: { a: linkTransform, th: cellTransform, td: cellTransform },
};

export function sanitizeReportHtml(html) {
  return sanitizeHtml(html, OPTIONS);
}

// sanitize-html 이 다시 이스케이프한 글자를 되돌린다
function unescapeText(text) {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
}

// 태그를 뺀 글자 수 (화면 편집기의 글자 수와 같게, 줄바꿈 없이 이어 센다)
export function textLengthOf(html) {
  let text = '';
  sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (chunk) => {
      text += chunk;
      return chunk;
    },
  });
  return unescapeText(text).length;
}
