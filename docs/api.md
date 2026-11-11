# api.md

API의 기준 문서다. API를 추가하거나 바꾸는 작업에서는 이 문서도 함께 갱신한다.

이 문서와 실제 API가 다르면 사용자에게 알린다.

---

## 1. 개요

- **기본 경로**: /api (개발 시 프론트엔드 Vite 개발 서버 5173 → 백엔드 3000 으로 프록시)
- **데이터 형식**: JSON (UTF-8), 요청 본문 최대 100kb (초과 시 400 INVALID_INPUT). 일일보고 저장·양식 저장 API 만 512kb (6.12, D-161)
- **인증 방식**: 로그인 쿠키 `todo_session` (httpOnly, SameSite=Strict). 토큰은 DB에 해시로 저장 (D-028, 6.3 로그인 쿠키)
- **날짜 형식**: ISO 8601, UTC (2026-01-01T00:00:00Z). 기간(DATE)은 YYYY-MM-DD
- **오늘 날짜**: 서버가 "오늘"을 정해야 할 때(마감 임박 알림 D-128, 일일보고 D-158)는 한국 시간(Asia/Seoul) 날짜를 쓴다
- **성공 상태**: 모든 API 는 성공 시 200
- 정의되지 않은 경로 404 NOT_FOUND, JSON 본문 형식 오류·100kb 초과 400 INVALID_INPUT, 처리되지 않은 서버 오류 500 INTERNAL_ERROR
- 보안 응답 헤더: 모든 응답에 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` 를 붙이고 `X-Powered-By` 는 끈다 (security.md 11 의 27번). CORS 는 열지 않는다 (개발은 Vite 프록시, 같은 출처)
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
| 409 | TEAM_LIMIT_EXCEEDED | 가입된 팀이 이미 20개라 팀을 만들거나 가입할 수 없음 (D-078) |
| 404 | EMAIL_NOT_REGISTERED | 가입되지 않은 이메일 (아이디 찾기, D-117) |
| 404 | ACCOUNT_NOT_FOUND | 아이디와 이메일이 일치하는 회원이 없음 (비밀번호 찾기, D-115) |
| 429 | INVITATION_RECENTLY_DECLINED | 초대를 거절한 지 24시간이 지나지 않은 회원 (D-121) |
| 400 | CURRENT_PASSWORD_MISMATCH | 현재 비밀번호가 틀림 (D-130) |
| 409 | TEAM_OWNER_CANNOT_WITHDRAW | 다른 팀원이 있는 팀의 관리자라 탈퇴할 수 없음 (D-131) |
| 409 | TASK_IN_HISTORY | 히스토리로 옮겨진 작업은 바꾸거나 옮기거나 지울 수 없음 (D-113) |
| 400 | TEAM_NAME_MISMATCH | 팀 해체 시 입력한 팀 이름이 실제 팀 이름과 다름 (D-080) |
| 404 | USER_NOT_FOUND | 초대한 이메일로 가입된 회원이 없음 (D-092) |
| 409 | ALREADY_TEAM_MEMBER | 초대한 회원이 이미 그 팀의 팀원임 |
| 409 | INVITATION_DUPLICATED | 그 회원에게 답을 기다리는 그 팀의 초대가 이미 있음 (D-093) |
| 409 | REPORT_NOT_TODAY | 오늘(한국 시간)이 아닌 날짜의 일일보고를 저장하려 함. 자정이 지난 경우 (D-158) |
| 409 | REPORT_ALREADY_SUBMITTED | 이미 제출한 일일보고를 임시저장하려 함 (D-157) |

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

### 6.2 회원가입, 아이디·비밀번호 찾기

#### GET /api/users/login-id-availability
- **설명**: 아이디 중복 확인 ([중복 확인] 버튼, D-038)
- **권한**: 비회원
- **요청** (쿼리): `loginId` string 필수 — 영어와 숫자 모두 포함 6~15자
- **응답 data**: `isAvailable` boolean — 사용할 수 있으면 true
- **오류**: 400 INVALID_INPUT
- **사용 테이블**: users

#### POST /api/email-verifications
- **설명**: 이메일 인증번호 발송. purpose 에 따라 먼저 확인한 뒤 6자리 인증번호를 메일로 보낸다 (D-035, D-038, D-117)
  - signup: 이메일이 이미 가입되어 있으면 409 EMAIL_DUPLICATED. 메일 제목 "[TODO] 회원가입 인증번호"
  - find_id: 가입되지 않은 이메일이면 404 EMAIL_NOT_REGISTERED. 메일 제목 "[TODO] 아이디 찾기 인증번호"
  - find_password: loginId 와 email 이 같은 회원이 아니면 404 ACCOUNT_NOT_FOUND. 메일 제목 "[TODO] 비밀번호 찾기 인증번호"
  - change_email: 로그인한 회원만 (requireLogin, 아니면 401). 이메일이 이미 가입되어 있으면(내 이메일 포함) 409 EMAIL_DUPLICATED. 메일 제목 "[TODO] 이메일 변경 인증번호" (D-021, D-129)
  - 메일 모양은 모두 D-046 과 같고, 제목 줄의 문구만 용도에 맞게 바꾼다
- **권한**: 비회원 (purpose 가 change_email 이면 회원)
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | email | string | O | D-026 정규식, 최대 100자 |
  | purpose | string | O | signup / find_id / find_password / change_email |
  | loginId | string | find_password 일 때 O | 1~15자 (형식은 검사하지 않음, 대소문자 구분 없음). 다른 용도면 보내지 않는다 (보내면 400) |
- **응답 data**:
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | verificationId | number | 인증 요청 id |
  | expireDate | string | 인증번호 만료 시각 (발송 + 5분) |
  | resendAvailableDate | string | 재발송 가능 시각 (발송 + 1분) |
- **오류**: 400 INVALID_INPUT, 404 EMAIL_NOT_REGISTERED, 404 ACCOUNT_NOT_FOUND, 409 EMAIL_DUPLICATED, 429 VERIFICATION_RESEND_TOO_SOON, 500 MAIL_SEND_FAILED
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

#### POST /api/users/find-id
- **설명**: 아이디 찾기 결과 (D-020, D-114). 인증을 마친 인증 요청으로 그 이메일 회원의 아이디와 가입일을 돌려준다
- **권한**: 비회원
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | email | string | O | 인증을 마친 이메일 (D-026 정규식, 최대 100자) |
  | verificationId | number | O | 인증을 마친 인증 요청 id (email, purpose=find_id 와 일치해야 함) |
- **응답 data**: `loginId` string — 아이디 전체, `createDate` string — 가입 시각
- **오류**: 400 INVALID_INPUT, 400 EMAIL_NOT_VERIFIED, 404 EMAIL_NOT_REGISTERED (그사이 탈퇴)
- **사용 테이블**: users, email_verifications
- **인증 유효 시간**: 인증 완료 후 30분 (D-044 와 같음). 성공하면 그 이메일의 find_id 인증 기록을 지운다 (한 번만 쓴다)

#### POST /api/users/reset-password
- **설명**: 비밀번호 재설정 (D-020, D-115, D-116). 아이디·이메일이 같은 회원인지와 이메일 인증을 다시 확인하고 새 비밀번호를 bcrypt 로 저장한다
- **권한**: 비회원
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | loginId | string | O | 1~15자 (대소문자 구분 없음) |
  | email | string | O | 인증을 마친 이메일 |
  | verificationId | number | O | 인증을 마친 인증 요청 id (email, purpose=find_password 와 일치해야 함) |
  | password | string | O | 새 비밀번호, 영어+숫자+특수문자 모두 포함 8~15자 (overview.md 8.1) |
- **응답 data**: `isReset` boolean — 항상 true
- **오류**: 400 INVALID_INPUT, 400 EMAIL_NOT_VERIFIED, 404 ACCOUNT_NOT_FOUND
- **사용 테이블**: users, email_verifications, login_tokens
- **인증 유효 시간**: 인증 완료 후 30분 (D-044, D-116)
- **처리 순서**: 입력 검사 → 아이디·이메일 회원 확인 → 인증 확인 → 한 트랜잭션에서 비밀번호 해시 저장 + login_fail_count 0 + lock_expire_date NULL + 그 회원의 login_tokens 모두 삭제 + 그 이메일의 find_password 인증 기록 삭제 → 커밋 뒤 그 회원의 실시간 연결을 모두 끊는다 (D-116)
- 새 비밀번호가 예전 비밀번호와 같아도 막지 않는다

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
- 모두 회원 전용 (requireLogin)
- 공간 권한 (할일·작업 공통): 개인 공간 대상은 소유자(user_id)만, 팀 공간 대상은 그 팀의 팀원(역할 상관없이, D-030)만 다룬다. 아니면 404 NOT_FOUND. id 로 다루는 API(/api/todos/{id}/..., /api/tasks/{id}/...)는 대상의 공간을 읽어 이 규칙으로 확인한다
- 할일 응답 형식 (Todo):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | todoId | number | 할일 id |
  | title | string | 제목 (1~50자) |
  | content | string | 내용 (1~2000자) |
  | startDate | string \| null | 시작일 YYYY-MM-DD (미정이면 null) |
  | endDate | string \| null | 종료일 YYYY-MM-DD (미정이면 null) |
  | startTime | string \| null | 시작 시각 HH:mm (시간 지정 안 함·미정이면 null, D-135) |
  | endTime | string \| null | 종료 시각 HH:mm (시간 지정 안 함·미정이면 null) |
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
  | startTime | string \| null | O | 시간 지정 안 함·미정이면 null, 아니면 HH:mm (00:00~23:55, 분은 5의 배수, D-136) |
  | endTime | string \| null | O | startTime 과 함께 null 이거나 함께 값. 같은 날이면 startTime 과 같거나 뒤 |
- DATE·TIME 은 문자열로 주고받고 SQL 에서 CAST 한다 (시간대 변환 방지). 시간은 입력한 한국 시간 그대로 (D-135)

| API | 설명 | 요청 | 응답 data | 오류 | 테이블 |
|---|---|---|---|---|---|
| GET /api/personal/todos | 내 개인 할일 목록 (최근 추가 순, D-057) | 없음 | `todos` Todo[] (없으면 빈 배열) | 401 | todos |
| POST /api/personal/todos | 개인 할일 추가 | 할일 요청 형식 | 저장한 Todo | 400, 401 | todos |
| GET /api/teams/{id}/todos | 팀 할일 목록 (최근 추가 순) | 없음 | `todos` Todo[] (없으면 빈 배열) | 400, 401, 404 | todos, team_members |
| POST /api/teams/{id}/todos | 팀 할일 추가 | 할일 요청 형식 | 저장한 Todo | 400, 401, 404 | todos, team_members |
| POST /api/todos/{id}/update | 할일 수정 (update_date 기록) | 할일 요청 형식 | 수정한 Todo | 400, 401, 404 | todos, team_members |
| POST /api/todos/{id}/delete | 할일 완전 삭제 (D-056) | 없음 | `isDeleted` true | 400, 401, 404 | todos, team_members |

- 수정·삭제는 공간 권한으로 확인한다 (개인: user_id, 팀: 팀원 여부)

### 6.5 작업 (칸반)

#### 작업 공통
- 모두 회원 전용 (requireLogin). 공간 권한은 6.4 할일 공통과 같다
- 작업자는 팀 공간 작업에만 있다 (D-060, D-097). 개인 공간 작업의 assignees 는 항상 빈 배열
- 상태 값: `waiting`(대기) / `progress`(진행) / `done`(완료)
- 순서(sortOrder): 같은 공간·같은 상태 안에서 0 부터, 작을수록 위. 순서를 바꾸는 처리는 그 공간(개인: 그 회원, 팀: 그 팀)의 작업 범위를 잠그는 한 트랜잭션(UPDLOCK·HOLDLOCK)에서 하고, 바뀐 공간들의 순서를 0 부터 빈틈없이 다시 매긴다
- 완료 시각(doneDate): 완료로 옮기면 그 시각, 완료에서 빠지면 null (D-015, D-066)
- 히스토리 작업(완료 + 완료 시각부터 7일 지남, D-113)은 작업 목록에 넣지 않고, 수정·드래그·삭제하면 409 TASK_IN_HISTORY. 완료 공간의 순서·index 는 히스토리 작업을 뺀 기준. 수정 내역 조회는 된다 (히스토리 상세 모달)
- 수정 내역은 작업 생성·내용 수정·작업자 변경·상태 변경 때만 남긴다. 같은 공간 안 순서 변경, 바뀐 것 없는 저장은 남기지 않는다 (D-013, D-065, D-067, D-068, D-099). 닉네임은 그 시점 로그인 회원의 닉네임. 기록마다 그 시점 작업자 닉네임을 task_log_assignees 에 저장한다
- 작업 응답 형식 (Task):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | taskId | number | 작업 id |
  | title, content, startDate, endDate, startTime, endTime, isPeriodUndecided | | Todo 와 같은 형식 |
  | status | string | 상태 |
  | sortOrder | number | 같은 상태 안의 순서 |
  | assignees | { userId: number, nickname: string }[] | 작업자 (지정한 순, 지금 닉네임). 없으면 빈 배열 |
  | doneDate | string \| null | 완료로 옮긴 시각 (완료가 아니면 null) |
  | updateDate | string \| null | 마지막 수정 시각 (수정 전이면 null) |
  | createDate | string | 작업 시작 시각 |
- 수정 내역 응답 형식 (TaskLog):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | logId | number | 수정 내역 id |
  | logType | string | `create`(작업 생성) / `change`(변경) |
  | isContentChanged | boolean | 제목·내용·기간이 바뀜 ("작업 수정") |
  | isAssigneeChanged | boolean | 작업자가 바뀜 ("작업자 변경", D-099) |
  | beforeStatus | string \| null | 바뀌기 전 상태 (상태가 바뀐 기록만, "상태 변경 (대기 → 진행)"). 바뀐 것을 "작업 수정 · 작업자 변경 · 상태 변경" 순서로 이어 쓴다 (D-067, D-100) |
  | nickname | string | 그 시점 닉네임 |
  | title, content, startDate, endDate, startTime, endTime, isPeriodUndecided, status | | 그 시점 작업 내용 (status 는 바뀐 뒤 상태) |
  | assigneeNicknames | string[] | 그 시점 작업자 닉네임 (없으면 빈 배열) |
  | createDate | string | 기록 시각 |

#### GET /api/personal/tasks
- **설명**: 내 개인 작업 목록 (히스토리 작업 제외). 상태(대기 → 진행 → 완료) 순, 같은 상태 안에서는 sortOrder 순
- **응답 data**: `tasks` Task[] (없으면 빈 배열)
- **오류**: 401
- **사용 테이블**: tasks, task_assignees, users

#### GET /api/teams/{id}/tasks
- **설명**: 팀 작업 목록 (히스토리 작업 제외). 정렬은 GET /api/personal/tasks 와 같다
- **권한**: 그 팀의 팀원
- **응답 data**: `tasks` Task[] (없으면 빈 배열)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_assignees, users, team_members

#### POST /api/todos/{id}/start
- **설명**: 작업 시작 (D-018). 할일을 지우고 같은 공간에 같은 내용의 작업을 대기 공간 맨 위에 만든다 (D-059, D-064). 작업자는 없다. 대기 공간의 다른 작업은 순서가 1씩 밀린다. "작업 생성" 수정 내역을 남긴다. 모두 한 트랜잭션
- **권한**: 공간 권한 (개인: 소유자, 팀: 팀원)
- **응답 data**: 만든 Task
- **오류**: 400, 401, 404 (없거나 이미 시작한 할일)
- **사용 테이블**: todos, tasks, task_logs

#### GET /api/tasks/{id}/logs
- **설명**: 작업의 수정 내역. 최근 것이 위 (D-070)
- **응답 data**: `logs` TaskLog[] (작업 생성 기록이 있으므로 1개 이상)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs, task_log_assignees

#### POST /api/tasks/{id}/update
- **설명**: 상세 UI 의 작업 수정 (D-062). 제목·내용·기간·상태·작업자를 한 번에 저장
- **요청**: 할일 요청 형식 + `status` string 필수 (waiting / progress / done) + `assigneeUserIds` number[] 필수 — 작업자 회원 id (1 이상 정수, 중복 없이, 그 팀의 지금 팀원만, 개인 공간 작업이면 빈 배열만). 아니면 400 INVALID_INPUT. 순서는 지정한 순서로 저장한다
- **응답 data**: 저장한 Task (바뀐 것이 없으면 그대로의 Task)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_assignees, task_logs, task_log_assignees, team_members
- **처리**: 한 트랜잭션에서 작업을 잠그고 지금 값과 비교한다. 작업자는 순서와 상관없이 같은 회원들이면 바뀌지 않은 것으로 본다
  - 바뀐 것 없음: 아무것도 저장하지 않는다 (D-068)
  - 내용(제목·내용·기간)이 바뀜: 저장, isContentChanged
  - 작업자가 바뀜: task_assignees 를 요청한 목록으로 바꾼다, isAssigneeChanged (D-099)
  - 상태가 바뀜: 옮겨 간 공간 맨 위(D-069), 떠난 공간 순서 다시 매김, 완료 시각 처리, beforeStatus
  - 하나라도 바뀌면 update_date 를 바꾸고 수정 내역 `change` 한 줄 (바뀐 것을 모두 표시, D-067, D-100)
  - 알림: 새로 들어간 작업자 중 나 아닌 회원에게 task_assigned 알림 (D-127). 완료로 바뀌거나 기간(날짜·시간)이 바뀌면 그 작업의 due_soon 알림을 모두 지우고, 작업자에서 빠진 회원의 due_soon 알림을 지운다 (D-128). 커밋 뒤 알림이 바뀐 회원에게 `notifications:changed`

#### POST /api/tasks/{id}/move
- **설명**: 칸반 드래그. 작업을 그 작업 공간(개인/팀)의 status 공간 index 자리에 놓는다 (D-069)
- **요청**:
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | status | string | O | 놓은 공간 waiting / progress / done |
  | index | number | O | 놓은 공간 안의 자리 (0 이 맨 위, 0 이상 정수). 옮기는 작업을 뺀 그 공간의 작업 수보다 크면 맨 아래 |
- **응답 data**: `tasks` Task[] — 옮긴 뒤 그 공간의 작업 목록 전체 (화면이 서버 순서로 다시 그리도록)
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs
- **처리**: 한 트랜잭션. 같은 상태 공간이면 순서만 바꾸고 수정 내역·update_date 를 남기지 않는다 (D-013). 다른 상태 공간이면 상태, 완료 시각, update_date 를 바꾸고 수정 내역 `change` + beforeStatus 를 남긴다. 완료로 옮기면 그 작업의 due_soon 알림을 지운다 (D-128)

#### POST /api/tasks/{id}/delete
- **설명**: 작업 완전 삭제 (D-023). 그 작업의 알림을 먼저 지우고(database.md notifications), 수정 내역·작업자도 함께 지워지고, 그 공간의 순서를 다시 매긴다
- **응답 data**: `isDeleted` true
- **오류**: 400, 401, 404
- **사용 테이블**: tasks, task_logs



### 6.6 팀 생성/관리

#### 팀 공통
- 모두 회원 전용 (requireLogin)
- 경로의 팀에 로그인한 회원이 속하지 않았거나 팀이 없으면 404 NOT_FOUND (있는지 여부를 드러내지 않는다)
- 팀에 속했지만 역할 권한이 없으면 403 FORBIDDEN. 권한은 아래 표를 서버에서 확인한다 (D-030). 화면은 할 수 있는 버튼만 보여주지만 서버 확인을 대신하지 않는다

  | 동작 | 관리자 (owner) | 부관리자 (manager) | 팀원 (member) |
  |---|---|---|---|
  | 팀 정보·팀원 목록 보기 | O | O | O |
  | 팀 이름 수정 | O | O | X |
  | 팀원(member) 내보내기 | O | O | X |
  | 부관리자(manager) 내보내기 | O | X | X |
  | 부관리자 지정·해제 | O | X | X |
  | 관리자 넘기기 | O | X | X |
  | 팀 탈퇴 | X (넘긴 뒤 가능, D-019) | O | O |
  | 팀 해체 | O | X | X |

- 자기 자신은 내보내기·역할 변경·관리자 넘기기 대상이 될 수 없다 (400 INVALID_INPUT). 관리자는 내보내기·역할 변경 대상이 될 수 없다 (403 FORBIDDEN)
- 대상 회원이 그 팀에 없으면 404 NOT_FOUND
- 역할·팀원을 바꾸는 처리(내보내기, 역할 변경, 관리자 넘기기, 탈퇴, 해체)는 한 트랜잭션에서 그 팀의 team_members 행을 잠그고(UPDLOCK·HOLDLOCK) 내 역할을 다시 읽어 권한을 확인한 뒤 바꾼다 (동시 변경 대비)
- 가입된 팀 수(D-078)는 한 트랜잭션에서 그 회원의 users 행을 잠그고 team_members 를 센다. 20개면 409 TEAM_LIMIT_EXCEEDED
- 팀 이름: 앞뒤 공백을 지우고 1~20자 (D-071)
- 팀 응답 형식 (Team):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | teamId | number | 팀 id |
  | name | string | 팀 이름 |
  | myRole | string | 내 역할 (owner / manager / member) |
- 팀 정보 응답 형식 (TeamDetail): Team 의 모든 필드 +
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | ownerNickname | string | 관리자 닉네임 |
  | memberCount | number | 팀원 수 (관리자 포함) |
  | createDate | string | 팀을 만든 시각 |
- 팀원 응답 형식 (TeamMember):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | userId | number | 회원 id |
  | nickname | string | 닉네임 |
  | email | string | 이메일 |
  | role | string | 역할 (owner / manager / member) |
  | joinDate | string | 합류 시각 (team_members.create_date) |

#### GET /api/teams
- **설명**: 내가 속한 팀 목록 (좌측 네비). 내 sort_order 순 (나중에 합류한 팀이 위, 드래그로 바꾼 순서, D-089)
- **응답 data**: `teams` Team[] (없으면 빈 배열)
- **오류**: 401
- **사용 테이블**: teams, team_members

#### POST /api/teams
- **설명**: 팀 만들기 (D-073). 만든 회원을 관리자(owner)로 넣고 그 회원의 팀 목록 맨 위(sort_order 0, 다른 팀은 1씩 밂)에 둔다 (D-089). 일일보고 기본 양식(6.12)도 만든다 (D-152). 가입된 팀 수 확인 + 팀 저장 + 관리자 저장 + 순서 밀기 + 기본 양식 저장을 한 트랜잭션
- **요청**: `name` string 필수 — 팀 이름 규칙
- **응답 data**: 만든 Team (myRole = owner)
- **오류**: 400 INVALID_INPUT, 401, 409 TEAM_LIMIT_EXCEEDED
- **사용 테이블**: users, teams, team_members, report_templates

#### POST /api/teams/{id}/move
- **설명**: 좌측 네비 팀 목록 드래그 (D-089). 내 팀 목록에서 그 팀을 index 자리에 놓는다. 다른 회원의 순서에는 영향이 없다
- **요청**: `index` number 필수 — 놓은 자리 (0 이 맨 위, 0 이상 정수). 옮기는 팀을 뺀 내 팀 수보다 크면 맨 아래
- **응답 data**: `teams` Team[] — 옮긴 뒤 내 팀 목록 전체
- **오류**: 400, 401, 404
- **사용 테이블**: teams, team_members
- **처리**: 한 트랜잭션에서 내 users 행을 잠그고 내 team_members 행의 sort_order 를 0 부터 빈틈없이 다시 매긴다

#### GET /api/teams/{id}
- **설명**: 팀 정보 카드 (D-081)
- **응답 data**: TeamDetail
- **오류**: 400, 401, 404
- **사용 테이블**: teams, team_members, users

#### GET /api/teams/{id}/members
- **설명**: 팀원 게시판. 관리자 → 부관리자 → 팀원 순, 같은 역할은 먼저 합류한 순 (D-076, D-079)
- **응답 data**: `members` TeamMember[] (관리자가 있으므로 1명 이상)
- **오류**: 400, 401, 404
- **사용 테이블**: team_members, users

#### POST /api/teams/{id}/update
- **설명**: 팀 이름 수정. 관리자·부관리자
- **요청**: `name` string 필수 — 팀 이름 규칙
- **응답 data**: 수정한 TeamDetail
- **오류**: 400, 401, 403, 404
- **사용 테이블**: teams, team_members, users

#### POST /api/teams/{id}/members/{userId}/remove
- **설명**: 팀원 내보내기. 관리자는 부관리자·팀원을, 부관리자는 팀원만 내보낼 수 있다 (D-030)
- **응답 data**: `members` TeamMember[] — 내보낸 뒤 팀원 목록
- **오류**: 400, 401, 403, 404
- **사용 테이블**: team_members, users, tasks, task_assignees, task_logs, task_log_assignees
- **작업자 정리 (D-100)**: 같은 트랜잭션에서 그 팀 작업의 작업자에서 대상 회원을 빼고, 빠진 작업마다 update_date 를 바꾸고 수정 내역 `change` + isAssigneeChanged 를 남긴다 (닉네임은 내보낸 회원, D-148). 대상 회원이 받은 그 팀의 task_assigned·due_soon 알림도 지운다 (D-127)

#### POST /api/teams/{id}/members/{userId}/role
- **설명**: 부관리자 지정·해제. 관리자만
- **요청**: `role` string 필수 — manager(지정) / member(해제)
- **응답 data**: `members` TeamMember[] — 바꾼 뒤 팀원 목록
- **오류**: 400, 401, 403, 404
- **사용 테이블**: team_members, users
- **처리**: 대상의 역할이 이미 요청한 역할이면 바꾸지 않고 성공

#### POST /api/teams/{id}/owner
- **설명**: 관리자 넘기기. 관리자만. 대상은 부관리자·팀원 누구나 (D-030). 대상은 owner, 원래 관리자는 manager 가 된다 (D-077). 한 트랜잭션
- **요청**: `userId` number 필수 — 새 관리자 회원 id (1 이상 정수)
- **응답 data**: TeamDetail (myRole = manager) + `members` TeamMember[]
- **오류**: 400, 401, 403, 404
- **사용 테이블**: teams, team_members, users
- **처리**: 관리자 1명 UNIQUE 필터 인덱스 때문에 원래 관리자를 먼저 manager 로 바꾼 뒤 대상을 owner 로 바꾼다

#### POST /api/teams/{id}/leave
- **설명**: 팀 탈퇴. 부관리자·팀원. 관리자는 관리자를 넘긴 뒤에만 탈퇴할 수 있고, 혼자 남은 팀은 팀 해체로 나간다 (D-019)
- **응답 data**: `isLeft` true
- **오류**: 400, 401, 403 (관리자), 404
- **사용 테이블**: team_members, tasks, task_assignees, task_logs, task_log_assignees
- **작업자 정리 (D-100)**: 내보내기와 같다 (닉네임은 탈퇴한 회원 본인, D-148). 내가 받은 그 팀의 task_assigned·due_soon 알림도 지운다

#### POST /api/teams/{id}/delete
- **설명**: 팀 해체. 관리자만. 서버도 팀 이름을 다시 확인한다 (D-075, D-080). 팀과 관련된 정보를 모두 지운다
- **요청**: `name` string 필수 — 확인용 팀 이름 (앞뒤 공백을 지우고 비교, 1~20자)
- **응답 data**: `isDeleted` true
- **오류**: 400 INVALID_INPUT, 400 TEAM_NAME_MISMATCH, 401, 403, 404
- **사용 테이블**: teams, notifications (그 팀 작업의 알림을 먼저 지운다). team_members, notifications, team_invite_declines, 팀 todos·tasks·task_assignees·task_logs·task_log_assignees, report_templates, daily_reports 는 ON DELETE CASCADE

### 6.7 팀 초대/알림

#### 초대/알림 공통
- 모두 회원 전용 (requireLogin)
- 알림 응답 형식 (Notification):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | notificationId | number | 알림 id |
  | notificationType | string | 종류 team_invite(팀 초대) / task_assigned(작업자 지정) / due_soon(마감 임박) |
  | teamId | number \| null | 팀 id (개인 작업의 마감 임박이면 null) |
  | teamName | string \| null | 팀의 지금 이름 |
  | taskId | number \| null | 작업 id (팀 초대면 null) |
  | taskTitle | string \| null | 작업의 지금 제목 |
  | taskEndDate | string \| null | 작업의 지금 종료일 YYYY-MM-DD (마감 임박만) |
  | taskEndTime | string \| null | 작업의 지금 종료 시각 HH:mm (마감 임박이고 시간이 있을 때만, D-138) |
  | senderNickname | string \| null | 보낸 회원의 그 시점 닉네임 (마감 임박이면 null) |
  | isRead | boolean | 알림 창에서 본 여부 |
  | createDate | string | 알림 시각 |
- 알림은 받는 회원 자신의 것만 다룬다. 남의 알림 id 면 404 NOT_FOUND

#### POST /api/teams/{id}/invitations
- **설명**: 팀 초대. 팀원 누구나 (D-008). 이메일로 회원을 찾아 팀 초대 알림을 만들고 안내 메일을 보낸다 (D-009)
- **요청**: `email` string 필수 — D-026 정규식, 최대 100자 (앞뒤 공백을 지우고 대소문자 구분 없이 찾는다)
- **응답 data**: `isMailSent` boolean — 안내 메일 발송 성공 여부
- **오류**: 400 INVALID_INPUT, 401, 404 NOT_FOUND (팀), 404 USER_NOT_FOUND, 409 ALREADY_TEAM_MEMBER (자기 자신 포함), 409 INVITATION_DUPLICATED, 429 INVITATION_RECENTLY_DECLINED
- **사용 테이블**: teams, team_members, users, notifications, team_invite_declines
- **처리 순서**: 입력 검사 → 내가 팀원인지 확인 → 이메일로 회원 찾기 → 이미 팀원인지 → 답을 기다리는 초대가 있는지 → 24시간 안에 거절했는지 (429 INVITATION_RECENTLY_DECLINED, D-121. 24시간 지난 거절 기록은 이때 지운다) → 알림 저장 (sender_user_id = 나) (동시 요청으로 UNIQUE 위반이 나면 INVITATION_DUPLICATED) → 안내 메일 발송
- **가입된 팀 20개 제한**: 초대할 때는 확인하지 않고 수락할 때 확인한다 (D-078)
- **메일 발송 실패**: 초대(알림)는 그대로 두고 `isMailSent` false 로 응답한다. 수락·거절은 사이트 알림에서 하므로 초대는 유효하다
- **안내 메일** (D-009): 보낸 사람 이름 "TODO"(주소 MAIL_USER), 제목 "[TODO] 팀 초대 안내". 본문 "{초대한 닉네임}님이 {팀 이름} 팀에 초대했습니다. TODO 에 로그인한 뒤 왼쪽 위 알림(종 아이콘)에서 수락하거나 거절해 주세요." HTML 본문(인증 메일과 같은 모양, 기본색 제목)과 텍스트 본문을 함께 보낸다. 닉네임·팀 이름은 HTML 이스케이프한다

#### GET /api/teams/{id}/invitations
- **설명**: 그 팀의 답을 기다리는 초대 목록 (D-120). 팀원 누구나. 최근 것이 위
- **응답 data**: `invitations` { notificationId: number, nickname: string, email: string, senderNickname: string, canCancel: boolean, createDate: string }[] — nickname·email 은 받는 회원, canCancel 은 내가 취소할 수 있는지 (초대한 회원 본인 또는 관리자·부관리자)
- **오류**: 400, 401, 404
- **사용 테이블**: notifications, users, team_members

#### POST /api/teams/{id}/invitations/{notificationId}/cancel
- **설명**: 초대 취소 (D-120). 초대한 회원 본인 또는 관리자·부관리자. 알림을 지우고 받는 회원에게 `notifications:changed`. 거절 기록은 남기지 않는다
- **응답 data**: `invitations` — 취소한 뒤 목록 (GET 과 같은 형식)
- **오류**: 400, 401, 403 (권한 없음), 404 (팀이 아니거나 이미 없는 초대)
- **사용 테이블**: notifications, users, team_members

#### POST /api/notifications/{id}/delete
- **설명**: 작업자 지정·마감 임박 알림 지우기 ([X], D-127, D-128). 팀 초대는 수락·거절로만 지운다 (team_invite 면 400 INVALID_INPUT)
- **응답 data**: `unreadCount` number
- **오류**: 400, 401, 404
- **사용 테이블**: notifications

#### GET /api/notifications
- **설명**: 내 알림 목록 (알림 창). 최근 것이 위. 목록을 만들기 전에 마감 임박 알림을 만든다 (아래)
- **응답 data**: `notifications` Notification[] (없으면 빈 배열), `unreadCount` number — 안 본 알림 수 (D-096)
- **오류**: 401
- **사용 테이블**: notifications, teams, tasks, task_assignees
- **마감 임박 알림 만들기 (D-128, D-138)**: 예약 작업 없이 이 API 가 불릴 때 만든다. 대상은 종료일 전날 00시 00분(한국 시간)부터 마감 전까지인 작업, 즉 오늘(한국 시간)이 종료일 전날이거나 종료일이고 아직 기한 지남이 아닌(시간이 있으면 종료 시각 전, D-137) 대기·진행 작업 중 내 개인 작업과 내가 작업자인 팀 작업. 아직 due_soon 알림이 없는 작업마다 하나 만든다 (UNIQUE 필터 인덱스로 겹치지 않게, 동시 요청의 UNIQUE 위반은 무시)

#### POST /api/notifications/read
- **설명**: 내 알림을 모두 본 것으로 바꾼다. 알림 창을 열 때 부른다 (D-096)
- **응답 data**: `unreadCount` number — 항상 0
- **오류**: 401
- **사용 테이블**: notifications

#### POST /api/notifications/{id}/accept
- **설명**: 팀 초대 수락. 그 팀의 팀원(member)으로 넣고 내 팀 목록 맨 위(sort_order 0, 다른 팀은 1씩 밂)에 둔 뒤 알림을 지운다 (D-089, D-095). 한 트랜잭션
- **응답 data**: 가입한 Team (myRole = member)
- **오류**: 400, 401, 404 (알림이 없음. 팀이 해체되면 알림도 지워진다), 409 TEAM_LIMIT_EXCEEDED (알림은 지우지 않는다, D-078)
- **사용 테이블**: users, notifications, teams, team_members
- **처리**: 내 users 행을 잠그고 가입된 팀 수 확인 → 이미 팀원이면(다른 경로로 먼저 가입) 알림만 지우고 그 Team 으로 응답

#### POST /api/notifications/{id}/decline
- **설명**: 팀 초대 거절. 알림을 지우고 거절 기록(team_invite_declines)을 남긴다 (D-095, D-121). 24시간 지난 거절 기록도 이때 지운다
- **응답 data**: `isDeclined` true
- **오류**: 400, 401, 404
- **사용 테이블**: notifications, team_invite_declines

### 6.8 실시간 반영 (Socket.IO)

#### 연결 (공통)
- 범위 (D-104, D-159): 팀 작업 페이지(할일·칸반)의 변경, 팀 일일보고의 제출·수정 제출, 새 알림 배지, 팀에서 내보내짐·팀 해체. 개인 공간은 실시간 반영하지 않는다
- 경로 /socket.io (개발 시 Vite 개발 서버가 백엔드 3000 으로 WebSocket 프록시). 같은 출처에서만 연결하고 CORS 를 열지 않는다
- 인증: 연결할 때 로그인 쿠키 `todo_session` 을 requireLogin 과 같은 방법으로 확인한다. 없거나 만료되었으면 연결을 거부한다 (화면은 다음 API 의 401 로 로그인 화면으로 간다)
- 끊기: 로그아웃하거나 다른 곳에서 새로 로그인하면(D-050) 그 회원의 연결을 모두 끊는다. 토큰 만료 시각이 되면 끊는다
- 방(room): 연결하면 서버가 `user:{회원 id}` 방과 그 회원이 속한 모든 `team:{팀 id}` 방에 넣는다. 팀을 만들거나 초대를 수락하면 그 회원의 연결을 그 팀 방에 넣고, 탈퇴·내보내기·해체되면 뺀다. 서버만 방을 정하고 화면이 방을 고르지 않는다 (남의 팀 이벤트를 받지 못하게)
- 방향: 서버 → 화면만. 화면은 소켓으로 데이터를 바꾸지 않고, 바꾸는 것은 모두 HTTP API 로 한다. 서버는 API 의 트랜잭션이 커밋된 뒤 이벤트를 보낸다
- 이벤트는 "무엇이 바뀌었는지"만 알린다. 화면은 받은 뒤 해당 목록 API 를 다시 불러 서버 순서로 그린다 (여러 명이 동시에 바꿔도 서버 상태가 기준)
- 다시 연결되면 화면은 보고 있는 목록(할일·작업·알림 개수·팀 목록)을 다시 불러온다 (끊긴 동안 놓친 이벤트 대비)

#### 이벤트
| 이벤트 | 보내는 방 | 보내는 때 | data |
|---|---|---|---|
| `team:todos-changed` | `team:{팀 id}` | 팀 할일 추가·수정·삭제, [작업 시작] | `teamId` number, `todoId` number, `action` string (create / update / delete / start), `actorUserId` number |
| `team:tasks-changed` | `team:{팀 id}` | 팀 작업 생성([작업 시작])·수정·드래그·삭제, 팀원이 나가 작업자에서 빠짐 (D-100) | `teamId` number, `taskIds` number[] (바뀐 작업), `action` string (create / update / move / delete / assignee-removed), `actorUserId` number |
| `team:reports-changed` | `team:{팀 id}` | 팀원이 일일보고를 제출하거나 수정 제출함 (임시저장은 보내지 않는다, D-159) | `teamId` number, `reportDate` string (YYYY-MM-DD), `reportId` number, `userId` number, `action` string (submit / update), `actorUserId` number |
| `notifications:changed` | `user:{회원 id}` | 그 회원에게 초대·작업자 지정 알림이 옴, 초대가 취소됨, 그 회원의 알림이 지워짐(작업 삭제 등), 그 회원이 수락·거절·읽음·지우기 처리 (다른 탭 맞춤). 마감 임박 알림은 알림을 불러올 때 생기므로 보내지 않는다 | `unreadCount` number |
| `teams:changed` | `user:{회원 id}` | 그 회원이 팀에서 내보내짐, 팀이 해체됨, 그 회원이 팀을 만들거나 가입하거나 탈퇴함 (다른 탭 맞춤) | `teamId` number, `reason` string (removed / dissolved / joined / left) |

- `actorUserId`: 바꾼 회원. 화면은 내가 바꾼 것이면 D-103 의 안내를 띄우지 않는다
- 팀 해체는 방에서 빼기 전에 그 팀의 모든 팀원에게 `teams:changed` (dissolved) 를 보낸다. 내보내기는 내보낸 회원에게 `teams:changed` (removed) 를 보낸다
- 이벤트를 보내다 실패해도 API 응답은 성공으로 둔다 (데이터는 이미 저장됨, 화면은 다시 연결하거나 다시 불러올 때 맞춰진다)

### 6.9 캘린더

#### 캘린더 공통
- 모두 회원 전용 (requireLogin). 공간 권한은 6.4 할일 공통과 같다
- 표시 대상: 칸반 작업(대기·진행·완료)과 히스토리 작업 중 기간이 정해진 것 (D-014, D-015, D-022). 할일과 기간 "미정" 작업은 뺀다
- 히스토리 작업: 상태가 완료이고 완료 시각(done_date)부터 7일이 지난 작업 (D-015, D-066). 기준 시각은 서버의 지금 시각(UTC)
- 기간은 DATE 문자열로 주고받는다 (시간대 변환 없음)

#### GET /api/personal/calendar, GET /api/teams/{id}/calendar
- **설명**: 보이는 기간과 겹치는 작업 목록 (개인 공간 / 팀 공간). 겹침: start_date ≤ to AND end_date ≥ from
- **권한**: 개인: 회원 / 팀: 그 팀의 팀원
- **요청** (쿼리):
  | 필드 | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | from | string | O | 보이는 첫 날 YYYY-MM-DD (실제 있는 날짜) |
  | to | string | O | 보이는 마지막 날 YYYY-MM-DD, from 과 같거나 뒤, from 부터 62일 이하 |
- **응답 data**: `tasks` CalendarTask[] (없으면 빈 배열). 시작일 → 긴 기간 → 작업 id 순
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | taskId | number | 작업 id |
  | title, content, startDate, endDate, startTime, endTime, status | | Task 와 같은 형식 (기간 미정은 오지 않는다) |
  | assignees | { userId: number, nickname: string }[] | 작업자 (팀 공간만, 개인 공간이면 빈 배열) |
  | isHistory | boolean | 히스토리 작업 여부 |
- **오류**: 400, 401, 404 (팀)
- **사용 테이블**: tasks, task_assignees, users, team_members

#### GET /api/holidays
- **설명**: 한 해의 공휴일 (D-107). 백엔드가 공공데이터포털 "한국천문연구원 특일 정보" API 의 공휴일 정보를 가져와 화면에 넘긴다. API 키는 환경 변수 HOLIDAY_API_KEY (화면에 보내지 않는다)
- **권한**: 회원
- **요청** (쿼리): `year` number 필수 — 2000 ~ 2100 정수
- **응답 data**: `holidays` { date: string (YYYY-MM-DD), name: string }[] (날짜 순, 없으면 빈 배열), `isAvailable` boolean — 공휴일 정보를 가져왔으면 true
- **오류**: 400, 401. 외부 API 가 실패하거나 키가 없으면 오류로 응답하지 않고 `holidays` 빈 배열 + `isAvailable` false (캘린더는 공휴일 없이 보인다)
- **사용 테이블**: 없음
- **캐시**: 해마다 가져온 결과를 서버 메모리에 24시간 둔다 (외부 API 호출 횟수 제한 대비). 실패한 결과는 캐시하지 않는다
- **외부 API 호출**: 키는 쿼리 파라미터로만 보내고 로그에 요청 URL 을 남기지 않는다 (security.md 1). 응답 형식과 호출 주소는 구현할 때 공공데이터포털 문서로 확인한다 (coding_rule.md 2). 제한 시간 5초

### 6.10 히스토리

#### GET /api/personal/history, GET /api/teams/{id}/history
- **설명**: 히스토리 작업 목록 (D-113). 완료 시각이 최근인 것이 위, 같으면 작업 id 큰 것이 위. 한 페이지 20개 (D-111)
- **권한**: 개인: 회원 / 팀: 그 팀의 팀원 (공간 권한은 6.4 할일 공통과 같다)
- **요청** (쿼리): `page` number 필수 — 1 이상 정수 (마지막 페이지를 넘으면 빈 배열)
- **응답 data**:
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | tasks | HistoryTask[] | 그 페이지의 히스토리 작업 (없으면 빈 배열) |
  | totalCount | number | 전체 히스토리 작업 수 |
  | page | number | 요청한 페이지 |
  | pageSize | number | 20 |
- HistoryTask 형식:
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | taskId | number | 작업 id |
  | title, content, startDate, endDate, startTime, endTime, isPeriodUndecided | | Task 와 같은 형식 |
  | doneDate | string | 완료 공간으로 옮긴 시각 |
  | assignees | { userId: number, nickname: string }[] | 작업자 (팀 공간만, 개인 공간이면 빈 배열) |
- **오류**: 400, 401, 404 (팀)
- **사용 테이블**: tasks, task_assignees, users, team_members
- 상세 모달의 수정 내역은 GET /api/tasks/{id}/logs 로 불러온다 (D-112)

### 6.11 회원정보 수정/탈퇴

#### 회원정보 공통
- 모두 회원 전용 (requireLogin). 로그인한 회원 자신의 정보만 다룬다 (경로에 회원 id 를 받지 않는다)
- 입력 규칙은 overview.md 8.1 과 같다. 아이디는 바꿀 수 없다 (D-021)
- 현재 비밀번호 확인(비밀번호 변경, 탈퇴, D-130)은 로그인과 같은 실패 제한을 쓴다: 틀리면 login_fail_count 를 올리고 5번이면 10분 잠금 (D-049). 잠겨 있으면 423 LOGIN_LOCKED. 맞으면 횟수를 0으로
- 닉네임을 바꿔도 이미 남은 수정 내역·알림의 닉네임은 그때 값 그대로다 (D-041)
- 회원 정보 응답 형식 (Me): `loginId` string, `nickname` string, `email` string, `phone` string, `createDate` string (가입 시각)

#### GET /api/users/me
- **설명**: 회원정보 수정 화면의 내 정보
- **응답 data**: Me
- **오류**: 401
- **사용 테이블**: users

#### POST /api/users/me/nickname
- **설명**: 닉네임 변경 (D-129)
- **요청**: `nickname` string 필수 — 한글·영어·숫자 1~8자
- **응답 data**: Me
- **오류**: 400, 401
- **사용 테이블**: users

#### POST /api/users/me/phone
- **설명**: 전화번호 변경. 인증 없음 (D-021)
- **요청**: `phone` string 필수 — 숫자 11자리
- **응답 data**: Me
- **오류**: 400, 401, 409 PHONE_DUPLICATED (다른 회원이 쓰는 번호. 지금 내 번호와 같으면 바꾸지 않고 성공)
- **사용 테이블**: users

#### POST /api/users/me/email
- **설명**: 이메일 변경. change_email 인증을 마친 새 이메일로 바꾼다 (D-021)
- **요청**: `email` string 필수 — 인증을 마친 새 이메일, `verificationId` number 필수 — email, purpose=change_email 과 일치
- **응답 data**: Me
- **오류**: 400 INVALID_INPUT, 400 EMAIL_NOT_VERIFIED, 401, 409 EMAIL_DUPLICATED (그사이 다른 회원이 가입)
- **사용 테이블**: users, email_verifications
- **인증 유효 시간**: 인증 완료 후 30분 (D-044 와 같음). 성공하면 그 인증 기록을 지운다

#### POST /api/users/me/password
- **설명**: 비밀번호 변경 (D-129, D-130). 지금 로그인은 유지한다 (한 곳에서만 로그인이라 다른 로그인은 없다, D-050)
- **요청**: `currentPassword` string 필수 — 1~15자, `newPassword` string 필수 — 영어+숫자+특수문자 모두 포함 8~15자
- **응답 data**: `isChanged` boolean — 항상 true
- **오류**: 400 INVALID_INPUT, 400 CURRENT_PASSWORD_MISMATCH, 401, 423 LOGIN_LOCKED
- **사용 테이블**: users

#### GET /api/users/me/withdrawal-check
- **설명**: 탈퇴 전 확인 (D-131). 탈퇴 창을 열 때 불러 막히는 팀과 함께 해체될 팀을 보여준다
- **응답 data**: `blockingTeams` { teamId: number, name: string }[] — 내가 관리자이고 다른 팀원이 있는 팀 (하나라도 있으면 탈퇴 불가), `soloTeams` { teamId: number, name: string }[] — 나 혼자인 팀 (탈퇴하면 해체)
- **오류**: 401
- **사용 테이블**: teams, team_members

#### POST /api/users/me/withdraw
- **설명**: 회원 탈퇴 (D-041, D-130, D-131)
- **요청**: `password` string 필수 — 현재 비밀번호 1~15자
- **응답 data**: `isWithdrawn` boolean — 항상 true. 로그인 쿠키를 만료시킨다
- **오류**: 400 INVALID_INPUT, 400 CURRENT_PASSWORD_MISMATCH, 401, 409 TEAM_OWNER_CANNOT_WITHDRAW (error 에 막는 팀 이름을 담는다: `teams` { teamId, name }[]), 423 LOGIN_LOCKED
- **사용 테이블**: users, login_tokens, email_verifications, teams, team_members, todos, tasks, task_assignees, task_logs, task_log_assignees, notifications, team_invite_declines, daily_reports
- **처리 순서**: 입력 검사 → 현재 비밀번호 확인 → 한 트랜잭션에서 내 users 행과 내 team_members 행을 잠그고
  1. 다른 팀원이 있는 팀의 관리자면 409 TEAM_OWNER_CANNOT_WITHDRAW (D-131)
  2. 나 혼자인 팀을 해체한다 (팀 해체와 같은 처리: 그 팀 작업의 알림을 먼저 지우고 teams 삭제, D-131)
  3. 남은 팀마다 팀 탈퇴와 같은 작업자 정리를 한다 (작업자에서 빼고 "작업자 변경" 기록, 닉네임은 탈퇴하는 회원, D-041, D-100, D-148) → 내 team_members 삭제
  4. 내가 받은 알림 삭제, 내가 보낸 알림의 sender_user_id 를 NULL 로 (sender_nickname 은 남김)
  5. 내 개인 작업의 알림 삭제 → 개인 tasks 삭제 (수정 내역 함께) → 개인 todos 삭제
  6. 내 일일보고 중 draft 행 삭제, submitted 행은 user_id 를 NULL 로 (닉네임은 남김, D-160)
  7. 내 team_invite_declines, login_tokens, 내 이메일의 email_verifications 삭제 → users 삭제
- 커밋 뒤: 내 실시간 연결을 끊고, 작업자를 정리한 팀에 `team:tasks-changed` (assignee-removed), 초대를 보냈던 받는 회원들에게는 알림이 그대로라 보내지 않는다
- 같은 아이디·이메일·전화번호로 다시 가입할 수 있고, 예전 기록과 연결되지 않는다 (D-041)

### 6.12 일일보고

#### 일일보고 공통
- 모두 회원 전용 (requireLogin). 경로의 팀에 로그인한 회원이 속하지 않았거나 팀이 없으면 404 NOT_FOUND (6.6 팀 공통과 같음)
- 오늘: 한국 시간(Asia/Seoul) 날짜. 날짜 경계(0시)도 한국 시간이다 (D-158)
- 보고는 한 회원이 팀마다 하루에 1개. 쓰기·수정은 오늘 보고만 (D-157, D-158)
- 저장 API(보고 저장, 양식 저장)는 요청 본문 최대 512kb. 넘으면 400 INVALID_INPUT
- HTML 정화 (D-155): 보고 내용과 양식의 기본 내용은 서버가 sanitize-html 로 아래만 남기고 나머지 태그·속성은 지운 뒤 저장한다. 화면이 보낸 HTML 을 그대로 믿지 않는다
  - 태그: p, br, strong, em, s, span, ul, ol, li, table, tbody, tr, th, td, hr, a
  - 속성: span 의 style 은 `color: #RRGGBB` 만, th·td 의 colspan·rowspan (1~10 정수), a 의 href 는 http·https·mailto 만 (그 밖은 a 를 지우고 글자만 남김). a 에는 서버가 target="_blank", rel="noopener noreferrer" 를 붙인다
