# todo.md

진행 상황을 기록하는 문서다. 세션이 바뀌어도 이 파일만 읽으면 이어서 작업할 수 있어야 한다.

## 운영 규칙
- 세션을 시작하면 이 파일부터 읽는다.
- "진행 중"에는 한 번에 하나의 작업만 둔다.
- 작업 상태가 바뀔 때마다 즉시 갱신한다. 세션 끝에 몰아서 쓰지 않는다.
- 세션을 마치기 전에 "세션 인계"를 갱신한다.
- loop.md 4단계가 모두 승인되어야 "완료"로 옮긴다.
- 완료된 항목은 날짜와 함께 "완료"로 옮긴다. 20개가 넘으면 오래된 것부터 지운다.
- 사용자의 결정은 "메모"가 아니라 decision.md에 기록한다.

---

## 진행 중

<!-- 형식:
### [작업명]
- 목표: 
- 범위: (프로젝트 전체 / 추가 기능: overview.md 핵심 기능 중 해당 기능)
- 현재 단계: (loop.md 단계 번호. 예: 2. 와이어프레임)
- 단계 승인: 설계(승인 전 / 승인 완료, YYYY-MM-DD), 와이어프레임( ), 구현( ), 보안 체크( )
- 진행 상황: (현재 단계에서 끝낸 것과 남은 것. 예: 화면 5개 중 3개 시안 완료)
- 관련 파일: 
- 재시도 기록: (실패한 체크리스트 항목과 연속 실패 횟수)
- 메모: 
-->

### 마감 임박 알림 개선
- 목표: 종료일을 내일로 정해 작업을 만들면 바로 마감 임박 알림이 오는 불편을 없앤다
- 범위: 추가 기능: overview.md 핵심 기능 중 팀 초대/알림(마감 임박 알림, D-128·D-138)
- 현재 단계: 3. 구현 (2026-11-12 시작)
- 단계 승인: 설계(승인 완료, 2026-11-12), 와이어프레임(해당 없음 — 화면 변화 없음, 설계 승인 때 함께 확인, 2026-11-12), 구현(승인 전), 보안 체크( )
- 진행 상황: 사용자 요청 (2026-11-12). 사용자가 1번(기간을 정할 때 이미 구간 안이면 알리지 않음) 선택 → D-166. 설계 문서 고침: database.md tasks.period_update_date, api.md 6.7 마감 임박 알림 만들기, overview.md 8.8, decision.md D-138 상태. 화면 변화 없음(와이어프레임 해당 없음). 사용자에게 설계 승인 요청함. 구현 때 사용자가 SSMS 에서 ALTER TABLE 을 실행해야 함. 설계 승인 (2026-11-12, 와이어프레임 해당 없음). 구현: schema.sql·taskService(기간을 바꾸면 period_update_date 갱신)·notificationService(구간 안에서 정한 작업 제외), 사용자가 SSMS 에서 컬럼 추가 SQL 실행 (2026-11-12, NOT NULL·기존 4개 create_date 로 채움 확인). 테스트: 백엔드 325개 (경계 1초 전/정각, 작업 시작, 제목만 수정, 기간 변경), 프론트엔드 빌드. 사용자에게 구현 승인 요청함
- 관련 파일: docs/decision.md D-128·D-138, docs/api.md 6.7 GET /api/notifications, backend/src/services/notificationService.js, frontend/src/layouts/MainLayout_screen.md
- 재시도 기록: 없음
- 메모:

---

## 백로그

우선순위가 높은 순서로 적는다. overview.md 핵심 기능의 우선순위를 기준으로 적는다.

"진행 중"에서 옮긴 작업은 "진행 중" 형식의 내용을 그대로 유지한 채 옮긴다.

- (없음. 핵심 기능 14개는 모두 "진행 중" 작업의 범위다)

---

## 막힌 일

사용자의 결정, 외부 조건, 또는 반복 실패(loop.md "종료 조건") 때문에 진행할 수 없는 항목이다.

- (없음)

---

## 세션 인계

