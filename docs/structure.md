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
|프로젝트/frontend/src/views/DailyReportView_screen.md|일일보고 화면 설계 문서 (D-150)|
|프로젝트/frontend/src/layouts/|공통 레이아웃 Vue 파일과 화면 설계 문서|
|프로젝트/frontend/src/layouts/MainLayout_screen.md|공통 레이아웃 화면 설계 문서|
|프로젝트/.gitignore|git에서 제외할 파일 목록. node_modules/, dist/, coverage/, .env, 로그, 개인 편집기 설정을 제외한다 (git.md 2번)|
|프로젝트/backend/|백엔드 폴더 (Node.js 24 + Express 5)|
|프로젝트/backend/package.json, package-lock.json|백엔드 의존성과 실행·테스트 명령 (spec.md). dev/start 는 node --env-file=.env 로 .env 를 읽는다|
|프로젝트/backend/node_modules/|npm 설치 폴더 (git 제외)|
|프로젝트/backend/vitest.config.js|백엔드 테스트 설정 (개발 DB 를 같이 써서 테스트 파일을 하나씩 실행)|
|프로젝트/backend/.env|(사용자가 직접 작성, git 제외) DB 접속 정보, 메일 계정, 공휴일 API 키|
|프로젝트/backend/.env.example|환경 변수 이름만 적고 값은 비운다: NODE_ENV, DB_SERVER, DB_INSTANCE, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, MAIL_USER, MAIL_PASSWORD, HOLIDAY_API_KEY (security.md 1번)|
|프로젝트/backend/sql/schema.sql|database.md 4번의 테이블 생성 SQL. 사용자가 SSMS 에서 실행한다|
|프로젝트/backend/src/server.js|HTTP 서버와 Socket.IO 시작 (포트 3000)|
|프로젝트/backend/src/app.js|Express 앱과 공통 처리 (본문 100kb 제한(일일보고 저장·양식 저장은 512kb), 보안 응답 헤더, 공통 오류 응답, api.md 1)|
|프로젝트/backend/src/config/|env.js(환경 변수 읽기), db.js(mssql 연결·트랜잭션), mail.js(nodemailer 메일 발송)|
|프로젝트/backend/src/middlewares/|errorHandler.js(없는 경로·공통 오류 응답), requireLogin.js(로그인 확인, 401 UNAUTHORIZED)|
|프로젝트/backend/src/routes/|API 경로. api.md 6.x 구역마다 나눈다 (health.js, users.js, emailVerifications.js, sessions.js, teams.js, notifications.js, work.js(할일·작업), calendar.js(캘린더·공휴일·히스토리). work.js·calendar.js 는 /api 아래에서 경로마다 로그인 확인)|
|프로젝트/backend/src/services/|업무 처리와 SQL(파라미터 바인딩, 트랜잭션). routes 와 같은 단위로 나눈다 (userService.js, emailVerificationService.js, sessionService.js, teamService.js, notificationService.js, spaceService.js(공간 권한·기간 값), todoService.js, taskCore.js(작업 조회·잠금·순서·수정 내역), taskService.js, calendarService.js(캘린더·히스토리), teamManageService.js(팀 정보·이름·내보내기·역할·관리자 넘기기·탈퇴·해체), invitationService.js(팀 초대))|
|프로젝트/backend/src/realtime/|index.js: Socket.IO 연결 인증(로그인 쿠키), user·team 방, 이벤트 보내기, 로그아웃·새 로그인·토큰 만료 때 끊기 (api.md 6.8)|
|프로젝트/backend/src/utils/|appError.js(실패 응답 오류), validation.js(입력 검사), mailTemplate.js(인증 메일·팀 초대 안내 메일 본문), koreaDate.js(한국 시간 오늘·시각), reportDefaults.js(일일보고 기본 양식), todoInput.js(할일·작업 입력 검사), holidayApi.js(공휴일 외부 API 호출·24시간 캐시). 이후 공휴일 API 호출, 일일보고 HTML 정화(sanitize-html, D-155)|
|프로젝트/backend/tests/|백엔드 테스트 (Vitest + supertest, test.md). setup.js(.env 읽기), helpers.js(메일 가로채기, 테스트 행 정리), 기능별 *.test.js|
|프로젝트/frontend/package.json|프론트엔드 의존성. 와이어프레임 단계에서 시안이 쓰는 bootstrap, bootstrap-icons, pretendard, vuedraggable(작업 시안의 칸반 드래그에 sortablejs 를 쓴다), 일일보고 시안의 Tiptap 과 그 묶음을 만드는 vite(개발 의존성, D-162)만 먼저 넣었다 (screen.md 시안 작성 규칙, D-146). 구현 단계에서 vue, vue-router, pinia, @vitejs/plugin-vue, vitest, @vue/test-utils, jsdom 을 더했다 (overrides 로 glob·minimatch 고정, spec.md). 스크립트 dev, build, preview, test, mockup:tiptap|
|프로젝트/frontend/package-lock.json|npm 이 만든 의존성 잠금 파일|
|프로젝트/frontend/node_modules/|npm 설치 폴더 (git 제외). 시안이 상대 경로로 bootstrap 등을 불러온다|
|프로젝트/frontend/vite.config.js, index.html|Vite 설정(5173, /api·/socket.io 프록시, 테스트 jsdom), 시작 HTML|
|프로젝트/frontend/dist/|빌드 결과물 (git 제외)|
|프로젝트/frontend/src/main.js, App.vue|Vue 앱 시작과 최상위 컴포넌트|
|프로젝트/frontend/src/router/|index.js: vue-router 경로, 로그인 여부에 따른 이동 (D-051, 화면을 옮길 때마다 GET /api/sessions/me), 로그인 만료 때 로그인 화면으로 (D-118). 없는 주소 처리 (D-119)는 /personal/tasks 를 만들 때 넣는다|
|프로젝트/frontend/src/stores/|pinia 상태: toast.js(알림 토스트), auth.js(로그인 회원), teams.js(내 팀 목록), notifications.js(알림 목록·안 본 개수)|
|프로젝트/frontend/src/api/|client.js: API 호출 공통 처리 (서버 오류 토스트, 401 로그인 만료 D-118)|
|프로젝트/frontend/src/utils/|validation.js: 화면 입력 검사 (서버와 같은 규칙), 남은 시간 표시. format.js: 날짜·시각 표시. period.js: 기간 표시·기한 지남·수정 내역 문구·기간 입력 검사|
|프로젝트/frontend/src/realtime/|socket.js: socket.io-client 연결과 이벤트 받기, 다시 연결 알림 (api.md 6.8)|
|프로젝트/frontend/src/components/|여러 화면이 쓰는 조각: AuthBrandPanel(인증 화면 브랜드 영역), AppToast(토스트), LoadingLabel(로딩 중 버튼 글자), NotificationPanel(알림 창), TeamCreateModal(팀 만들기 모달), KanbanBoard, TaskCard, TaskDetailPanel, TaskLogModal, TodoFormPanel, PeriodFields(제목·내용·기간 입력), ConfirmDialog(확인창), TaskInfoModal(캘린더·히스토리 작업 상세 모달)|
|프로젝트/frontend/src/assets/styles/TaskView.css|작업 화면 스타일 (시안 task_view.html 과 같은 값). 캘린더·히스토리 상세도 같은 클래스를 쓴다|
|프로젝트/frontend/src/assets/styles/CalendarView.css|캘린더 화면 스타일 (시안 calendar_view.html 값 + FullCalendar 를 시안 모양으로 맞추는 규칙)|
|프로젝트/frontend/src/assets/styles/theme.css|공통 디자인 값 (overview.md 9)과 인증 화면 카드·입력·버튼·문구, 회원 화면 레이아웃·버튼·모달·카드·배지·표 공통 스타일 (시안 mockup_common.css 와 같은 값)|
|프로젝트/frontend/src/views/*.vue, layouts/MainLayout.vue|화면 11개. overview.md 5 화면 목록과 같다. 만든 것: SignupView.vue, LoginView.vue, layouts/MainLayout.vue, TaskView.vue, TeamInfoView.vue, CalendarView.vue, HistoryView.vue, ComingSoonView.vue(아직 만들지 않은 메뉴 화면 자리, 모든 화면을 만들면 지운다)|
|프로젝트/frontend/tests/|프론트엔드 테스트 (Vitest + @vue/test-utils + jsdom)|
|프로젝트/.claude/skills/grilling/|grilling 스킬 (mattpocock/skills, 계획을 질문으로 검증하는 스킬. npx skills add 로 설치, D-132)|
|프로젝트/.claude/launch.json|Claude 브라우저 미리보기용 개발 서버 설정 (backend 3000, frontend 5173, Node 24 경로 지정)|
|프로젝트/skills-lock.json|npx skills 로 설치한 스킬 목록과 해시|
|프로젝트/docs/reference.md|reference 폴더 참고자료 목록 (파일명, 설명, 관련 작업). AI가 폴더를 볼 때 갱신|
|프로젝트/docs/mockups/|화면 시안 HTML. 서버 없이 바로 열어 보는 파일 (loop.md 2번 와이어프레임)|
|프로젝트/docs/mockups/login_view.html, signup_view.html, find_id_view.html, find_password_view.html|로그인·회원가입·아이디 찾기·비밀번호 찾기 시안|
|프로젝트/docs/mockups/main_layout.html, task_view.html, calendar_view.html, team_info_view.html, history_view.html, profile_view.html|공통 레이아웃·작업·캘린더·팀 정보·히스토리·회원정보 수정 시안 (작업·캘린더·히스토리는 ?space=team 으로 팀 공간)|
|프로젝트/docs/mockups/daily_report_view.html, daily_report_view.js|일일보고 시안과 동작 스크립트 (D-150, D-146)|
|프로젝트/docs/mockups/vendor/tiptap.iife.js|시안용 Tiptap 묶음 (window.Tiptap). 서버 없이 연 시안은 ES 모듈을 못 불러와서 만든다. 직접 고치지 않고 `npm run mockup:tiptap` 으로 다시 만든다 (D-162)|
|프로젝트/frontend/scripts/build-mockup-tiptap.js, mockup-tiptap-entry.js|시안용 Tiptap 묶음을 만드는 스크립트와 묶을 목록 (Vite 라이브러리 빌드, D-162)|
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
