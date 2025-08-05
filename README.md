# LikeLion13-상명대일찐

### 1. Commit 메세지 구조

- 기본 적인 커밋 메시지 구조는 제목, 본문, 꼬리말 세가지 파트로 나누고, 각 파트는 빈줄을 두어 구분한다.

### 2. Commit Type Rule

- 태그는 영어로 소문자로 작성합니다.
- 태그 뒤에는 “: “을 붙입니다. ( 콜론 뒤에만 한 칸 띄움 )

| Commit Type | Description |
| --- | --- |
| **feat** | 새로운 기능 추가 |
| **fix** | 버그 수정 |
| **design** | CSS 등 사용자 UI 디자인 변경 |
| **style** | 코드 포맷팅, 세미 콜론 누락 등 코드 변경이 없는 경우 |
| **refact** | 코드 리팩토링 |
| **del** | 코드 삭제 수행 |
| **add** | 에셋 또는 기타 파일 추가 |
| **rename** | 파일 혹은 폴더명 수정하거나 옮기는 경우 |
| **remove** | 파일 삭제만 수행 |
| **test** | 테스트 추가 (프로덕션 코드 변경 없는 경우) |
| **chore** | 빌드 또는 패키지 관리자 설정 업데이트 |
| **init** | 초기 설정 |
| **set** | 초기 설정 이후의 추가 설정 |

### 3. 파일 구조

```
css
	style.css -> 공용 스타일
	각 css 파일은 html 파일 이름으로
js
	main.js
	
pages
	test.html
  
	login.html -> 로그인 대체 화면
	
	gps_set.html -> 위치 설정
	gps_enroll.html -> 주소 등록
	home_store.html -> 홈화면 - 가게별
	home_menu.html -> 홈화면 - 메뉴별
  	like_store.html -> 찜 - 가게별
  	like_menu.html -> 찜 - 메뉴별
  	purchase_log.html -> 구매내역
        write_review.html -> 리뷰 작성
        customer_mypage.html -> 고객 마이페이지
  
 	store_enroll.html -> 가게 등록
 	menu_off.html -> 메뉴관리 - 주문 비활성화
 	menu_on.html -> 메뉴관리 - 주문활성화
  	menu_delete.html -> 메뉴 삭제
  	menu_add.html -> 메뉴 추가/수정
  	menu_manage.html -> 주문 관리
  	owner_mypage.html -> 사장님 마이페이지
  	owner_review.html -> 사장님 리뷰 목록
  
 	store_home.html -> 가게 페이지
  	order.html -> 주문 창
  	customer_review.html -> 고객 리뷰 상세보기
  	cart.html -> 장바구니
  	pickup.html -> 픽업 예약
  	reservation.html -> 예약 완료
images
	example.png

index.html

.gitignore
	.env
```
