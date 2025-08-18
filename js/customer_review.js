// 고객 리뷰 페이지 JavaScript - API 연동
document.addEventListener("DOMContentLoaded", () => {
  
  // 기본 설정
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;
  
  // DOM 요소들
  const $topTitle = document.querySelector(".top_title");
  const $reviewList = document.querySelector(".review_list");
  const $backArrow = document.querySelector("#back_arrow");
  
  // 상태 관리
  const state = {
    storeId: null,
    storeInfo: null,
    reviews: [],
    cursor: null,
    hasMore: true,
    loading: false
  };

  // 앱 시작
  init();

  async function init() {
    console.log("=== CUSTOMER_REVIEW.JS 초기화 시작 ===");
    
    // URL 파라미터에서 storeId 추출
    extractStoreId();
    
    if (!state.storeId) {
      alert("가게 정보를 찾을 수 없습니다.");
      window.history.back();
      return;
    }
    
    // 이벤트 리스너 등록
    setupEventListeners();
    
    // 가게 정보 로드 (상단 타이틀용)
    await loadStoreInfo();
    
    // 리뷰 목록 로드
    await loadReviews();
    
    // 무한 스크롤 설정
    setupInfiniteScroll();
    
    console.log("=== CUSTOMER_REVIEW.JS 초기화 완료 ===");
  }

  function extractStoreId() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeIdParam = urlParams.get('storeId');
    state.storeId = storeIdParam ? parseInt(storeIdParam, 10) : null;
    
    console.log('추출된 storeId:', state.storeId);
  }

  function setupEventListeners() {
    // 뒤로가기 버튼
    if ($backArrow) {
      $backArrow.addEventListener('click', (e) => {
        e.preventDefault();
        // store_home.html로 돌아가기
        window.location.href = `store_home.html?storeId=${state.storeId}`;
      });
    }
    
    console.log('이벤트 리스너 등록 완료');
  }

  async function loadStoreInfo() {
    try {
      console.log('가게 정보 로딩 시작...');
      
      const response = await fetch(`${API_BASE}/api/v1/store/${state.storeId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`가게 정보 로드 실패: ${response.status}`);
      }
      
      const data = await response.json();
      state.storeInfo = data.result || data;
      
      // 가게명을 상단 타이틀에 표시
      if ($topTitle && state.storeInfo.name) {
        $topTitle.textContent = state.storeInfo.name;
      }
      
      console.log('가게 정보 로딩 완료:', state.storeInfo.name);
      
    } catch (error) {
      console.error('가게 정보 로딩 실패:', error);
      // 가게 정보 실패해도 리뷰는 표시
    }
  }

  async function loadReviews() {
    if (state.loading || !state.hasMore) {
      return;
    }
    
    state.loading = true;
    
    try {
      console.log('리뷰 목록 로딩 시작... cursor:', state.cursor);
      
      // API URL 구성
      const params = new URLSearchParams();
      params.set('targetType', 'STORE');
      params.set('targetId', state.storeId.toString());
      params.set('offset', PAGE_SIZE.toString());
      
      if (state.cursor !== null) {
        params.set('cursor', state.cursor.toString());
      }
      
      const url = `${API_BASE}/api/v1/reviews?${params.toString()}`;
      console.log('요청 URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`리뷰 목록 로드 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('리뷰 목록 응답:', data);
      
      const result = data.result || data;
      const newReviews = result.reviews || [];
      
      // 리뷰 목록 추가
      state.reviews = state.reviews.concat(newReviews);
      
      // 페이지네이션 정보 업데이트
      state.cursor = result.cursor;
      state.hasMore = result.hasNext === true;
      
      // 리뷰 화면에 표시
      displayReviews(newReviews);
      
      console.log(`리뷰 ${newReviews.length}개 로딩 완료. 전체: ${state.reviews.length}개`);
      
    } catch (error) {
      console.error('리뷰 목록 로딩 실패:', error);
      alert('리뷰 목록을 불러오는데 실패했습니다.');
    } finally {
      state.loading = false;
    }
  }

  function displayReviews(reviews) {
    if (!$reviewList) {
      console.error('리뷰 목록 요소를 찾을 수 없음');
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    reviews.forEach(review => {
      const reviewCard = createReviewCard(review);
      fragment.appendChild(reviewCard);
    });
    
    $reviewList.appendChild(fragment);
    console.log(`리뷰 ${reviews.length}개가 화면에 표시되었습니다.`);
  }

  function createReviewCard(review) {
    // 메인 카드 컨테이너
    const card = document.createElement('article');
    card.className = 'review_card';
    
    // 리뷰 날짜
    const dateElement = document.createElement('div');
    dateElement.className = 'review_date';
    dateElement.textContent = formatDate(review.reviewDate);
    
    // 리뷰 내용
    const textElement = document.createElement('p');
    textElement.className = 'review_text';
    textElement.textContent = review.reviewContent || '리뷰 내용이 없습니다.';
    
    // 주문 메뉴 목록
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'review_items';
    
    if (review.orders && review.orders.menus) {
      // 메뉴별로 수량을 합계
      const menuMap = new Map();
      review.orders.menus.forEach(menu => {
        const name = menu.name;
        const quantity = menu.quantity || 1;
        
        if (menuMap.has(name)) {
          menuMap.set(name, menuMap.get(name) + quantity);
        } else {
          menuMap.set(name, quantity);
        }
      });
      
      // 합계된 메뉴 목록 표시
      menuMap.forEach((totalQuantity, menuName) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'item_row';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = menuName;
        
        const qtySpan = document.createElement('span');
        qtySpan.className = 'qty';
        qtySpan.textContent = `${totalQuantity}개`;
        
        itemRow.appendChild(nameSpan);
        itemRow.appendChild(qtySpan);
        itemsContainer.appendChild(itemRow);
      });
    }
    
    // 카드 구성
    card.appendChild(dateElement);
    card.appendChild(textElement);
    card.appendChild(itemsContainer);
    
    return card;
  }

  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayOfWeek = days[date.getDay()];
      
      return `${month}월 ${day}일 (${dayOfWeek})`;
    } catch (error) {
      console.error('날짜 포맷 실패:', error);
      return '날짜 정보 없음';
    }
  }

  function setupInfiniteScroll() {
    // 센티넬 요소 생성 (무한 스크롤 감지용)
    const sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    sentinel.style.height = '1px';
    sentinel.style.visibility = 'hidden';
    $reviewList.appendChild(sentinel);
    
    // Intersection Observer 설정
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !state.loading && state.hasMore) {
            console.log('센티넬 감지 - 추가 리뷰 로딩');
            loadReviews();
          }
        });
      }, {
        rootMargin: '200px', // 200px 전에 미리 로드
        threshold: 0
      });
      
      observer.observe(sentinel);
      
      // 더 이상 로드할 데이터가 없으면 observer 해제
      const checkHasMore = () => {
        if (!state.hasMore) {
          observer.disconnect();
          sentinel.remove();
          console.log('모든 리뷰 로딩 완료 - observer 해제');
        }
      };
      
      // 주기적으로 hasMore 상태 확인
      const interval = setInterval(() => {
        if (!state.hasMore) {
          checkHasMore();
          clearInterval(interval);
        }
      }, 1000);
      
    } else {
      // IntersectionObserver를 지원하지 않는 구형 브라우저용 폴백
      console.log('IntersectionObserver 미지원 - 스크롤 이벤트 사용');
      
      window.addEventListener('scroll', () => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
        
        if (nearBottom && !state.loading && state.hasMore) {
          console.log('스크롤 바닥 근처 도달 - 추가 리뷰 로딩');
          loadReviews();
        }
      });
    }
    
    console.log('무한 스크롤 설정 완료');
  }
});