// 예약 완료 페이지 JavaScript
document.addEventListener("DOMContentLoaded", () => {
  
    // DOM 요소들
    const $storeName = document.querySelector(".store_name");
    const $reservationNum = document.querySelector(".reservation_num");
    const $reservationTime = document.querySelector(".reservation_time");
    const $pickupButton = document.querySelector(".pickup_button");
    
    // 상태 관리
    const state = {
      orderData: null
    };
  
    // 초기화
    init();
  
    function init() {
      console.log("=== RESERVATION.JS 초기화 시작 ===");
      
      // 쿠키 상태 확인
      console.log("현재 쿠키:", document.cookie);
      console.log("쿠키 개수:", document.cookie.split(';').filter(c => c.trim()).length);
      
      // 개별 토큰 확인
      const accessToken = getCookie('accessToken');
      const refreshToken = getCookie('refreshToken');
      console.log("accessToken 존재:", !!accessToken);
      console.log("refreshToken 존재:", !!refreshToken);
      
      // URL 파라미터에서 주문 데이터 추출
      extractOrderData();
      
      if (!state.orderData) {
        console.error("주문 데이터가 없습니다.");
        // 주문 데이터가 없으면 홈으로 이동
        window.location.href = 'home_store.html';
        return;
      }
      
      // 예약 정보 화면에 표시
      displayReservationInfo();
      
      // 이벤트 리스너 등록
      setupEventListeners();
      
      console.log("=== RESERVATION.JS 초기화 완료 ===");
    }
  
    function extractOrderData() {
      // sessionStorage에서 주문 데이터 가져오기 (URL 파라미터 대신)
      const orderDataFromStorage = sessionStorage.getItem('orderResult');
      
      if (orderDataFromStorage) {
        try {
          state.orderData = JSON.parse(orderDataFromStorage);
          console.log("sessionStorage에서 주문 데이터 로드:", state.orderData);
          
          // 사용 후 삭제 (보안상)
          sessionStorage.removeItem('orderResult');
          return; // 성공적으로 로드했으면 여기서 종료
          
        } catch (error) {
          console.error("sessionStorage 주문 데이터 파싱 실패:", error);
        }
      }
      
      // 기존 URL 파라미터 방식도 유지 (호환성을 위해)
      const params = new URLSearchParams(window.location.search);
      const orderDataParam = params.get('orderData');
      
      if (orderDataParam) {
        try {
          state.orderData = JSON.parse(decodeURIComponent(orderDataParam));
          console.log("URL 파라미터에서 주문 데이터 로드:", state.orderData);
          
          // URL 정리
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
          
        } catch (error) {
          console.error("URL 파라미터 주문 데이터 파싱 실패:", error);
        }
      }
    }
  
    function displayReservationInfo() {
      const orderData = state.orderData;
      
      // 가게명 표시
      if ($storeName && orderData.storeName) {
        $storeName.textContent = orderData.storeName;
      }
      
      // 주문번호 표시 (orderNum에서 처음 5자리만 사용)
      if ($reservationNum && orderData.orderNum) {
        const shortOrderNum = orderData.orderNum.substring(0, 5);
        $reservationNum.textContent = shortOrderNum;
      }
      
      // 방문 시간 표시
      if ($reservationTime && orderData.visitTime) {
        const visitTime = formatVisitTime(orderData.visitTime);
        $reservationTime.textContent = `${visitTime} 까지 방문해주세요!`;
      }
      
      console.log("예약 정보 표시 완료");
    }
  
    function formatVisitTime(visitTimeISO) {
      try {
        const visitDate = new Date(visitTimeISO);
        
        // 12시간 형식으로 변환
        let hours = visitDate.getHours();
        const minutes = visitDate.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        if (hours === 0) hours = 12;
        
        const minutesStr = minutes === 0 ? '00' : '30';
        
        return `${hours}:${minutesStr} ${ampm}`;
        
      } catch (error) {
        console.error("시간 포맷 실패:", error);
        return "시간 정보 없음";
      }
    }
  
    function setupEventListeners() {
      // "구매내역으로 이동" 버튼
      if ($pickupButton) {
        $pickupButton.addEventListener('click', () => {
          window.location.href = 'purchase_log.html';
        });
      }
      
      console.log("이벤트 리스너 등록 완료");
    }
  
    // 쿠키 읽기 헬퍼 함수
    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }
  });