- 글자 수: 구역 내용은 태그를 뺀 글자 5,000자 이하, HTML 은 구역마다 20,000자 이하, 보고 하나의 HTML 합계 100,000자 이하. 넘으면 400 INVALID_INPUT (D-161)
- 구역 형식 (TemplateSection, 양식의 구역):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | title | string | 구역 제목. 앞뒤 공백을 지우고 1~30자. 한 양식 안에서 서로 달라야 한다 |
  | type | string | stats(통계) / tasks(작업 목록) / text(글) |
  | statuses | string[] | tasks 만. waiting / progress / done 중 1개 이상 (중복 없음). 다른 종류면 빈 배열 |
  | doneRange | DoneRange 또는 null | stats, 그리고 statuses 에 done 이 있는 tasks 만. 나머지는 null |
  | defaultHtml | string | text 만. 기본 내용 (정화한 HTML, 빈 문자열 가능). 다른 종류면 빈 문자열 |
- 완료 범위 (DoneRange, D-154): `kind` string — sinceLastReport / weekday / monthDay / lastWeek / lastMonth, `weekday` number — weekday 만 1(월)~7(일), `day` number — monthDay 만 1~31. 해당 없는 값은 null

  | kind | 완료로 옮겨진 시각(done_date)의 범위 (한국 시간) |
  |---|---|
  | sinceLastReport | 이 팀의 내 submitted 보고 중 오늘 전 보고일의 가장 마지막 보고의 submit_date 이후. 없으면 지금 완료 공간의 작업 (히스토리 제외) |
  | weekday | 오늘 전의 가장 가까운 그 요일 0시 이후 (오늘이 그 요일이면 7일 전) |
  | monthDay | 오늘 전의 가장 가까운 그 날짜 0시 이후 (오늘이 그 날짜면 지난 달. 그 달에 없는 날짜는 그 달 마지막 날) |
  | lastWeek | 지난 주 월요일 0시 이상, 이번 주 월요일 0시 미만 |
  | lastMonth | 지난 달 1일 0시 이상, 이번 달 1일 0시 미만 |
