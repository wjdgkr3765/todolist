# database.md

데이터 모델의 기준 문서다. 스키마를 바꾸는 작업에서는 이 문서도 함께 갱신한다.

이 문서와 실제 스키마가 다르면 사용자에게 알린다.

---

## 1. 개요

- **DB**: Microsoft SQL Server 2019, DB 이름 `todolist` (D-031)
- **서버**: localhost\SQLEXPRESS (이름 있는 인스턴스, D-034). 환경 변수 DB_INSTANCE, DB_PORT 를 적으면 포트 우선
- **접속**: SQL Server 인증(아이디/비밀번호). DB와 로그인 계정은 사용자가 SSMS에서 만들고, 접속 정보는 사용자가 직접 backend/.env 에 넣는다 (D-031, D-034)
- **시각**: `DATETIME2`, UTC 저장, 기본값 `SYSUTCDATETIME()` (D-032). 단 할일·작업의 기간은 달력 날짜라 `DATE` (시간대 변환 안 함)

---

## 2. 네이밍 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 테이블 | 소문자 snake_case, 단수형 + s (영어 불규칙 복수형은 쓰지 않음) | `users`, `historys`, `newsletter_configs` |
| 컬럼 | 소문자 snake_case | `send_time` |
| 기본 키 | `id BIGINT IDENTITY(1,1) PRIMARY KEY` | |
| 외래 키 컬럼 | `{단수 테이블명}_id` | `user_id`, `gubun_id` |
| 인덱스 | `idx_{테이블}_{컬럼}` | `idx_users_email` |
| 여부(불리언) | `is_` 접두사 + `BIT` (0/1) | `is_use BIT` |
| 값 제한 | 들어갈 값이 정해진 컬럼(불리언 제외)에 `CHECK (컬럼 IN (...))`를 붙인다 | `CHECK (status IN ('A','B'))` |
| 시각 | `DATETIME2`, UTC로 저장, 기본값 `SYSUTCDATETIME()` (기간처럼 달력 날짜만 필요한 값은 `DATE`) | |
| 시각 컬럼명 | `_date` 접미사 | `send_date` |
| 문자열 | `NVARCHAR` | |
| 중복 방지 | 단일 컬럼은 인라인 `UNIQUE`, 연결 테이블은 두 FK 조합에 복합 `UNIQUE` | `UNIQUE (user_id, gubun_id)` |
| 외래 키 선언 | 컬럼 정의 뒤에 모아서 쓴다 | `FOREIGN KEY (gubun_id) REFERENCES gubuns(id)` |
| 제약 이름 | DEFAULT, FK, UNIQUE, CHECK에 이름을 붙이지 않는다 (DB가 자동으로 정함) | |
| 컬럼 순서 | id → 업무 컬럼 → FK → 여부 → 날짜 → create_date | |
| 표기 | SQL 키워드는 대문자, 타입·제약 열을 맞춰 정렬 | |
| 설명 | 컬럼마다 줄 끝에 `-- 설명`을 단다 | `name NVARCHAR(20) NOT NULL, -- 이름` |

### 공통 컬럼
- `id`: 모든 테이블에 둔다
- `create_date`: 생성 시각 (UTC). 마지막 컬럼에 둔다. 설정 정보 테이블에는 두지 않는다
- 수정 시각: 기본으로 만들지 않고, 필요한 테이블에만 만든다

### 테이블 종류
| 종류 | 규칙 | 예 |
|---|---|---|
| 연결 테이블 | 양쪽 FK와 `create_date`만 두고, 두 FK 조합에 `UNIQUE` | `subscriptions` |
| 설정 테이블 | 분류·설정 값을 저장하고, 생성·수정 시각을 두지 않는다 | `gubuns`, `newsletter_configs` |

### 예
<!-- 아래는 SQL Server 예다. 프로젝트 DB의 문법에 맞게 바꾼다 -->
```sql
CREATE TABLE subscriptions (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,           -- 기본키
    user_id     BIGINT   NOT NULL,                          -- 구독한 회원
    gubun_id    BIGINT   NOT NULL,                          -- 구독한 구분
    create_date DATETIME NOT NULL DEFAULT GETUTCDATE(),     -- 생성 시각 (UTC)

    FOREIGN KEY (user_id)  REFERENCES users(id),
    FOREIGN KEY (gubun_id) REFERENCES gubuns(id),
    UNIQUE (user_id, gubun_id)
);
```

---

## 3. 테이블 정의

<!-- 테이블마다 아래 형식을 복사해서 쓴다. 2. 네이밍 규칙을 따른다 -->
```sql
CREATE TABLE 테이블명 (
    컬럼 타입 제약 -- 설명
);
```

<!-- 예시 (SQL Server). 프로젝트 DB의 문법에 맞게 바꾼다 -->
```sql
CREATE TABLE users (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,           -- 기본키
    name        NVARCHAR(20) NOT NULL,                      -- 이름
    create_date DATETIME     NOT NULL DEFAULT GETUTCDATE()  -- 생성 시각 (UTC)
);
```

---

## 4. 실제 사용할 테이블 생성 코드
<!-- 실제 테이블 생성 코드를 이 아래에 작성 -->

