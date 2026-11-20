# 일정관리 협업 시스템 (TODO)

개인과 팀이 칸반보드와 캘린더로 할 일을 함께 관리하는 웹 서비스입니다.
팀원끼리 작업 상태(대기 / 진행 / 완료)와 작업자를 실시간으로 공유하고, 일정을 캘린더로 확인하며, 끝난 작업을 히스토리로 남깁니다.

> 이번 프로젝트는 **로컬 실행까지**가 범위입니다. 실제 서버 배포(도메인, HTTPS, 운영 메일 계정)는 하지 않습니다.

---

## 주요 기능

| 기능 | 내용 |
|---|---|
| 회원가입 / 로그인 | 이메일 인증(Gmail)과 전화번호 문자 인증(SOLAPI)을 모두 마쳐야 가입. 로그인은 24시간 유지, 5번 틀리면 10분 잠금 |
| 아이디 / 비밀번호 찾기 | 이메일 인증번호로 본인 확인 |
| 작업 페이지 | 할일 목록 → [작업 시작] → 칸반보드(대기 / 진행 / 완료). 드래그로 순서·상태 변경, 수정 내역 기록, 기간에 시간 지정 |
| 팀 | 팀 만들기, 이메일로 초대, 역할(관리자 / 부관리자 / 팀원), 작업자 지정, "내 작업만" 보기 |
| 실시간 반영 | 같은 팀 접속자 화면에 할일·작업 변경, 일일보고 제출, 새 알림을 바로 반영 (Socket.IO) |
| 알림 | 팀 초대, 작업자 지정, 마감 임박, 놓친 알람 |
| 캘린더 | 작업을 기간 막대로 표시, 공휴일 표시 (공공데이터포털) |
| 히스토리 | 완료한 지 일주일이 지난 작업 모아 보기 |
| 일일보고 | 팀 양식으로 칸반 작업을 자동으로 채운 보고 초안을 고쳐 제출. 완료 범위(지난 보고 이후 / 요일 / 날짜 / 지난 주 / 지난 달 / 오늘) |
| 알람 | 원하는 날짜·시각(24시간제)에 울리는 개인 알람. 요일 반복·매일, 공휴일에는 끄기, 화면 팝업 + 브라우저 바탕화면 알림, 놓친 알람은 알림 목록에 |
| 회원정보 | 닉네임·이메일·전화번호·비밀번호 변경, 회원 탈퇴 |

기능별 자세한 규칙은 [docs/overview.md](docs/overview.md)에 있습니다.

---

## 기술 스택

| 구분 | 사용 |
|---|---|
| 런타임 | Node.js 24 |
| 백엔드 | Express 5, mssql (SQL 직접 작성, 파라미터 바인딩), Socket.IO, nodemailer, solapi, sanitize-html, bcrypt |
| 프론트엔드 | Vue 3 + Vite, vue-router, Pinia, Bootstrap 5, Bootstrap Icons, Pretendard, FullCalendar, Tiptap, vuedraggable |
| DB | Microsoft SQL Server 2019 |
| 테스트 | Vitest (백엔드 supertest, 프론트엔드 @vue/test-utils + jsdom) |

정확한 버전은 [docs/spec.md](docs/spec.md)에 있습니다.

---

## 폴더 구조

```
todolist/
├─ backend/          백엔드 (Express, 포트 3000)
│  ├─ sql/           DB 만들기 SQL (schema.sql, alarms.sql)
│  ├─ src/           routes(API 경로) · services(업무 처리·SQL) · utils · realtime(Socket.IO)
│  └─ tests/         백엔드 테스트
├─ frontend/         프론트엔드 (Vue 3 + Vite, 포트 5173)
│  ├─ src/           views(화면) · layouts · components · stores · api · utils
│  └─ tests/         프론트엔드 테스트
└─ docs/             설계 문서와 화면 시안(docs/mockups)
```

전체 목록은 [docs/structure.md](docs/structure.md)에 있습니다.

---

## 처음 실행하기