- 자동 채우기 (D-153): 대상은 이 팀의 tasks 중 task_assignees 에 내가 있는 작업. 대기·진행은 지금 그 상태인 작업 전부, 완료는 status = done 이고 done_date 가 완료 범위 안인 작업 (히스토리 작업 포함)
  - stats: `<p>: 완료 {N}건, 진행 {N}건, 대기 {N}건</p>`
  - tasks: 진행 → 대기 → 완료, 같은 상태 안은 sort_order 순 (완료 중 히스토리 작업은 done_date 늦은 순으로 뒤에). 작업 하나가 `<li>` 하나인 `<ul>`. 글은 `[기간] 제목 - [상태]` (기간: 월/일, 시간 없음. 시작·종료가 보고일과 해가 다르면 `YYYY/M/D`, 같은 날이면 `[M/D]`, 미정이면 `[미정]`. 상태: 대기 / 진행 / 완료). 제목은 HTML 이스케이프
  - 해당 작업이 없으면 빈 문자열 (N/A 를 넣지 않는다)
- 보고 구역 형식 (ReportSection): TemplateSection 의 title, type, statuses, doneRange + `html` string (구역 내용). defaultHtml 은 담지 않는다
- 보고 형식 (Report):
  | 필드 | 타입 | 설명 |
  |---|---|---|
  | reportId | number 또는 null | 보고 id (저장 전 초안이면 null) |
  | reportDate | string | 보고일 YYYY-MM-DD |
  | status | string | draft / submitted / new (저장 전 초안) |
  | nickname | string | 작성자 닉네임 |
  | isMine | boolean | 내 보고 여부 |
  | header | string | 머리말 ({날짜}를 바꾼 값) |
  | sections | ReportSection[] | 구역 |
  | draftDate | string 또는 null | 마지막 임시저장 시각 (내 보고만, 남의 보고는 null) |
  | submitDate | string 또는 null | 처음 제출 시각 |
  | updateDate | string 또는 null | 마지막 수정 제출 시각 (있으면 화면에 "수정됨 · 시각") |
