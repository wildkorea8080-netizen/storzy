# 프로세스 release 일관성

Migration `055`부터 heartbeat는 `STORZY_RELEASE`를 기록한다. process health는 15개 역할의 최신 release를 기대 release와 비교하며 다른 digest는 `RELEASE_MISMATCH`로 판정한다.
