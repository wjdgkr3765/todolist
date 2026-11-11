# structure.md

해당 파일은 폴더 구조와 간단한 설명을 정리한 파일이다.

---

## 규칙

1. 이 파일에서 수정할 수 있는 곳은 "변경 가능" 목록뿐이다. 이 규칙과 "변경 불가능" 목록을 포함한 나머지 부분은 수정하지 않는다.
2. "변경 가능" 목록
   - 목록의 항목(경로, 파일명, 설명)은 추가, 수정, 삭제할 수 있다.
   - 폴더나 파일을 만들거나 옮기거나 지우면, 실제 구조와 맞도록 이 목록을 바로 갱신한다. `프로젝트/backend/`와 `프로젝트/frontend/` 하위 구조가 바뀔 때도 같다.
3. "변경 불가능" 목록
   - 목록에 적힌 경로와 파일명은 수정하지 않는다.
   - 목록에 항목을 추가하거나 삭제하지 않는다.
   - 목록에 적힌 실제 파일을 옮기거나 이름을 바꾸거나 삭제하지 않는다. 파일 내용은 각 문서의 규칙에 따라 수정할 수 있다.

---

## 1. 폴더 구조

### 변경 가능
|폴더구조|설명|
|---|---|
|프로젝트/frontend/|프론트엔드 폴더 (Vue 3 + Vite)|
|프로젝트/frontend/src/views/|화면(View) Vue 파일과 화면 설계 문서 `{화면파일명}_screen.md` (D-025)|
|프로젝트/frontend/src/views/LoginView_screen.md|로그인 화면 설계 문서|
|프로젝트/frontend/src/views/SignupView_screen.md|회원가입 화면 설계 문서|
|프로젝트/frontend/src/views/TaskView_screen.md|작업 화면 설계 문서|
|프로젝트/frontend/src/views/TeamInfoView_screen.md|팀 정보 화면 설계 문서|
|프로젝트/frontend/src/views/CalendarView_screen.md|캘린더 화면 설계 문서|
|프로젝트/frontend/src/views/HistoryView_screen.md|히스토리 화면 설계 문서|
|프로젝트/frontend/src/views/FindIdView_screen.md|아이디 찾기 화면 설계 문서|
|프로젝트/frontend/src/views/FindPasswordView_screen.md|비밀번호 찾기 화면 설계 문서|
|프로젝트/frontend/src/views/ProfileView_screen.md|회원정보 수정 화면 설계 문서|
|프로젝트/frontend/src/layouts/|공통 레이아웃 Vue 파일과 화면 설계 문서|
|프로젝트/frontend/src/layouts/MainLayout_screen.md|공통 레이아웃 화면 설계 문서|
|프로젝트/.gitignore|git에서 제외할 파일 목록. node_modules/, dist/, coverage/, .env, 로그, 개인 편집기 설정을 제외한다 (git.md 2번)|
|프로젝트/backend/|(구현 단계에서 만든다) 백엔드 폴더 (Node.js 24 + Express 5)|
|프로젝트/backend/package.json|(구현 단계) 백엔드 의존성과 실행·테스트 명령 (spec.md)|
|프로젝트/backend/.env|(사용자가 직접 작성, git 제외) DB 접속 정보, 메일 계정, 공휴일 API 키|
|프로젝트/backend/.env.example|(구현 단계) 환경 변수 이름만 적고 값은 비운다 (DB 접속, DB_INSTANCE, DB_PORT, MAIL_USER, 메일 비밀번호, HOLIDAY_API_KEY, NODE_ENV 등, security.md 1번)|
|프로젝트/backend/sql/schema.sql|(구현 단계) database.md 4번의 테이블 생성 SQL. 사용자가 SSMS 에서 실행한다|
|프로젝트/backend/src/server.js|(구현 단계) HTTP 서버와 Socket.IO 시작 (포트 3000)|
|프로젝트/backend/src/app.js|(구현 단계) Express 앱과 공통 처리 (본문 100kb 제한, 보안 응답 헤더, 공통 오류 응답, api.md 1)|
|프로젝트/backend/src/config/|(구현 단계) DB 연결(mssql), 메일 발송(nodemailer), 환경 변수 읽기|
|프로젝트/backend/src/middlewares/|(구현 단계) 로그인 확인(requireLogin), 오류 처리|
|프로젝트/backend/src/routes/|(구현 단계) API 경로. api.md 6.x 구역마다 파일 하나 (예: teams.js, notifications.js)|
|프로젝트/backend/src/services/|(구현 단계) 업무 처리와 SQL(파라미터 바인딩, 트랜잭션). routes 와 같은 단위로 나눈다|
|프로젝트/backend/src/realtime/|(구현 단계) Socket.IO 연결 인증, 방, 이벤트 보내기 (api.md 6.8)|
|프로젝트/backend/src/utils/|(구현 단계) 입력 검사, 날짜(한국 시간 오늘), 메일 본문, 공휴일 API 호출|
|프로젝트/backend/tests/|(구현 단계) 백엔드 테스트 (Vitest + supertest, test.md)|
|프로젝트/frontend/package.json|프론트엔드 의존성. 와이어프레임 단계에서 시안이 쓰는 bootstrap, bootstrap-icons, pretendard, vuedraggable(작업 시안의 칸반 드래그에 sortablejs 를 쓴다)만 먼저 넣었다 (screen.md 시안 작성 규칙, D-146). 나머지는 구현 단계에서 더한다|
|프로젝트/frontend/package-lock.json|npm 이 만든 의존성 잠금 파일|
|프로젝트/frontend/node_modules/|npm 설치 폴더 (git 제외). 시안이 상대 경로로 bootstrap 등을 불러온다|
|프로젝트/frontend/vite.config.js, index.html|(구현 단계) Vite 설정(5173, /api·/socket.io 프록시), 시작 HTML|
|프로젝트/frontend/src/main.js, App.vue|(구현 단계) Vue 앱 시작과 최상위 컴포넌트|
|프로젝트/frontend/src/router/|(구현 단계) vue-router 경로, 로그인 여부에 따른 이동 (D-051), 없는 주소 처리 (D-119)|
|프로젝트/frontend/src/stores/|(구현 단계) pinia 상태: 로그인 회원, 팀 목록, 알림 개수|
|프로젝트/frontend/src/api/|(구현 단계) API 호출 공통 처리 (401 로그인 만료 D-118, 서버 오류 토스트)|
|프로젝트/frontend/src/realtime/|(구현 단계) socket.io-client 연결과 이벤트 받기 (api.md 6.8)|
|프로젝트/frontend/src/components/|(구현 단계) 여러 화면이 쓰는 조각: AuthBrandPanel, KanbanBoard, TaskDetailPanel, TaskLogModal, 토스트, 확인창 등|
|프로젝트/frontend/src/assets/styles/theme.css|(구현 단계) 공통 디자인 값 (overview.md 9)|
|프로젝트/frontend/src/views/*.vue, layouts/MainLayout.vue|(구현 단계) 화면 10개. overview.md 5 화면 목록과 같다|
|프로젝트/frontend/tests/|(구현 단계) 프론트엔드 테스트 (Vitest + @vue/test-utils + jsdom)|
|프로젝트/.claude/skills/grilling/|grilling 스킬 (mattpocock/skills, 계획을 질문으로 검증하는 스킬. npx skills add 로 설치, D-132)|
|프로젝트/skills-lock.json|npx skills 로 설치한 스킬 목록과 해시|
|프로젝트/docs/reference.md|reference 폴더 참고자료 목록 (파일명, 설명, 관련 작업). AI가 폴더를 볼 때 갱신|
|프로젝트/docs/mockups/|화면 시안 HTML. 서버 없이 바로 열어 보는 파일 (loop.md 2번 와이어프레임)|
|프로젝트/docs/mockups/login_view.html, signup_view.html, find_id_view.html, find_password_view.html|로그인·회원가입·아이디 찾기·비밀번호 찾기 시안|
|프로젝트/docs/mockups/main_layout.html, task_view.html, calendar_view.html, team_info_view.html, history_view.html, profile_view.html|공통 레이아웃·작업·캘린더·팀 정보·히스토리·회원정보 수정 시안 (작업·캘린더·히스토리는 ?space=team 으로 팀 공간)|
|프로젝트/docs/mockups/task_view.js|작업 시안의 동작 스크립트 (D-146). 서버 없이 시안 안에서만 버튼·저장·삭제·드래그·입력 검사를 흉내 낸다|
|프로젝트/docs/mockups/mockup_common.css, mockup_common.js|시안 공통 스타일과 스크립트 (공통 디자인 값, 공통 레이아웃, 브랜드 영역, 상태 선택 막대). 실제 화면 코드가 아니다|

### 변경 불가능
- 프로젝트/docs/coding_rule.md
- 프로젝트/docs/database.md
- 프로젝트/docs/screen.md
- 프로젝트/docs/guide.md
- 프로젝트/docs/loop.md
- 프로젝트/docs/spec.md
- 프로젝트/docs/structure.md
- 프로젝트/docs/test.md
- 프로젝트/docs/todo.md
- 프로젝트/docs/overview.md
- 프로젝트/docs/api.md
- 프로젝트/docs/decision.md
- 프로젝트/docs/security.md
- 프로젝트/docs/git.md
- 프로젝트/docs/reference/
- 프로젝트/CLAUDE.md
