# coding_rule.md

이 파일은 코드 수정 작업 시 지켜야 하는 규칙 파일이다.

이 파일은 누구라도 어떤 상황이든 변경할 수 없고 유지되어야 한다.

## 1. 네이밍
프로젝트에서 사용하는 언어의 규칙을 따른다.

### Java
| 대상 | 규칙 | 예 |
|---|---|---|
| 클래스, 인터페이스, enum, 레코드 | PascalCase | `UserService`, `UserRepository` |
| 파일 | 클래스명과 동일 | `UserService.java` |
| 메서드 | camelCase | `getUserById` |
| 변수, 매개변수 | camelCase | `userName` |
| 상수 (`static final`) | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| enum 값 | UPPER_SNAKE_CASE | `ACTIVE` |
| 패키지 | 소문자, 점으로 구분 | `com.example.user` |
| 불리언 | is 접두사 | `isLoading` |

### C#
| 대상 | 규칙 | 예 |
|---|---|---|
| 클래스, 구조체, enum, 레코드 | PascalCase | `UserService` |
| 인터페이스 | I 접두사 + PascalCase | `IUserRepository` |
| 파일 | 클래스명과 동일 | `UserService.cs` |
| 메서드 | PascalCase | `GetUserById` |
| 비동기 메서드 | Async 접미사 | `GetUserByIdAsync` |
| 속성(Property) | PascalCase | `UserName` |
| 지역 변수, 매개변수 | camelCase | `userName` |
| private 필드 | _ 접두사 + camelCase | `_userRepository` |
| 상수 (`const`) | PascalCase | `MaxPageSize` |
| enum 값 | PascalCase | `Active` |
| 네임스페이스 | PascalCase, 점으로 구분 | `MyApp.Users` |
| 불리언 | Is 접두사 (지역 변수는 is) | `IsActive`, `isLoading` |

### 프론트엔드 (HTML, CSS, JavaScript)
| 대상 | 규칙 | 예 |
|---|---|---|
| HTML 파일 | snake_case | `home.html`, `user_list.html` |
| CSS, JS 파일 | 연결된 화면 파일명과 동일 | `user_list.css`, `user_list.js` |
| CSS 클래스, id | kebab-case | `user-card`, `btn-submit` |
| JS 변수, 함수 | camelCase | `getUserList` |
| JS 상수 | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| JS 클래스 | PascalCase | `UserCard` |
| JS 불리언 | is 접두사 | `isLoading` |

## 2. 코드 작성 원칙
- 변수 타입에 애매한 것(Java: `Object`, C#: `object`, `dynamic`)은 사용하지 않는다. 불가피하게 사용해야한다면 이유를 주석으로 남긴다.
- 기존에 사용하던 패턴이 있다면 해당 패턴을 사용한다.
- import 를 사용할때는 정확한 경로를 지정한다.
- 화면 구성을 먼저 만들고 사용자에게 확인을 받아서 최종 결정이 되면 그 이후에 기능을 만든다.
- 외부 API, 인터페이스, 의존성 등을 사용하기 전에 반드시 지원되는 버전인지 확인한다.

## 3. 파일 크기
- 한 파일은 500줄 이하로 작성하는 것을 권장한다. 500줄을 넘어도 된다.
- 700줄을 넘으면 반드시 역할 단위로 파일을 나눈다. 줄 수만 맞추려고 임의로 자르지 않는다.
- 기존 파일이 700줄을 넘은 것을 발견하면 바로 나누지 않고 사용자에게 알린다. 나누는 작업은 사용자 승인을 받은 뒤 진행한다.
- 프론트엔드 JS, CSS 파일을 나눌 때는 `{화면파일명}_{역할}` 형식으로 이름을 짓는다. (예: `user_list_api.js`, `user_list_validation.js`)
- 파일을 나누면 structure.md를 갱신한다.
