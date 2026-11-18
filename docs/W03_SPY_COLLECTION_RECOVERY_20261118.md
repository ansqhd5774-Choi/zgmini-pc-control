# W03 SPY 원자료 중단 복구

기준: 실PC coverage run 44210472996은 저장 자료 읽기 검사이며 신규 수집 성공이 아니다. 11/17 11:30 KST R47 로그는 STOP_HTTP_404 / SOURCE_COLLECTION, 신규 저장 0이다. 이후 기존 Task의 CMD는 B #2049로 fde41fa4ac02c99139171c18a03fa2b00f6956825be92f9c2b3d10da7217a955 설치가 확인됐다. embedded R35 hash fca04343f4af573944f8c08a795aed37d9672fce8246cf2aed91862d622a5dcf, 새 공식 /api/v1/bars/stocks/us/ 경로를 사용한다. 11/18 09:46 coverage 조회는 다음 11:30 실행 전이며 실제 저장 SPY는 아직 11/03이다.

사용자의 SPY 수집 문제 해결 지시와 기존 공통 B 승인 범위에서, 이미 수정·설치된 기존 Task ZGMINI-PC-Theme-Nine-R47-Private만 1회 실행한다. 기존 R181 Task-once의 검증된 인증/원문 SHA/공유 lease/one-shot claim/생성 전 검증/불명확 재실행 금지/JSON+TXT readback 구조를 R47의 별도 고정 schema/operation/manifest에 한정해 재사용한다. R181 승인이나 operation을 다른 Task로 위장 사용하지 않는다.

고정 source pin 668b0646e22a4a36e540bb6590e86e086e97df87, 승인 manifest approvals/r47-task-once/r47-task-collect-existing-20261118.json. 정확한 Task XML·action·CMD·R73/R48 네 파일 및 WMI/Task 유휴를 검사한다. Task 등록·정의·주기/명령·수집기·산식·ETF·quota·D1·SQLite 변경은 허용하지 않는다. 기존 Task의 승인된 GMH/비공개 원자료 저장/계산만 실행될 수 있다. R35의 기존 4GET/batch, 60초 간격, 64 batch 상한과 기존 일별 probe cap/checkpoint를 그대로 사용한다.

정규 입구: pc-writer-b-source-once.yml, title/operation r47-existing-task-run-once, pc-writer-b-install label, 기존 소유자 actor, UUID request/chat, manifest path+raw SHA256. 승인된 고정 entrypoint만 실행하며 generic shell이나 일반 A에 운영 쓰기를 삽입하지 않는다. 실행 수락은 수집 성공이 아니며 별도 현재 raw manifest/checkpoint/최신 SPY 거래일 readback으로 성공을 판정한다. 중복 실행 0, 새 예약/Controller/공급자 추가 없음.

## #2066 이후 일시 오류 수정

기존 fde41… CMD 단회 실행은 STOP_NETWORK_OR_TIMEOUT으로 종료되어 신규 저장 0이었다. 무료 bars HEAD는 502 / Retry-After 60으로 관측됐다. 기능 PR zgmini#1281(c47252fd 소스, W03 병합 73f70b84)은 R35·PLANNER만 변경한다. 연결/429/500/502/503/504는 기존 배치 예산 안에서 최대 두 번 재시도하며 Retry-After를 존중하고, 검증된 checkpoint/cursor를 재개한다. 불명확 실행·변조·부정확 봉·404는 중단한다. 일시 실패를 성공한 최신성 probe와 구분하여 6시간/하루 2회 제한의 오적용을 제거한다.

새 exact transition: fde41fa4… → 4d1cc9f180b7169e892da2fec888d08b5f7fcbfa7db285ced68cc5d09e6869c4 (219531 bytes). Source SHA c47252fd2ee66bc34f7b930e61b38cc6714add77. 기존 단회 #2066은 재사용하지 않고 새 승인 원문 및 요청 ID로 설치와 검증 실행을 각각 1회 수행한다. Task 정의·주기·산식·ETF·D1·공급자/요금제 변경 없음. 홈페이지 정상이나 Task 시작 수락을 실제 수집 성공으로 보고하지 않는다.

검증: 기능 집중 회귀 34/34, exact CAS 및 단회 admission 24/24 PASS. 운영 설치·신규 원자료 전진은 별도 결과로 확인한다.