- 기본 양식 (D-152): header `{날짜} 진행 사항입니다.`, sections ◆ 통계(stats, sinceLastReport) / ◆ 진행(tasks, [progress]) / ◆ 대기(tasks, [waiting]) / ◆ 완료(tasks, [done], sinceLastReport) / ◆ 기타(text, 빈 기본 내용). 제목 앞 ◆ 도 제목 글자에 들어간다

#### GET /api/teams/{id}/reports
- **설명**: 팀원 보고 현황 (왼쪽 목록, D-158)
- **쿼리**: `date` string 필수 — YYYY-MM-DD, 오늘 또는 그 전. 오늘 뒤면 400
- **응답 data**: `date` string, `isToday` boolean, `items` ReportStatus[] — 나 → 지금 팀원(합류 순) → 그날 제출했지만 지금 팀에 없는 사람(제출 순)

  | 필드 | 타입 | 설명 |
  |---|---|---|
  | userId | number 또는 null | 회원 id (탈퇴한 회원이면 null) |
  | nickname | string | 지금 팀원은 지금 닉네임, 지금 팀에 없는 사람은 보고에 저장된 닉네임 |
  | isMe | boolean | 나 여부 |
  | status | string | submitted / draft (나만) / none (미제출) |
  | reportId | number 또는 null | 볼 수 있는 보고 id (submitted, 또는 내 draft). 없으면 null |
  | submitDate | string 또는 null | 처음 제출 시각 |
  | isEdited | boolean | 수정 제출한 적 있음 |
