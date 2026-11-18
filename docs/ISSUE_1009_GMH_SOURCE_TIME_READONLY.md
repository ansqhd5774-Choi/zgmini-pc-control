# #1009 기존 GMH 수집 요청시각의 실제 PC 검증

기존 #2166 계산/저장, #2133 D1 parity 및 기능 #1372 소스를 재사용한다. source SHA 2ca21bdcc603d80eb79156c4cca1cd9f4dc2b3cf의 순수 attestSavedGmhSevenCollectionTime만 고정 checkout에서 호출한다. 현재 PC raw manifest/checkpoint/private artifact SHA를 각 고정 값으로 검증하고 기존 30페이지를 SHA 재조회한다. 공급처 호출/재계산/원자료·DB/D1·예약·운영소스 쓰기 없음.

시각은 실제 manifest의 collectedAt(GET 요청시작)에서 계산하며 저장 완료시각이나 현재시각으로 위장하지 않는다. 14종 최신 관측일 covering 영수증의 가장 보수적인 시각을 보고한다. 원자료·가격·토큰·전체 점수는 보고하지 않는다. 공개권·상위 공급자·D1 CAS·R32 비퇴행·10개 공개 READY는 별도 판정이며 이 RO 결과로 true가 되지 않는다.

정규 기존 Writer B Workflow의 고정 읽기 전용 operation으로 실행·결과 반환한다. Controller 설치/새 Task/새 예약·사용자 CMD는 추가하지 않는다. GITHUB event SHA를 사용하며 요청에서 미래 HEAD를 예측하거나 동일 소스를 다시 설치하지 않는다.
