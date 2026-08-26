# 디자인 이미지 서명과 픽셀 검증

디자인 URL의 HTTP Content-Type만 신뢰하지 않고 최대 64KiB의 실제 파일 prefix를 읽어 이미지 형식과 크기를 확인한다.

## PNG

- 8-byte PNG signature 확인
- 첫 chunk가 IHDR인지 확인
- IHDR의 width와 height 추출

## JPEG

- SOI marker 확인
- JPEG segment를 제한된 prefix 안에서 순회
- 지원되는 SOF marker에서 width와 height 추출

응답 MIME과 실제 형식이 다르거나 header에서 유효한 크기를 읽을 수 없으면 등록을 거부한다. 각 축은 Printful 일반 파일 제한에 맞춰 1~20,000 pixels만 허용한다. width와 height는 검증 메타데이터로 저장한다.

DPI는 픽셀만으로 확정할 수 없다. 후보별 Printful placement의 실제 인쇄 너비·높이를 연결한 뒤 `pixels / print inches`로 계산해야 하므로 후속 placement guideline 작업에서 최소 DPI gate를 적용한다.
