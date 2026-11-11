# database.md

데이터 모델의 기준 문서다. 스키마를 바꾸는 작업에서는 이 문서도 함께 갱신한다.

이 문서와 실제 스키마가 다르면 사용자에게 알린다.

---

## 1. 개요

- **DB**: Microsoft SQL Server 2019, DB 이름 `todolist` (D-031)
- **서버**: localhost\SQLEXPRESS (이름 있는 인스턴스, D-034). 환경 변수 DB_INSTANCE, DB_PORT 를 적으면 포트 우선
- **접속**: SQL Server 인증(아이디/비밀번호). DB와 로그인 계정은 사용자가 SSMS에서 만들고, 접속 정보는 사용자가 직접 backend/.env 에 넣는다 (D-031, D-034)
- **시각**: `DATETIME2`, UTC 저장, 기본값 `SYSUTCDATETIME()` (D-032). 단 할일·작업의 기간은 달력 날짜라 `DATE`, 기간 시간은 따로 `TIME(0)` 이고 입력한 한국 시간 그대로 저장한다 (시간대 변환 안 함, D-135)

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

- 생성 순서 (FK 때문에): users → login_tokens → email_verifications → teams → team_members → todos → tasks → task_assignees → task_logs → task_log_assignees → notifications → team_invite_declines
- 만료 데이터 정리 (D-122): 로그인할 때 만료된 login_tokens(모든 회원), 인증번호를 보낼 때 하루 지난 email_verifications, 초대·거절할 때 24시간 지난 team_invite_declines 를 함께 지운다
- 회원 탈퇴 처리 순서는 api.md 6.11 POST /api/users/me/withdraw 에 있다

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
- 새로 로그인하면 그 회원의 다른 행을 지운다 (D-050). 그때 만료된 행(모든 회원)도 지운다 (D-122)

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
- 인증번호를 보낼 때 하루 지난 행(모든 이메일)을 함께 지운다 (D-122)

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
- 기간 시간 (D-135, D-136): start_time, end_time 은 함께 있거나 함께 NULL(날짜만 있는 기간). 5분 단위, 초는 0. 같은 날이면 start_time ≤ end_time
- 개인 공간 할일: user_id = 소유자, team_id = NULL. 팀 공간 할일: team_id = 팀, user_id = NULL (만든 회원이 탈퇴해도 팀 할일이 남도록, D-041). 둘 중 하나만 있다
- 팀을 해체하면 팀 할일도 지운다 (ON DELETE CASCADE, D-075)
- 삭제는 완전 삭제 (D-056)

```sql
CREATE TABLE todos (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    title               NVARCHAR(50)   NOT NULL,                         -- 제목 (1~50자)
    content             NVARCHAR(2000) NOT NULL,                         -- 내용 (1~2000자)
    start_date          DATE           NULL,                             -- 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                             -- 기간 종료일 (미정이면 NULL)
    start_time          TIME(0)        NULL,                             -- 기간 시작 시각 (시간 지정 안 함·미정이면 NULL, D-135)
    end_time            TIME(0)        NULL,                             -- 기간 종료 시각 (시간 지정 안 함·미정이면 NULL)
    user_id             BIGINT         NULL,                             -- 개인 공간 소유자 (팀 공간이면 NULL)
    team_id             BIGINT         NULL,                             -- 팀 공간 (개인 공간이면 NULL)
    is_period_undecided BIT            NOT NULL DEFAULT 0,               -- 기간 미정 여부
    update_date         DATETIME2      NULL,                             -- 마지막 수정 시각 (UTC, 수정 전이면 NULL)
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 추가 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CHECK (
        (user_id IS NOT NULL AND team_id IS NULL)
        OR (user_id IS NULL AND team_id IS NOT NULL)
    ),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL AND start_time IS NULL AND end_time IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date
            AND (
                (start_time IS NULL AND end_time IS NULL)
                OR (start_time IS NOT NULL AND end_time IS NOT NULL AND (start_date < end_date OR start_time <= end_time))
            ))
    ),
    CHECK (start_time IS NULL OR (DATEPART(MINUTE, start_time) % 5 = 0 AND DATEPART(SECOND, start_time) = 0)),
    CHECK (end_time IS NULL OR (DATEPART(MINUTE, end_time) % 5 = 0 AND DATEPART(SECOND, end_time) = 0))
);

CREATE INDEX idx_todos_user_id ON todos (user_id, create_date);
CREATE INDEX idx_todos_team_id ON todos (team_id, create_date);
```