- 그 날짜(한국 시간) 뒤에 합류한 지금 팀원은 그 날짜 목록에서 뺀다 (team_members.create_date 기준). 나는 언제나 넣는다
- **오류**: 400, 401, 404
- **사용 테이블**: team_members, users, daily_reports

#### GET /api/teams/{id}/reports/{reportId}
- **설명**: 보고 하나 읽기. submitted 보고, 또는 내 draft 보고
- **응답 data**: Report
- **오류**: 400, 401, 404 (다른 팀 보고, 남의 draft 보고, 없는 보고)
- **사용 테이블**: team_members, daily_reports

#### GET /api/teams/{id}/reports/today
- **설명**: 내 오늘 보고 열기. 저장한 오늘 보고가 있으면 그것을, 없으면 지금 팀 양식으로 초안을 만들어 준다 (저장하지 않음, status = new). 초안은 머리말 {날짜} 바꿈 + 자동 구역 채우기 + 글 구역은 이어받기가 켜져 있으면 같은 팀의 내 마지막 보고(draft·submitted, 오늘 전 보고일 중 가장 마지막)에서 제목이 같은 text 구역의 html, 없거나 꺼져 있으면 defaultHtml (D-156)
- **응답 data**: `report` Report, `isCarryOver` boolean — 내 이어받기 설정
- **오류**: 401, 404
- **사용 테이블**: team_members, users, report_templates, daily_reports, tasks, task_assignees

