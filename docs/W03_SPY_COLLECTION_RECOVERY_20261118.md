# W03 SPY 원자료 중단 복구

기준: 실PC coverage run 44210472996은 저장 자료 읽기 검사이며 신규 수집 성공이 아니다. 11/17 11:30 KST R47 로그는 STOP_HTTP_404 / SOURCE_COLLECTION, 신규 저장 0이다. 이후 기존 Task의 CMD는 B #2049로 fde41fa4ac02c99139171c18a03fa2b00f6956825be92f9c2b3d10da7217a955 설치가 확인됐다. embedded R35 hash fca04343f4af573944f8c08a795aed37d9672fce8246cf2aed91862d622a5dcf, 새 공식 /api/v1/bars/stocks/us/ 경로를 사용한다. 11/18 09:46 coverage 조회는 다음 11:30 실행 전이며 실제 저장 SPY는 아직 11/03이다.

사용자의 SPY 수집 문제 해결 지시와 기존 공통 B 승인 범위에서, 이미 수정·설치된 기존 Task ZGMINI-PC-Theme-Nine-R47-Private만 1회 실행한다. 기존 R181 Task-once의 검증된 인증/원문 SHA/공유 lease/one-shot claim/생성 전 검증/불명확 재실행 금지/JSON+TXT readback 구조를 R47의 별도 고정 schema/operation/manifest에 한정해 재사용한다. R181 승인이나 operation을 다른 Task로 위장 사용하지 않는다.

고정 source pin 668b0646e22a4a36e540bb6590e86e086e97df87, 승인 manifest approvals/r47-task-once/r47-task-collect-existing-20261118.json. 정확한 Task XML·action·CMD·R73/R48 네 파일 및 WMI/Task 유휴를 검사한다. Task 등록·정의·주기/명령·수집기·산식·ETF·quota·D1·SQLite 변경은 허용하지 않는다. 기존 Task의 승인된 GMH/비공개 원자료 저장/계산만 실행될 수 있다. R35의 기존 4GET/batch, 60초 간격, 64 batch 상한과 기존 일별 probe cap/checkpoint를 그대로 사용한다.

정규 입구: pc-writer-b-source-once.yml, title/operation r47-existing-task-run-once, pc-writer-b-install label, 기존 소유자 actor, UUID request/chat, manifest path+raw SHA256. 승인된 고정 entrypoint만 실행하며 generic shell이나 일반 A에 운영 쓰기를 삽입하지 않는다. 실행 수락은 수집 성공이 아니며 별도 현재 raw manifest/checkpoint/최신 SPY 거래일 readback으로 성공을 판정한다. 중복 실행 0, 새 예약/Controller/공급자 추가 없음.