### tasks (작업)
- [작업 시작]으로 할일을 옮겨 만든다: 할일은 지우고 작업을 만든다 (D-059)
- 제목·내용·기간(시간 포함) 규칙은 todos 와 같다
- status: waiting(대기), progress(진행), done(완료)
- sort_order: 같은 공간(개인 공간이면 그 회원, 팀 공간이면 그 팀)·같은 상태 안의 순서. 0 부터 작을수록 위. [작업 시작]으로 올린 작업은 대기 맨 위(0)에 두고 나머지를 1씩 민다 (D-064). 드래그하면 옮긴 공간과 떠난 공간의 순서를 0 부터 다시 매긴다
- done_date: 완료 공간으로 옮긴 시각. 완료에서 빠지면 NULL, 다시 완료로 옮기면 그 시각을 새로 넣는다 (D-015, D-066). 히스토리는 이 값 + 7일을 기준으로 쓴다
- 개인 공간·팀 공간 구분은 todos 와 같다 (user_id 또는 team_id 중 하나). [작업 시작]으로 만든 작업은 할일의 공간을 그대로 이어받는다
- 작업자는 task_assignees 에 둔다 (팀 공간 작업만, D-060, D-097)
- 팀을 해체하면 팀 작업도 지운다 (ON DELETE CASCADE, D-075)
- 삭제는 완전 삭제 (D-023). 수정 내역(task_logs)과 작업자(task_assignees)도 함께 지워진다

```sql
CREATE TABLE tasks (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                 -- 기본키
    title               NVARCHAR(50)   NOT NULL,                          -- 제목 (1~50자)
    content             NVARCHAR(2000) NOT NULL,                          -- 내용 (1~2000자)
    start_date          DATE           NULL,                              -- 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                              -- 기간 종료일 (미정이면 NULL)
    start_time          TIME(0)        NULL,                              -- 기간 시작 시각 (시간 지정 안 함·미정이면 NULL, D-135)
    end_time            TIME(0)        NULL,                              -- 기간 종료 시각 (시간 지정 안 함·미정이면 NULL)
    status              NVARCHAR(10)   NOT NULL DEFAULT 'waiting',        -- 상태 (waiting / progress / done)
    sort_order          INT            NOT NULL,                          -- 같은 상태 안의 순서 (0 부터, 작을수록 위)
    user_id             BIGINT         NULL,                              -- 개인 공간 소유자 (팀 공간이면 NULL)
    team_id             BIGINT         NULL,                              -- 팀 공간 (개인 공간이면 NULL)
    is_period_undecided BIT            NOT NULL DEFAULT 0,                -- 기간 미정 여부
    done_date           DATETIME2      NULL,                              -- 완료 공간으로 옮긴 시각 (UTC, 완료가 아니면 NULL)
    update_date         DATETIME2      NULL,                              -- 마지막 수정 시각 (UTC, 순서만 바꾼 경우는 기록하지 않음)
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 작업 시작 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CHECK (
        (user_id IS NOT NULL AND team_id IS NULL)
        OR (user_id IS NULL AND team_id IS NOT NULL)
    ),
    CHECK (status IN ('waiting', 'progress', 'done')),
    CHECK (sort_order >= 0),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL AND start_time IS NULL AND end_time IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date
            AND (
                (start_time IS NULL AND end_time IS NULL)
                OR (start_time IS NOT NULL AND end_time IS NOT NULL AND (start_date < end_date OR start_time <= end_time))
            ))
    ),
    CHECK (start_time IS NULL OR (DATEPART(MINUTE, start_time) % 5 = 0 AND DATEPART(SECOND, start_time) = 0)),
    CHECK (end_time IS NULL OR (DATEPART(MINUTE, end_time) % 5 = 0 AND DATEPART(SECOND, end_time) = 0)),
    CHECK (
        (status = 'done' AND done_date IS NOT NULL)
        OR (status <> 'done' AND done_date IS NULL)
    )
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id, status, sort_order);
CREATE INDEX idx_tasks_team_id ON tasks (team_id, status, sort_order);
```

