# #1018 MarketParquet 단일 예약 폐기

기존 사용자 2026-11-16 사용 제거 및 2026-11-18 이슈 처리 지시 범위에서 `ZGMINI-PC-MarketParquet-ETF`의 Enabled만 false로 설정한다. GMH/Core Task, 운영 소스/DB/D1/산식은 변경하지 않는다. Task/원본 파일 삭제, 임의 프로세스 종료 및 공급처 호출 없음.

현재 정확한 XML/진입점과 독립 GMH Task XML을 manifest에 고정한다. 기존 Writer B Issue 인증·공유 설치 잠금·단회 claim·백업·JSON/TXT create-only readback을 재사용한다. Task COM Enabled를 실제 읽으므로 XML에서 Enabled가 생략된 것을 장애로 오판하지 않는다. 작업 Running/소유 프로세스/원본 해시 변경은 무변경 STOP. 중지 직전 재조회, 중지 후 Disabled/실행0/GMH XML 불변/Settings.Enabled 외 XML 불변을 확인한다. 모호하면 STATE_UNKNOWN이며 자동 재실행/재활성화하지 않는다.

정확 Task 비활성화와 모든 공급자 HTTP 0건은 다른 증거다. 이 실행은 향후 모든 프로세스의 무호출을 보장하지 않는다. 기존 로그와 사후 관측을 별도 대조하고, 새 주기/전역 gate/추적 예약을 추가하지 않는다.

검증: 고정 범위·서명된 actor/request/raw SHA·정상/변조/실행중/백업 실패/직전 drift/중지 불명확/GMH 변경/가짜 PASS 회귀를 실행한다. 원본 PC에서는 먼저 읽기 전용 native snapshot으로 current preimage만 확인한다.

Microsoft 공식 API: https://learn.microsoft.com/en-us/windows/win32/taskschd/registeredtask
## 2026-11-18 최초 Windows 결과 보완

#2174는 Task disable 이전 백업 flush 단계에서 EPERM으로 중단됐다. 읽기 핸들 fsync가 원인이며 쓰기/배타 생성 핸들로 수정하고 실제 TEMP 회귀를 추가했다. 이 prewrite 실패가 공유 Writer 잠금을 계속 잡지 않도록 소유 잠금 해제 범위를 수정했다(단회 journal/백업은 보존). 기존 #2174는 재실행하지 않는다.

이미 종료된 #2174가 남긴 잠금 한 건만 새 명세의 recoverPrewriteRequestId로 지정한다. 고정 run completed/failure, 정확 원격 PREFLIGHT_STOP 영수증 SHA, 현재 Task/GMH/진입점 원본 SHA 불변, 이전 백업 SHA, shared owner UUID를 독립 확인한 후 NTFS hardlink create-only로 보관하고 같은 파일 ID인 잠금만 해제한다. 다른 요청/실행중/운영 변경 불명확 상태에는 적용하지 않는다. 새 요청으로 정규 단회 중지를 이어간다.

#2179는 Actions run GET 권한 부재로 복구 전 중단됐다. 기존 #2174의 완료된 첫 실행과 create-only PREFLIGHT_STOP 영수증은 이미 검증된 사실이므로 종료 상태를 매번 조회하는 선행조건을 제거한다. immutable 원문 SHA와 일회성 원장·원본 Task/백업/owner 재조회는 유지하며 Actions 권한을 확대하지 않는다. 새 ID만 사용한다.
