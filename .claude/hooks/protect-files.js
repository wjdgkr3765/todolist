// PreToolUse 훅: 수정 금지 문서와 .env 를 보호한다
// - 수정 금지 문서(guide.md "변경할 수 없고" 문서, screen.md 템플릿, CLAUDE.md, docs/reference/): 고치기·쓰기 막음 (읽기는 허용)
// - .env (.env.example 은 허용): 읽기·고치기·쓰기 막음 (security.md 1번)
// 전역 Node 가 14 일 수 있어 CommonJS 와 Node 14 문법만 쓴다
const path = require('path');

const PROTECTED_DOCS = [
  'CLAUDE.md',
  'docs/guide.md',
  'docs/loop.md',
  'docs/coding_rule.md',
  'docs/security.md',
  'docs/git.md',
  'docs/screen.md',
];
const PROTECTED_DIRS = ['docs/reference/'];
const WRITE_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
// .env, .env.local 등. .env.example 은 값 없는 예시라 허용
const ENV_FILE = /^\.env(\.(?!example$)[^/]+)?$/i;

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    return; // 입력을 못 읽으면 막지 않는다
  }
  const toolInput = input.tool_input || {};
  const target = toolInput.file_path || toolInput.notebook_path || toolInput.path;
  if (!target) {
    return;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const relative = path.relative(path.resolve(projectDir), path.resolve(projectDir, target)).split(path.sep).join('/');
  const lower = relative.toLowerCase();
  const fileName = path.basename(relative);

  if (ENV_FILE.test(fileName)) {
    deny(`${relative} 는 비밀 정보 파일이라 AI 가 읽거나 고칠 수 없습니다 (security.md 1번). 값은 사용자가 직접 넣고, 키 이름 확인이 필요하면 사용자에게 요청하세요.`);
    return;
  }
  if (WRITE_TOOLS.indexOf(input.tool_name) === -1) {
    return;
  }
  const isProtectedDoc = PROTECTED_DOCS.some((doc) => doc.toLowerCase() === lower);
  const isProtectedDir = PROTECTED_DIRS.some((dir) => lower.indexOf(dir.toLowerCase()) === 0);
  if (isProtectedDoc || isProtectedDir) {
    deny(`${relative} 는 수정 금지 문서입니다 (guide.md·structure.md·reference.md 규칙). 꼭 바꿔야 하면 사용자가 직접 고쳐야 합니다.`);
  }
});
