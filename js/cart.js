// 장바구니 페이지 JavaScript - 완전히 새로운 코드
document.addEventListener('DOMContentLoaded', () => {
  
  // 기본 설정
  const API_BASE = "https://api-whynotbuy.store";
  
  // DOM 요소들
  const $storeName = document.querySelector('.store_name');
  const $cartTemplate = document.querySelector('.cart_list_template');
  const $mainContent = document.querySelector('.content');
  const $addMenuEl = document.querySelector('.add_menu'); // 항상 이 앞에 삽입
  const $priceRegular = document.querySelector('.price_regular');
  const $priceSale = document.querySelector('.price_sale');
  const $orderButton = document.querySelector('.order_button');
  const $orderButtonText = document.querySelector('.order_button_text');
  
  // 상태 관리
  const appState = {
    cartData: null,
    cartItems: [],
    storeInfo: null
  };

  // 앱 시작
  init();

  async function init() {
    console.log("=== CART.JS 초기화 시작 ===");
    
    // 서버에서 장바구니 데이터 로드
    await loadCartFromServer();
    
    // 장바구니 아이템 렌더링
    renderCartItems();
    
    // 이벤트 리스너 등록
    setupEvents();
    
    console.log("=== CART.JS 초기화 완료 ===");
  }

  async function loadCartFromServer() {
    try {
      console.log("서버에서 장바구니 조회 시작...");
      
      const response = await fetch(`${API_BASE}/api/v1/carts`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          alert('로그인이 필요합니다.');
          return;
        } else if (response.status === 404) {
          console.log("장바구니가 비어있음");
          displayEmptyCart();
          return;
        }
        throw new Error(`장바구니 조회 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("서버 장바구니 응답:", data);
      
      appState.cartData = data.result || data;
      appState.cartItems = appState.cartData.cartMenuInfoList || [];
      
      console.log("장바구니 아이템들:", appState.cartItems);
      
      // 🆕 각 메뉴의 상세 정보 로드
      if (appState.cartItems.length > 0) {
        await loadMenuDetails();
        
        // 첫 번째 가게명을 상단에 표시
        await loadStoreInfo(appState.cartItems[0].storeId);
      }
      
    } catch (error) {
      console.error("장바구니 조회 실패:", error);
      displayEmptyCart();
    }
  }

  // 🆕 각 메뉴의 상세 정보를 API로 조회
  async function loadMenuDetails() {
    console.log("메뉴 상세 정보 로딩 시작...");
    
    const detailPromises = appState.cartItems.map(async (item) => {
      try {
        console.log(`메뉴 상세 조회: storeId=${item.storeId}, menuId=${item.menuId}`);
        
        const response = await fetch(`${API_BASE}/api/v1/store/${item.storeId}/menus/${item.menuId}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error(`메뉴 상세 조회 실패: ${response.status} for menuId ${item.menuId}`);
          return null;
        }
        
        const data = await response.json();
        const menuDetail = data.result || data;
        
        console.log(`메뉴 상세 정보 로드 완료: ${menuDetail.name}`, menuDetail);
        
        // 🆕 장바구니 아이템에 상세 정보 추가
        return {
          ...item,
          name: menuDetail.name,
          price: menuDetail.price,
          discountPercent: menuDetail.discountPercent,
          description: menuDetail.description,
          menuImage: menuDetail.menuImage
        };
        
      } catch (error) {
        console.error(`메뉴 상세 조회 에러: menuId ${item.menuId}`, error);
        return {
          ...item,
          name: item.menuName,
          price: 0,
          discountPercent: 0,
          description: '',
          menuImage: ''
        };
      }
    });
    
    // 🆕 모든 메뉴 상세 정보 로드 완료 대기
    const detailedItems = await Promise.all(detailPromises);
    
    // null이 아닌 아이템들만 필터링
    appState.cartItems = detailedItems.filter(item => item !== null);
    
    console.log("모든 메뉴 상세 정보 로딩 완료:", appState.cartItems);
  }

  async function loadStoreInfo(storeId) {
    try {
      console.log("가게 정보 로딩 시작...", storeId);
      
      const response = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`가게 정보 로드 실패: ${response.status}`);
      }
      
      const data = await response.json();
      appState.storeInfo = data.result || data;
      
      // 가게명 표시
      if ($storeName && appState.storeInfo.name) {
        $storeName.textContent = appState.storeInfo.name;
      }
      
      console.log("가게 정보 로딩 완료:", appState.storeInfo.name);
      
    } catch (error) {
      console.error("가게 정보 로딩 실패:", error);
    }
  }

  function displayEmptyCart() {
    if ($storeName) {
      $storeName.textContent = "장바구니가 비어있습니다";
    }
    
    // 빈 장바구니 메시지 표시
    const emptyMessage = document.createElement('div');
    emptyMessage.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #666;
      font-size: 16px;
    `;
    emptyMessage.textContent = '장바구니에 담긴 메뉴가 없습니다.';
    
    $mainContent.insertBefore(emptyMessage, $addMenuEl);
    
    // 주문 버튼 숨기기
    if ($orderButton) {
      $orderButton.style.display = 'none';
    }
  }

  function renderCartItems() {
    if (!appState.cartItems || appState.cartItems.length === 0) {
      console.log("렌더링할 장바구니 아이템이 없음");
      return;
    }
    
    console.log("장바구니 아이템 렌더링 시작...");
    
    // 기존 메뉴 아이템들 제거 (add_menu 앞의 모든 menu_item 제거)
    const existingItems = $mainContent.querySelectorAll('.menu_item');
    existingItems.forEach(item => item.remove());
    
    let totalOriginalPrice = 0;
    let totalSalePrice = 0;
    
    appState.cartItems.forEach((item, index) => {
      // 템플릿 복제
      const fragment = document.importNode($cartTemplate.content, true);
      
      // DOM 요소들 선택
      const $menuItem = fragment.querySelector('.menu_item');
      const $menuTitle = fragment.querySelector('.menu_title');
      const $menuImg = fragment.querySelector('.menu_img img');
      const $regularPrice = fragment.querySelector('.regular_price');
      const $salePercent = fragment.querySelector('.sale_percent');
      const $salePrice = fragment.querySelector('.sale_price');
      const $quantityValue = fragment.querySelector('.quantity_value');
      const $deleteButton = fragment.querySelector('.menu_delete');
      const $quantityMinusBtn = fragment.querySelector('.quantity_button1');
      const $quantityPlusBtn = fragment.querySelector('.quantity_button2');
      
      // 🆕 API에서 가져온 실제 메뉴 정보 사용
      const menuPrice = item.price || 0;
      const discountPercent = item.discountPercent || 0;
      const quantity = item.quantity || 1;
      
      const originalPrice = menuPrice * quantity;
      const discountedPrice = Math.round(menuPrice * (1 - discountPercent / 100)) * quantity;
      
      totalOriginalPrice += originalPrice;
      totalSalePrice += discountedPrice;
      
      // 🆕 실제 데이터로 바인딩
      $menuTitle.textContent = item.name || item.menuName || '메뉴명 없음';
      $menuImg.src = item.menuImage || '../images/sample_pizza.jpg';
      $menuImg.alt = item.name || item.menuName || '메뉴 이미지';
      
      $regularPrice.textContent = `${originalPrice.toLocaleString()} 원`;
      
      if (discountPercent > 0) {
        $salePercent.textContent = `${discountPercent}%`;
        $salePercent.style.display = 'block';
        $salePrice.textContent = `${discountedPrice.toLocaleString()} 원`;
      } else {
        $salePercent.style.display = 'none';
        $salePrice.textContent = `${originalPrice.toLocaleString()} 원`;
      }
      
      $quantityValue.textContent = `${quantity} 개`;
      
      // 이벤트 리스너 등록
      $deleteButton.addEventListener('click', () => deleteCartItem(item, index));
      $quantityMinusBtn.addEventListener('click', () => updateQuantity(item, index, -1));
      $quantityPlusBtn.addEventListener('click', () => updateQuantity(item, index, 1));
      
      // add_menu 앞에 삽입 (버튼이 마지막에 유지)
      $mainContent.insertBefore(fragment, $addMenuEl);
    });
    
    // 합계 금액 업데이트
    updateTotalPrice(totalOriginalPrice, totalSalePrice);
    
    console.log("장바구니 아이템 렌더링 완료");
  }

  function updateTotalPrice(totalOriginal, totalSale) {
    if ($priceRegular) {
      $priceRegular.textContent = `${totalOriginal.toLocaleString()} 원`;
    }
    
    if ($priceSale) {
      $priceSale.textContent = `${totalSale.toLocaleString()} 원`;
    }
    
    if ($orderButtonText) {
      const discount = totalOriginal - totalSale;
      if (discount > 0) {
        $orderButtonText.textContent = `총 ${discount.toLocaleString()}원 할인받고 방문 예약하기`;
      } else {
        $orderButtonText.textContent = `${totalSale.toLocaleString()}원 방문 예약하기`;
      }
    }
  }

  async function deleteCartItem(item, index) {
    try {
      console.log("장바구니 아이템 삭제 시작...", item);
      
      // 🆕 서버 API로 삭제 요청
      const response = await fetch(`${API_BASE}/api/v1/carts/menu`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          menuId: item.menuId
        })
      });
      
      if (!response.ok) {
        throw new Error(`메뉴 삭제 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("삭제 응답:", data);
      
      // 🆕 서버 응답으로 장바구니 상태 업데이트
      appState.cartData = data.result;
      appState.cartItems = data.result.cartMenuInfoList || [];
      
      // 🆕 삭제 후 남은 메뉴들의 상세 정보 다시 로드
      if (appState.cartItems.length > 0) {
        await loadMenuDetails();
      }
      
      // UI 다시 렌더링
      renderCartItems();
      
      // 장바구니가 비어있으면 빈 상태 표시
      if (appState.cartItems.length === 0) {
        displayEmptyCart();
      }
      
    } catch (error) {
      console.error("장바구니 아이템 삭제 실패:", error);
      alert("메뉴 삭제에 실패했습니다. 다시 시도해주세요.");
    }
  }

  async function updateQuantity(item, index, change) {
    const newQuantity = item.quantity + change;
    
    if (newQuantity < 1) {
      // 수량이 0이 되면 삭제
      deleteCartItem(item, index);
      return;
    }
    
    if (newQuantity > 99) {
      alert("최대 99개까지 주문 가능합니다.");
      return;
    }
    
    try {
      console.log("수량 변경 시작...", item.name || item.menuName, ":", item.quantity, "→", newQuantity);
      
      // 🆕 서버 API로 수량 업데이트 요청
      const response = await fetch(`${API_BASE}/api/v1/carts/menu`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          menuId: item.menuId,
          quantity: newQuantity
        })
      });
      
      if (!response.ok) {
        throw new Error(`수량 변경 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("수량 변경 응답:", data);
      
      // 🆕 서버 응답으로 장바구니 상태 업데이트
      appState.cartData = data.result;
      appState.cartItems = data.result.cartMenuInfoList || [];
      
      // 🆕 수량 변경 후 메뉴 상세 정보 다시 로드
      await loadMenuDetails();
      
      // UI 다시 렌더링
      renderCartItems();
      
      console.log("수량 변경 완료");
      
    } catch (error) {
      console.error("수량 변경 실패:", error);
      alert("수량 변경에 실패했습니다. 다시 시도해주세요.");
    }
  }

  function setupEvents() {
    // "다른 메뉴 더 담기" 버튼 클릭 시
    if ($addMenuEl) {
      $addMenuEl.addEventListener('click', () => {
        if (appState.storeInfo) {
          // 현재 가게의 store_home.html로 이동
          window.location.href = `store_home.html?storeId=${appState.storeInfo.storeId}`;
        } else {
          // 가게 정보가 없으면 홈으로
          window.location.href = 'home_store.html';
        }
      });
    }
    
    // 주문 버튼 클릭 시 - pickup.html로 이동
    if ($orderButton) {
      $orderButton.addEventListener('click', () => {
        if (appState.cartItems.length === 0) {
          alert("장바구니에 메뉴를 담아주세요.");
          return;
        }
        
        // 첫 번째 아이템의 storeId를 사용해서 pickup.html로 이동
        const storeId = appState.cartItems[0]?.storeId;
        if (storeId) {
          window.location.href = `pickup.html?storeId=${storeId}`;
        } else {
          alert("가게 정보를 찾을 수 없습니다.");
        }
      });
    }
    
    console.log("이벤트 리스너 등록 완료");
   }
});