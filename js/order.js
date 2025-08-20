// 메뉴 주문 페이지 JavaScript - 완전히 새로운 코드
document.addEventListener("DOMContentLoaded", () => {
  // 기본 설정
  const API_BASE = "https://api-whynotbuy.store";

  // DOM 요소들
  const $topTitle = document.querySelector(".top_title");
  const $menuTitle = document.querySelector(".menu_title");
  const $priceStrike = document.querySelector(".price_strike");
  const $saleRate = document.querySelector(".sale_rate");
  const $salePrice = document.querySelector(".sale_price");
  const $menuImg = document.querySelector(".menu_img img");
  const $menuDesc = document.querySelector(".menu_desc");
  const $quantityValue = document.querySelector(".quantity_value");
  const $minusBtn = document.querySelector(".quantity_button1");
  const $plusBtn = document.querySelector(".quantity_button2");
  const $cartButton = document.querySelector(".cart_button");
  const $cartButtonPrice = document.querySelector(".cart_button_price");
  const $backArrow = document.querySelector("#back_arrow");

  // 상태 관리
  const appState = {
    storeId: null,
    menuId: null,
    storeInfo: null,
    menuInfo: null,
    quantity: 1,
  };

  // 앱 시작
  init();

  async function init() {
    console.log("=== ORDER.JS 초기화 시작 ===");

    // URL 파라미터 추출
    extractParams();

    if (!appState.storeId || !appState.menuId) {
      alert("메뉴 정보를 찾을 수 없습니다.");
      window.history.back();
      return;
    }

    // 이벤트 리스너 등록
    setupEvents();

    // 데이터 로드
    await loadStoreData();
    await loadMenuData();

    console.log("=== ORDER.JS 초기화 완료 ===");
  }

  function extractParams() {
    const params = new URLSearchParams(window.location.search);
    appState.storeId = parseInt(params.get("storeId"));
    appState.menuId = parseInt(params.get("menuId"));

    console.log("URL 파라미터:", {
      storeId: appState.storeId,
      menuId: appState.menuId,
    });
  }

  function setupEvents() {
    // 수량 버튼 스타일 및 이벤트
    if ($minusBtn) {
      $minusBtn.style.cursor = "pointer";
      $minusBtn.addEventListener("click", () => changeQuantity(-1));
    }

    if ($plusBtn) {
      $plusBtn.style.cursor = "pointer";
      $plusBtn.addEventListener("click", () => changeQuantity(1));
    }

    // 뒤로가기 버튼
    if ($backArrow) {
      $backArrow.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = `store_home.html?storeId=${appState.storeId}`;
      });
    }

    // 장바구니 담기 버튼
    if ($cartButton) {
      $cartButton.addEventListener("click", addToServerCart);
    }

    console.log("이벤트 리스너 등록 완료");
  }

  async function loadStoreData() {
    try {
      console.log("가게 정보 로딩 시작...");

      const response = await fetch(
        `${API_BASE}/api/v1/store/${appState.storeId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`가게 정보 로드 실패: ${response.status}`);
      }

      const data = await response.json();
      appState.storeInfo = data.result || data;

      // 가게명 표시
      if ($topTitle && appState.storeInfo.name) {
        $topTitle.textContent = appState.storeInfo.name;
      }

      console.log("가게 정보 로딩 완료:", appState.storeInfo.name);
    } catch (error) {
      console.error("가게 정보 로딩 실패:", error);
    }
  }

  async function loadMenuData() {
    try {
      console.log("메뉴 정보 로딩 시작...");

      const response = await fetch(
        `${API_BASE}/api/v1/store/${appState.storeId}/menus/${appState.menuId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`메뉴 정보 로드 실패: ${response.status}`);
      }

      const data = await response.json();
      appState.menuInfo = data.result || data;

      // 메뉴 정보 화면에 표시
      displayMenuInfo();

      console.log("메뉴 정보 로딩 완료:", appState.menuInfo.name);
    } catch (error) {
      console.error("메뉴 정보 로딩 실패:", error);
      alert("메뉴 정보를 불러오는데 실패했습니다.");
    }
  }

  function displayMenuInfo() {
    const menu = appState.menuInfo;

    // 메뉴명
    if ($menuTitle) {
      $menuTitle.textContent = menu.name || "메뉴명 없음";
    }

    // 가격 정보
    const originalPrice = menu.price || 0;
    const discountPercent = menu.discountPercent || 0;
    const discountedPrice = Math.round(
      originalPrice * (1 - discountPercent / 100)
    );

    // 정가 (할인이 있을 때만)
    if ($priceStrike) {
      if (discountPercent > 0) {
        $priceStrike.textContent = `${originalPrice.toLocaleString()} 원`;
        $priceStrike.style.display = "block";
      } else {
        $priceStrike.style.display = "none";
      }
    }

    // 할인율 (할인이 있을 때만)
    if ($saleRate) {
      if (discountPercent > 0) {
        $saleRate.textContent = `${discountPercent}%`;
        $saleRate.style.display = "inline";
      } else {
        $saleRate.style.display = "none";
      }
    }

    // 판매가
    if ($salePrice) {
      const finalPrice = discountPercent > 0 ? discountedPrice : originalPrice;
      $salePrice.textContent = `${finalPrice.toLocaleString()} 원`;
    }

    // 메뉴 이미지
    if ($menuImg) {
      $menuImg.src = menu.menuImage || "../images/sample_pizza.jpg";
      $menuImg.alt = menu.name || "메뉴 이미지";
    }

    // 메뉴 설명
    if ($menuDesc) {
      $menuDesc.textContent = menu.description || "메뉴 설명이 없습니다.";
    }

    // 장바구니 버튼 가격 업데이트
    updateCartButtonPrice();
  }

  function changeQuantity(delta) {
    const newQuantity = appState.quantity + delta;

    if (newQuantity >= 1 && newQuantity <= 99) {
      appState.quantity = newQuantity;

      // 수량 표시 업데이트
      if ($quantityValue) {
        $quantityValue.textContent = `${appState.quantity} 개`;
      }

      // 장바구니 버튼 가격 업데이트
      updateCartButtonPrice();

      console.log("수량 변경:", appState.quantity);
    }
  }

  function updateCartButtonPrice() {
    if (!$cartButtonPrice || !appState.menuInfo) return;

    const originalPrice = appState.menuInfo.price || 0;
    const discountPercent = appState.menuInfo.discountPercent || 0;
    const discountedPrice = Math.round(
      originalPrice * (1 - discountPercent / 100)
    );
    const finalPrice = discountPercent > 0 ? discountedPrice : originalPrice;
    const totalPrice = finalPrice * appState.quantity;

    $cartButtonPrice.textContent = `${totalPrice.toLocaleString()}원`;
  }

  async function addToServerCart() {
    if (!appState.menuInfo) {
      alert("메뉴 정보가 없습니다.");
      return;
    }

    try {
      console.log("=== 서버 장바구니 추가 시작 ===");
      console.log("요청 데이터:", {
        menuId: appState.menuId,
        quantity: appState.quantity,
      });

      const response = await fetch(`${API_BASE}/api/v1/carts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          menuId: appState.menuId,
          quantity: appState.quantity,
        }),
      });

      console.log("응답 상태 코드:", response.status);

      if (!response.ok) {
        throw new Error(
          `장바구니 추가 실패: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json();
      console.log("서버 응답 데이터:", responseData);

      // 응답 데이터를 URL 파라미터로 전달하여 store_home으로 이동
      const cartDataString = encodeURIComponent(
        JSON.stringify(responseData.result)
      );
      const targetUrl = `store_home.html?storeId=${appState.storeId}&cartData=${cartDataString}`;

      console.log("이동할 URL:", targetUrl);
      console.log("=== 서버 장바구니 추가 완료 ===");

      window.location.href = targetUrl;
    } catch (error) {
      console.error("장바구니 추가 에러:", error);

      if (error.message.includes("401")) {
        alert("로그인이 필요합니다.");
      } else if (error.message.includes("404")) {
        alert("메뉴를 찾을 수 없습니다.");
      } else {
        alert("장바구니에 추가하는데 실패했습니다. 다시 시도해주세요.");
      }
    }
  }
});
