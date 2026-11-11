# api.md

API의 기준 문서다. API를 추가하거나 바꾸는 작업에서는 이 문서도 함께 갱신한다.

이 문서와 실제 API가 다르면 사용자에게 알린다.

---

## 1. 개요

- **기본 경로**: /api (개발 시 프론트엔드 Vite 개발 서버 5173 → 백엔드 3000 으로 프록시)
- **데이터 형식**: JSON (UTF-8), 요청 본문 최대 100kb (초과 시 400 INVALID_INPUT)
- **인증 방식**: 로그인 쿠키 `todo_session` (httpOnly, SameSite=Strict). 토큰은 DB에 해시로 저장 (D-028, 6.3 로그인 쿠키)
- **날짜 형식**: ISO 8601, UTC (2026-01-01T00:00:00Z). 기간(DATE)은 YYYY-MM-DD
- **성공 상태**: 모든 API 는 성공 시 200
- 정의되지 않은 경로 404 NOT_FOUND, JSON 본문 형식 오류·100kb 초과 400 INVALID_INPUT, 처리되지 않은 서버 오류 500 INTERNAL_ERROR
- 다른 회원의 대상이거나 없는 대상이면 404 NOT_FOUND (있는지 여부를 드러내지 않는다). 경로 id 가 1 이상 정수가 아니면 400 INVALID_INPUT

---

## 2. 네이밍 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 경로 | 소문자 kebab-case, 복수형 명사 | `/api/users` |
| 경로 변수 | `{id}` | `/api/users/{id}` |
| 요청/응답 필드 | camelCase | `userName`, `createdAt` |
| 쿼리 파라미터 | camelCase | `?pageSize=20` |

### 메서드
| 메서드 | 용도 |
|---|---|
| GET | 조회 |
| POST | 생성/수정/삭제 |

---

## 3. 공통 응답 형식

### 성공
```json
{
  "data": {}
}
```

