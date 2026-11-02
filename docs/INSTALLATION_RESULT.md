# 설치 및 실제 실행 증거

## 구축 기준

- 비공개 제어 저장소 생성 및 전용 Runner6개 분리 설치: 2026-11-02 사용자 승인.
- 기존 공개 zgmini/전용 테마 브랜치/PC 운영 checkout/정규 예약/SQLite/D1/배포 계약은 보존한다.
- 제어 저장소 default main은 신규 승인 저장소의 초기 branch이며 공개 zgmini에 새 작업 branch를 만든 것이 아니다.
- 기존 C:의 다른 프로젝트 Runner는 재사용·중지·재등록하지 않는다.
- 새 일반챗에는 GitHub 저장소 접근과 GENERAL_CHAT_START.md 공통 지침이 필요하다. 컨텍스트 없는 모든 새 대화에 자동 권한이 생기지 않는다.

## 최초 진단

- 공개 zgmini에 전용 Runner0개, 기존 다른 프로젝트 Runner 프로세스 존재.
- Windows x64, 12논리 스레드, 메모리15.75GiB. 최초 조회 여유0.77GiB.
- 기존 Core/Korea/Iran 작업 존재, Core 수집/게시 checkpoint 전진 관찰.
- 기존 전용 브랜치 a735e4edff07409f952dcb6cd09a03791a95c094 및 main 2b0407f7c87418280b3a2503611c7e578ed89cf7 확인. 이후 변경이 있으면 시점별로 구분한다.

## 현재 검증

- 로컬 허용목록/중복/6좌석/실패/Core 충돌 fixture/timeout/미승인 source 차단: 8개 검사 통과.
- 실제 등록/Online/Actions 요청/업로드/일반챗 연결 도구 확인은 후속 실측 결과로 갱신한다. 아직 전체 구축 완료를 뜻하지 않는다.

## 자동 시작 계획과 제한

일반 사용자 권한으로 로그인 시 Startup에서 숨김 supervisor를 시작한다. 기존 PC 운영 계약의 로그인 세션 조건을 따른다. 로그인 전 Windows 서비스 연결은 관리자 설치가 필요하므로 별도 사용자 직접 실행 범위이며 자동으로 권한을 높이지 않는다.

supervisor는 6개 전용 listener를 낮은 우선순위로 실행하고 자체 실패 재시작은 bounded로 제한한다. 재부팅 이전의 자체 supervisor lease만 boot 시각으로 구분해 보관 후 정리한다. Core lock이나 다른 작업 lock은 삭제하지 않는다.

## 자동화 범위

A급 고정 진단/검산만 활성화. B급 운영 변경은 비활성. 새 실행 코드는 검증·승인된 불변 bundle로 설치한 뒤 허용목록에 연결한다. 단순 일반챗 요청에 임의 shell/source 실행 권한을 주지 않는다.

## 무료 범위

자체 PC Runner, private 결과 파일과 댓글만 사용. GitHub-hosted runner/Artifact/cache/유료서버는 사용하지 않는다. 자체 PC 전력·디스크 및 GitHub API/저장 한도는 존재한다.
