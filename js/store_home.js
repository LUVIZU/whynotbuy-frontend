// 가게 상세 페이지 JavaScript
document.addEventListener("DOMContentLoaded", () => {
  
  /* ========= 기본 설정 ========= */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10; // 한 번에 가져올 메뉴 개수
  
  /* ========= DOM 요소들 선택 ========= */
  // 상단 가게명 타이틀
  const $topTitle = document.querySelector(".top_title");
  
  // 가게 정보 영역
  const $businessHours = document.querySelector(".business_hours");
  const $address = document.querySelector(".address");
  const $copyIcon = document.querySelector(".copy_logo"); // 주소 복사 아이콘
  
  // 리뷰 요약 영역
  const $reviewText = document.querySelector(".review_text");
  const $reviewMore = document.querySelector(".review_more"); // 리뷰 자세히 보기 링크
  
  // 메뉴 리스트 영역
  const $menuList = document.querySelector("#menuList");
  const $menuTemplate = document.querySelector("#menuItemTpl"); // 메뉴 템플릿
  
  // 장바구니 버튼
  const $floatingCart = document.querySelector("#floatingCart");

  /* ========= 🔧 상태 관리 ========= */
  const state = {
    storeId: null,        // URL에서 추출한 가게 ID
    storeInfo: null,      // 가게 정보 객체
    menus: [],           // 불러온 메뉴 목록
    cursor: null,        // 다음 페이지를 위한 커서
    hasMoreMenus: true,  // 더 불러올 메뉴가 있는지
    loading: false       // API 요청 중인지 확인
  };

  /* ========= 초기화 함수 ========= */
  function init() {
    // URL에서 storeId 추출
    extractStoreId();
    
    // storeId가 없으면 에러 처리
    if (!state.storeId) {
      alert("가게 정보를 찾을 수 없습니다.");
      window.history.back(); // 이전 페이지로 돌아가기
      return;
    }
    
    // 가게 정보 로드
    loadStoreInfo();
    
    // 리뷰 요약 로드
    loadReviewSummary();
    
    // 메뉴 목록 로드 (첫 페이지)
    loadMenus();
    
    // 이벤트 리스너 등록
    setupEventListeners();
  }

  /* ========= URL에서 storeId 추출 ========= */
  function extractStoreId() {
    // 현재 URL의 쿼리 파라미터를 파싱
    // 예: store_home.html?storeId=1001 → storeId = 1001
    const urlParams = new URLSearchParams(window.location.search);
    const storeIdParam = urlParams.get('storeId');
    
    // 문자열을 숫자로 변환 (parseInt 사용)
    state.storeId = storeIdParam ? parseInt(storeIdParam, 10) : null;
    
    console.log('추출된 storeId:', state.storeId);
  }

  /* ========= 가게 정보 API 호출 ========= */
  async function loadStoreInfo() {
    try {
      console.log('가게 정보 로딩 시작...');
      
      // API 호출 (fetch 사용)
      const response = await fetch(`${API_BASE}/api/v1/store/${state.storeId}`, {
        method: 'GET',
        credentials: 'include' // 쿠키/인증 정보 포함
      });
      
      // 응답이 성공적이지 않으면 에러 처리
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // JSON 데이터 파싱
      const data = await response.json();
      console.log('가게 정보 응답:', data);
      
      // 응답 구조 확인 (data.result 또는 data 직접 사용)
      const storeInfo = data.result || data;
      state.storeInfo = storeInfo;
      
      // UI에 가게 정보 표시
      renderStoreInfo(storeInfo);
      
    } catch (error) {
      console.error('가게 정보 로딩 실패:', error);
      alert('가게 정보를 불러오는데 실패했습니다.');
    }
  }

  /* ========= 가게 정보 UI 렌더링 ========= */
  function renderStoreInfo(storeInfo) {
    // 상단 타이틀에 가게명 표시
    if ($topTitle && storeInfo.name) {
      $topTitle.textContent = storeInfo.name;
    }
    
    // 영업시간 표시 (시:분 형식으로 변환)
    if ($businessHours && storeInfo.openingTime && storeInfo.closingTime) {
      // "11:00:00" → "11:00" 형식으로 변환
      const openTime = storeInfo.openingTime.slice(0, 5);
      const closeTime = storeInfo.closingTime.slice(0, 5);
      $businessHours.textContent = `영업시간 ${openTime}~${closeTime}`;
    }
    
    // 도로명 주소 표시
    if ($address && storeInfo.roadAddressName) {
      $address.textContent = storeInfo.roadAddressName;
    }
    
    console.log('가게 정보 렌더링 완료');
  }

  /* ========= 리뷰 요약 API 호출 ========= */
  async function loadReviewSummary() {
    try {
      console.log('리뷰 요약 로딩 시작...');
      
      const response = await fetch(`${API_BASE}/api/v1/reviews/${state.storeId}/summary`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('리뷰 요약 응답:', data);
      
      // 리뷰 요약 텍스트 추출
      const summary = data.result?.summary || data.summary || '';
      
      // UI에 리뷰 요약 표시
      if ($reviewText && summary) {
        $reviewText.textContent = summary;
        
        // 리뷰 텍스트가 길면 더보기/접기 기능 추가
        setupReviewToggle(summary);
      }
      
      console.log('리뷰 요약 렌더링 완료');
      
    } catch (error) {
      console.error('리뷰 요약 로딩 실패:', error);
      // 리뷰 요약은 실패해도 페이지는 정상 동작하도록 함
    }
  }

  /* ========= 메뉴 목록 API 호출 ========= */
  async function loadMenus() {
    // 이미 로딩 중이거나 더 이상 불러올 메뉴가 없으면 중단
    if (state.loading || !state.hasMoreMenus) {
      return;
    }
    
    state.loading = true; // 로딩 상태 설정
    
    try {
      console.log('메뉴 목록 로딩 시작... cursor:', state.cursor);
      
      // API URL 구성
      const url = buildMenusUrl();
      console.log('요청 URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('메뉴 목록 응답:', data);
      
      // 응답 데이터 구조 확인
      const result = data.result || data;
      const newMenus = result.menus || [];
      
      // 기존 메뉴 목록에 새 메뉴들 추가 (무한스크롤용)
      state.menus = state.menus.concat(newMenus);
      
      // 다음 페이지 정보 업데이트
      state.cursor = result.nextCursor;
      state.hasMoreMenus = result.hasData === true; // hasData가 true일 때만 더 로드
      
      // 새로 받은 메뉴들을 UI에 렌더링
      renderMenus(newMenus);
      
      console.log(`메뉴 ${newMenus.length}개 로딩 완료. 전체: ${state.menus.length}개`);
      
    } catch (error) {
      console.error('메뉴 목록 로딩 실패:', error);
      alert('메뉴 목록을 불러오는데 실패했습니다.');
    } finally {
      state.loading = false; // 로딩 상태 해제
    }
  }

  /* ========= 메뉴 API URL 구성 ========= */
  function buildMenusUrl() {
    // URLSearchParams로 쿼리 파라미터 구성
    const params = new URLSearchParams();
    
    // 한 번에 가져올 메뉴 개수
    params.set('size', PAGE_SIZE.toString());
    
    // 정렬 기준 (할인율 높은 순)
    params.set('menuSortType', 'DISCOUNT');
    
    // 다음 페이지를 위한 커서 (첫 페이지가 아닐 때만)
    if (state.cursor !== null) {
      params.set('cursor', state.cursor.toString());
    }
    
    return `${API_BASE}/api/v1/store/${state.storeId}/menus?${params.toString()}`;
  }

  /* ========= 메뉴 목록 UI 렌더링 ========= */
  function renderMenus(menus) {
    // 템플릿이 없으면 중단
    if (!$menuTemplate || !$menuList) {
      console.error('메뉴 템플릿 또는 목록 요소를 찾을 수 없음');
      return;
    }
    
    // DocumentFragment로 성능 최적화 (DOM 조작 최소화)
    const fragment = document.createDocumentFragment();
    
    // 각 메뉴 아이템 생성
    menus.forEach(menu => {
      // 템플릿 복제
      const menuItem = $menuTemplate.content.cloneNode(true);
      
      // 메뉴명
      const $menuName = menuItem.querySelector('.menu_name');
      if ($menuName) {
        $menuName.textContent = menu.name || '메뉴명 없음';
      }
      
      // 가격 정보 계산 및 표시
      renderMenuPricing(menuItem, menu);
      
      // 메뉴 이미지
      const $menuThumb = menuItem.querySelector('.menu_thumb');
      if ($menuThumb) {
        $menuThumb.src = menu.menuImage || '../images/sample_pizza.jpg'; // 기본 이미지
        $menuThumb.alt = menu.name || '메뉴 이미지';
      }
      
      // 찜하기 버튼 (현재는 이벤트만 등록, API는 나중에)
      const $likeBtn = menuItem.querySelector('.menu_like');
      if ($likeBtn) {
        $likeBtn.dataset.menuId = menu.menuId;
        $likeBtn.addEventListener('click', () => handleMenuLike(menu.menuId));
      }
      
      fragment.appendChild(menuItem);
    });
    
    // 실제 DOM에 추가 (기존 목록에 이어서)
    $menuList.appendChild(fragment);
  }

  /* ========= 메뉴 가격 정보 렌더링 ========= */
  function renderMenuPricing(menuItem, menu) {
    const originalPrice = menu.price || 0;
    const discountPercent = menu.discountPercent || 0;
    
    // 할인된 가격 계산
    const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
    
    // 정가 (취소선) - 할인이 있을 때만 표시
    const $priceStrike = menuItem.querySelector('.price_strike');
    if ($priceStrike) {
      if (discountPercent > 0) {
        $priceStrike.textContent = `${originalPrice.toLocaleString()}원`;
        $priceStrike.style.display = 'block';
      } else {
        $priceStrike.style.display = 'none';
      }
    }
    
    // 할인율 - 할인이 있을 때만 표시
    const $saleRate = menuItem.querySelector('.price_sale_rate');
    if ($saleRate) {
      if (discountPercent > 0) {
        $saleRate.textContent = `${discountPercent}%`;
        $saleRate.style.display = 'inline';
      } else {
        $saleRate.style.display = 'none';
      }
    }
    
    // 판매가 (할인가 또는 정가)
    const $salePrice = menuItem.querySelector('.price_sale');
    if ($salePrice) {
      const finalPrice = discountPercent > 0 ? discountedPrice : originalPrice;
      $salePrice.textContent = `${finalPrice.toLocaleString()}원`;
    }
  }

  /* ========= 이벤트 리스너 등록 ========= */
  function setupEventListeners() {
    // 주소 복사 기능
    if ($copyIcon) {
      $copyIcon.addEventListener('click', copyAddress);
    }
    
    // 리뷰 자세히 보기
    if ($reviewMore) {
      $reviewMore.addEventListener('click', (e) => {
        e.preventDefault();
        // customer_review.html로 이동 (storeId 전달)
        window.location.href = `customer_review.html?storeId=${state.storeId}`;
      });
    }
    
    // 장바구니 버튼
    if ($floatingCart) {
      $floatingCart.addEventListener('click', () => {
        window.location.href = 'cart.html';
      });
    }
    
    // 무한 스크롤 (스크롤 이벤트)
    window.addEventListener('scroll', handleScroll);
    
    console.log('이벤트 리스너 등록 완료');
  }

  /* ========= 주소 복사 함수 ========= */
  async function copyAddress() {
    if (!state.storeInfo?.roadAddressName) {
      alert('복사할 주소가 없습니다.');
      return;
    }
    
    try {
      // 클립보드에 주소 복사
      await navigator.clipboard.writeText(state.storeInfo.roadAddressName);
      alert('주소가 복사되었습니다!');
      console.log('주소 복사 완료:', state.storeInfo.roadAddressName);
    } catch (error) {
      console.error('주소 복사 실패:', error);
      // 구형 브라우저 대안
      fallbackCopyAddress();
    }
  }

  /* ========= 주소 복사 대안 (구형 브라우저용) ========= */
  function fallbackCopyAddress() {
    const textArea = document.createElement('textarea');
    textArea.value = state.storeInfo.roadAddressName;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      alert('주소가 복사되었습니다!');
    } catch (error) {
      console.error('대안 복사도 실패:', error);
      alert('주소 복사에 실패했습니다.');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  /* ========= 무한 스크롤 처리 ========= */
  function handleScroll() {
    // 로딩 중이거나 더 이상 불러올 메뉴가 없으면 중단
    if (state.loading || !state.hasMoreMenus) {
      return;
    }
    
    // 스크롤이 거의 바닥에 도달했는지 확인
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    
    if (nearBottom) {
      console.log('📜 스크롤 바닥 근처 도달 - 추가 메뉴 로딩');
      loadMenus(); // 다음 페이지 메뉴 로드
    }
  }

  /* ========= 리뷰 요약 더보기/접기 기능 ========= */
  function setupReviewToggle(fullText) {
    if (!$reviewText || !fullText) return;
    
    // 부모 div의 높이를 자동으로 조정할 수 있도록 CSS 설정
    const $reviewSummary = document.querySelector('.review_summary');
    if ($reviewSummary) {
      $reviewSummary.style.height = 'auto';
      $reviewSummary.style.minHeight = 'auto';
    }
    
    // 리뷰 텍스트 영역 CSS 조정
    $reviewText.style.height = 'auto';
    $reviewText.style.maxHeight = 'none';
    $reviewText.style.overflow = 'visible';
    $reviewText.style.whiteSpace = 'normal';
    $reviewText.style.wordWrap = 'break-word';
    $reviewText.style.lineHeight = '1.5';
    
    // 텍스트가 짧으면 그대로 표시
    if (fullText.length <= 100) {
      $reviewText.textContent = fullText;
      return;
    }
    
    // 긴 텍스트는 축약해서 표시
    const shortText = fullText.substring(0, 37) + '...';
    let isExpanded = false;
    
    function updateDisplay() {
      if (isExpanded) {
        // 전체 텍스트 표시 - div가 자동으로 늘어남
        $reviewText.innerHTML = `
          <span style="display: block; margin-bottom: 8px;">${fullText}</span>
          <button class="review-toggle-btn" style="
            color: #666; 
            background: none; 
            border: none; 
            cursor: pointer; 
            text-decoration: underline;
            font-size: 14px;
            padding: 0;
          ">접기</button>
        `;
      } else {
        // 축약 텍스트 표시 - div가 작게 유지됨
        $reviewText.innerHTML = `
          <span style="display: block; margin-bottom: 8px;">${shortText}</span>
          <button class="review-toggle-btn" style="
            color: #666; 
            background: none; 
            border: none; 
            cursor: pointer; 
            text-decoration: underline;
            font-size: 14px;
            padding: 0;
          ">더보기</button>
        `;
      }
      
      // 버튼 이벤트 재등록
      const $toggleBtn = $reviewText.querySelector('.review-toggle-btn');
      if ($toggleBtn) {
        $toggleBtn.addEventListener('click', (e) => {
          e.preventDefault(); // 기본 동작 방지
          isExpanded = !isExpanded;
          updateDisplay();
          
          // 📱 스크롤 위치 조정 (선택사항 - 사용자 경험 향상)
          if (isExpanded) {
            // 펼쳐질 때 약간의 딜레이 후 스크롤 조정
            setTimeout(() => {
              const rect = $reviewSummary.getBoundingClientRect();
              if (rect.bottom > window.innerHeight) {
                $reviewSummary.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'nearest' 
                });
              }
            }, 100);
          }
        });
      }
    }
    
    updateDisplay();
  }

  /* ========= ❤️ 메뉴 찜하기 (API 대기중) ========= */
  function handleMenuLike(menuId) {
    console.log('메뉴 찜하기 클릭:', menuId);
    // TODO: 메뉴 찜하기 API가 나오면 구현
    alert('메뉴 찜하기 기능은 준비 중입니다.');
  }

  /* ========= 앱 시작 ========= */
  init();
  
  console.log('store_home.js 초기화 완료!');
});