// 가게 상세 페이지 JavaScript - 로딩 애니메이션 적용 버전 + 찜 기능
document.addEventListener("DOMContentLoaded", () => {
  // 기본 설정
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;

  // DOM 요소들
  const $topTitle = document.querySelector(".top_title");
  const $businessHours = document.querySelector(".business_hours");
  const $address = document.querySelector(".address");
  const $copyIcon = document.querySelector(".copy_logo");
  const $reviewText = document.querySelector(".review_text");
  const $reviewMore = document.querySelector(".review_more");
  const $menuList = document.querySelector("#menuList");
  const $menuLoading = document.querySelector("#menuLoading");
  const $menuTemplate = document.querySelector("#menuItemTpl");
  const $floatingCart = document.querySelector("#floatingCart");

  // 상태 관리
  const appState = {
    storeId: null,
    storeInfo: null,
    menus: [],
    cursor: null,
    hasMoreMenus: true,
    loading: false,
    cartData: null,
    favoriteMenuIds: new Set(), // 찜한 메뉴 ID들을 저장
  };

  // 로딩 애니메이션 HTML 생성 함수
  function createLoadingDots() {
    return `
      <span class="loading-dots">
        <span class="dot">.</span>
        <span class="dot">.</span>
        <span class="dot">.</span>
      </span>
    `;
  }

  // 앱 시작
  init();

  async function init() {
    console.log("=== STORE_HOME.JS 초기화 시작 ===");

    // URL 파라미터 추출
    extractParams();

    if (!appState.storeId) {
      alert("가게 정보를 찾을 수 없습니다.");
      window.history.back();
      return;
    }

    // 이벤트 리스너 등록
    setupEvents();

    // 가게 정보 먼저 로드 (가게명 표시용)
    await loadStoreData();

    // 병렬 처리: 리뷰, 메뉴, 장바구니, 찜 목록을 동시에 로드
    Promise.all([
      loadReviewSummary(), // 리뷰는 실패해도 상관없음
      loadFavoriteMenus(), // 찜 목록 먼저 로드
      loadMenus(), // 메뉴 로드 (우선순위 높음)
      handleCartState(), // 장바구니 상태 처리
    ])
      .then(() => {
        console.log("=== 모든 데이터 로딩 완료 ===");
      })
      .catch((error) => {
        console.error("일부 데이터 로딩 실패:", error);
        // 메뉴 로딩이 실패하지 않는 한 계속 진행
      });

    console.log("=== STORE_HOME.JS 초기화 완료 ===");
  }

  function extractParams() {
    const params = new URLSearchParams(window.location.search);
    appState.storeId = parseInt(params.get("storeId"));

    // order.html에서 전달된 장바구니 데이터 확인
    const cartDataParam = params.get("cartData");
    if (cartDataParam) {
      try {
        appState.cartData = JSON.parse(decodeURIComponent(cartDataParam));
        console.log("URL에서 받은 장바구니 데이터:", appState.cartData);

        // URL 정리
        const cleanUrl = `${window.location.pathname}?storeId=${appState.storeId}`;
        window.history.replaceState({}, "", cleanUrl);
      } catch (error) {
        console.error("장바구니 데이터 파싱 실패:", error);
      }
    }

    console.log("URL 파라미터:", {
      storeId: appState.storeId,
      hasCartData: !!appState.cartData,
    });
  }

  function setupEvents() {
    // 주소 복사
    if ($copyIcon) {
      $copyIcon.addEventListener("click", copyStoreAddress);
    }

    // 리뷰 자세히 보기
    if ($reviewMore) {
      $reviewMore.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = `customer_review.html?storeId=${appState.storeId}`;
      });
    }

    // 장바구니 버튼
    if ($floatingCart) {
      $floatingCart.addEventListener("click", () => {
        window.location.href = "cart.html";
      });
    }

    // 무한 스크롤
    window.addEventListener("scroll", handleScroll);

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

      // 가게 정보 즉시 화면에 표시 (로딩 애니메이션 제거)
      displayStoreInfo();

      console.log("가게 정보 로딩 완료:", appState.storeInfo.name);
    } catch (error) {
      console.error("가게 정보 로딩 실패:", error);

      // 에러 발생 시 로딩 애니메이션 제거하고 에러 메시지 표시
      if ($topTitle) {
        $topTitle.textContent = "가게 정보 로딩 실패";
      }
      if ($businessHours) {
        $businessHours.textContent = "영업시간을 불러올 수 없습니다.";
      }
      if ($address) {
        $address.textContent = "주소를 불러올 수 없습니다.";
      }

      alert("가게 정보를 불러오는데 실패했습니다.");
    }
  }

  async function displayStoreInfo() {
    const store = appState.storeInfo;

    if ($topTitle && store.name) {
      $topTitle.textContent = store.name;
    }

    if ($businessHours && store.openingTime && store.closingTime) {
      const openTime = store.openingTime.slice(0, 5);
      const closeTime = store.closingTime.slice(0, 5);
      $businessHours.textContent = `영업시간 ${openTime}~${closeTime}`;
    }

    if ($address) {
      let addr = store.roadAddressName || store.addressName || "";

      if ((!addr || addr.trim() === "") && store.latitude && store.longitude) {
        try {
          addr = await kakaoReverse(store.latitude, store.longitude);
          console.log("📌 reverse geocoding으로 채운 주소:", addr);
        } catch (e) {
          console.warn("주소 변환 실패:", e);
        }
      }

      $address.textContent = addr || "주소 정보 없음";
    }
  }

  async function copyStoreAddress() {
    if (!appState.storeInfo?.roadAddressName) {
      alert("복사할 주소가 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(appState.storeInfo.roadAddressName);
      alert("주소가 복사되었습니다!");
    } catch {
      alert("주소 복사에 실패했습니다.");
    }
  }

  function handleScroll() {
    if (appState.loading || !appState.hasMoreMenus) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) loadMenus();
  }

  async function loadReviewSummary() {
    try {
      console.log("리뷰 요약 로딩 시작...");

      // 로딩 애니메이션 표시
      if ($reviewText) {
        $reviewText.innerHTML = "로딩중" + createLoadingDots();
      }

      const response = await fetch(
        `${API_BASE}/api/v1/reviews/${appState.storeId}/summary`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.log("리뷰 요약 로드 실패:", response.status);
        if ($reviewText) {
          $reviewText.textContent = "리뷰를 불러올 수 없습니다.";
        }
        return;
      }

      const data = await response.json();
      const summary = data.result?.summary || data.summary || "";

      if ($reviewText && summary) {
        $reviewText.textContent = summary; // 로딩 애니메이션 제거하고 실제 내용 표시
        setupReviewToggle(summary);
      }

      console.log("리뷰 요약 로딩 완료");
    } catch (error) {
      console.error("리뷰 요약 로딩 실패:", error);
      if ($reviewText) {
        $reviewText.textContent = "리뷰를 불러오는 중 오류가 발생했습니다.";
      }
    }
  }

  function setupReviewToggle(fullText) {
    if (!$reviewText || !fullText || fullText.length <= 100) {
      return;
    }

    const $reviewSummary = document.querySelector(".review_summary");
    if ($reviewSummary) {
      $reviewSummary.style.height = "auto";
      $reviewSummary.style.minHeight = "auto";
    }

    $reviewText.style.height = "auto";
    $reviewText.style.maxHeight = "none";
    $reviewText.style.overflow = "visible";
    $reviewText.style.whiteSpace = "normal";
    $reviewText.style.wordWrap = "break-word";
    $reviewText.style.lineHeight = "1.5";

    const shortText = fullText.substring(0, 37) + "...";
    let isExpanded = false;

    function updateDisplay() {
      if (isExpanded) {
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

      const $toggleBtn = $reviewText.querySelector(".review-toggle-btn");
      if ($toggleBtn) {
        $toggleBtn.addEventListener("click", (e) => {
          e.preventDefault();
          isExpanded = !isExpanded;
          updateDisplay();

          if (isExpanded) {
            setTimeout(() => {
              const rect = $reviewSummary.getBoundingClientRect();
              if (rect.bottom > window.innerHeight) {
                $reviewSummary.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }
            }, 100);
          }
        });
      }
    }

    updateDisplay();
  }

  // 찜한 메뉴 목록 로드
  async function loadFavoriteMenus() {
    try {
      console.log("찜한 메뉴 목록 로딩 시작...");

      let allFavorites = [];
      let cursor = null;
      let hasMore = true;

      // 모든 찜 목록을 가져오기 위해 페이지네이션 처리
      while (hasMore) {
        const params = new URLSearchParams();
        params.set("size", "50"); // 최대 50개씩 가져오기
        if (cursor !== null) {
          params.set("cursor", cursor.toString());
        }

        const response = await fetch(
          `${API_BASE}/api/v1/favorites/menus?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            console.log("로그인이 필요합니다. 찜 목록을 건너뜁니다.");
            return;
          }
          throw new Error(`찜 목록 로드 실패: ${response.status}`);
        }

        const data = await response.json();
        const result = data.result || data;
        const favorites = result.FavoriteMenus || result.favoriteMenus || [];

        allFavorites = allFavorites.concat(favorites);
        cursor = result.nextCursor;
        hasMore = result.hasData === true;

        console.log(
          `찜 목록 ${favorites.length}개 로드, 다음 커서: ${cursor}, 더 있음: ${hasMore}`
        );
      }

      // 찜한 메뉴 ID들을 Set에 저장
      appState.favoriteMenuIds = new Set(allFavorites.map((fav) => fav.menuId));

      console.log(
        `찜한 메뉴 총 ${allFavorites.length}개 로딩 완료:`,
        Array.from(appState.favoriteMenuIds)
      );

      // 이미 로드된 메뉴들의 찜 상태 업데이트
      updateFavoriteIcons();
    } catch (error) {
      console.error("찜한 메뉴 목록 로딩 실패:", error);
      // 찜 로딩 실패해도 계속 진행
    }
  }

  // 찜 아이콘 업데이트
  function updateFavoriteIcons() {
    const $menuItems = document.querySelectorAll(".menu_item");

    $menuItems.forEach(($item) => {
      const $likeBtn = $item.querySelector(".menu_like");
      if ($likeBtn && $likeBtn.dataset.menuId) {
        const menuId = parseInt($likeBtn.dataset.menuId);
        const isFavorited = appState.favoriteMenuIds.has(menuId);
        updateLikeButtonState($likeBtn, isFavorited);
      }
    });

    console.log("찜 아이콘 업데이트 완료");
  }

  // 찜 버튼 상태 업데이트
  function updateLikeButtonState($likeBtn, isFavorited) {
    const $likeIcon = $likeBtn.querySelector(".like_icon");

    if (isFavorited) {
      // 빨간 하트로 변경
      $likeIcon.src = "../images/like_red.svg";
      $likeBtn.setAttribute("aria-pressed", "true");
      $likeBtn.style.opacity = "1";
    } else {
      // 기본 하트로 변경
      $likeIcon.src = "../images/like.svg";
      $likeBtn.setAttribute("aria-pressed", "false");
      $likeBtn.style.opacity = "0.7";
    }
  }

  async function loadMenus() {
    if (appState.loading || !appState.hasMoreMenus) {
      return;
    }

    appState.loading = true;

    // 첫 번째 로딩이면 로딩 애니메이션 표시
    if (appState.menus.length === 0) {
      if ($menuLoading) {
        $menuLoading.style.display = "block";
        $menuLoading.innerHTML = "메뉴 로딩중" + createLoadingDots();
      }
      if ($menuList) {
        $menuList.style.display = "none";
      }
    }

    try {
      console.log("메뉴 목록 로딩 시작... cursor:", appState.cursor);

      const params = new URLSearchParams();
      params.set("size", PAGE_SIZE.toString());
      params.set("menuSortType", "DISCOUNT");
      if (appState.cursor !== null) {
        params.set("cursor", appState.cursor.toString());
      }

      const url = `${API_BASE}/api/v1/store/${
        appState.storeId
      }/menus?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`메뉴 목록 로드 실패: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result || data;
      const newMenus = result.menus || [];

      // 메뉴 목록 추가
      appState.menus = appState.menus.concat(newMenus);

      // 페이지네이션 정보 업데이트
      appState.cursor = result.nextCursor;
      appState.hasMoreMenus = result.hasData === true;

      // 첫 번째 로딩 완료 시 로딩 애니메이션 숨기고 메뉴 리스트 표시
      if (appState.menus.length === newMenus.length) {
        if ($menuLoading) {
          $menuLoading.style.display = "none";
        }
        if ($menuList) {
          $menuList.style.display = "block";
        }
      }

      // 메뉴 즉시 화면에 표시
      displayMenus(newMenus);

      console.log(
        `메뉴 ${newMenus.length}개 로딩 완료. 전체: ${appState.menus.length}개`
      );

      // 메뉴가 로드된 후 장바구니 표시 업데이트 (가격 계산을 위해)
      if (appState.cartData) {
        displayCartFromData(appState.cartData);
      }
    } catch (error) {
      console.error("메뉴 목록 로딩 실패:", error);

      // 에러 발생 시 로딩 애니메이션 제거하고 에러 메시지 표시
      if ($menuLoading) {
        $menuLoading.innerHTML = "메뉴를 불러오는데 실패했습니다.";
        $menuLoading.style.display = "block";
      }
      if ($menuList) {
        $menuList.style.display = "none";
      }

      alert("메뉴 목록을 불러오는데 실패했습니다.");
    } finally {
      appState.loading = false;
    }
  }

  function displayMenus(menus) {
    if (!$menuTemplate || !$menuList) {
      console.error("메뉴 템플릿 또는 목록 요소를 찾을 수 없음");
      return;
    }

    const fragment = document.createDocumentFragment();

    menus.forEach((menu) => {
      const menuItem = $menuTemplate.content.cloneNode(true);

      // 메뉴 클릭 이벤트
      const $menuItemElement = menuItem.querySelector(".menu_item");
      if ($menuItemElement) {
        $menuItemElement.style.cursor = "pointer";
        $menuItemElement.addEventListener("click", () => {
          window.location.href = `order.html?storeId=${appState.storeId}&menuId=${menu.menuId}`;
        });
      }

      // 메뉴명
      const $menuName = menuItem.querySelector(".menu_name");
      if ($menuName) {
        $menuName.textContent = menu.name || "메뉴명 없음";
      }

      // 가격 정보
      displayMenuPricing(menuItem, menu);

      // 메뉴 이미지
      const $menuThumb = menuItem.querySelector(".menu_thumb");
      if ($menuThumb) {
        $menuThumb.src = menu.menuImage || "../images/sample_pizza.jpg";
        $menuThumb.alt = menu.name || "메뉴 이미지";
      }

      // 찜하기 버튼
      const $likeBtn = menuItem.querySelector(".menu_like");
      if ($likeBtn) {
        $likeBtn.dataset.menuId = menu.menuId;

        // 찜 상태에 따라 아이콘 설정
        const isFavorited = appState.favoriteMenuIds.has(menu.menuId);
        updateLikeButtonState($likeBtn, isFavorited);

        $likeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleMenuLike(menu.menuId, $likeBtn);
        });
      }

      fragment.appendChild(menuItem);
    });

    $menuList.appendChild(fragment);
    console.log(`메뉴 ${menus.length}개가 화면에 표시되었습니다.`);
  }

  function displayMenuPricing(menuItem, menu) {
    const originalPrice = menu.price || 0;
    const discountPercent = menu.discountPercent || 0;
    const discountedPrice = Math.round(
      originalPrice * (1 - discountPercent / 100)
    );

    // 정가 (할인이 있을 때만)
    const $priceStrike = menuItem.querySelector(".price_strike");
    if ($priceStrike) {
      if (discountPercent > 0) {
        $priceStrike.textContent = `${originalPrice.toLocaleString()}원`;
        $priceStrike.style.display = "block";
      } else {
        $priceStrike.style.display = "none";
      }
    }

    // 할인율 (할인이 있을 때만)
    const $saleRate = menuItem.querySelector(".price_sale_rate");
    if ($saleRate) {
      if (discountPercent > 0) {
        $saleRate.textContent = `${discountPercent}%`;
        $saleRate.style.display = "inline";
      } else {
        $saleRate.style.display = "none";
      }
    }

    // 판매가
    const $salePrice = menuItem.querySelector(".price_sale");
    if ($salePrice) {
      const finalPrice = discountPercent > 0 ? discountedPrice : originalPrice;
      $salePrice.textContent = `${finalPrice.toLocaleString()}원`;
    }
  }

  async function handleCartState() {
    console.log("=== 장바구니 상태 처리 시작 ===");

    if (appState.cartData) {
      // order.html에서 전달받은 데이터가 있으면 사용
      console.log("URL에서 받은 장바구니 데이터 사용");
      // 메뉴가 로드되기를 기다린 후 표시 (가격 계산을 위해)
      waitForMenusAndDisplayCart();
    } else {
      // 데이터가 없으면 서버에서 조회
      console.log("서버에서 장바구니 조회");
      await loadCartFromServer();
    }
  }

  function waitForMenusAndDisplayCart() {
    // 메뉴가 로드될 때까지 대기하거나, 이미 로드되었으면 즉시 표시
    const checkMenus = () => {
      if (appState.menus.length > 0) {
        displayCartFromData(appState.cartData);
      } else {
        // 100ms 후 다시 확인
        setTimeout(checkMenus, 100);
      }
    };
    checkMenus();
  }

  function displayCartFromData(cartData) {
    console.log("장바구니 데이터로 UI 업데이트:", cartData);

    if (!$floatingCart) {
      console.error("장바구니 버튼 요소를 찾을 수 없음");
      return;
    }

    if (!cartData.cartMenuInfoList || cartData.cartMenuInfoList.length === 0) {
      console.log("장바구니가 비어있음");
      $floatingCart.hidden = true;
      return;
    }

    // 현재 가게의 아이템만 필터링
    const currentStoreItems = cartData.cartMenuInfoList.filter((item) => {
      console.log(
        `아이템 storeId: ${item.storeId}, 현재 storeId: ${appState.storeId}`
      );
      return parseInt(item.storeId) === parseInt(appState.storeId);
    });

    console.log("현재 가게 아이템들:", currentStoreItems);

    if (currentStoreItems.length === 0) {
      console.log("현재 가게의 아이템이 없음");
      $floatingCart.hidden = true;
      return;
    }

    // 총 수량 계산
    const totalCount = currentStoreItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    // 가격 계산 (메뉴 정보에서 가져오기)
    let totalOriginalPrice = 0;
    let totalDiscountedPrice = 0;

    currentStoreItems.forEach((item) => {
      // 현재 로드된 메뉴 목록에서 해당 메뉴 찾기
      const menuInfo = appState.menus.find(
        (menu) => menu.menuId === item.menuId
      );

      if (menuInfo) {
        const originalPrice = menuInfo.price || 0;
        const discountPercent = menuInfo.discountPercent || 0;
        const quantity = item.quantity || 0;

        const itemOriginalPrice = originalPrice * quantity;
        const itemDiscountedPrice =
          Math.round(originalPrice * (1 - discountPercent / 100)) * quantity;

        totalOriginalPrice += itemOriginalPrice;
        totalDiscountedPrice += itemDiscountedPrice;

        console.log(
          `메뉴 ${item.menuName}: 원가 ${itemOriginalPrice}원, 할인가 ${itemDiscountedPrice}원`
        );
      } else {
        console.warn(`메뉴 정보를 찾을 수 없음: menuId ${item.menuId}`);
      }
    });

    console.log("총 수량:", totalCount);
    console.log("총 원가:", totalOriginalPrice);
    console.log("총 할인가:", totalDiscountedPrice);

    // 장바구니 버튼 표시
    $floatingCart.hidden = false;

    // UI 업데이트
    const $cartCount = $floatingCart.querySelector(".cart_count");
    const $cartOld = $floatingCart.querySelector("#cartOld");
    const $cartNow = $floatingCart.querySelector("#cartNow");

    if ($cartCount) {
      $cartCount.textContent = totalCount;
    }

    if ($cartOld && $cartNow) {
      if (totalOriginalPrice > 0) {
        if (totalOriginalPrice !== totalDiscountedPrice) {
          // 할인이 있는 경우
          $cartOld.textContent = `${totalOriginalPrice.toLocaleString()}원`;
          $cartOld.style.display = "inline";
          $cartNow.textContent = `${totalDiscountedPrice.toLocaleString()}원`;
        } else {
          // 할인이 없는 경우
          $cartOld.style.display = "none";
          $cartNow.textContent = `${totalDiscountedPrice.toLocaleString()}원`;
        }
      } else {
        // 가격 정보가 없는 경우 기본 표시
        $cartOld.style.display = "none";
        $cartNow.textContent = `${totalCount}개 담김`;
      }
    }

    console.log("장바구니 UI 업데이트 완료");
  }

  async function loadCartFromServer() {
    try {
      console.log("서버에서 장바구니 조회 시작...");

      const response = await fetch(`${API_BASE}/api/v1/carts`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          console.log("장바구니가 비어있거나 로그인 필요");
          $floatingCart.hidden = true;
          return;
        }
        throw new Error(`장바구니 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      console.log("서버 장바구니 응답:", data);

      const cartData = data.result || data;

      // 메뉴가 로드되기를 기다린 후 표시
      const checkMenus = () => {
        if (appState.menus.length > 0) {
          displayCartFromData(cartData);
        } else {
          setTimeout(checkMenus, 100);
        }
      };
      checkMenus();

      console.log("서버 장바구니 조회 완료");
    } catch (error) {
      console.error("서버 장바구니 조회 실패:", error);
      $floatingCart.hidden = true;
    }
  }

  async function copyStoreAddress() {
    if (!appState.storeInfo?.roadAddressName) {
      alert("복사할 주소가 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(appState.storeInfo.roadAddressName);
      alert("주소가 복사되었습니다!");
      console.log("주소 복사 완료:", appState.storeInfo.roadAddressName);
    } catch (error) {
      console.error("주소 복사 실패:", error);

      // 구형 브라우저 대안
      const textArea = document.createElement("textarea");
      textArea.value = appState.storeInfo.roadAddressName;
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand("copy");
        alert("주소가 복사되었습니다!");
      } catch (err) {
        alert("주소 복사에 실패했습니다.");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  function handleScroll() {
    if (appState.loading || !appState.hasMoreMenus) {
      return;
    }

    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;

    if (nearBottom) {
      console.log("스크롤 바닥 근처 도달 - 추가 메뉴 로딩");
      loadMenus();
    }
  }

  // 메뉴 찜하기/해제 처리
  async function handleMenuLike(menuId, $likeBtn) {
    console.log("메뉴 찜하기 클릭:", menuId);

    const isFavorited = appState.favoriteMenuIds.has(menuId);

    // 버튼 비활성화 (중복 클릭 방지)
    $likeBtn.disabled = true;
    $likeBtn.style.opacity = "0.5";

    try {
      if (isFavorited) {
        // 찜 해제
        await removeFavorite(menuId);
        appState.favoriteMenuIds.delete(menuId);
        updateLikeButtonState($likeBtn, false);
        console.log(`메뉴 ${menuId} 찜 해제 완료`);
      } else {
        // 찜 추가
        await addFavorite(menuId);
        appState.favoriteMenuIds.add(menuId);
        updateLikeButtonState($likeBtn, true);
        console.log(`메뉴 ${menuId} 찜 추가 완료`);
      }
    } catch (error) {
      console.error("찜 처리 실패:", error);
      alert("찜 처리에 실패했습니다. 다시 시도해주세요.");

      // 실패 시 원래 상태로 복원
      updateLikeButtonState($likeBtn, isFavorited);
    } finally {
      // 버튼 활성화
      $likeBtn.disabled = false;
      $likeBtn.style.opacity = "";
    }
  }

  // 찜 추가 API 호출
  async function addFavorite(menuId) {
    const response = await fetch(
      `${API_BASE}/api/v1/menus/${menuId}/favorite`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        alert("로그인이 필요합니다.");
        // 필요시 로그인 페이지로 리다이렉트
        // window.location.href = '/login';
        return;
      }
      throw new Error(`찜 추가 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log("찜 추가 응답:", data);

    return data;
  }

  // 찜 해제 API 호출
  async function removeFavorite(menuId) {
    const response = await fetch(
      `${API_BASE}/api/v1/favorites/menus/${menuId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        alert("로그인이 필요합니다.");
        return;
      }
      throw new Error(`찜 해제 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log("찜 해제 응답:", data);

    return data;
  }
  function kakaoReverse(lat, lng) {
    return new Promise((resolve) => {
      if (typeof kakao === "undefined" || !kakao.maps?.services) {
        console.warn("⚠️ Kakao SDK 준비 안됨");
        return resolve("");
      }
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(Number(lng), Number(lat), (res, status) => {
        if (status !== kakao.maps.services.Status.OK || !res?.length) {
          return resolve("");
        }
        resolve(
          res[0].road_address?.address_name ||
            res[0].address?.address_name ||
            ""
        );
      });
    });
  }
});