### task_logs (수정 내역)
- 작업 생성, 작업 수정, 작업자 변경, 상태 변경(상세 UI 수정·드래그)마다 한 행. 같은 상태 안 순서 변경은 남기지 않는다 (D-013, D-065, D-099)
- log_type: create(작업 생성) / change(변경). change 행은 무엇이 바뀌었는지를 아래 세 값으로 저장하고, 화면은 "작업 수정 · 작업자 변경 · 상태 변경 (대기 → 진행)" 순서로 바뀐 것만 이어 쓴다 (D-067, D-100)
  - is_content_changed: 제목·내용·기간이 바뀜 → "작업 수정"
  - is_assignee_changed: 작업자가 바뀜 → "작업자 변경" (팀원이 팀을 나가 작업자에서 빠질 때도, D-100)
  - before_status: 상태가 바뀌었으면 바뀌기 전 상태, 아니면 NULL → "상태 변경 (대기 → 진행)"
  - change 행은 셋 중 하나 이상이 바뀌어야 한다. create 행은 셋 다 0 / NULL
- 행마다 그 시점의 작업 내용(제목, 내용, 기간, 상태)을 저장한다 (D-065). 그 시점 작업자는 task_log_assignees 에 저장한다 (D-099)
- 회원은 그 시점 닉네임만 저장하고 users 와 FK 로 연결하지 않는다. 회원이 탈퇴해도 기록이 남고, 재가입한 회원과 연결되지 않는다 (D-041)
- nickname: 그 변경을 한 회원. 팀원이 팀을 나가(탈퇴·내보내기) 작업자에서 빠진 기록은 빠진 회원 본인의 그 시점 닉네임 (D-100, D-101)
- 작업을 지우면 함께 지운다 (ON DELETE CASCADE)

