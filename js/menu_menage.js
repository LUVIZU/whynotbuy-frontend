document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const orderListEl = document.getElementById("order-list");
  const orderTemplate = document.getElementById("order-card-template");
  let nextCursor = null;
  let isLoading = false;

  // ✅ 쿠키에서 JWT 토큰 가져오기
  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  // ✅ 남은 시간 계산 (visitTime 기준)
  function calcRemainTime(visitTimeStr) {
    // visitTimeStr: 서버에서 내려준 예약 시간 (ISO8601, UTC)
    const pickupTime = new Date(visitTimeStr); // 자동으로 로컬(KST) 변환됨
    const now = new Date();

    const diffMs = pickupTime.getTime() - now.getTime();
    const diffMin = Math.floor(diffMs / 1000 / 60);

    if (diffMin <= 0) return "곧 도착";
    if (diffMin < 60) return `${diffMin}분 후`;

    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins === 0 ? `${hours}시간 후` : `${hours}시간 ${mins}분 후`;
  }

  // ✅ 카드 렌더링
  function renderOrderCard(order) {
    const clone = orderTemplate.content.cloneNode(true);
    const card = clone.querySelector(".order-card");

    card.dataset.id = order.orderId;
    card.querySelector("[data-order-number]").textContent = order.orderNum;

    // 메뉴 목록
    const itemsUl = card.querySelector("[data-items]");
    itemsUl.innerHTML = "";
    if (order.menuSummaries && order.menuSummaries.length) {
      order.menuSummaries.forEach((menu) => {
        const li = document.createElement("li");
        li.className = "order-item";
        li.innerHTML = `
          <span class="order-item__name">${menu}</span>
          <span class="order-item__qty">1개</span>
        `;
        itemsUl.appendChild(li);
      });
    }

    // ✅ 픽업 시간 (visitTime)
    const pickup = new Date(order.visitTime);
    card.querySelector("[data-pickup-time]").textContent =
      pickup.toLocaleTimeString("ko-KR", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    // 남은 시간
    card.querySelector("[data-remain-time]").textContent = calcRemainTime(
      order.visitTime
    );
    // ✅ 가격 (원가 / 할인율 / 최종가)
    const originPrice = order.totalOriginalPrice ?? order.totalPrice;
    const discountRate = order.averageDiscountPercent
      ? Math.round(order.averageDiscountPercent)
      : 0;
    const finalPrice = order.totalPrice; // API의 totalPrice가 최종가

    card.querySelector(
      "[data-origin-price]"
    ).textContent = `${originPrice.toLocaleString()}원`;
    card.querySelector("[data-discount-rate]").textContent =
      discountRate > 0 ? `-${discountRate}%` : "0%";
    card.querySelector(
      "[data-final-price]"
    ).textContent = `${finalPrice.toLocaleString()}원`;

    orderListEl.appendChild(clone);
  }

  // ✅ 주문 불러오기
  async function loadOrders(cursor = null, size = 10) {
    if (isLoading) return;
    isLoading = true;

    const token = getCookie("accessToken");

    try {
      let url = `${API_BASE}/api/v1/orders?size=${size}`;
      if (cursor) url += `&cursor=${cursor}`;

      // ❌ storeId는 붙이지 않는다 (서버가 토큰 기반으로 OWNER의 가게를 인식)
      // if (storeId) url += `&storeId=${storeId}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const { orderList, nextCursor: nc } = data.result;
        orderList.forEach(renderOrderCard);
        nextCursor = nc;
      } else {
        console.warn("❌ 주문 조회 실패:", data.message);
      }
    } catch (err) {
      console.error("주문 불러오기 오류", err);
    } finally {
      isLoading = false;
    }
  }

  // ✅ 스크롤 페이징
  window.addEventListener("scroll", () => {
    if (isLoading || nextCursor === -1) return;
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 200
    ) {
      loadOrders(nextCursor);
    }
  });

  // ✅ 네비게이션에 storeId 붙이기
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  if (storeId) {
    document.querySelectorAll(".bottom_nav a").forEach((a) => {
      let href = a.getAttribute("href");
      if (href.includes("?")) {
        href += `&storeId=${storeId}`;
      } else {
        href += `?storeId=${storeId}`;
      }
      a.setAttribute("href", href);
    });
  }
  async function openStore() {
    const token = getCookie("accessToken");
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const bottomStatus = document.getElementById("countdown");
        bottomStatus.textContent = "주문 마감하기"; // 🔥 텍스트 변경
        bottomStatus.style.background = "#28a745"; // 초록색
        alert("✅ 가게가 오픈되었습니다!");
      } else {
        alert("❌ 오픈 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 오픈 오류", err);
      alert("서버 오류로 오픈하지 못했습니다.");
    }
  }

  // ✅ 가게 즉시 마감
  async function closeStore() {
    const token = getCookie("accessToken");
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const bottomStatus = document.getElementById("countdown");
        bottomStatus.textContent = "주문 받기"; // 🔥 텍스트 변경
        bottomStatus.style.background = "#a82d2f"; // 빨간색
        alert("✅ 가게가 마감되었습니다!");
      } else {
        alert("❌ 마감 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 마감 오류", err);
      alert("서버 오류로 마감하지 못했습니다.");
    }
  }

  // ✅ 하단 상태 배지 클릭 → API 호출 + 토글
  const bottomStatus = document.getElementById("countdown");
  if (bottomStatus) {
    bottomStatus.addEventListener("click", () => {
      if (bottomStatus.textContent.includes("주문 받기")) {
        openStore();
      } else {
        closeStore();
      }
    });
  }
  // ✅ 가게 상태 판별 공통 함수
  function isStoreOpen(store) {
    if (!store.openingTime || !store.closingTime) return false;

    const now = new Date();

    const open = new Date(now);
    open.setHours(
      store.openingTime.hour,
      store.openingTime.minute,
      store.openingTime.second,
      0
    );

    const close = new Date(now);
    close.setHours(
      store.closingTime.hour,
      store.closingTime.minute,
      store.closingTime.second,
      0
    );

    if (close > open) {
      // ✅ 일반적인 케이스 (같은 날 오픈~마감)
      return now >= open && now < close;
    } else {
      // ✅ 마감 시간이 오픈보다 빠른 경우 (자정 넘김 케이스)
      return now >= open || now < close;
    }
  }

  // ✅ 상태 적용 (버튼 + 메뉴관리 탭 같이 변경)
  async function applyStoreStatus() {
    const token = getCookie("accessToken");
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.isSuccess) {
        const store = data.result;
        const bottomStatus = document.getElementById("countdown");
        const menuTab = document.getElementById("menu-manage-link");

        if (isStoreOpen(store)) {
          // 영업중
          bottomStatus.textContent = "주문 마감하기";
          bottomStatus.style.background = "#a82d2f"; // 빨간색
          if (menuTab) menuTab.href = `menu_on.html?storeId=${storeId}`;
        } else {
          // 마감중
          bottomStatus.textContent = "주문 받기";
          bottomStatus.style.background = "#777777";
          if (menuTab) menuTab.href = `menu_off.html?storeId=${storeId}`;
        }
      }
    } catch (err) {
      console.error("가게 상태 조회 오류", err);
    }
  }

  // ✅ 초기 실행
  applyStoreStatus();

  // ✅ 초기 로딩 시 상태 반영
  async function setMenuTabLink() {
    const token = getCookie("accessToken");
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const store = data.result;
        const menuTab = document.getElementById("menu-manage-link");
        if (menuTab) {
          if (isStoreOpen(store)) {
            menuTab.setAttribute("href", `menu_on.html?storeId=${storeId}`);
          } else {
            menuTab.setAttribute("href", `menu_off.html?storeId=${storeId}`);
          }
        }
      }
    } catch (err) {
      console.error("가게 상태 조회 오류", err);
    }
  }

  // ✅ 초기 실행
  setMenuTabLink();
});