#### GET /api/teams/{id}/reports/today/fresh
- **설명**: [새 양식 적용] 용 초안 (D-157). 지금 팀 양식으로 만든 초안을 준다 (저장하지 않음). 글 구역은 언제나 defaultHtml. 화면이 쓰던 글 구역 중 제목이 같은 것의 내용을 옮겨 넣는다
- **응답 data**: `report` Report (status = new, reportId = null)
- **오류**: 401, 404
- **사용 테이블**: team_members, report_templates, daily_reports, tasks, task_assignees

#### GET /api/teams/{id}/reports/section-content
- **설명**: 자동 구역 [다시 불러오기] (D-157). 그 구역 설정으로 지금 칸반 기준 내용을 만든다
- **쿼리**: `type` string 필수 — stats / tasks, `statuses` string — tasks 만, 쉼표로 구분 (예: progress,done), `doneKind` string — 완료 범위가 있을 때, `doneWeekday` number, `doneDay` number. 규칙은 TemplateSection·DoneRange 와 같다
- **응답 data**: `html` string
- **오류**: 400, 401, 404
- **사용 테이블**: team_members, daily_reports, tasks, task_assignees

#### POST /api/teams/{id}/reports/today/save
- **설명**: 오늘 보고 임시저장 또는 제출·수정 제출 (D-157). 없으면 만들고 있으면 바꾼다. 닉네임은 지금 내 닉네임으로 저장한다
- **요청**: `reportDate` string 필수 — 화면이 연 보고일 (오늘이 아니면 409 REPORT_NOT_TODAY), `action` string 필수 — draft(임시저장) / submit(제출·수정 제출), `header` string 필수 — 0~100자, `sections` ReportSection[] 필수 — 1~20개, 제목이 서로 다름, 각 html 은 정화한 뒤 글자 수 검사
- **처리**: 한 트랜잭션에서 (team_id, user_id, report_date) 행을 잠그고(UPDLOCK·HOLDLOCK) 읽는다
  - draft: 행이 submitted 면 409 REPORT_ALREADY_SUBMITTED. 아니면 저장하고 draft_date = 지금
  - submit: 행이 없거나 draft 면 status = submitted, submit_date = 지금. 이미 submitted 면 update_date = 지금 (수정 제출)
