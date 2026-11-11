# spec.md

기술 스택, 의존성을 정리한다.

(D-002, D-017, D-027, D-033. 버전은 2026-11-06 npm 최신 기준. 설치할 때 npm audit 로 취약점을 확인한다)

---

## 1. 스택
|구분|선택|버전|
|---|---|---|
|런타임|Node.js LTS|24.x|
|프레임워크|백엔드 Express / 프론트엔드 Vue 3 + Vite|express 5.3.0 / vue 3.5.45 / vite 8.3.6|
|언어|JavaScript|ES2022|
|스타일링|Bootstrap|5.3.8|
|DB|Microsoft SQL Server (mssql 패키지로 직접 쿼리, 파라미터 바인딩)|2019|
|테스트 도구|Vitest (백엔드: supertest, 프론트엔드: @vue/test-utils + jsdom)|vitest 5.1.0 / supertest 7.3.1 / @vue/test-utils 2.5.1 / jsdom 31.0.0|


---

## 2. 의존성
|이름|버전|용도|
|---|---|---|
|express|5.3.0|백엔드 웹 서버|
|mssql|12.7.14|SQL Server 접속 (기본 드라이버 tedious)|
|bcrypt|6.0.0|비밀번호·인증번호 해시|
|nodemailer|10.3.1|Gmail SMTP 메일 발송|
|cookie-parser|1.4.7|로그인 쿠키 읽기|
|socket.io / socket.io-client|4.8.4|실시간 반영|
|vue|3.5.45|프론트엔드 프레임워크|
|vite / @vitejs/plugin-vue|8.3.6 / 6.0.10|빌드·개발 서버, Vue SFC|
|vue-router|5.4.0|화면 이동|
|pinia|4.1.0|로그인 정보, 선택한 개인/팀 상태 관리|
|bootstrap|5.3.8|스타일, 레이아웃|
|bootstrap-icons|1.13.2|아이콘|
|pretendard|1.3.9|기본 글꼴 (OFL-1.1, 동적 서브셋) (D-043)|
|vuedraggable|4.1.0 (next 태그, Vue 3용, sortablejs 1.14.0 포함)|칸반 드래그|
|@tiptap/vue-3, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-table, @tiptap/extension-text-style|3.32.0 (2026-10-13, 같은 버전으로 맞춤)|일일보고 리치 에디터 (D-155). starter-kit(굵게·기울임·취소선·목록·구분선·링크), table(표), text-style(글자 색). 읽기 전용 보기도 같은 편집기로 그린다 (v-html 쓰지 않음)|
|sanitize-html|2.18.1|백엔드. 일일보고 HTML 을 허용한 태그·속성만 남기고 정화 (D-155, api.md 6.12)|
|@fullcalendar/vue3, @fullcalendar/core|7.1.4|월간 캘린더 (D-002). v7은 temporal-polyfill 피어 의존성 필요, @fullcalendar/daygrid는 6.1.22까지만 있어 v7 구성은 캘린더 작업 때 공식 문서로 확인|
|vitest, supertest, @vue/test-utils, jsdom|1. 스택 표|테스트|

- 참고: 이전 프로젝트에서 @vue/test-utils → js-beautify 하위 의존성의 moderate 취약점 때문에 frontend/package.json overrides 로 glob 14.0.4, minimatch 11.0.5 를 고정했다

---

## 3. 외부 서비스
|이름|용도|설정|
|---|---|---|
|Gmail SMTP|인증번호·팀 초대 메일 (D-004)|환경 변수 MAIL_USER 등 (backend/.env)|
|공공데이터포털 한국천문연구원 특일 정보 API|캘린더 공휴일 (D-107)|환경 변수 HOLIDAY_API_KEY (backend/.env, 사용자가 발급). 호출 주소·응답 형식은 구현 때 공식 문서로 확인. 별도 npm 패키지 없이 Node.js 기본 fetch 사용|

---

## 4. 개발 환경
- 개발 포트: 백엔드 3000, 프론트엔드 5173 (Vite 개발 서버에서 /api 와 /socket.io(WebSocket) 를 백엔드로 프록시), 화면 시안 미리보기 5199