```sql
CREATE TABLE task_logs (
    id                  BIGINT IDENTITY(1,1) PRIMARY KEY,                 -- 기본키
    log_type            NVARCHAR(10)   NOT NULL,                          -- 종류 (create / change)
    before_status       NVARCHAR(10)   NULL,                              -- 바뀌기 전 상태 (상태가 바뀐 기록만, 아니면 NULL)
    nickname            NVARCHAR(8)    NOT NULL,                          -- 기록을 남긴 회원의 그 시점 닉네임 (D-041)
    title               NVARCHAR(50)   NOT NULL,                          -- 그 시점 제목
    content             NVARCHAR(2000) NOT NULL,                          -- 그 시점 내용
    start_date          DATE           NULL,                              -- 그 시점 기간 시작일 (미정이면 NULL)
    end_date            DATE           NULL,                              -- 그 시점 기간 종료일 (미정이면 NULL)
    start_time          TIME(0)        NULL,                              -- 그 시점 기간 시작 시각 (시간 지정 안 함·미정이면 NULL, D-135)
    end_time            TIME(0)        NULL,                              -- 그 시점 기간 종료 시각 (시간 지정 안 함·미정이면 NULL)
    status              NVARCHAR(10)   NOT NULL,                          -- 그 시점 상태 (바뀐 뒤 상태)
    task_id             BIGINT         NOT NULL,                          -- 대상 작업
    is_period_undecided BIT            NOT NULL DEFAULT 0,                -- 그 시점 기간 미정 여부
    is_content_changed  BIT            NOT NULL DEFAULT 0,                -- 제목·내용·기간이 바뀐 기록 여부
    is_assignee_changed BIT            NOT NULL DEFAULT 0,                -- 작업자가 바뀐 기록 여부 (D-099)
    create_date         DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(), -- 기록 시각 (UTC)

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CHECK (log_type IN ('create', 'change')),
    CHECK (before_status IS NULL OR before_status IN ('waiting', 'progress', 'done')),
    CHECK (status IN ('waiting', 'progress', 'done')),
    CHECK (
        (log_type = 'create' AND before_status IS NULL AND is_content_changed = 0 AND is_assignee_changed = 0)
        OR (log_type = 'change' AND (before_status IS NOT NULL OR is_content_changed = 1 OR is_assignee_changed = 1))
    ),
    CHECK (
        (is_period_undecided = 1 AND start_date IS NULL AND end_date IS NULL AND start_time IS NULL AND end_time IS NULL)
        OR (is_period_undecided = 0 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date
            AND (
                (start_time IS NULL AND end_time IS NULL)
                OR (start_time IS NOT NULL AND end_time IS NOT NULL AND (start_date < end_date OR start_time <= end_time))
            ))
    ),
    CHECK (start_time IS NULL OR (DATEPART(MINUTE, start_time) % 5 = 0 AND DATEPART(SECOND, start_time) = 0)),
    CHECK (end_time IS NULL OR (DATEPART(MINUTE, end_time) % 5 = 0 AND DATEPART(SECOND, end_time) = 0))
);

CREATE INDEX idx_task_logs_task_id ON task_logs (task_id, create_date);
```

### task_assignees (작업자)
- 팀 공간 작업의 작업자. 여러 명 (D-012, D-097). 연결 테이블
- 그 팀의 지금 팀원만 지정할 수 있다 (서버에서 확인)
- 화면 표시 순서는 지정한 순 (id 순). 카드에는 첫 작업자 + "외 N명" (D-098)
- 팀원이 팀을 탈퇴하거나 내보내지거나 회원 탈퇴하면 그 회원의 행을 지운다 (D-041, D-100)
- 작업을 지우면 함께 지운다 (ON DELETE CASCADE)

```sql
CREATE TABLE task_assignees (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    task_id     BIGINT    NOT NULL,                              -- 작업
    user_id     BIGINT    NOT NULL,                              -- 작업자 회원
    create_date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),     -- 지정 시각 (UTC)

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (task_id, user_id)
);

CREATE INDEX idx_task_assignees_user_id ON task_assignees (user_id);
```

### task_log_assignees (수정 내역의 그 시점 작업자)
- 수정 내역 한 줄마다 그 시점 작업자의 닉네임을 저장한다 (D-099). users 와 FK 로 연결하지 않는다 (D-041)
- 표시 순서는 id 순 (그 시점 작업자 지정 순)
- 수정 내역을 지우면 함께 지운다 (ON DELETE CASCADE)

```sql
CREATE TABLE task_log_assignees (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    nickname    NVARCHAR(8) NOT NULL,                            -- 그 시점 작업자 닉네임
    task_log_id BIGINT      NOT NULL,                            -- 수정 내역
    create_date DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),   -- 기록 시각 (UTC)

    FOREIGN KEY (task_log_id) REFERENCES task_logs(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_log_assignees_task_log_id ON task_log_assignees (task_log_id);
```

### teams (팀)
- 팀 정보는 팀 이름만. 1~20자, 다른 팀과 이름이 같아도 된다 (D-071)
- 팀을 해체하면 행을 지운다. 팀과 관련된 정보(team_members, notifications, team_invite_declines, 팀 todos·tasks 와 그 작업자·수정 내역)도 함께 지워진다 (ON DELETE CASCADE, D-075). 단 작업과 이어진 알림은 먼저 지운다 (notifications 참고)