### users (회원)
- 탈퇴하면 행을 하드 삭제한다 (D-041). 작업·수정 내역은 user_id 대신 그 시점 닉네임을 따로 저장해 표시한다
- 로그인 실패 제한: 비밀번호를 연속 5번 틀리면 lock_expire_date = 그때 + 10분, login_fail_count 는 0으로. 로그인에 성공하면 login_fail_count 를 0으로 (D-049)

```sql
CREATE TABLE users (
    id               BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    login_id         NVARCHAR(15)  NOT NULL UNIQUE,                   -- 아이디
    password_hash    NVARCHAR(60)  NOT NULL,                          -- 비밀번호 bcrypt 해시 (60자)
    nickname         NVARCHAR(8)   NOT NULL,                          -- 닉네임 (중복 허용)
    email            NVARCHAR(100) NOT NULL UNIQUE,                   -- 이메일
    phone            NVARCHAR(11)  NOT NULL UNIQUE,                   -- 전화번호 (숫자 11자리, 인증 보류 D-005)
    login_fail_count INT           NOT NULL DEFAULT 0,                -- 연속으로 비밀번호를 틀린 횟수 (0~4, D-049)
    lock_expire_date DATETIME2     NULL,                              -- 로그인 잠금이 풀리는 시각 (UTC, 잠금 없으면 NULL)
    create_date      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(), -- 가입 시각 (UTC)

    CHECK (LEN(phone) = 11 AND phone NOT LIKE '%[^0-9]%'),
    CHECK (login_fail_count BETWEEN 0 AND 5)
);
```

### login_tokens (로그인 토큰)
- 로그인할 때 만든 무작위 토큰을 httpOnly 쿠키로 보내고, 여기에는 토큰의 SHA-256 해시(16진수 64자)만 저장한다 (D-028)
- 만료는 로그인 + 24시간 (D-007). 로그아웃하면 행을 지운다
- 새로 로그인하면 그 회원의 다른 행을 지운다 (D-050)

```sql
CREATE TABLE login_tokens (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    token_hash  NVARCHAR(64) NOT NULL UNIQUE,                    -- 토큰 SHA-256 해시 (16진수 64자)
    user_id     BIGINT       NOT NULL,                           -- 로그인한 회원
    expire_date DATETIME2    NOT NULL,                           -- 만료 시각 (로그인 + 24시간, UTC)
    create_date DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),  -- 로그인 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_login_tokens_user_id ON login_tokens (user_id);
```

### email_verifications (이메일 인증번호)
- 인증번호는 bcrypt 해시로 저장한다. 6자리 숫자, 유효시간 5분, 재발송은 1분 뒤, 5번 틀리면 무효 (D-035)
- purpose: signup(회원가입), find_id(아이디 찾기), find_password(비밀번호 찾기), change_email(이메일 변경)
- 회원가입 전에도 쓰므로 users 와 FK 로 연결하지 않는다

```sql
CREATE TABLE email_verifications (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    email       NVARCHAR(100) NOT NULL,                          -- 인증할 이메일
    code_hash   NVARCHAR(60)  NOT NULL,                          -- 인증번호 bcrypt 해시
    purpose     NVARCHAR(20)  NOT NULL,                          -- 용도
    fail_count  INT           NOT NULL DEFAULT 0,                -- 틀린 횟수 (5가 되면 무효)
    is_verified BIT           NOT NULL DEFAULT 0,                -- 인증 완료 여부
    expire_date DATETIME2     NOT NULL,                          -- 인증번호 만료 시각 (발송 + 5분, UTC)
    verify_date DATETIME2     NULL,                              -- 인증 완료 시각 (UTC)
    create_date DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(), -- 발송 시각 (UTC)

    CHECK (purpose IN ('signup', 'find_id', 'find_password', 'change_email')),
    CHECK (fail_count BETWEEN 0 AND 5)
);

CREATE INDEX idx_email_verifications_email ON email_verifications (email, purpose, create_date);
```

### todos (할일)
- 제목 1~50자, 내용 1~2000자, 기간 필수 또는 미정 (D-010, D-058)
- 미정이면 start_date, end_date 모두 NULL. 미정이 아니면 둘 다 있고 start_date ≤ end_date
- 개인 공간 할일은 user_id = 만든 회원 = 소유자. 팀 공간(team_id)은 팀 작업 페이지에서 추가한다
- 삭제는 완전 삭제 (D-056)

```sql
CREATE TABLE todos (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    title               NVARCHAR(50)   NOT NULL,                         -- 제목 (1~50자)
    content             NVARCHAR(2000) NOT NULL,                         -- 내용 (1~2000자)
    start_date          DATE           NULL,                             -- 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                             -- 기간 종료일 (미정이면 NULL)
    user_id             BIGINT         NOT NULL,                         -- 만든 회원 (개인 공간 소유자)
    is_period_undecided BIT            NOT NULL DEFAULT 0,               -- 기간 미정 여부
    update_date         DATETIME2      NULL,                             -- 마지막 수정 시각 (UTC, 수정 전이면 NULL)
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 추가 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date)
    )
);

CREATE INDEX idx_todos_user_id ON todos (user_id, create_date);
```

