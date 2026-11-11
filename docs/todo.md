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

### 일정관리 협업 시스템 (프로젝트 전체)
- 목표: overview.md 핵심 기능 14개 전체를 loop.md 순서(설계 → 와이어프레임 → 구현 → 보안 체크)로 완성한다
- 범위: 프로젝트 전체
- 현재 단계: 3. 구현 (시작 전). 승인 뒤 추가한 일일보고(D-150)도 설계·와이어프레임 승인 완료 (2026-11-11), 구현 범위에 포함 (우선순위 14)
- 단계 승인: 설계(승인 완료, 2026-11-11), 와이어프레임(승인 완료, 2026-11-11), 구현(승인 전), 보안 체크(승인 전)
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
  - 구현: 시작 전. 사용자가 "아직 구현 단계로 넘어가지 마"라고 함 (2026-11-11). 사용자가 시작하라고 할 때까지 코드를 만들지 않는다
  - 사용자 준비 (2026-11-11 사용자 답변): SQL Server 로그인 계정 만듦, Gmail 앱 비밀번호 발급함, 공휴일 API 키 발급함. backend/.env 는 구현을 시작하면서 AI 가 .env.example(키 이름만)을 만든 뒤 사용자가 작성 (아직 없음). DB(todolist) 생성 여부는 확인하지 않음
- 관련 파일: docs/overview.md, docs/spec.md, docs/database.md, docs/api.md, docs/decision.md, docs/reference.md, docs/structure.md, frontend/src/views/LoginView_screen.md, frontend/src/views/SignupView_screen.md, frontend/src/views/TaskView_screen.md, frontend/src/layouts/MainLayout_screen.md
- 재시도 기록: 없음
- 메모:
  - docs/mockups/ 의 시안 4개는 이전 프로젝트 시안이다. 와이어프레임 단계에서 설계와 다시 맞춰 보고 승인받는다 (D-085). 시안 안의 결정 번호는 이전 번호다 (새 번호는 decision.md D-083 표)
  - 이전 프로젝트에서 미결로 남은 것: 없음 (D-087, D-088, D-102 로 모두 결정)

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

- **마지막 갱신**: 2026-11-11 (세션 종료)
- **현재 상태**: 핵심 기능 14개(일일보고 포함, D-150~D-163) 설계·와이어프레임 승인 완료 (2026-11-11). 시안 11개 모두 동작하는 시안. 3. 구현 시작 전 (코드 없음). 사용자가 구현 시작을 보류함
- **다음에 할 일**: 사용자가 구현 시작을 말하면 → DB(todolist) 생성 여부 확인, backend/.env.example 작성 후 사용자에게 .env 작성 안내 → 구현 우선순위 1(회원가입)부터 기능마다 test.md 완료 체크리스트. 그 전에는 구현하지 않는다
- **주의 사항**:
  - DB: localhost\SQLEXPRESS, SQL Server 인증 계정 `todolist_app` (D-034). SSMS 접속 시 "서버 인증서 신뢰" 체크 필요
  - backend/.env 는 사용자가 직접 작성한다 (AI는 키 이름만 확인). 공휴일 API 키(HOLIDAY_API_KEY)·Gmail 앱 비밀번호는 사용자가 발급받았다 (2026-11-11)
  - git: 커밋과 푸시는 AI가 한다. 커밋 메시지에 서명 줄을 붙이지 않는다 (D-086)
  - 시안 검사: Chrome headless 를 Node 24 내장 WebSocket 으로 조작 (CDP). 일일보고 시안의 Tiptap 묶음은 frontend 에서 `npm run mockup:tiptap` 으로 다시 만든다 (D-162)
  - 이 컴퓨터의 기본 Node 는 14. 프로젝트는 Node 24 (nvm 의 v24.22.2). 사용자 상태 표시줄(남은 컨텍스트)은 ~/.claude/statusline.ps1

---

## 완료

- (없음)