- **마지막 갱신**: 2026-11-12
- **현재 상태**: "마감 임박 알림 개선" 3. 구현 끝, 사용자 구현 승인 기다림 (승인되면 4. 보안 체크)
- **다음에 할 일**: 사용자가 고른 방법을 decision.md 에 기록하고 api.md 6.7·MainLayout_screen.md 를 고친다 → 설계 승인 → (화면 변경이 없으면 와이어프레임은 사용자와 확인) → 구현 → 보안 체크
- **주의 사항**:
  - DB: localhost\SQLEXPRESS, SQL Server 인증 계정 `todolist_app` (D-034). SSMS 접속 시 "서버 인증서 신뢰" 체크 필요
  - backend/.env 는 사용자가 직접 작성한다 (AI는 키 이름만 확인). 공휴일 API 키(HOLIDAY_API_KEY)·Gmail 앱 비밀번호는 사용자가 발급받았다 (2026-11-11)
  - git: 커밋과 푸시는 AI가 한다. 커밋 메시지에 서명 줄을 붙이지 않는다 (D-086)
  - 시안 검사: Chrome headless 를 Node 24 내장 WebSocket 으로 조작 (CDP). 일일보고 시안의 Tiptap 묶음은 frontend 에서 `npm run mockup:tiptap` 으로 다시 만든다 (D-162)
  - 이 컴퓨터의 기본 Node 는 14. 프로젝트는 Node 24 (nvm 의 v24.22.2). 전역 nvm 은 바꾸지 않고 명령 앞에 `export PATH=/c/Users/WJDGKR3386/AppData/Local/nvm/v24.22.2:$PATH` 를 붙여 실행한다 (npx 는 전역 node 를 써서 v14 로 실패함, 2026-11-12)
  - 회사 보안 프로그램(Somansa)이 Gmail SMTP 의 TLS 인증서를 바꿔 끼운다. 백엔드는 --use-system-ca 로 Windows 인증서 저장소를 믿어야 메일이 나간다 (package.json dev/start, .claude/launch.json 에 넣음, 2026-11-12)
  - sqlcmd 로 SQL 을 실행할 때는 -I(QUOTED_IDENTIFIER ON) 가 필요하다. schema.sql 맨 위에 SET 으로 넣어 두었다 사용자 상태 표시줄(남은 컨텍스트)은 ~/.claude/statusline.ps1

---

## 완료

