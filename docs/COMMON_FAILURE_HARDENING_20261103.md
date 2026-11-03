# 공통 실행·복구 보완

공통 정본의 보충 절차다. 개별 R17/R6/ER1 기능 실행이나 게시 승인을 대신하지 않는다.

1. 중복 요청은 원래 PASS/FAIL/BLOCKED/STATE_UNKNOWN과 code·firstFail을 보존한다. reused는 실행하지 않았다는 뜻이며 성공 판정이 아니다.
2. worker timeout에서 종료 확인이 안 되면 bounded 대기 후 STATE_UNKNOWN을 회수한다. 해당 request/seat/heavy lease와 worker PID를 보존한다. 전체 node 종료나 잠금 삭제를 하지 않으며, 기록된 작업 프로세스의 실제 종료를 확인한 뒤 승인된 복구로 처리한다.
3. 부분 전환은 `CONTROLLER_RECOVERY.md`의 명시적 rollback으로 처리한다. 설치 전 취소와 사후 진단 결과 대기를 구분하고 원래 실패 요청은 보존한다.
4. 대상 커밋에 별도 인프라 변경이 있으면 무조건 무시하지 않는다. 승인 manifest의 선택 필드 infrastructureEvidence(schema=ZGMINI_NON_DEPLOYED_INFRA_ACK_V1, approvalRef=해당 저장소의 병합된 PR URL, files=변경된 .github/·scripts/ 전체 path/sha256)로 정확히 대조한다. 해당 PR은 목표 커밋의 조상이어야 한다. 이 확인은 Controller 배포에 포함하지 않는 인프라 변경의 인정이며 해당 파일을 PC에 설치하지 않는다. 누락·추가·해시 불일치는 차단한다.
5. 결과 댓글과 불명확 접수의 회수는 페이지 전체를 조회한다. 조회 상한까지 도달하면 미발견으로 단정하지 않고 PAGINATION_INCOMPLETE로 중단한다. 결과 업로드 marker는 공식 Actions bot 댓글만 인정한다.
6. 상태 조회는 controllerState·maintenanceState·automationState를 분리한다. Controller 정상만으로 유지보수기의 파일/프로세스/heartbeat/수신 상태가 정상이라고 보고하지 않는다. HEALTHY도 현재 채팅의 외부 도구 접수 권한을 보장하지 않는다.

검증: Windows Node에서 관련 14개 테스트 파일 155/155 PASS. 실제 fixture 자식·손자 프로세스 timeout 검사 포함. 실제 운영 rollback 및 업무별 수집·게시·배포는 실행하지 않았다. PC 설치 여부는 별도 Runtime 결과를 따른다.