### 1. 준비물
- **Node.js 24** (nvm 을 쓰면 `nvm install 24`)
- **SQL Server 2019** (Express 판도 됩니다)와 SSMS
- 외부 서비스 키 (필요한 기능만 쓸 수 있습니다)
  - Gmail 앱 비밀번호: 인증 메일·팀 초대 메일
  - SOLAPI API 키·발신번호: 전화번호 문자 인증 (건당 요금)
  - 공공데이터포털 "한국천문연구원 특일 정보" API 키: 캘린더 공휴일, 알람의 "공휴일에는 끄기"

### 2. DB 만들기
1. SSMS 에서 `todolist` DB 와 SQL Server 인증 로그인 계정을 만들고, 그 계정에 `todolist` DB 권한(db_owner)을 줍니다.
2. `todolist` DB 를 고른 뒤 [backend/sql/schema.sql](backend/sql/schema.sql) 전체를 실행합니다. (빈 DB 에서 한 번만)
   - 알람 기능 전에 만든 DB 라면 [backend/sql/alarms.sql](backend/sql/alarms.sql) 만 한 번 실행합니다. 이미 적용된 DB 에서는 아무것도 하지 않습니다.

### 3. 환경 변수
`backend/.env.example` 을 복사해 `backend/.env` 를 만들고 값을 채웁니다. **`.env` 는 git 에 올리지 않습니다.**

| 이름 | 내용 |
|---|---|
| `NODE_ENV` | `development` |
| `DB_SERVER`, `DB_INSTANCE` 또는 `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | DB 접속 정보 |
| `MAIL_USER`, `MAIL_PASSWORD` | Gmail 주소와 앱 비밀번호 |
| `HOLIDAY_API_KEY` | 공휴일 API 키 |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` | 문자 발송 키와 발신번호 |
| `DATA_ENCRYPTION_KEY`, `DATA_HASH_KEY` | 이메일·전화번호 암호화 키와 찾기용 해시 키 (각각 무작위 32바이트 base64) |

암호화 키는 아래 명령으로 만들고, **잃으면 저장된 이메일·전화번호를 되살릴 수 없으니 따로 보관**합니다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. 설치와 실행
백엔드와 프론트엔드를 각각 설치하고, 터미널 두 개에서 따로 실행합니다.

```powershell
cd backend; npm install; npm run dev
```

```powershell
cd frontend; npm install; npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다. 프론트엔드 개발 서버가 `/api` 와 `/socket.io` 를 백엔드(3000)로 넘겨 줍니다.

> 회사 보안 프로그램이 HTTPS 인증서를 바꿔 끼우는 환경에서는 백엔드가 Windows 인증서 저장소를 믿어야 메일이 나갑니다. `npm run dev` 에 `--use-system-ca` 가 들어 있습니다.

---

## 테스트

```powershell
cd backend; npm test
```

```powershell
cd frontend; npm test
```

- 백엔드 테스트는 `backend/.env` 의 **실제 개발 DB** 를 씁니다. 테스트 회원은 아이디가 `vt` 로 시작하고, 테스트가 끝나면 지웁니다. 메일·문자는 실제로 보내지 않고 가로챕니다.
- 프론트엔드 빌드: `cd frontend; npm run build`

---

## 화면 시안

설계 단계의 화면 시안은 [docs/mockups](docs/mockups) 에 있습니다. 서버 없이 시안 안에서 동작을 흉내 냅니다.
위쪽 "시안 상태" 선택 막대로 로딩·오류 같은 상태도 볼 수 있습니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/overview.md](docs/overview.md) | 기능, 화면 목록, 용어, 공통 디자인 값 |
| [docs/api.md](docs/api.md) | API 명세 |
| [docs/database.md](docs/database.md) | 테이블 정의 |
| [docs/decision.md](docs/decision.md) | 결정과 그 이유 (D-001 ~) |
| [docs/security.md](docs/security.md) | 보안 규칙과 보안 체크 항목 |
| [docs/todo.md](docs/todo.md) | 작업 진행 기록 |

작업 순서와 규칙은 [CLAUDE.md](CLAUDE.md) → [docs/guide.md](docs/guide.md) → [docs/loop.md](docs/loop.md) 에 있습니다.