### 일정관리 협업 시스템 (프로젝트 전체) — 완료 2026-11-12
- 목표: overview.md 핵심 기능 14개 전체를 loop.md 순서(설계 → 와이어프레임 → 구현 → 보안 체크)로 완성한다
- 범위: 프로젝트 전체
- 현재 단계: 완료 (2026-11-12). 4단계 모두 승인. 승인 뒤 추가한 일일보고(D-150)도 설계·와이어프레임 승인 완료 (2026-11-11), 구현 범위에 포함 (우선순위 14)
- 단계 승인: 설계(승인 완료, 2026-11-11), 와이어프레임(승인 완료, 2026-11-11), 구현(승인 완료, 2026-11-12), 보안 체크(승인 완료, 2026-11-12)
- 진행 상황:
  - 끝낸 것: 이전 프로젝트 기획/설계(project_design.md)를 문서에 반영 (2026-11-11, D-082). 상세 설계가 끝난 기능은 회원가입, 로그인/로그아웃, 공통 레이아웃, 작업 페이지 - 할일 목록, 작업 페이지 - 칸반보드이고, 화면 문서 4개(LoginView, SignupView, MainLayout, TaskView)를 만들었다
  - 끝낸 것 (2026-11-11): 미결 1·3 결정 (D-087, D-088). 팀 생성/관리 상세 설계 (database.md teams·team_members, api.md 6.6, TeamInfoView_screen.md 새로 작성, MainLayout_screen.md 팀 목록·팀 만들기 모달·팀 공간 탭, overview.md 화면 경로). 팀 목록 순서·드래그(D-089), 팀 공간 경로(D-090). 팀 초대/알림 상세 설계 (D-091~D-096, database.md notifications, api.md 6.7, TeamInfoView 초대 모달, MainLayout 알림 창). 팀 작업 페이지 상세 설계 (D-097~D-100, todos·tasks team_id, task_assignees, task_log_assignees, task_logs 종류 create/change 로 변경, api.md 6.4·6.5, TaskView 작업자). 인증 메일 모양 승인(D-102), 작업자 변경 기록 닉네임(D-101). 실시간 반영 상세 설계 (D-103~D-105, api.md 6.8, TaskView·MainLayout 실시간 동작). 캘린더 상세 설계 (D-106~D-109, api.md 6.9 캘린더·공휴일, CalendarView_screen.md 새로 작성, spec.md 외부 서비스). 히스토리 상세 설계 (D-110~D-113, api.md 6.10, HistoryView_screen.md 새로 작성, 칸반에서 히스토리 작업 제외 409 TASK_IN_HISTORY). 아이디/비밀번호 찾기 상세 설계 (D-114~D-117, api.md 6.2, FindIdView·FindPasswordView_screen.md 새로 작성). 빠진 설계 7개(D-118~D-124), 추가 기능 4개(D-125~D-128: 기한 지남, 내 작업만, 작업자 지정 알림, 마감 임박 알림), 회원정보 수정/탈퇴 상세 설계 (D-129~D-131, api.md 6.11, ProfileView_screen.md). grilling 스킬 설치 (D-132)
  - /profile 확정 (D-133). structure.md 에 구현 단계에서 만들 폴더·파일 정리 (템플릿 예시 행 삭제). api.md 에 보안 응답 헤더 추가. loop.md 설계 완료 기준 1~7 확인 완료 (화면 문서의 API 가 모두 api.md 에 있음을 스크립트로 대조, 남은 자리표시·옛 문구 정리)
  - 설계 승인 완료 (2026-11-11)
  - 와이어프레임: 화면 10개 시안 완성 (이전 4개 갱신, 새 6개, 공통 mockup_common.css·js). 시안용으로 frontend/package.json 에 bootstrap·bootstrap-icons·pretendard 설치(Node 24, npm audit 0), .gitignore 생성. 완료 기준 1~5 확인 (Chrome headless 로 모든 상태 콘솔 오류 0, 시안 사이 링크 대상 모두 있음). 와이어프레임 승인 완료 (2026-11-11)
  - 승인 뒤 설계 추가 (사용자 요청, loop.md 앞 단계 변경): 기간에 시간 넣기 D-135~D-140 (todos·tasks·task_logs 에 start_time·end_time, api.md 기간 형식·마감 임박 시점, TaskView 시간 지정 입력, 기한 지남·캘린더·히스토리 표시, 시안 3개). D-134(히스토리 완료일 시간)는 잘못 이해한 변경이라 되돌림(D-141)
  - 승인 뒤 설계 추가: D-142 작업 카드·할일 목록은 "~ 종료일"만, 상세 UI 는 시작~종료 (마우스 올리면 전체)
  - 승인 뒤 설계 추가: D-144 히스토리 표 기간은 시작일~종료일, 날짜만(시간 없음), 두 줄 (D-143 종료일만은 잘못 이해해 변경)
  - 승인 뒤 설계 추가: D-147 수정 내역에 "수정한 사람 / 만든 사람" 표시
  - 승인 뒤 설계 변경: D-148 내보내기로 작업자에서 빠진 기록은 내보낸 회원 닉네임 (D-101 변경)
  - 동작하는 시안 (D-146): 시안 10개 모두 동작하게 완료 (2026-11-11). 나머지 9개는 이전 세션에서 만든 동작 코드를 Chrome headless 로 "4. 동작"마다 눌러 확인하고, 빠진 3곳을 고침 (로그인 입력 시 오류 지우기, 비밀번호 찾기 새 비밀번호 blur 검사, 팀 탈퇴·해체 뒤 안내 토스트와 팀 목록에서 빼기). 모든 시안·모든 상태 콘솔 오류 0. 사용자 승인 완료 (2026-11-11)
  - 승인 뒤 기능 추가: 일일보고 (14번째 핵심 기능, D-150~D-161). grilling 으로 결정 → 설계 문서 작성 완료 (overview.md 8.15, database.md report_templates·daily_reports·users.is_report_carry_over, api.md 6.12·6.6·6.8·6.11, spec.md Tiptap·sanitize-html, structure.md, MainLayout_screen.md 탭, DailyReportView_screen.md 새로 작성). 설계 승인 완료 (2026-11-11). 시안 daily_report_view.html + .js 완성 (Tiptap 묶음 D-162, 상태 32개, Chrome headless 로 동작·콘솔 오류 확인, 다른 시안 팀 탭에 일일보고 추가). 사용자 요청으로 표 셀 배경색·정렬 추가 (D-163). 와이어프레임 승인 완료 (2026-11-11)
  - 구현: 사용자가 구현 시작을 지시함 (2026-11-12). DB 확인 결과 todolist DB 있음, todolist_app 은 SQL 로그인이고 todolist DB 의 db_owner, 테이블 0개 (Windows 인증 sqlcmd 로 확인). backend/.env.example 작성 완료. 사용자가 DB·로그인을 다시 만들고 backend/.env 작성 완료 (키 10개 확인, todolist_app 접속 확인)
  - 우선순위 1 회원가입 (완료, 2026-11-12): 백엔드(기본 구조, health, 아이디 중복 확인, 인증번호 발송·확인, 회원가입 API)와 sql/schema.sql(트랜잭션 안에서 실행 후 되돌려 14개 생성 확인), 프론트엔드(기본 구조, theme.css, 토스트, AuthBrandPanel, SignupView) 작성. 사용자가 SSMS 에서 schema.sql 실행 (2026-11-12, 테이블 14개·인덱스 18개 확인). test.md 체크리스트: 코드 검토 1~10, 빌드, 테스트(백엔드 117개 실제 DB, 프론트엔드 55개), 화면 확인(브라우저 pane 에서 요소·크기·동작·375px, 콘솔 오류 0 — 경고 1건은 아직 없는 /login 경로), git 확인 통과. 사용자가 자기 메일로 인증 메일을 받아 끝까지 가입 성공 (users 1행, bcrypt 해시, 인증 기록 삭제 확인). 다음: 우선순위 2 로그인/로그아웃. 스크린샷은 pane 이 숨겨져 있어 찍지 못함
  - 인증번호 [확인] 버튼 동작 사용자 승인 (D-164, 2026-11-12). SignupView_screen.md 에 반영
  - 우선순위 2 로그인/로그아웃 (완료, 2026-11-12): 백엔드 POST /api/sessions·logout, GET /api/sessions/me, requireLogin, 인증번호 change_email(로그인 필요). 프론트엔드 auth 스토어, 라우터 화면 이동 제한(D-051), 401 만료 처리(D-118), LoginView. 테스트: 백엔드 147개(실제 DB, 3회 연속), 프론트엔드 72개, 빌드 성공, 브라우저 확인(실패 상자, 로그인 → /personal/tasks, 로그인 상태에서 /signup → /personal/tasks, 로그아웃 뒤 401, httpOnly 쿠키), 콘솔은 계획된 401 만. 로그아웃 버튼은 공통 레이아웃(우선순위 3)에서 붙인다
  - 우선순위 3 공통 레이아웃 (완료, 2026-11-12): 레이아웃이 쓰는 API 를 함께 만듦 — GET/POST /api/teams, POST /api/teams/{id}/move(기본 일일보고 양식 포함), 알림 GET·read·delete·accept·decline(마감 임박 알림 만들기 포함), Socket.IO 연결(쿠키 인증, user·team 방, 로그아웃·새 로그인 때 끊기). 프론트엔드 MainLayout(네비·알림 창·팀 목록 드래그·팀 만들기 모달·회원 메뉴·로그아웃·메뉴 탭), 라우터 회원 화면 경로·없는 주소(D-119)·`/` 이동, 아직 없는 메뉴 화면은 ComingSoonView(제목만). 테스트: 백엔드 182개, 프론트엔드 94개, 빌드, 브라우저(1280x800 에서 크기 값, 팀 만들기 → 팀 정보 탭, 알림 창, 회원 메뉴, 실시간 연결 인증) 확인
  - 우선순위 4·5 작업 페이지(할일 목록·칸반) 완료, 우선순위 8 팀 작업 페이지(작업자 지정·내 작업만)도 같은 화면이라 함께 완료 (2026-11-12): API 6.4 할일 전부, 6.5 작업 전부(드래그·상세 수정·삭제·수정 내역, 작업자 지정 알림, 마감 임박 알림 지우기), GET /api/teams/{id}/members. 실시간 team:todos-changed·team:tasks-changed 보내기·받기(D-103~D-105)와 끊김 띠(D-123)도 넣음. 프론트엔드 TaskView + KanbanBoard·TaskCard·TaskDetailPanel·TaskLogModal·TodoFormPanel·PeriodFields·ConfirmDialog. 테스트: 백엔드 223개, 프론트엔드 127개, 빌드. 브라우저(1440x900)에서 크기 값·기한 지남·상세·수정 검사·칸반 드래그·팀 목록 드래그 확인
  - 브라우저 확인에서 찾아 고친 버그: 칸반 카드를 놓을 때 옮긴 카드를 찾지 못해 드래그 API 를 부르지 않음 (vuedraggable end 이벤트 대신 change 이벤트로 바꿈, 팀 목록 드래그도 같게). 단위 테스트가 emit 을 직접 불러서 놓쳤던 것이라 KanbanBoard.test.js 를 더함
  - 우선순위 6·7 팀 생성/관리·팀 초대 완료, 9 실시간 반영도 팀 일일보고 이벤트를 빼고 완료 (2026-11-12): API 6.6 나머지(팀 정보·이름 수정·내보내기·역할·관리자 넘기기·탈퇴·해체, 작업자 정리 D-100·D-148), 6.7 초대·초대 목록·초대 취소(안내 메일, 24시간 재초대 금지). teams:changed removed/left/dissolved 보내기. 프론트엔드 TeamInfoView (확인창에 버튼 잠금·문구 옵션 추가). 테스트: 백엔드 239개, 프론트엔드 140개, 빌드, 브라우저(팀 정보 화면 크기 값, 팀 해체 2단계). 브라우저에서는 실제 초대 메일이 외부로 나가지 않도록 초대 발송은 하지 않음 (자동 테스트에서 메일을 가로채 확인)
  - 우선순위 10 캘린더·11 히스토리 완료 (2026-11-12): API 6.9 캘린더·공휴일(실제 키로 호출 확인, 24시간 캐시), 6.10 히스토리. FullCalendar v7 구성을 공식 문서로 확인해 spec.md 를 고침 (@fullcalendar/vue3 + temporal-polyfill, 하위 경로 daygrid·locales/ko, @fullcalendar/core 없음). v7 내부 클래스는 무작위 이름이라 role 속성으로 스타일을 맞추고, skeleton.css 의 !important 를 같은 방식으로 덮음. 테스트: 백엔드 258개, 프론트엔드 146개. 브라우저(1440x1000)에서 칸 높이·선·막대 크기·색·+N·오늘 원 확인
  - 확인 못 한 것: pane 이 숨겨져 requestAnimationFrame 이 돌지 않아, 한 칸에 작업이 여러 개일 때 막대가 세로로 쌓이는지(위치 계산)는 확인하지 못함 (모두 top 0 으로 겹쳐 보임). 승인 요청 때 사용자에게 화면으로 확인을 부탁한다
  - 우선순위 12 아이디/비밀번호 찾기 완료 (2026-11-12): API find-id·reset-password(로그인 무효·실시간 끊기 D-116). 프론트엔드 FindIdView·FindPasswordView, 공통 EmailVerifyField (회원가입 화면은 이미 확인을 마쳐 그대로 둠). 화면 이동 상태는 router.options.history.state 로 읽도록 LoginView 도 고침. 테스트: 백엔드 269개, 프론트엔드 153개. 브라우저에서 화면·빈 값 검사 확인 (인증 메일은 보내지 않음)
  - 우선순위 13 회원정보 수정/탈퇴 완료 (2026-11-12): API 6.11 전부 (현재 비밀번호 확인은 로그인과 같은 실패 제한을 쓰도록 sessionService 의 checkPasswordWithLimit 으로 떼어냄, 탈퇴 7단계 한 트랜잭션, 막는 팀은 오류 응답 teams 로). 프론트엔드 ProfileView, EmailVerifyField 에 인증번호 줄 붙이기·발송 잠금 옵션, API 오류의 추가 필드 전달. 테스트: 백엔드 279개, 프론트엔드 161개
  - 우선순위 14 일일보고 완료 (2026-11-12): API 6.12 전부 + POST /api/users/me/report-carry-over, 저장·양식 저장만 본문 512kb, team:reports-changed (submit/update). sanitize-html 2.18.1 설치(npm audit 0). 허용하지 않은 링크는 sanitize-html 이 태그 이름을 바꾸면 닫는 태그를 잘못 쓰는 문제가 있어 속성 없는 span 으로 바꿔 글자만 남긴다. 프론트엔드 DailyReportView + ReportEditor·ReportToolbar·ReportTemplateModal(vuedraggable), ComingSoonView 삭제. 테스트: 백엔드 323개(실제 DB), 프론트엔드 181개, 빌드. 브라우저(1280x800·800px)에서 도구 막대·표 셀 배경색/정렬·링크 검사·임시저장/제출/수정 제출·남의 보고 읽기·실시간 반영·나가기 확인창·다시 불러오기·새 양식 적용·이어받기·양식 설정 모달·좁은 화면·팀원 권한·없는 팀 확인. 브라우저에서 찾아 고친 버그: 양식 모달이 반응형 객체를 structuredClone 해 열리지 않음 (JSON 복사로 바꿈)
  - 전체 체크리스트 (2026-11-12): 코드 검토(파일 700줄 이하, v-html·innerHTML 없음), 빌드, 백엔드 323·프론트엔드 181 통과, npm audit 0 (백엔드·프론트엔드), git status 에 dist·.env 없음
  - 구현 승인 (2026-11-12). 4. 보안 체크 (2026-11-12): security.md 11 의 28개 항목 확인. 실제 요청은 임시 스크립트(backend/_security_check.mjs, 확인 후 지움)로 로컬 앱에 테스트 계정만 써서 보냄 — 틀린 아이디/비밀번호 같은 응답, 5번 잠금, 로그아웃 뒤 401, 쿠키 HttpOnly·SameSite=Strict, 회원 전용 API 54개 로그인 없이 401, 다른 계정 데이터 26개 403/404, 팀원이 관리자 기능 8개 403, 잘못된 입력 43개 400, ' OR '1'='1, XSS 저장, 오류 응답, 응답 헤더, CORS. 결과 22개 통과 / 해당 없음 2개(22·23 파일 업로드 없음) / 고친 것 없음. 21번: GET /api/notifications 가 마감 임박 알림을 만드는 것은 설계(D-128)대로 서버가 계산하는 알림이라 사용자의 저장·수정·삭제가 아니고 SameSite=Strict 로 다른 사이트 요청도 막혀 통과로 봄. 사용자에게 보안 체크 승인 요청함
  - 브라우저 pane 이 숨겨져 있으면 화면 크기가 0 으로 잡혀 높이 값이 줄어 보인다. 크기 확인은 resize_window 로 1280x800 을 지정한 뒤 한다. 숨겨진 동안은 클릭·포커스·크기 변경 이벤트도 오지 않아 페이지 안 스크립트(버튼 click(), Tiptap 명령, focus 이벤트 보내기)로 확인했다
  - 사용자 준비 (2026-11-11 사용자 답변): SQL Server 로그인 계정 만듦, Gmail 앱 비밀번호 발급함, 공휴일 API 키 발급함. backend/.env 는 사용자가 작성 (아직 없음)
