# 12공급원 원본 파서 5개 비공개 회수 — B 초안

상태: **LOCAL_DRAFT / NOT_APPROVED / NOT_INSTALLED / NOT_RUN** (2026-11-07)

이 패키지는 현재 PC의 **실행 중인 Core 소스를 확인한 것이 아닙니다.** 고정 경로
`E:\ZGmini\projects\zgmini-earnings-history-pc-release`의 역사적 Git checkout에서
다섯 원본 파서만 읽고, 검증된 바이트를 비공개 control 저장소의 **전용 브랜치**에
보관하는 1회성 안전 회수 도구입니다. PC 운영 파일·DB·예약·Controller를 고치거나
`zgmini` 공개 저장소로 복사하지 않습니다. 공용 API 갱신·게시 복구의 완료 증거가 아닙니다.

## 고정 범위

- `lib/eia-calendar.mjs`
- `lib/usda-calendar.mjs`
- `lib/cftc-calendar.mjs`
- `lib/treasury-calendar.mjs`
- `lib/tic-calendar.mjs`

각 파일 1~1,000,000바이트, 일반 파일·symlink 거부, SHA-256, 필수 `export`
이름, 대표적인 고정 키 패턴 검사, `git` HEAD/작업 트리 루트/인덱스 추적 상태를
확인합니다. 외부 API 호출이나 원본 모듈 실행은 없습니다. 파일 안의 잠재적
비밀값은 자동 검사만으로 모두 검출할 수 없으므로 공개 저장소 반영 전 별도 검토가
필요합니다. `runtimeSourceVerified:false`가 정상 결과입니다.

## 승인·등록 전 필수 확인

1. 현재 `approval.json`은 `DRAFT_REQUIRES_EXACT_B_APPROVAL`이며
   `export.mjs`의 `APPROVAL_SHA`는 **해당 초안 원본 바이트** 해시입니다.
   그러므로 **실행 불가(fail-closed)** 상태입니다.
2. 별도 명시 승인 후 승인 파일의 `status`만
   `APPROVED_B_SOURCE_READONLY_EXPORT_ONCE`로 바꾸고 변경된 전체 바이트
   SHA-256을 `export.mjs`에 정확히 재고정하십시오. 경로·범위·저장소·지침은
   늘리지 마십시오.
3. 비공개 `ansqhd5774-Choi/zgmini-pc-control`에
   `codex/calendar-parser-source-stage-20261107` **전용 브랜치가 사전에 존재하는지**
   확인합니다. 미존재면 업로더는 중단하며 자동 생성하거나 `main`에 쓰지 않습니다.
4. `calendar-source-recovery-b/` 아래 `approval.json`과 `installer` 2개를
   private control에, `.github/workflows/pc-calendar-source-recovery-once.yml`을
   승인된 방식으로 등록한 뒤 정확한 `controlSha`로 일치하는 1회성 `issues:opened`
   요청만 허용하십시오. 아직 이 단계는 수행되지 않았습니다.
5. 요청 Issue 본문은 임의 코드/경로 없이 아래 고정 형태입니다. ID는 요청 시
   실제 UUID v4로 대체하고 `approvalManifestSha256`에 **승인 후 새로운 SHA**를
   넣습니다.

```json
{
  "schema": "ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_REQUEST_V1",
  "requestId": "pc-calendar-parser-recovery-UUID_V4",
  "chatId": "chat-UUID_V4",
  "operation": "calendar-parser-source-recovery-readonly-once",
  "controlRepository": "ansqhd5774-Choi/zgmini-pc-control",
  "controlSha": "EXACT_40_CHARACTER_EVENT_SHA",
  "approvalManifestSha256": "EXACT_64_CHARACTER_APPROVED_MANIFEST_SHA256"
}
```

6. 승인된 실행은 RUNNER_TEMP에만 임시 파일을 기록하고, 전부 검증된 5개 파일을
   private control **전용 브랜치**의
   `results/calendar-parser-source-b-<requestId>/lib/`에 원본 그대로 커밋합니다.
   일치하는 기존 파일은 재조회만 하며 다른 내용은 절대 덮지 않습니다.
   결과 JSON/TXT·Issue 댓글에는 원본 코드나 키가 포함되지 않습니다.
7. 담당자는 비공개 원본을 다시 검토한 뒤에만 `zgmini` 공개 PR에 선택적으로
   반영하고 관련 12공급원 통합 테스트를 수행합니다. **실제 활성 Runtime 검증·게시
   문제는 원담당의 별도 후속 실행이며 자연 예약 검증으로 대체할 수 없습니다.**

로컬 검증: `node --test calendar-source-recovery-b-20261107/installer/export.test.mjs`
