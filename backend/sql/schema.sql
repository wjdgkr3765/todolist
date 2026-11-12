-- todolist 테이블 생성 SQL (database.md 4번을 생성 순서대로 모은 것)
-- 실행: SSMS 에서 todolist DB 를 선택하고 이 파일 전체를 실행한다. 테이블이 없는 빈 DB 에서 한 번만 실행한다
-- database.md 를 바꾸면 이 파일도 함께 바꾼다

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON; -- 필터 인덱스(WHERE 가 있는 인덱스)에 필요. SSMS 는 기본으로 켜져 있다
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

-- users (회원)
CREATE TABLE users (
    id               BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    login_id         NVARCHAR(15)  NOT NULL UNIQUE,                   -- 아이디
    password_hash    NVARCHAR(60)  NOT NULL,                          -- 비밀번호 bcrypt 해시 (60자)
    nickname         NVARCHAR(8)   NOT NULL,                          -- 닉네임 (중복 허용)
    email            NVARCHAR(100) NOT NULL UNIQUE,                   -- 이메일
    phone            NVARCHAR(11)  NOT NULL UNIQUE,                   -- 전화번호 (숫자 11자리, 인증 보류 D-005)
    login_fail_count INT           NOT NULL DEFAULT 0,                -- 연속으로 비밀번호를 틀린 횟수 (0~4, D-049)
    is_report_carry_over BIT       NOT NULL DEFAULT 0,                -- 일일보고 지난 보고 이어받기 켜짐 여부 (D-156)
    lock_expire_date DATETIME2     NULL,                              -- 로그인 잠금이 풀리는 시각 (UTC, 잠금 없으면 NULL)
    create_date      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(), -- 가입 시각 (UTC)

    CHECK (LEN(phone) = 11 AND phone NOT LIKE '%[^0-9]%'),
    CHECK (login_fail_count BETWEEN 0 AND 5)
);

-- login_tokens (로그인 토큰)
CREATE TABLE login_tokens (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    token_hash  NVARCHAR(64) NOT NULL UNIQUE,                    -- 토큰 SHA-256 해시 (16진수 64자)
    user_id     BIGINT       NOT NULL,                           -- 로그인한 회원
    expire_date DATETIME2    NOT NULL,                           -- 만료 시각 (로그인 + 24시간, UTC)
    create_date DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),  -- 로그인 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_login_tokens_user_id ON login_tokens (user_id);

-- email_verifications (이메일 인증번호)
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

-- teams (팀)
CREATE TABLE teams (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    name        NVARCHAR(20) NOT NULL,                           -- 팀 이름 (1~20자, 중복 허용)
    create_date DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()   -- 만든 시각 (UTC)
);

-- team_members (팀원)
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

-- todos (할일)
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

-- tasks (작업)
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

-- task_assignees (작업자)
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

-- task_logs (수정 내역)
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

-- task_log_assignees (수정 내역의 그 시점 작업자)
CREATE TABLE task_log_assignees (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    nickname    NVARCHAR(8) NOT NULL,                            -- 그 시점 작업자 닉네임
    task_log_id BIGINT      NOT NULL,                            -- 수정 내역
    create_date DATETIME2   NOT NULL DEFAULT SYSUTCDATETIME(),   -- 기록 시각 (UTC)

    FOREIGN KEY (task_log_id) REFERENCES task_logs(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_log_assignees_task_log_id ON task_log_assignees (task_log_id);

-- notifications (알림)
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

-- team_invite_declines (초대 거절 기록)
CREATE TABLE team_invite_declines (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    team_id     BIGINT    NOT NULL,                              -- 초대한 팀
    user_id     BIGINT    NOT NULL,                              -- 거절한 회원
    create_date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),     -- 거절 시각 (UTC)

    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (team_id, user_id)
);

-- report_templates (일일보고 양식)
CREATE TABLE report_templates (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    header      NVARCHAR(100) NOT NULL DEFAULT '',               -- 머리말 (0~100자, {날짜} 자리표시 가능)
    sections    NVARCHAR(MAX) NOT NULL,                          -- 구역 목록 JSON (TemplateSection[], 1~20개)
    team_id     BIGINT        NOT NULL UNIQUE,                   -- 팀 (팀마다 1개)
    update_date DATETIME2     NULL,                              -- 마지막으로 양식을 저장한 시각 (UTC, 기본 양식이면 NULL)

    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CHECK (ISJSON(sections) = 1)
);

-- daily_reports (일일보고)
CREATE TABLE daily_reports (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    report_date DATE          NOT NULL,                          -- 보고일 (한국 시간 날짜)
    status      NVARCHAR(10)  NOT NULL,                          -- 상태 (draft / submitted)
    nickname    NVARCHAR(8)   NOT NULL,                          -- 작성자의 마지막 저장 시점 닉네임 (D-160)
    header      NVARCHAR(100) NOT NULL DEFAULT '',               -- 머리말 ({날짜}를 바꾼 값)
    sections    NVARCHAR(MAX) NOT NULL,                          -- 구역 구성과 내용 JSON (ReportSection[])
    team_id     BIGINT        NOT NULL,                          -- 팀
    user_id     BIGINT        NULL,                              -- 작성자 (회원 탈퇴하면 NULL)
    draft_date  DATETIME2     NULL,                              -- 마지막 임시저장 시각 (UTC)
    submit_date DATETIME2     NULL,                              -- 처음 제출한 시각 (UTC, 제출 전이면 NULL)
    update_date DATETIME2     NULL,                              -- 마지막 수정 제출 시각 (UTC, 수정 제출 전이면 NULL)
    create_date DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(), -- 처음 저장한 시각 (UTC)

    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (status IN ('draft', 'submitted')),
    CHECK (ISJSON(sections) = 1),
    CHECK (
        (status = 'draft' AND submit_date IS NULL AND update_date IS NULL AND user_id IS NOT NULL)
        OR (status = 'submitted' AND submit_date IS NOT NULL)
    )
);

CREATE UNIQUE INDEX idx_daily_reports_team_id_user_id ON daily_reports (team_id, user_id, report_date) WHERE user_id IS NOT NULL;
CREATE INDEX idx_daily_reports_team_id ON daily_reports (team_id, report_date);
CREATE INDEX idx_daily_reports_user_id ON daily_reports (user_id);

COMMIT TRANSACTION;