- 관련 파일: docs/overview.md, docs/spec.md, docs/database.md, docs/api.md, docs/decision.md, docs/reference.md, docs/structure.md, frontend/src/views/LoginView_screen.md, frontend/src/views/SignupView_screen.md, frontend/src/views/TaskView_screen.md, frontend/src/layouts/MainLayout_screen.md
- 재시도 기록: 로그인 테스트 "잠금 남은 시간" 1회 실패 (2026-11-12) — 잠금 시각은 DB 시계, 남은 시간은 Node 시계로 계산해 10분이 11분으로 나옴. 남은 초를 DB 에서 계산하도록 고친 뒤 3회 연속 통과
- 메모:
  - 보안 체크 승인 (2026-11-12). 승인 전 사용자 요청으로 입력 화면 Tab 이동을 입력칸끼리만 바꿈 (D-165), 사용자 승인 (2026-11-12)
  - 사용자에게 부탁한 화면 확인 중 캘린더 막대 쌓임·일일보고 도구 막대 클릭은 답을 받지 못한 채 완료
  - docs/mockups/ 의 시안 4개는 이전 프로젝트 시안이다. 와이어프레임 단계에서 설계와 다시 맞춰 보고 승인받는다 (D-085). 시안 안의 결정 번호는 이전 번호다 (새 번호는 decision.md D-083 표)
  - 이전 프로젝트에서 미결로 남은 것: 없음 (D-087, D-088, D-102 로 모두 결정)