```sql
CREATE TABLE teams (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    name        NVARCHAR(20) NOT NULL,                           -- 팀 이름 (1~20자, 중복 허용)
    create_date DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()   -- 만든 시각 (UTC)
);
```

### team_members (팀원)
- 팀과 회원을 잇고 역할을 저장한다. role: owner(관리자) / manager(부관리자) / member(팀원) (D-030)
- 팀마다 관리자는 1명 (role = 'owner' 조건의 UNIQUE 필터 인덱스)
- 한 회원이 속한 팀은 역할과 상관없이 20개까지 (D-078). 서버에서 회원 행을 잠그고 센다 (api.md 6.6 팀 공통)
- create_date 가 합류 시각이다. 팀원 게시판의 합류일과 정렬(D-076)에 쓴다
- sort_order: 그 회원의 좌측 네비 팀 목록 순서 (회원마다 따로, D-089). 0 부터 작을수록 위. 팀을 만들거나 초대를 수락하면 그 회원의 새 행은 0, 그 회원의 다른 행은 1씩 민다. 드래그하면 그 회원의 행을 0 부터 빈틈없이 다시 매긴다. 탈퇴·내보내기·해체로 빠진 자리는 빈틈으로 두고 순서대로 보여준다
- 회원이 탈퇴하면 그 회원의 행을 지운다 (관리자로 다른 팀원이 있는 팀이 있으면 탈퇴할 수 없다, D-131)

```sql
CREATE TABLE team_members (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    role        NVARCHAR(10) NOT NULL,                           -- 역할 (owner / manager / member)
    sort_order  INT          NOT NULL,                           -- 그 회원의 팀 목록 순서 (0 부터, 작을수록 위, D-089)
    team_id     BIGINT       NOT NULL,                           -- 팀
    user_id     BIGINT       NOT NULL,                           -- 회원
    create_date DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),  -- 합류 시각 (UTC)

    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (team_id, user_id),
    CHECK (role IN ('owner', 'manager', 'member')),
    CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX idx_team_members_team_id ON team_members (team_id) WHERE role = 'owner';
CREATE INDEX idx_team_members_user_id ON team_members (user_id, sort_order);
```

### notifications (알림)
- 회원에게 보내는 알림. notification_type (D-024 → D-127, D-128):
  - team_invite(팀 초대): team_id, sender_nickname, sender_user_id 있음, task_id 없음. 한 행이 곧 답을 기다리는 초대. 수락·거절·취소하면 지운다 (D-095, D-120). 유효기간 없음 (D-094)
  - task_assigned(작업자 지정): team_id, task_id, sender_nickname, sender_user_id 있음 (D-127)
  - due_soon(마감 임박): task_id 있음, sender 없음. 팀 작업이면 team_id 있음, 개인 작업이면 NULL (D-128)
- 한 팀에서 한 회원에게 답을 기다리는 초대는 1개 (D-093, team_invite 조건의 UNIQUE 필터 인덱스). 마감 임박은 작업마다 회원당 1개 (due_soon 조건의 UNIQUE 필터 인덱스)
- sender_nickname: 보낸 회원의 그 시점 닉네임 (보낸 회원이 탈퇴하거나 팀을 나가도 남는다). sender_user_id: 초대 취소 권한 확인용 (D-120). 보낸 회원이 탈퇴하면 NULL 로 바꾼다
- is_read: 알림 창을 열면 그 회원의 알림을 모두 1로 바꾼다 (D-096)
- 지우는 때
  - 팀을 해체하면 함께 지운다 (team_id ON DELETE CASCADE)
  - 작업을 지우는 처리(작업 삭제, 팀 해체, 회원 탈퇴로 개인 작업 삭제)는 그 작업의 알림을 먼저 지운 뒤 작업을 지운다 (task_id 는 tasks 와 teams 두 경로로 이어져 CASCADE 를 걸 수 없다)
  - 회원이 팀을 나가면(탈퇴·내보내기) 그 회원이 받은 그 팀의 task_assigned·due_soon 알림을 지운다 (D-127)
  - due_soon 은 작업이 완료되거나 기간이 바뀌거나 그 회원이 작업자에서 빠지면 지운다 (D-128)
  - 회원이 탈퇴하면 그 회원이 받은 알림을 모두 지운다

