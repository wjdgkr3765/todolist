-- 알람 기능 DB 바꾸기 (D-177, D-179, database.md alarms·notifications)
-- 실행: SSMS 에서 todolist DB 를 선택하고 이 파일 전체를 한 번만 실행한다. 이미 alarms 가 있으면 아무것도 하지 않는다
-- 새 DB 는 schema.sql 에 같은 내용이 들어 있다

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON; -- 필터 인덱스(WHERE 가 있는 인덱스)에 필요
SET ANSI_NULLS ON;

IF OBJECT_ID(N'dbo.alarms', N'U') IS NOT NULL
BEGIN
    PRINT N'alarms 테이블이 이미 있어 아무것도 하지 않았습니다.';
    RETURN;
END;

BEGIN TRANSACTION;

-- alarms (알람)
CREATE TABLE alarms (
    id             BIGINT IDENTITY(1,1) PRIMARY KEY,                -- 기본키
    title          NVARCHAR(30) NULL,                               -- 알람 이름 (없으면 NULL)
    alarm_time     TIME(0)      NOT NULL,                           -- 울릴 시각 (한국 시간, 분 단위)
    alarm_date     DATE         NULL,                               -- 한 번 울리는 날짜 (요일 알람이면 NULL)
    weekdays       TINYINT      NOT NULL DEFAULT 0,                 -- 반복 요일 비트 (월 1 ~ 일 64, 0 이면 한 번)
    user_id        BIGINT       NOT NULL,                           -- 알람 주인
    is_on          BIT          NOT NULL DEFAULT 1,                 -- 켜짐 여부
    is_holiday_off BIT          NOT NULL DEFAULT 0,                 -- 공휴일에는 끄기 (요일 알람만)
    next_fire_date DATETIME2    NULL,                               -- 다음에 울릴 시각 (UTC, 꺼져 있으면 NULL)
    create_date    DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),  -- 생성 시각 (UTC)

    FOREIGN KEY (user_id) REFERENCES users(id),
    CHECK (weekdays BETWEEN 0 AND 127),
    CHECK ((weekdays = 0 AND alarm_date IS NOT NULL AND is_holiday_off = 0) OR (weekdays > 0 AND alarm_date IS NULL)),
    CHECK ((is_on = 1 AND next_fire_date IS NOT NULL) OR (is_on = 0 AND next_fire_date IS NULL))
);

CREATE INDEX idx_alarms_user_id ON alarms (user_id, next_fire_date);

-- notifications: alarm_id 컬럼 추가 (기존 행은 NULL)
ALTER TABLE notifications ADD alarm_id BIGINT NULL; -- 알람 (alarm_missed 만)

-- 아래는 방금 더한 alarm_id 를 쓰므로 실행할 때 해석되도록 EXEC 로 실행한다
EXEC(N'ALTER TABLE notifications ADD FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE;');

-- 이름 없이 만든 두 CHECK 를 지우고 alarm_missed 를 넣은 것으로 다시 만든다
DECLARE @dropChecks NVARCHAR(MAX) = N'';
SELECT @dropChecks = @dropChecks + N'ALTER TABLE notifications DROP CONSTRAINT ' + QUOTENAME(name) + N';'
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.notifications');
EXEC(@dropChecks);

EXEC(N'ALTER TABLE notifications ADD
    CHECK (notification_type IN (''team_invite'', ''task_assigned'', ''due_soon'', ''alarm_missed'')),
    CHECK (
        (notification_type = ''team_invite'' AND team_id IS NOT NULL AND task_id IS NULL AND alarm_id IS NULL AND sender_nickname IS NOT NULL)
        OR (notification_type = ''task_assigned'' AND team_id IS NOT NULL AND task_id IS NOT NULL AND alarm_id IS NULL AND sender_nickname IS NOT NULL)
        OR (notification_type = ''due_soon'' AND task_id IS NOT NULL AND alarm_id IS NULL AND sender_nickname IS NULL AND sender_user_id IS NULL)
        OR (notification_type = ''alarm_missed'' AND alarm_id IS NOT NULL AND team_id IS NULL AND task_id IS NULL AND sender_nickname IS NULL AND sender_user_id IS NULL)
    );');

EXEC(N'CREATE UNIQUE INDEX idx_notifications_user_id_alarm_id ON notifications (user_id, alarm_id) WHERE notification_type = ''alarm_missed'';');
EXEC(N'CREATE INDEX idx_notifications_alarm_id ON notifications (alarm_id);');

COMMIT TRANSACTION;
PRINT N'알람 테이블을 만들고 알림 테이블을 바꿨습니다.';