### tasks (작업)
- [작업 시작]으로 할일을 옮겨 만든다: 할일은 지우고 작업을 만든다 (D-059)
- 제목·내용·기간 규칙은 todos 와 같다
- status: waiting(대기), progress(진행), done(완료)
- sort_order: 같은 회원·같은 상태 안의 순서. 0 부터 작을수록 위. [작업 시작]으로 올린 작업은 대기 맨 위(0)에 두고 나머지를 1씩 민다 (D-064). 드래그하면 옮긴 공간과 떠난 공간의 순서를 0 부터 다시 매긴다
- done_date: 완료 공간으로 옮긴 시각. 완료에서 빠지면 NULL, 다시 완료로 옮기면 그 시각을 새로 넣는다 (D-015, D-066). 히스토리는 이 값 + 7일을 기준으로 쓴다
- 팀 공간(team_id)과 작업자는 팀 작업 페이지에서 추가한다 (D-060)
- 삭제는 완전 삭제 (D-023). 수정 내역(task_logs)도 함께 지워진다

```sql
CREATE TABLE tasks (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                 -- 기본키
    title               NVARCHAR(50)   NOT NULL,                          -- 제목 (1~50자)
    content             NVARCHAR(2000) NOT NULL,                          -- 내용 (1~2000자)
    start_date          DATE           NULL,                              -- 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                              -- 기간 종료일 (미정이면 NULL)
    status              NVARCHAR(10)   NOT NULL DEFAULT 'waiting',        -- 상태 (waiting / progress / done)
    sort_order          INT            NOT NULL,                          -- 같은 상태 안의 순서 (0 부터, 작을수록 위)
    user_id             BIGINT         NOT NULL,                          -- 만든 회원 (개인 공간 소유자)
    is_period_undecided BIT            NOT NULL DEFAULT 0,                -- 기간 미정 여부
    done_date           DATETIME2      NULL,                              -- 완료 공간으로 옮긴 시각 (UTC, 완료가 아니면 NULL)
    update_date         DATETIME2      NULL,                              -- 마지막 수정 시각 (UTC, 순서만 바꾼 경우는 기록하지 않음)
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 작업 시작 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (status IN ('waiting', 'progress', 'done')),
    CHECK (sort_order >= 0),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date)
    ),
    CHECK (
        (status = 'done' AND done_date IS NOT NULL)
        OR (status <> 'done' AND done_date IS NULL)
    )
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id, status, sort_order);
```

### task_logs (수정 내역)
- 작업 생성, 작업 수정, 상태 변경(상세 UI 수정·드래그)마다 한 행. 같은 상태 안 순서 변경은 남기지 않는다 (D-013, D-065)
- log_type: create(작업 생성), update(작업 수정), status(상태 변경). before_status 는 상태가 바뀐 기록에만 넣고 나머지는 NULL (내용+상태를 함께 바꾸면 update + before_status, D-067)
- 행마다 그 시점의 작업 내용(제목, 내용, 기간, 상태)을 저장한다 (D-065)
- 회원은 그 시점 닉네임만 저장하고 users 와 FK 로 연결하지 않는다. 회원이 탈퇴해도 기록이 남고, 재가입한 회원과 연결되지 않는다 (D-041)
- 작업을 지우면 함께 지운다 (ON DELETE CASCADE)

```sql
CREATE TABLE task_logs (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                 -- 기본키
    log_type            NVARCHAR(10)   NOT NULL,                          -- 종류 (create / update / status)
    before_status       NVARCHAR(10)   NULL,                              -- 바뀌기 전 상태 (상태가 바뀐 기록만, 아니면 NULL)
    nickname            NVARCHAR(8)    NOT NULL,                          -- 기록을 남긴 회원의 그 시점 닉네임 (D-041)
    title               NVARCHAR(50)   NOT NULL,                          -- 그 시점 제목
    content             NVARCHAR(2000) NOT NULL,                          -- 그 시점 내용
    start_date          DATE           NULL,                              -- 그 시점 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                              -- 그 시점 기간 종료일 (미정이면 NULL)
    status              NVARCHAR(10)   NOT NULL,                          -- 그 시점 상태 (바뀐 뒤 상태)
    task_id             BIGINT         NOT NULL,                          -- 대상 작업
    is_period_undecided BIT            NOT NULL DEFAULT 0,                -- 그 시점 기간 미정 여부
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 기록 시각 (UTC)

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CHECK (log_type IN ('create', 'update', 'status')),
    CHECK (before_status IS NULL OR before_status IN ('waiting', 'progress', 'done')),
    CHECK (status IN ('waiting', 'progress', 'done')),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date)
    )
);

CREATE INDEX idx_task_logs_task_id ON task_logs (task_id, create_date);
```

### 아직 설계하지 않은 테이블
- teams, team_members (팀 생성/관리, overview.md 8.7 참고), 작업자, 알림·초대, 히스토리 관련 테이블
- 할일·작업의 팀 공간(team_id)은 팀 작업 페이지에서 추가한다
