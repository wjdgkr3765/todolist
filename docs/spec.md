# spec.md

기술 스택, 의존성을 정리한다.

(D-002, D-017, D-027, D-033, D-169. 버전은 2026-11-06 npm 최신 기준 (pg 는 2026-11-13). 설치할 때 npm audit 로 취약점을 확인한다)

---

## 1. 스택
|구분|선택|버전|
|---|---|---|
|런타임|Node.js LTS|24.x|
|프레임워크|백엔드 Express / 프론트엔드 Vue 3 + Vite|express 5.3.0 / vue 3.5.45 / vite 8.3.6|
|언어|JavaScript|ES2022|
|스타일링|Bootstrap|5.3.8|
|DB|PostgreSQL, Supabase 무료 (pg 패키지로 직접 쿼리, 파라미터 바인딩) (D-169)|16 이상 (Supabase 새 프로젝트 기본 버전, 구현 때 확인)|
|테스트 도구|Vitest (백엔드: supertest, 프론트엔드: @vue/test-utils + jsdom)|vitest 5.1.0 / supertest 7.3.1 / @vue/test-utils 2.5.1 / jsdom 31.0.0|


---

## 2. 의존성
|이름|버전|용도|
|---|---|---|
|express|5.3.0|백엔드 웹 서버|
|pg|8.23.1|PostgreSQL(Supabase) 접속. mssql 12.7.14 를 대신한다 (D-169)|
|bcrypt|6.0.0|비밀번호·인증번호 해시|
|nodemailer|10.3.1|Gmail SMTP 메일 발송|
|cookie-parser|1.4.7|로그인 쿠키 읽기|
|socket.io / socket.io-client|4.8.4|실시간 반영 (socket.io-client 는 백엔드 테스트에도 개발 의존성으로 쓴다)|
|vue|3.5.45|프론트엔드 프레임워크|
|vite / @vitejs/plugin-vue|8.3.6 / 6.0.10|빌드·개발 서버, Vue SFC|
|vue-router|5.4.0|화면 이동|
|pinia|4.1.0|로그인 정보, 선택한 개인/팀 상태 관리|
|bootstrap|5.3.8|스타일, 레이아웃|
|bootstrap-icons|1.13.2|아이콘|
|pretendard|1.3.9|기본 글꼴 (OFL-1.1, 동적 서브셋) (D-043)|
|vuedraggable|4.1.0 (next 태그, Vue 3용, sortablejs 1.14.0 포함)|칸반 드래그|
|@tiptap/vue-3, @tiptap/core, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-table, @tiptap/extension-text-style|3.32.0 (2026-10-13, 같은 버전으로 맞춤)|일일보고 리치 에디터 (D-155). starter-kit(굵게·기울임·취소선·목록·구분선·링크), table(표), text-style(글자 색). 읽기 전용 보기도 같은 편집기로 그린다 (v-html 쓰지 않음)|
|sanitize-html|2.18.1|백엔드. 일일보고 HTML 을 허용한 태그·속성만 남기고 정화 (D-155, api.md 6.12)|
|@fullcalendar/vue3|7.1.4|월간 캘린더 (D-002). 2026-11-12 공식 문서로 v7 구성 확인 (D-088): Vue 는 @fullcalendar/vue3 하나만 설치하고 월간 보기는 @fullcalendar/vue3/daygrid, 한국어는 @fullcalendar/vue3/locales/ko 하위 경로로 불러온다. @fullcalendar/core 는 Vue 에서 따로 설치하지 않는다. CSS 는 @fullcalendar/vue3/skeleton.css 만 쓰고 테마 대신 CalendarView.css 로 시안 모양을 입힌다|
|temporal-polyfill|1.0.8|@fullcalendar/vue3 v7 의 피어 의존성 (직접 import 하지 않는다)|
|vitest, supertest, @vue/test-utils, jsdom|1. 스택 표|테스트|

- 참고: 이전 프로젝트에서 @vue/test-utils → js-beautify 하위 의존성의 moderate 취약점 때문에 frontend/package.json overrides 로 glob 14.0.4, minimatch 11.0.5 를 고정했다

---