### 실패
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다."
  }
}
```

---

## 4. 오류 코드

| HTTP 상태 | 코드 | 설명 |
|---|---|---|
| 400 | INVALID_INPUT | 입력값이 올바르지 않음 |
| 401 | UNAUTHORIZED | 로그인이 필요함 |
| 403 | FORBIDDEN | 권한이 없음 |
| 404 | NOT_FOUND | 대상이 없음 |
| 500 | INTERNAL_ERROR | 서버 오류 |

<!-- 프로젝트 전용 오류 코드는 이 아래에 추가한다 -->

| HTTP 상태 | 코드 | 설명 |
|---|---|---|
| 409 | LOGIN_ID_DUPLICATED | 이미 사용 중인 아이디 |
| 409 | EMAIL_DUPLICATED | 이미 가입된 이메일 |
| 409 | PHONE_DUPLICATED | 이미 가입된 전화번호 |
| 429 | VERIFICATION_RESEND_TOO_SOON | 인증번호 발송 후 1분이 지나지 않음 |
| 400 | VERIFICATION_CODE_MISMATCH | 인증번호가 틀림 (메시지에 남은 횟수 표시) |
| 400 | VERIFICATION_EXPIRED | 인증번호 유효시간(5분)이 지남 |
| 400 | VERIFICATION_LOCKED | 5번 틀려 인증번호가 무효가 됨 |
| 400 | EMAIL_NOT_VERIFIED | 이메일 인증을 하지 않았거나 인증이 유효하지 않음 |
| 500 | MAIL_SEND_FAILED | 메일 발송 실패 |
| 401 | LOGIN_FAILED | 아이디 또는 비밀번호가 틀림 (어느 쪽인지 알려주지 않음) |
| 423 | LOGIN_LOCKED | 비밀번호를 연속 5번 틀려 10분 동안 로그인 잠김 (메시지에 남은 분 표시) |

---

## 5. API 정의

<!-- API마다 아래 형식을 복사해서 쓴다 -->
### {{메서드}} {{경로}}
- **설명**: 
- **권한**: (overview.md "사용자와 권한" 기준)
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
- **응답 data**:
  | 필드 | 타입 | 설명 |
  |---|---|---|
- **오류**: (4. 오류 코드 중 발생할 수 있는 것)
- **사용 테이블**: (database.md 기준)

---

## 6. 실제 사용할 API
<!-- 실제 API 정의를 이 아래에 작성 -->

### 6.1 GET /api/health
- **설명**: 서버와 DB 접속 상태 확인 (`SELECT 1` 실행)
- **권한**: 누구나
- **응답 data**: `db` string — DB 접속 성공 시 `"ok"`
- **오류**: 500 INTERNAL_ERROR (접속 정보와 원인은 응답에 담지 않는다)

### 6.2 회원가입

#### GET /api/users/login-id-availability
- **설명**: 아이디 중복 확인 ([중복 확인] 버튼, D-038)
- **권한**: 비회원
- **요청** (쿼리): `loginId` string 필수 — 영어와 숫자 모두 포함 6~15자
- **응답 data**: `isAvailable` boolean — 사용할 수 있으면 true
- **오류**: 400 INVALID_INPUT
- **사용 테이블**: users

#### POST /api/email-verifications
- **설명**: 이메일 인증번호 발송. purpose 가 signup 이면 이메일 중복을 먼저 확인하고, 중복이 아닐 때만 6자리 인증번호를 메일로 보낸다 (D-035, D-038)
- **권한**: 비회원
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | email | string | O | D-026 정규식, 최대 100자 |
  | purpose | string | O | signup / find_id / find_password / change_email (각 기능 작업에서 해당 값을 받게 한다) |
- **응답 data**:
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | verificationId | number | 인증 요청 id |
  | expireDate | string | 인증번호 만료 시각 (발송 + 5분) |
  | resendAvailableDate | string | 재발송 가능 시각 (발송 + 1분) |
- **오류**: 400 INVALID_INPUT, 409 EMAIL_DUPLICATED, 429 VERIFICATION_RESEND_TOO_SOON, 500 MAIL_SEND_FAILED
- **사용 테이블**: users, email_verifications
- **재발송**: 같은 이메일·용도로 1분 안에 보낸 기록이 있으면 429. 새로 보내면 이전 인증 기록을 지워 이전 번호는 무효 (D-045). 메일 발송에 실패하면 새 기록을 지운다 (바로 다시 보낼 수 있음)

#### POST /api/email-verifications/{id}/verify
- **설명**: 인증번호 확인. 틀리면 fail_count 를 1 올리고, 5가 되면 무효 (D-035)
- **권한**: 비회원
- **요청**: `code` string 필수 — 숫자 6자리
- **응답 data**: `isVerified` boolean — 인증 성공 시 true
- **오류**: 400 INVALID_INPUT, 400 VERIFICATION_CODE_MISMATCH, 400 VERIFICATION_EXPIRED, 400 VERIFICATION_LOCKED, 404 NOT_FOUND
- **사용 테이블**: email_verifications
- **처리 순서**: 비교 전에 fail_count 를 먼저 1 올리는 원자적 UPDATE(만료 전, 5 미만일 때만) → 맞으면 1 되돌리고 인증 완료. 5번째로 틀리면 VERIFICATION_LOCKED. 이미 5번 틀렸으면 VERIFICATION_LOCKED, 만료되었으면 VERIFICATION_EXPIRED (틀린 횟수는 올리지 않음)

#### POST /api/users
- **설명**: 회원가입. 입력 규칙, 아이디·이메일·전화번호 중복, 이메일 인증 여부를 확인한 뒤 비밀번호를 bcrypt 로 해시해 저장 (D-006, D-042)
- **권한**: 비회원
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | loginId | string | O | 영어와 숫자 모두 포함 6~15자 |
  | password | string | O | 영어+숫자+특수문자 모두 포함 8~15자 |
  | nickname | string | O | 한글·영어·숫자 1~8자 |
  | email | string | O | 인증을 마친 이메일 |
  | phone | string | O | 숫자 11자리 |
  | verificationId | number | O | 인증을 마친 인증 요청 id (email, purpose=signup 과 일치해야 함) |
- **응답 data**: `userId` number — 가입한 회원 id
- **오류**: 400 INVALID_INPUT, 400 EMAIL_NOT_VERIFIED, 409 LOGIN_ID_DUPLICATED, 409 EMAIL_DUPLICATED, 409 PHONE_DUPLICATED
- **사용 테이블**: users, email_verifications
- **인증 유효 시간**: 인증 완료 후 30분 안에 가입 (D-044). 가입에 성공하면 그 이메일의 인증 기록을 지운다
- **처리 순서**: 입력 검사 → 중복 확인(아이디 → 이메일 → 전화번호 순서로 첫 번째 중복만 응답) → 이메일 인증 확인 → 저장(회원 저장 + 인증 기록 삭제를 트랜잭션). 저장 순간 동시 가입으로 UNIQUE 위반이 나면 다시 확인해 해당 중복 오류로 응답

### 6.3 로그인

#### 로그인 쿠키 (공통)
- 이름 `todo_session`, 값은 무작위 토큰(32바이트 base64url). DB(login_tokens)에는 SHA-256 해시만 저장 (D-028)
- httpOnly, SameSite=Strict, Path=/, Max-Age 24시간(86400초), NODE_ENV=production 이면 Secure
- 회원 전용 API 는 로그인 확인 미들웨어(requireLogin)를 거친다: 쿠키가 없거나 토큰이 없거나 만료되었으면 401 UNAUTHORIZED

#### POST /api/sessions
- **설명**: 로그인. 성공하면 로그인 쿠키를 설정하고, 그 회원의 다른 토큰은 지운다 (D-050)
- **권한**: 비회원
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | loginId | string | O | 1~15자 (형식은 검사하지 않음, 대소문자 구분 없음) |
  | password | string | O | 1~15자 |
- **응답 data**: `userId` number, `loginId` string, `nickname` string, `email` string
- **오류**: 400 INVALID_INPUT, 401 LOGIN_FAILED, 423 LOGIN_LOCKED
- **사용 테이블**: users, login_tokens
- **처리 순서 (D-049)**: 아이디로 회원 찾기(없으면 가짜 해시와 비교 후 LOGIN_FAILED) → 비교 전에 login_fail_count 를 먼저 1 올리는 원자적 UPDATE(잠김이거나 이미 5면 못 올림 → LOGIN_LOCKED) → 비밀번호 비교 → 틀리고 5번째면 lock_expire_date = 지금 + 10분, 횟수 0 → LOGIN_LOCKED / 틀리고 5번째 전이면 LOGIN_FAILED / 맞으면 한 트랜잭션에서 다른 토큰 삭제 + 새 토큰 저장 + 횟수·잠금 초기화
- **주의 (이전 프로젝트에서 실제 발생한 버그)**: 잠그기 전에 처리가 멈춰 횟수가 5로 남으면 영구 잠김이 될 수 있다 → 이 경우 그때부터 10분 잠금으로 처리한다

#### POST /api/sessions/logout
- **설명**: 로그아웃. 쿠키의 토큰을 DB 에서 지우고 쿠키를 만료시킨다. 로그인하지 않았어도 성공
- **권한**: 누구나
- **응답 data**: `isLoggedOut` boolean — 항상 true
- **오류**: 없음 (서버 오류만 500)
- **사용 테이블**: login_tokens

#### GET /api/sessions/me
- **설명**: 로그인 확인. 화면 이동 막기(D-051)와 로그인 회원 정보 표시에 쓴다
- **권한**: 회원 (requireLogin)
- **응답 data**: POST /api/sessions 응답과 같음
- **오류**: 401 UNAUTHORIZED
- **사용 테이블**: login_tokens, users

### 6.4 할일

#### 할일 공통
- 모두 회원 전용 (requireLogin). 로그인한 회원 자신의 개인 할일만 다룬다 (팀 할일은 팀 작업 페이지에서 추가)
- 할일 응답 형식 (Todo):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | todoId | number | 할일 id |
  | title | string | 제목 (1~50자) |
  | content | string | 내용 (1~2000자) |
  | startDate | string \| null | 시작일 YYYY-MM-DD (미정이면 null) |
  | endDate | string \| null | 종료일 YYYY-MM-DD (미정이면 null) |
  | isPeriodUndecided | boolean | 기간 미정 여부 |
  | createDate | string | 추가 시각 |
- 할일 요청 형식 (추가·수정 같음):
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | title | string | O | 앞뒤 공백을 지우고 1~50자 |
  | content | string | O | 앞뒤 공백을 지우고 1~2000자 |
  | isPeriodUndecided | boolean | O | 기간 미정 여부 |
  | startDate | string \| null | O | 미정이면 null, 아니면 실제 있는 날짜 YYYY-MM-DD |
  | endDate | string \| null | O | 미정이면 null, 아니면 YYYY-MM-DD, startDate 와 같거나 뒤 |
- DATE 는 문자열로 주고받고 SQL 에서 CAST 한다 (시간대 변환 방지)

| API | 설명 | 요청 | 응답 data | 오류 | 테이블 |
|---|---|---|---|---|---|
| GET /api/personal/todos | 내 개인 할일 목록 (최근 추가 순, D-057) | 없음 | `todos` Todo[] (없으면 빈 배열) | 401 | todos |
| POST /api/personal/todos | 할일 추가 | 할일 요청 형식 | 저장한 Todo | 400, 401 | todos |
| POST /api/todos/{id}/update | 내 할일 수정 (update_date 기록) | 할일 요청 형식 | 수정한 Todo | 400, 401, 404 | todos |
| POST /api/todos/{id}/delete | 내 할일 완전 삭제 (D-056) | 없음 | `isDeleted` true | 400, 401, 404 | todos |

- 수정·삭제는 user_id 조건으로 소유자를 확인한다

### 6.5 작업 (칸반)

#### 작업 공통
- 모두 회원 전용 (requireLogin). 로그인한 회원 자신의 개인 작업만 다룬다 (팀 작업·작업자는 팀 작업 페이지에서 추가, D-060)
- 상태 값: `waiting`(대기) / `progress`(진행) / `done`(완료)
- 순서(sortOrder): 같은 상태 안에서 0 부터, 작을수록 위. 순서를 바꾸는 처리는 그 회원의 작업 범위를 잠그는 한 트랜잭션(UPDLOCK·HOLDLOCK)에서 하고, 바뀐 공간들의 순서를 0 부터 빈틈없이 다시 매긴다
- 완료 시각(doneDate): 완료로 옮기면 그 시각, 완료에서 빠지면 null (D-015, D-066)
- 수정 내역은 작업 생성·내용 수정·상태 변경 때만 남긴다. 같은 공간 안 순서 변경, 바뀐 것 없는 저장은 남기지 않는다 (D-013, D-065, D-067, D-068). 닉네임은 그 시점 로그인 회원의 닉네임
- 작업 응답 형식 (Task):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | taskId | number | 작업 id |
  | title, content, startDate, endDate, isPeriodUndecided | | Todo 와 같은 형식 |
  | status | string | 상태 |
  | sortOrder | number | 같은 상태 안의 순서 |
  | doneDate | string \| null | 완료로 옮긴 시각 (완료가 아니면 null) |
  | updateDate | string \| null | 마지막 수정 시각 (수정 전이면 null) |
  | createDate | string | 작업 시작 시각 |
- 수정 내역 응답 형식 (TaskLog):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | logId | number | 수정 내역 id |
  | logType | string | `create`(작업 생성) / `update`(작업 수정) / `status`(상태 변경) |
  | beforeStatus | string \| null | 바뀌기 전 상태 (상태가 바뀐 기록만. update 이면서 값이 있으면 "작업 수정 · 상태 변경", D-067) |
  | nickname | string | 그 시점 닉네임 |
  | title, content, startDate, endDate, isPeriodUndecided, status | | 그 시점 작업 내용 (status 는 바뀐 뒤 상태) |
  | createDate | string | 기록 시각 |

#### GET /api/personal/tasks
- **설명**: 내 개인 작업 목록. 상태(대기 → 진행 → 완료) 순, 같은 상태 안에서는 sortOrder 순
- **응답 data**: `tasks` Task[] (없으면 빈 배열)
- **오류**: 401
- **사용 테이블**: tasks

#### POST /api/todos/{id}/start
- **설명**: 작업 시작 (D-018). 내 할일을 지우고 같은 내용의 작업을 대기 공간 맨 위에 만든다 (D-059, D-064). 대기 공간의 다른 작업은 순서가 1씩 밀린다. "작업 생성" 수정 내역을 남긴다. 모두 한 트랜잭션
- **권한**: 회원 (자기 할일만)
- **응답 data**: 만든 Task
- **오류**: 400, 401, 404 (없거나 이미 시작한 할일)
- **사용 테이블**: todos, tasks, task_logs

#### GET /api/tasks/{id}/logs
- **설명**: 내 작업의 수정 내역. 최근 것이 위 (D-070)
- **응답 data**: `logs` TaskLog[] (작업 생성 기록이 있으므로 1개 이상)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs

#### POST /api/tasks/{id}/update
- **설명**: 상세 UI 의 작업 수정 (D-062). 제목·내용·기간·상태를 한 번에 저장
- **요청**: 할일 요청 형식 + `status` string 필수 (waiting / progress / done)
- **응답 data**: 저장한 Task (바뀐 것이 없으면 그대로의 Task)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs
- **처리**: 한 트랜잭션에서 작업을 잠그고 지금 값과 비교한다
  - 바뀐 것 없음: 아무것도 저장하지 않는다 (D-068)
  - 내용(제목·내용·기간)만 바뀜: 저장, update_date, 수정 내역 `update`
  - 상태만 바뀜: 옮겨 간 공간 맨 위(D-069), 떠난 공간 순서 다시 매김, 완료 시각 처리, update_date, 수정 내역 `status`
  - 둘 다 바뀜: 위 두 가지를 함께 하고 수정 내역은 한 줄 `update` + beforeStatus (D-067)

#### POST /api/tasks/{id}/move
- **설명**: 칸반 드래그. 작업을 status 공간의 index 자리에 놓는다 (D-069)
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | status | string | O | 놓은 공간 waiting / progress / done |
  | index | number | O | 놓은 공간 안의 자리 (0 이 맨 위, 0 이상 정수). 옮기는 작업을 뺀 그 공간의 작업 수보다 크면 맨 아래 |
- **응답 data**: `tasks` Task[] — 옮긴 뒤 내 작업 목록 전체 (화면이 서버 순서로 다시 그리도록)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs
- **처리**: 한 트랜잭션. 같은 공간이면 순서만 바꾸고 수정 내역·update_date 를 남기지 않는다 (D-013). 다른 공간이면 상태, 완료 시각, update_date 를 바꾸고 수정 내역 `status` 를 남긴다

#### POST /api/tasks/{id}/delete
- **설명**: 내 작업 완전 삭제 (D-023). 수정 내역도 함께 지워지고, 그 공간의 순서를 다시 매긴다
- **응답 data**: `isDeleted` true
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs


### 6.6 아직 설계하지 않은 API
- 팀 생성/관리 (overview.md 8.7의 승인된 계획 참고), 팀 초대/알림, 팀 작업 페이지, 실시간 반영(Socket.IO 이벤트), 캘린더, 히스토리, 아이디/비밀번호 찾기, 회원정보 수정/탈퇴
