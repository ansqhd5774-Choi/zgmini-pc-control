# Windows 런타임 공통 A급 조회 — SOURCE_ONLY

현재 상태: **소스·로컬 회귀 테스트만 완료**. 이 디렉터리의 workflow 파일은 아직 `main`에 등록되지 않았고, 실제 PC 조회 증거도 아니다. B급 설치·교체·예약 실행은 전혀 하지 않는다.

## 목적

기존 Windows self-hosted Runner에서 Controller 승인 프로필의 설치 원본만 읽는다. `ACTIVE_RUNTIME.json` 존재와 SHA-256, `INSTALL_RESULT.json`, 예약 CMD/VBS, 정확히 등록된 Windows Task 이름·시간·활성화 여부 및 versions/backups 디렉터리 상태를 조사한다. 동일 파일들을 두 번 읽어 내용이나 존재가 달라졌으면 모드는 `STATE_UNKNOWN_CHANGED_DURING_READ`로 돌리고 운영 변경을 중단한다.

| 조회 모드 | 관측 조건 | 후속 B급 후보 |
| --- | --- | --- |
| `FIRST_SINGLE_CMD_UPGRADE` | 설치 원본은 안정적으로 존재, `ACTIVE_RUNTIME.json` 없음 | 최초 안전 전환의 사전검사만 가능 |
| `REPEATABLE_ACTIVE_RUNTIME` | 설치 원본·`ACTIVE_RUNTIME.json` 둘 다 안정적으로 존재 | 기존 활성 포인터 기반 반복 전환 후보 |
| `INSTALL_PREIMAGE_NOT_FOUND` / `INSTALL_PREIMAGE_UNVERIFIED` | 설치 원본 부재·크기 초과·해시 불가 | B급 설치 판단 불가 |
| `ACTIVE_PREIMAGE_UNVERIFIED` / `STATE_UNKNOWN*` | 활성 원본 불확실·검사 중 변동 | B급 설치 판단 불가 |

이 모드는 **A 조회 증거**일 뿐 B 실행 권한이 아니다. 기존 `R179` 게시 실패, `L7` 수집 실패, 공개 API `STALE`은 이 조회 성공만으로 해결되지 않는다.

## 공통 등록과 요청 계약

1. 검토된 `ZGMINI_APPROVED_RUNTIME_CAPABILITY_PROFILES_V1` JSON을 Git 정본의 `approvals/approved-runtime-a/<manifest-sha256>.json`으로 등록한다. 파일명 SHA-256과 실제 blob 바이트를 일치시킨다. 불특정 Issue path/task/쉘 선택은 허용하지 않는다.
2. 승인 프로필은 rootSegments `pc-writer/theme-config-tool`, 고정 파일 `INSTALL_RESULT.json`, `ACTIVE_RUNTIME.json`, `THEME_SCHEDULED.cmd`, `THEME_SCHEDULED.vbs`, 디렉터리 `versions`, `backups`, Task `ZGMINI-PC-Configured-Themes`(expectedHour:13) 범위를 가진다. `binding.sourceRepository/sourceBranch`가 실제 기능 저장소/브랜치와 일치해야 한다. Manifest `binding.sourceSha`는 등록 당시의 감사용 원본 SHA이며, **개별 A 조회 요청의 sourceSha가 달라져도 같은 승인 범위 내에서 다시 사용**할 수 있다. Manifest 내용이 바뀌면 독립적 정확한 해시 검토가 다시 필요하다.
3. 별도의 사전 라벨 생성 없이 고정 Issue 제목 `pc-approved-runtime-a`, 비공개 저장소 소유자 `ansqhd5774-Choi`의 최초 `opened` 요청만 허용한다. 본문 JSON의 필드는 `schema`, `requestId`, `chatId`, `operation`, `sourceRepository`, `sourceBranch`, `sourceSha`, `approvalManifestSha256` 정확히 8개다. `operation=approved-runtime-inventory-readonly`, `schema=ZGMINI_PC_APPROVED_RUNTIME_A_REQUEST_V1`.
4. Windows workflow에서 `%GITHUB_WORKSPACE%/approved-a-control`의 Git HEAD/작업 파일/고정 manifest SHA를 서로 검증한다. 승인 목록에 없는 경로·Task·프로필을 Issue가 추가할 수 없다.
5. A 프로브는 GitHub token 없이 로컬 `%RUNNER_TEMP%`에 임시 JSON만 작성한다. 업로드 단계가 파일 내용·경로·Task 인수·환경변수를 배제하고 fingerprint/메타데이터만 `results/approved-runtime-a-<requestId>.json/.txt`에 create-only로 저장·2/2 readback 검증 후 원 Issue에 댓글을 남긴다. 조회 중 PC의 운영 파일·DB·예약을 변경하지 않는다.

## 다음 필수 단계

1. 기존 공통 A 조회기 `theme-generic-a/controller/approved-runtime-inventory-readonly.mjs`를 실제 코드를 수정하지 않고 재사용한다. 이 파일을 같은 경로로 PR에 포함하면 현재 `run.mjs`의 상대 import를 유지할 수 있고, Controller 자체 설치·교체가 필요 없다.
2. 고정 manifest 내용을 보안 검토하고 실제 Git HEAD 바이트·SHA로 등록한다. `pc-approved-runtime-a-once.yml`은 `.github/workflows/`로 이동한다. PC Workflow/Runner 설치·가동은 별도 실제 확인이 필요하다.
3. 승인된 1회 실제 PC A 조회의 **고유 requestId**를 발행하고 JSON/TXT 원본을 회수해 `FIRST/REPEATABLE/UNKNOWN` 상태를 확정한다. 이 결과를 B급 정규 manifest·해시·원본 백업 계약과 연결한다.
4. 그다음 기능 담당자가 승인된 B로 설치→수집→계산→D1→API→UI를 복구한다. 장래 예약 검증은 전 단계가 완료된 후 별도 진행한다.

로컬 검증: `node --test windows-runtime-mode-a/approved-runtime-a.test.mjs theme-generic-a/tests/*.test.mjs` (2026-11-08, **34/34 통과**, Windows 실PC 미검증).