```sql
CREATE TABLE notifications (
    id                BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    notification_type NVARCHAR(20) NOT NULL,                           -- 종류 (team_invite / task_assigned / due_soon)
    sender_nickname   NVARCHAR(8)  NULL,                               -- 보낸 회원의 그 시점 닉네임 (due_soon 이면 NULL)
    user_id           BIGINT       NOT NULL,                           -- 받는 회원
    sender_user_id    BIGINT       NULL,                               -- 보낸 회원 (초대 취소 권한 확인용, 탈퇴하면 NULL)
    team_id           BIGINT       NULL,                               -- 팀 (개인 작업의 due_soon 이면 NULL)
    task_id           BIGINT       NULL,                               -- 작업 (team_invite 이면 NULL)
    is_read           BIT          NOT NULL DEFAULT 0,                 -- 알림 창에서 본 여부
    create_date       DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),  -- 알림 시각 (UTC)

    FOREIGN KEY (user_id)        REFERENCES users(id),
    FOREIGN KEY (sender_user_id) REFERENCES users(id),
    FOREIGN KEY (team_id)        REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id)        REFERENCES tasks(id),
    CHECK (notification_type IN ('team_invite', 'task_assigned', 'due_soon')),
    CHECK (
        (notification_type = 'team_invite' AND team_id IS NOT NULL AND task_id IS NULL AND sender_nickname IS NOT NULL)
        OR (notification_type = 'task_assigned' AND team_id IS NOT NULL AND task_id IS NOT NULL AND sender_nickname IS NOT NULL)
        OR (notification_type = 'due_soon' AND task_id IS NOT NULL AND sender_nickname IS NULL AND sender_user_id IS NULL)
    )
);

CREATE UNIQUE INDEX idx_notifications_user_id_team_id ON notifications (user_id, team_id) WHERE notification_type = 'team_invite';
CREATE UNIQUE INDEX idx_notifications_user_id_task_id ON notifications (user_id, task_id) WHERE notification_type = 'due_soon';
CREATE INDEX idx_notifications_user_id ON notifications (user_id, create_date);
CREATE INDEX idx_notifications_task_id ON notifications (task_id);
```

### team_invite_declines (초대 거절 기록)
- 초대를 거절하면 한 행을 남긴다. 같은 팀은 거절 시각부터 24시간 동안 그 회원을 다시 초대할 수 없다 (D-121). 연결 테이블
- 같은 팀·회원이 다시 거절하면 기존 행을 지우고 새로 만든다 (UNIQUE)
- 초대하거나 거절할 때 24시간 지난 행을 함께 지운다 (D-122)
- 팀을 해체하면 함께 지운다 (ON DELETE CASCADE). 회원이 탈퇴하면 그 회원의 행을 지운다

```sql
CREATE TABLE team_invite_declines (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    team_id     BIGINT    NOT NULL,                              -- 초대한 팀
    user_id     BIGINT    NOT NULL,                              -- 거절한 회원
    create_date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),     -- 거절 시각 (UTC)

    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (team_id, user_id)
);
```

### 히스토리
- 따로 테이블을 두지 않는다. tasks 중 status = 'done' 이고 done_date 가 지금(UTC)보다 7일 이상 지난 행이 히스토리 작업이다 (D-015, D-066, D-113)
- 히스토리 작업은 칸반에서 빠지고 읽기 전용이다. 완료 공간의 순서(sort_order)를 다시 매길 때는 히스토리 작업을 빼고 매긴다 (히스토리 작업의 sort_order 는 쓰지 않는다)
