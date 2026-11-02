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
- 수정 후 로컬9개 검사 통과. 자체 lease는 다른 owner를 빼앗지 않고, 허용되지 않은 shell/operation/repo/경로를 차단한다.
- 최초 설치 source: `9533658d44a1810f96d50ae43cd67b4f1a733fba`. 수정 적용 controller source: `c491d95fdb594a729f08deff68d86e04c18a9544`. 공식 Runner `v2.338.2`, ZIP SHA256 `a1f17aa987fc8158bc7521d284912267a0d01b7c2c4684b33c86783b5e8221cc` 검증.
- 일반챗용 연결 GitHub 도구로 private README 읽기→Issue 생성→결과 댓글→결과 파일 읽기를 실제 수행했다. [최초 실행 #1](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1): PASS, CMD→고정 Node 진입, TXT·JSON 회수.
- [동시 검증 #2~#7](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/2): Runner1~6이 서로 다른 workspace에서 모두 PASS. 12:45:02.914Z~12:45:09.471Z에6개가 실제 동시 실행됐다. 각 보호 전후 hash 동일. 운영 쓰기0, Provider/D1 호출0. 이 증거는 독립 fixture 병렬 실행이며 임의 운영 쓰기6개 안전을 뜻하지 않는다.
- [의도된 실패 #9](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/9), [timeout #10](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/10)에서 FAIL 코드·첫 실패 단계·TXT/JSON·댓글 회수. 의도된 음성 검증 결과를 실제 Core 장애로 분류하지 않는다.
- [Core 충돌 fixture #11](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/11): 실제 Core 잠금을 삭제하지 않고 fixture의 쓰기 gate 차단 확인. [미승인 작업 #12](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/12): BLOCKED/OPERATION_NOT_ALLOWED. [중복 요청 #13](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/13): DUPLICATE_REUSED_NO_EXECUTION.
- 최초 Core 조회 #8의 ENOENT는 격리 worker PATH에서 schtasks.exe를 찾지 못한 controller 오류였다. System32 절대 경로로 수정했으며 [#21](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/21)에서 CORE_READONLY_DIAGNOSIS PASS. 승인 PC source `a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e`, 기존3개 task hash 불변, Core COMPLETE/게시 VERIFIED checkpoint 전진을 확인했다. 이 SHA를 개발 main으로 교체하지 않았다.
- 최초 병렬 결과 파일 일부에서 GitHub contents 동시 쓰기 충돌이 발생했으며 결과 댓글은 회수됐다. 결과 업로드만 별도 mutex로 직렬화했고 [최종 #14~#21](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/14)의8개 요청 모두 JSON·TXT2개씩 및 댓글이 확인됐다. 작업 자체를 전역 직렬화하지 않았다.
- [공통 단위검사 #20](https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/20): 승인된 불변 a735e4e source에서18/18 PASS, 단일 test worker·128MiB heap 한도. 실제 source와 요청 SHA를 기록했다. job별 임시 source/TEMP/HOME을 사용하며 기존 운영 checkout은 바꾸지 않았다.
- 전용 listener만 idle 확인 후 재시작했다. 자체 supervisor PID31716→14436, GitHub에서 전용 Runner1개 Offline 관찰 후6개 Online, 등록 자격증명 재사용 및 수정 source의 실제 후속 job 성공. 기존 Core를 중지하거나 전체 PC 네트워크를 끊지 않았다. 재부팅 후 자동 시작은 아직 직접 관찰하지 않았다.
- 실제 Startup VBS를 호출해 기존 supervisor owner/PID14436과 listener6개가 보존되는 것을 확인했다. 중복 Startup 진입이 Runner를 추가 실행하지 않았다. 이것은 재부팅 검증을 대신하지 않는다.
- ZGMINI 프로젝트 설정에 새 일반챗의 자동 요청·회수 지침을 추가하고 기존 원문 보존/저장값 일치를 확인했다. 실제 새 모델 대화가 항상 이 지침을 준수한다고 자동 보증하지 않는다.

## 기존 Core 보호와 효율

- 설치·controller 업데이트·실제 job에서 task/config 보호 hash 전후 동일. Core 수집/게시 checkpoint가 초기12:17~12:21Z에서12:53~12:56Z로 전진했다. SQLite를 열지 않았고 기존 lock 삭제·운영 파일 교체·수집/게시/D1 실행0이다.
- 이전 흐름의 CMD 전달→사용자 실행→파일 전달 단계가 이번 실검증에는 없었다. 일반챗용 도구의 요청1회→자동 댓글/결과 조회로 회수했다. 최초 smoke의 PC 실행597ms, isolation fixture 약15~16초, 승인 테스트 job 약16초였다. GitHub 대기/업로드 시간은 별도이며 기존 방식 대비 퍼센트 개선을 추정하지 않는다.
- Heavy 작업은1개씩, 최소 여유 메모리 gate를 사용한다. 현재 고정18개 suite는 단일 worker/제한 heap으로 실행하며 다른 무거운 작업의 일반 기준과 구분했다. PC 자원 부족은 해당 작업의 BLOCKED/RESOURCE_WAIT_MEMORY이며 Core 장애가 아니다.

## 산출물과 권한 경계

신규 파일은 `.github/workflows/pc-job.yml`, `config/operations.json`, `controller/{common,engine,entry,operations,supervisor,upload,worker}.mjs`, `tests/{engine,native-path}.test.mjs`, `tools/{install,update}.mjs`, README/AGENTS 및 이 문서·GENERAL_CHAT_START·INSTALL_AND_ROLLBACK이다. 초기 신규 저장소 main을 사용했고 공개 zgmini에 신규 branch를 만들지 않았다.

자동 실행은 현재 허용된 A급 진단·고정 검사만이다. B급 운영 파일 설치/수집/SQLite/D1/게시/스케줄/배포/삭제는 활성화하지 않았다. 새 executable 또는 operation은 검증·승인 범위를 등록한 뒤 사용하며 임의 shell을 허용하는 만능 원격 실행기를 만들지 않았다. C급 관리자·보안·시스템 설정은 사용자 직접 범위다.

## 자동 시작 계획과 제한

일반 사용자 권한으로 로그인 시 Startup에서 숨김 supervisor를 시작한다. 기존 PC 운영 계약의 로그인 세션 조건을 따른다. 로그인 전 Windows 서비스 연결은 관리자 설치가 필요하므로 별도 사용자 직접 실행 범위이며 자동으로 권한을 높이지 않는다.

supervisor는 6개 전용 listener를 낮은 우선순위로 실행하고 자체 실패 재시작은 bounded로 제한한다. 재부팅 이전의 자체 supervisor lease만 boot 시각으로 구분해 보관 후 정리한다. Core lock이나 다른 작업 lock은 삭제하지 않는다.

## 자동화 범위

A급 고정 진단/검산만 활성화. B급 운영 변경은 비활성. 새 실행 코드는 검증·승인된 불변 bundle로 설치한 뒤 허용목록에 연결한다. 단순 일반챗 요청에 임의 shell/source 실행 권한을 주지 않는다.

## 무료 범위

자체 PC Runner, private 결과 파일과 댓글만 사용. GitHub-hosted runner/Artifact/cache/유료서버는 사용하지 않는다. 자체 PC 전력·디스크 및 GitHub API/저장 한도는 존재한다.
