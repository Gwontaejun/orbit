# Orbit

> Record your ideas in 3D.

Orbit은 노트를 작성하고 노트 사이의 관계를 3D 그래프로 탐색할 수 있는 데스크톱 중심의 노트 애플리케이션입니다. 노션과 비슷한 편집 경험에 3D 지식 그래프를 결합해, 아이디어의 구조와 연결 관계를 시각적으로 확인할 수 있도록 만들었습니다.

## 배포 주소

**[Orbit 바로가기](https://orbit-notes.vercel.app/)**

Google 계정으로 로그인하면 사용자별 Orbit 워크스페이스가 생성되며, 작성한 노트는 Supabase에 저장됩니다. 로그인 전에는 예시 그래프를 탐색할 수 있고, 노트 열기 및 생성 시 로그인이 필요합니다.

> 현재 모바일 환경은 공식 지원 범위에 포함하지 않습니다. 데스크톱 브라우저 사용을 권장합니다.

## 주요 기능

- 노션 스타일의 리치 텍스트 노트 작성 및 편집
- 제목, 본문, 카테고리, 태그 관리
- 카테고리 자동완성 및 신규 카테고리 생성
- Enter 입력을 이용한 태그 칩 생성
- 부모·자식 구조를 지원하는 계층형 노트 목록
- 노트 선택, 하위 노트 생성 및 삭제
- 노트와 관계를 표현하는 3D 그래프
- 기본, 구형, Helix, 카테고리, 태그 레이아웃
- 카테고리 및 태그별 군집 영역 표시
- 레이아웃 전환 애니메이션
- 연결선 표시 전환 및 부모에서 자식으로 흐르는 효과
- 카메라 회전과 줌 컨트롤
- 카테고리 및 태그 필터링
- Google OAuth 로그인
- 사용자별 데이터 분리와 Supabase RLS 적용
- GitHub 연동 기반 Vercel 자동 배포

## 기술 스택

### Frontend

- React 19
- TypeScript 6
- Vite 8
- CSS Modules
- Zustand

### 3D Graph

- Three.js
- React Three Fiber
- React Three Drei
- React Three Postprocessing
- d3-force-3d

### Editor

- Tiptap 3
- React Select

### Backend & Authentication

- Supabase
- PostgreSQL
- Supabase Auth · Google OAuth
- Row Level Security

### Code Quality & Deployment

- ESLint
- Prettier
- FSD 레이어 의존성 검사
- Vercel
- GitHub 기반 CI/CD

## 프로젝트 구조

프로젝트는 Feature-Sliced Design을 기준으로 구성되어 있습니다.

```text
src/
├─ app/                         # 앱 초기화, Provider, 전역 스타일
│  ├─ providers/
│  ├─ styles/
│  └─ ui/
├─ entities/                    # 핵심 도메인 모델과 데이터 접근
│  ├─ note/
│  │  ├─ lib/layout/            # 그래프 레이아웃 계산
│  │  └─ model/
│  └─ workspace/
│     ├─ api/                   # Supabase 워크스페이스 저장소
│     └─ model/
├─ features/                    # 사용자 행동 단위 기능
│  ├─ auth/
│  └─ note-editor/
├─ shared/                      # 도메인에 종속되지 않는 공용 코드
│  ├─ api/supabase/
│  ├─ styles/
│  └─ types/
└─ widgets/                     # 독립적인 화면 구성 블록
   └─ orbit-graph/
      ├─ lib/
      ├─ model/
      └─ ui/
```

각 slice는 `index.ts`를 공개 API로 사용합니다. ESLint가 다음과 같은 역방향 의존성을 검사합니다.

```text
app → widgets → features → entities → shared
```

- `shared`는 상위 레이어를 참조할 수 없습니다.
- `entities`는 `features`, `widgets`, `app`을 참조할 수 없습니다.
- `features`는 다른 feature 또는 상위 레이어를 참조할 수 없습니다.
- 다른 slice의 내부 파일 대신 공개 `index.ts`를 통해 import합니다.

## 로컬 실행

### 요구 사항

- Node.js 20 이상
- npm
- Supabase 프로젝트

### 설치

```bash
git clone https://github.com/Gwontaejun/orbit.git
cd orbit
npm install
```

개발 서버를 실행합니다.

```bash
npm run dev
```

기본 개발 주소는 `http://localhost:5173`입니다.

## Supabase 설정

데이터베이스 테이블, 사용자 생성 트리거 및 RLS 정책은 다음 마이그레이션에 정의되어 있습니다.

```text
supabase/migrations/20260821000000_orbit_phase5.sql
```

마이그레이션에는 다음 테이블이 포함됩니다.

- `profiles`
- `workspaces`
- `notes`
- `categories`
- `tags`
- `note_tags`
- `note_relations`

Google OAuth 사용 시 Supabase의 `Authentication → URL Configuration`을 설정해야 합니다.

```text
Site URL
https://orbit-notes.vercel.app

Redirect URLs
https://orbit-notes.vercel.app
https://orbit-notes.vercel.app/**
http://localhost:5173/**
```

Google Cloud Console의 Authorized redirect URI에는 Supabase 콜백 주소를 등록합니다.

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

## 스크립트

```bash
npm run dev          # 개발 서버 실행
npm run build        # TypeScript 검사 및 프로덕션 빌드
npm run preview      # 프로덕션 빌드 미리보기
npm run lint         # ESLint 및 FSD 의존성 검사
npm run format       # Prettier 자동 포맷
npm run format:check # 포맷 상태 검사
```

## 배포

Orbit은 Vercel에 배포되어 있습니다. GitHub 저장소를 Vercel 프로젝트에 연결하면 다음 흐름으로 자동 배포됩니다.

```text
Pull Request 또는 브랜치 push → Preview Deployment
main 브랜치 push             → Production Deployment
```

## 커밋 컨벤션

Conventional Commits 형식을 사용하되 변경 내용은 한국어로 작성합니다.

```text
type(scope): 변경 내용
```

### 타입

- `feat`: 새로운 기능
- `fix`: 오류 수정
- `refactor`: 기능 변화가 없는 구조 개선
- `style`: UI 또는 CSS 변경
- `perf`: 성능 개선
- `chore`: 설정, 의존성, 빌드 작업
- `docs`: 문서 변경
- `test`: 테스트 추가 및 수정

### 작성 규칙

- `type`과 `scope`는 영문 소문자로 작성합니다.
- 변경 내용은 간결한 한국어로 작성합니다.
- 문장 끝에 마침표를 붙이지 않습니다.
- 하나의 커밋에는 하나의 목적만 담습니다.

### 예시

```text
feat(note): 노트 생성 기능 추가
fix(graph): 노드 선택 해제 시 카메라가 초기화되는 문제 수정
style(editor): 에디터 툴바 스타일 개선
perf(graph): 화면이 숨겨졌을 때 렌더링 중단
refactor(workspace): 워크스페이스 상태와 Provider 분리
chore(lint): FSD 레이어 의존성 검사 추가
docs(readme): 프로젝트 실행 및 배포 방법 추가
```
