# structure.md

해당 파일은 폴더 구조와 간단한 설명을 정리한 파일이다.

---

## 규칙

1. 이 파일에서 수정할 수 있는 곳은 "변경 가능" 목록뿐이다. 이 규칙과 "변경 불가능" 목록을 포함한 나머지 부분은 수정하지 않는다.
2. "변경 가능" 목록
   - 목록의 항목(경로, 파일명, 설명)은 추가, 수정, 삭제할 수 있다.
   - 폴더나 파일을 만들거나 옮기거나 지우면, 실제 구조와 맞도록 이 목록을 바로 갱신한다. `프로젝트/backend/`와 `프로젝트/frontend/` 하위 구조가 바뀔 때도 같다.
3. "변경 불가능" 목록
   - 목록에 적힌 경로와 파일명은 수정하지 않는다.
   - 목록에 항목을 추가하거나 삭제하지 않는다.
   - 목록에 적힌 실제 파일을 옮기거나 이름을 바꾸거나 삭제하지 않는다. 파일 내용은 각 문서의 규칙에 따라 수정할 수 있다.

---

## 1. 폴더 구조

### 변경 가능
|폴더구조|설명|
|---|---|
|프로젝트/backend/|백엔드 폴더 (예시)|
|프로젝트/frontend/|프론트엔드 폴더 (Vue 3 + Vite)|
|프로젝트/frontend/src/views/|화면(View) Vue 파일과 화면 설계 문서 `{화면파일명}_screen.md` (D-025)|
|프로젝트/frontend/src/views/LoginView_screen.md|로그인 화면 설계 문서|
|프로젝트/frontend/src/views/SignupView_screen.md|회원가입 화면 설계 문서|
|프로젝트/frontend/src/views/TaskView_screen.md|작업 화면 설계 문서|
|프로젝트/frontend/src/layouts/|공통 레이아웃 Vue 파일과 화면 설계 문서|
|프로젝트/frontend/src/layouts/MainLayout_screen.md|공통 레이아웃 화면 설계 문서|
|프로젝트/backend/Controllers/HomeController.cs|기본 홈컨트롤러 (예시)|
|프로젝트/.gitignore|git에서 제외할 파일 목록. 빌드 결과물과 개인 설정을 제외한다 (예시, git.md 2번)|
|프로젝트/docs/reference.md|reference 폴더 참고자료 목록 (파일명, 설명, 관련 작업). AI가 폴더를 볼 때 갱신|
|프로젝트/docs/mockups/|화면 시안 HTML. 서버 없이 바로 열어 보는 파일 (loop.md 2번 와이어프레임)|
|프로젝트/docs/mockups/login_view.html, signup_view.html, main_layout.html, task_view.html|이전 프로젝트 화면 시안 (와이어프레임 단계에서 설계와 다시 맞춰 보고 승인받는다)|

### 변경 불가능
- 프로젝트/docs/coding_rule.md
- 프로젝트/docs/database.md
- 프로젝트/docs/screen.md
- 프로젝트/docs/guide.md
- 프로젝트/docs/loop.md
- 프로젝트/docs/spec.md
- 프로젝트/docs/structure.md
- 프로젝트/docs/test.md
- 프로젝트/docs/todo.md
- 프로젝트/docs/overview.md
- 프로젝트/docs/api.md
- 프로젝트/docs/decision.md
- 프로젝트/docs/security.md
- 프로젝트/docs/git.md
- 프로젝트/docs/reference/
- 프로젝트/CLAUDE.md
