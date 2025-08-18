// pickup.js — 픽업 예약 페이지 (완전히 새로 작성)
document.addEventListener("DOMContentLoaded", () => {
  
  // 기본 설정
  const API_BASE = "https://api-whynotbuy.store";
  
  // DOM 요소들
  const $storeName = document.querySelector(".store_name");
  const $orderList = document.querySelector(".order_list");
  const $regularPrice = document.querySelector(".regular_price");
  const $salePrice = document.querySelector(".sale_price");
  const $pickupButton = document.querySelector(".pickup_button");
  const $backArrow = document.querySelector("#back_arrow");
  
  // 상태 관리
  const state = {
    storeId: null,
    storeInfo: null,
    cartData: null,
    cartId: null,
    orderItems: [],
    totalOriginalPrice: 0,
    totalDiscountedPrice: 0
  };

  // 타임피커 상태
  let timePicker = null;

  // 초기화
  init();

  async function init() {
    console.log("=== PICKUP.JS 초기화 시작 ===");
    
    // URL 파라미터 추출
    extractParams();
    
    if (!state.storeId) {
      alert("가게 정보를 찾을 수 없습니다.");
      window.history.back();
      return;
    }
    
    // 이벤트 리스너 등록
    setupEventListeners();
    
    // 데이터 로드
    await loadCartData();
    await loadStoreInfo();
    displayOrderInfo();
    
    // 타임피커 초기화
    initTimePicker();
    
    console.log("=== PICKUP.JS 초기화 완료 ===");
  }

  function extractParams() {
    const params = new URLSearchParams(window.location.search);
    state.storeId = parseInt(params.get('storeId'));
    console.log('추출된 storeId:', state.storeId);
  }

  function setupEventListeners() {
    // 뒤로가기 버튼
    if ($backArrow) {
      $backArrow.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'cart.html';
      });
    }
    
    // 픽업 예약 완료 버튼
    if ($pickupButton) {
      $pickupButton.addEventListener('click', handlePickupReservation);
    }
    
    console.log('이벤트 리스너 등록 완료');
  }

  async function loadCartData() {
    try {
      console.log('장바구니 데이터 로딩 시작...');
      
      const response = await fetch(`${API_BASE}/api/v1/carts`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`장바구니 조회 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('장바구니 응답:', data);
      
      state.cartData = data.result || data;
      state.cartId = state.cartData.cartId;
      
      // 현재 가게의 아이템만 필터링
      if (state.cartData.cartMenuInfoList) {
        state.orderItems = state.cartData.cartMenuInfoList.filter(item => 
          parseInt(item.storeId) === parseInt(state.storeId)
        );
      }
      
      console.log('장바구니 ID:', state.cartId);
      console.log('현재 가게 주문 아이템:', state.orderItems);
      
      if (state.orderItems.length === 0) {
        alert('해당 가게의 메뉴가 장바구니에 없습니다.');
        window.history.back();
        return;
      }
      
    } catch (error) {
      console.error('장바구니 데이터 로딩 실패:', error);
      alert('장바구니 정보를 불러오는데 실패했습니다.');
      window.history.back();
    }
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
      
      console.log('가게 정보 로딩 완료:', state.storeInfo.name);
      
    } catch (error) {
      console.error('가게 정보 로딩 실패:', error);
    }
  }

  function displayOrderInfo() {
    // 가게명 표시
    if ($storeName && state.storeInfo) {
      $storeName.textContent = state.storeInfo.name || '가게명 없음';
    }
    
    // 주문 아이템 목록 표시
    if ($orderList) {
      $orderList.innerHTML = '';
      
      state.orderItems.forEach(item => {
        const orderItem = document.createElement('p');
        orderItem.className = 'order_item';
        
        const itemName = document.createElement('span');
        itemName.textContent = item.menuName || '메뉴명 없음';
        
        const itemCount = document.createElement('span');
        itemCount.className = 'order_item_count';
        itemCount.textContent = `${item.quantity || 0}개`;
        
        orderItem.appendChild(itemName);
        orderItem.appendChild(itemCount);
        $orderList.appendChild(orderItem);
      });
    }
    
    // 가격 계산 및 표시
    calculateAndDisplayPrices();
  }

  async function calculateAndDisplayPrices() {
    let totalOriginal = 0;
    let totalDiscounted = 0;
    
    for (const item of state.orderItems) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/store/${state.storeId}/menus/${item.menuId}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          const menuInfo = data.result || data;
          
          const originalPrice = menuInfo.price || 0;
          const discountPercent = menuInfo.discountPercent || 0;
          const quantity = item.quantity || 0;
          
          const itemOriginalTotal = originalPrice * quantity;
          const itemDiscountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
          const itemDiscountedTotal = itemDiscountedPrice * quantity;
          
          totalOriginal += itemOriginalTotal;
          totalDiscounted += itemDiscountedTotal;
          
          console.log(`${item.menuName}: 원가 ${itemOriginalTotal}원, 할인가 ${itemDiscountedTotal}원`);
        }
      } catch (error) {
        console.error(`메뉴 ${item.menuId} 정보 로드 실패:`, error);
      }
    }
    
    state.totalOriginalPrice = totalOriginal;
    state.totalDiscountedPrice = totalDiscounted;
    
    // 가격 표시
    if ($regularPrice) {
      $regularPrice.textContent = `${totalOriginal.toLocaleString()} 원`;
    }
    
    if ($salePrice) {
      $salePrice.textContent = `${totalDiscounted.toLocaleString()} 원`;
    }
    
    console.log('총 원가:', totalOriginal);
    console.log('총 할인가:', totalDiscounted);
  }

  async function handlePickupReservation() {
    try {
      // 타임피커에서 선택된 시간 가져오기
      const selectedTime = getSelectedTime();
      
      if (!selectedTime) {
        alert('픽업 시간을 선택해주세요.');
        return;
      }
      
      console.log('=== 시간 변환 디버깅 ===');
      console.log('선택된 시간:', selectedTime);
      
      // 오늘 날짜 + 선택된 시간으로 DateTime 생성
      const now = new Date();
      const pickupDateTime = new Date();
      pickupDateTime.setUTCFullYear(now.getFullYear());
      pickupDateTime.setUTCMonth(now.getMonth());
      pickupDateTime.setUTCDate(now.getDate());
      pickupDateTime.setUTCHours(selectedTime.hour24);
      pickupDateTime.setUTCMinutes(selectedTime.minute);
      pickupDateTime.setUTCSeconds(0);
      pickupDateTime.setUTCMilliseconds(0);
      
      console.log('현재 시간:', now.toLocaleString());
      console.log('픽업 시간:', pickupDateTime.toLocaleString());
      console.log('픽업 시간 ISO:', pickupDateTime.toISOString());
      
      // 과거 시간 체크
      const minTime = new Date(now.getTime() + 30 * 60 * 1000); // 30분 후
      if (pickupDateTime <= minTime) {
        alert('현재 시간보다 최소 30분 이후 시간을 선택해주세요.');
        return;
      }
      
      // 주문 API 호출
      const orderData = {
        cartId: state.cartId,
        visitTime: pickupDateTime.toISOString()
      };
      
      console.log('주문 데이터:', orderData);
      
      const response = await fetch(`${API_BASE}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`주문 실패: ${response.status} - ${errorData.message || '알 수 없는 오류'}`);
      }
      
      const result = await response.json();
      console.log('주문 완료:', result);
      
      const orderResult = result.result || result;
      
      // 성공 메시지
      const discountAmount = state.totalOriginalPrice - state.totalDiscountedPrice;
      const timeStr = `${selectedTime.hour12}:${String(selectedTime.minute).padStart(2, '0')} ${selectedTime.period}`;
      
      // reservation.html로 이동
      console.log("이동 전 쿠키 확인:", document.cookie);
      sessionStorage.setItem('orderResult', JSON.stringify(orderResult));
      window.location.href = 'reservation.html';
      
    } catch (error) {
      console.error('픽업 예약 실패:', error);
      alert(`픽업 예약에 실패했습니다.\n${error.message}`);
    }
  }

  // 타임피커에서 선택된 시간 가져오기
  function getSelectedTime() {
    if (!timePicker) {
      console.error('타임피커가 초기화되지 않았습니다.');
      return null;
    }
    
    const hourWheel = document.querySelector('.wheel[data-type="hour"]');
    const minuteWheel = document.querySelector('.wheel[data-type="minute"]');
    const ampmWheel = document.querySelector('.wheel[data-type="ampm"]');
    
    if (!hourWheel || !minuteWheel || !ampmWheel) {
      console.error('타임피커 휠 요소를 찾을 수 없습니다.');
      return null;
    }
    
    // 각 휠의 현재 선택된 인덱스 계산
    const ITEM_HEIGHT = 40;
    
    const hourIndex = Math.round(hourWheel.scrollTop / ITEM_HEIGHT);
    const minuteIndex = Math.round(minuteWheel.scrollTop / ITEM_HEIGHT);
    const ampmIndex = Math.round(ampmWheel.scrollTop / ITEM_HEIGHT);
    
    // 12시간 형식 값들
    const hour12 = hourIndex + 1; // 1~12
    const minute = minuteIndex === 1 ? 30 : 0; // 0 또는 30
    const period = ampmIndex === 0 ? 'AM' : 'PM';
    
    // 24시간 형식으로 변환
    let hour24;
    if (period === 'AM') {
      hour24 = hour12 === 12 ? 0 : hour12; // 12 AM = 0시
    } else {
      hour24 = hour12 === 12 ? 12 : hour12 + 12; // 12 PM = 12시
    }
    
    console.log(`시간 변환: ${hour12}:${String(minute).padStart(2, '0')} ${period} → ${hour24}:${String(minute).padStart(2, '0')}`);
    
    return {
      hour12,
      minute,
      period,
      hour24
    };
  }

  // 타임피커 초기화
  function initTimePicker() {
    let ITEM_HEIGHT = 40;
  
    const hourWheel = document.querySelector('.wheel[data-type="hour"]');
    const minuteWheel = document.querySelector('.wheel[data-type="minute"]');
    const ampmWheel = document.querySelector('.wheel[data-type="ampm"]');
  
    if (!hourWheel || !minuteWheel || !ampmWheel) {
      console.error('타임피커 요소를 찾을 수 없습니다.');
      return;
    }
  
    // 아이템 생성
    function makeItem(text) {
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = text;
      return el;
    }
    
    // 휠에 아이템 추가
    function populateWheels() {
      // 시간 (1-12)
      for (let h = 1; h <= 12; h++) {
        hourWheel.appendChild(makeItem(String(h)));
      }
      
      // 분 (00, 30)
      ['00', '30'].forEach(m => minuteWheel.appendChild(makeItem(m)));
      
      // AM/PM
      ['AM', 'PM'].forEach(p => ampmWheel.appendChild(makeItem(p)));
    }
    
    populateWheels();
    
    // 아이템 높이 측정
    function measureItemHeight() {
      const sample = hourWheel.querySelector('.item');
      if (sample) {
        const height = sample.getBoundingClientRect().height;
        if (height && Math.abs(height - ITEM_HEIGHT) > 0.1) {
          ITEM_HEIGHT = height;
        }
      }
    }
    
    // 휠 패딩 설정
    function setWheelPadding(wheel) {
      const padding = Math.max(0, (wheel.clientHeight - ITEM_HEIGHT) / 2);
      wheel.style.setProperty('--pad', padding + 'px');
    }
    
    // 재계산
    function recalculate() {
      measureItemHeight();
      [hourWheel, minuteWheel, ampmWheel].forEach(setWheelPadding);
    }
    
    recalculate();
    
    // 스냅 기능
    function snapToNearest(wheel, smooth = true) {
      const count = wheel.querySelectorAll('.item').length;
      const index = Math.max(0, Math.min(count - 1, Math.round(wheel.scrollTop / ITEM_HEIGHT)));
      const targetTop = index * ITEM_HEIGHT;
      
      wheel.scrollTo({
        top: targetTop,
        behavior: smooth ? 'smooth' : 'auto'
      });
      
      // 활성 상태 업데이트
      const items = wheel.querySelectorAll('.item');
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });
    }
    
    // 스크롤 이벤트
    function onScroll(e) {
      const wheel = e.currentTarget;
      clearTimeout(wheel._snapTimer);
      wheel._snapTimer = setTimeout(() => snapToNearest(wheel, true), 100);
    }
    
    [hourWheel, minuteWheel, ampmWheel].forEach(wheel => {
      wheel.addEventListener('scroll', onScroll, { passive: true });
    });
    
    // 탭으로 선택 기능
    function enableTapToSelect(wheel) {
      let startY = 0;
      let moved = false;
      
      wheel.addEventListener('pointerdown', (e) => {
        startY = e.clientY;
        moved = false;
      }, { passive: true });
      
      wheel.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientY - startY) > 10) {
          moved = true;
        }
      }, { passive: true });
      
      wheel.addEventListener('pointerup', (e) => {
        if (moved) return;
        
        const item = e.target.closest('.item');
        if (!item || !wheel.contains(item)) return;
        
        const items = Array.from(wheel.querySelectorAll('.item'));
        const index = items.indexOf(item);
        
        if (index >= 0) {
          wheel.scrollTo({
            top: index * ITEM_HEIGHT,
            behavior: 'smooth'
          });
          setTimeout(() => snapToNearest(wheel, true), 150);
        }
      });
    }
    
    [hourWheel, minuteWheel, ampmWheel].forEach(enableTapToSelect);
    
    // 초기 시간 설정 (현재 시간 + 1시간)
    function setInitialTime() {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
      
      let hour12 = futureTime.getHours() % 12;
      if (hour12 === 0) hour12 = 12;
      
      const minute = futureTime.getMinutes() < 30 ? 0 : 30;
      const period = futureTime.getHours() >= 12 ? 'PM' : 'AM';
      
      // 휠 위치 설정
      const hourIndex = hour12 - 1;
      const minuteIndex = minute === 30 ? 1 : 0;
      const periodIndex = period === 'PM' ? 1 : 0;
      
      hourWheel.scrollTop = hourIndex * ITEM_HEIGHT;
      minuteWheel.scrollTop = minuteIndex * ITEM_HEIGHT;
      ampmWheel.scrollTop = periodIndex * ITEM_HEIGHT;
      
      // 초기 스냅 적용
      setTimeout(() => {
        snapToNearest(hourWheel, false);
        snapToNearest(minuteWheel, false);
        snapToNearest(ampmWheel, false);
      }, 100);
    }
    
    setInitialTime();
    
    // 윈도우 리사이즈 대응
    window.addEventListener('resize', () => {
      recalculate();
      [hourWheel, minuteWheel, ampmWheel].forEach(w => snapToNearest(w, false));
    });
    
    // 타임피커 준비 완료
    timePicker = {
      recalculate,
      getSelectedTime
    };
    
    console.log('타임피커 초기화 완료');
  }
});