- **응답 data**: Report
- **오류**: 400 INVALID_INPUT, 401, 404, 409 REPORT_NOT_TODAY, 409 REPORT_ALREADY_SUBMITTED
- **사용 테이블**: team_members, users, daily_reports
- 커밋 뒤 submit 이면 `team:reports-changed` (처음 제출 submit / 수정 제출 update)

#### GET /api/teams/{id}/report-template
- **설명**: 팀 양식 ([양식 설정] 모달). 팀원 누구나 읽을 수 있다
- **응답 data**: `header` string, `sections` TemplateSection[], `canEdit` boolean — 내가 관리자·부관리자
- **오류**: 401, 404
- **사용 테이블**: team_members, report_templates

#### POST /api/teams/{id}/report-template/update
- **설명**: 팀 양식 저장 (D-152). 관리자·부관리자만 (팀원이면 403). 바로 적용, 이미 저장한 보고는 바꾸지 않는다. 실시간 이벤트를 보내지 않는다
- **요청**: `header` string 필수 — 앞뒤 공백을 지우고 0~100자, `sections` TemplateSection[] 필수 — 1~20개
- **응답 data**: `header` string, `sections` TemplateSection[], `canEdit` boolean
- **오류**: 400, 401, 403, 404
- **사용 테이블**: team_members, report_templates

#### POST /api/users/me/report-carry-over
- **설명**: 일일보고 "지난 보고 이어받기" 켜기/끄기 (D-156). 모든 팀에 적용된다
- **요청**: `isOn` boolean 필수
- **응답 data**: `isCarryOver` boolean
- **오류**: 400, 401
- **사용 테이블**: users