## 3. 외부 서비스
|이름|용도|설정|
|---|---|---|
|Gmail SMTP|인증번호·팀 초대 메일 (D-004)|환경 변수 MAIL_USER 등 (개발 backend/.env, 운영 Azure 앱 설정). Azure 에서 포트 587 로 보낸다|
|Supabase (무료)|DB (PostgreSQL, D-169)|운영·개발 프로젝트 2개 (무료는 2개까지). 용량 500MB, 7일 동안 DB 사용이 없으면 일시정지 (대시보드에서 다시 켬). 환경 변수 DATABASE_URL (database.md 1)|
|Azure App Service (무료 F1, Linux, Node 24 LTS)|앱 서버 (백엔드 + 빌드한 프론트엔드, D-168)|5 운영 환경|
|GitHub Actions|main 에 푸시하면 빌드·테스트 뒤 Azure 로 배포|5 운영 환경|
|공공데이터포털 한국천문연구원 특일 정보 API|캘린더 공휴일 (D-107)|환경 변수 HOLIDAY_API_KEY (backend/.env, 사용자가 발급). 호출 주소 https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo (serviceKey, solYear, numOfRows, _type=json), 응답 response.body.items.item[] 의 locdate(YYYYMMDD)·dateName·isHoliday (2026-11-12 실제 호출로 확인). 별도 npm 패키지 없이 Node.js 기본 fetch 사용|

---

## 4. 개발 환경
- 개발 포트: 백엔드 3000, 프론트엔드 5173 (Vite 개발 서버에서 /api 와 /socket.io(WebSocket) 를 백엔드로 프록시), 화면 시안 미리보기 5199
- 개발 DB: Supabase 개발 프로젝트(todolist-dev). 백엔드 테스트도 이 프로젝트를 쓴다. 회사 보안 프로그램 때문에 회사 PC 에서 Supabase 접속(포트 5432, TLS)이 막히면 사용자에게 알리고 PC 에 PostgreSQL 을 설치하는 방법으로 바꿀지 묻는다

---

## 5. 운영 환경 (배포, D-167~D-170)
- 주소: Azure 가 주는 `https://{앱 이름}.azurewebsites.net` 하나 (도메인을 사지 않는다). HTTPS 만 허용(HTTPS Only 켬)
- 구성: Azure App Service 하나에서 백엔드가 API(/api), 실시간(/socket.io), 빌드한 프론트엔드 화면을 함께 보낸다. 같은 출처라 로그인 쿠키(SameSite=Strict)를 그대로 쓰고 CORS 를 열지 않는다
- App Service: 요금제 Free(F1), Linux, 런타임 NODE|24-lts, 지역 Korea Central, Web sockets 켬. 시작 명령 `npm start` (backend). 포트는 Azure 가 주는 환경 변수 PORT (없으면 3000)
- 환경 변수: Azure 앱 설정에 NODE_ENV=production, DATABASE_URL, MAIL_USER, MAIL_PASSWORD, HOLIDAY_API_KEY 를 사용자가 직접 넣는다. 운영에는 .env 파일이 없다
- 배포: GitHub Actions(.github/workflows/deploy.yml). main 에 푸시하면 ① 프론트엔드 npm ci → 테스트 → 빌드 ② 백엔드 npm ci → 빌드 결과를 backend/public 으로 복사 → 개발 의존성을 뺀 설치 ③ backend 폴더를 Azure 로 올린다. 백엔드 테스트는 DB 가 필요해서 배포 때 돌리지 않고 로컬에서 돌린다. Azure 접속 정보(게시 프로필)는 사용자가 GitHub 저장소 Secret `AZURE_WEBAPP_PUBLISH_PROFILE` 에 넣는다
- 무료 제약 (사용자 7명 기준): 실시간 연결(WebSocket) 동시 5개 → 넘으면 Socket.IO 가 HTTP 폴링으로 자동으로 바꿔 연결한다 (api.md 6.8). CPU 하루 60분, 메모리 1GB, 20분 동안 요청이 없으면 앱이 잠들고 다음 접속이 몇 초 느리다
- 운영 DB 의 테이블은 비어 있는 상태로 시작한다. 로컬 SQL Server 의 데이터는 옮기지 않는다
