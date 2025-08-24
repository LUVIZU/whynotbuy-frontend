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
    const pickupTime = new Date(visitTimeStr);
    const now = new Date();

    const diffMs = pickupTime.getTime() - now.getTime();
    const diffMin = Math.floor(diffMs / 1000 / 60);

    if (diffMin < 0) return "픽업 완료"; // ✅ 이미 지난 경우
    if (diffMin === 0) return "곧 도착"; // ✅ 정확히 0분일 때
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

    // ✅ 픽업 시간
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

    // ✅ 가격
    const originPrice = order.totalOriginalPrice ?? order.totalPrice;
    const discountRate = order.averageDiscountPercent
      ? Math.round(order.averageDiscountPercent)
      : 0;
    const finalPrice = order.totalPrice;

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

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
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

  // ✅ 가게 오픈
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
        localStorage.setItem("storeOpenState", "OPEN");
        const bottomStatus = document.getElementById("countdown");
        bottomStatus.textContent = "주문 마감하기";
        bottomStatus.style.background = "#a82d2f";
        alert("✅ 가게가 오픈되었습니다!");
      } else {
        alert("❌ 오픈 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 오픈 오류", err);
      alert("서버 오류로 오픈하지 못했습니다.");
    }
  }

  // ✅ 가게 마감
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
        localStorage.setItem("storeOpenState", "CLOSE");
        const bottomStatus = document.getElementById("countdown");
        bottomStatus.textContent = "주문 받기";
        bottomStatus.style.background = "#777";
        alert("✅ 가게가 마감되었습니다!");
      } else {
        alert("❌ 마감 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 마감 오류", err);
      alert("서버 오류로 마감하지 못했습니다.");
    }
  }

  // ✅ 버튼 클릭 → 상태 토글
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

  // ✅ 영업시간 기준으로 버튼 상태 자동 반영
  async function applyBusinessHoursStatus() {
    try {
      const token = getCookie("accessToken");
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        credentials: "include",
      });

      if (!res.ok) throw new Error("가게 정보 조회 실패");
      const data = await res.json();
      const store = data.result;

      const bottomStatus = document.getElementById("countdown");
      if (!store?.openingTime || !store?.closingTime) {
        console.warn("영업시간 정보 없음");
        return;
      }

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const [openH, openM] = store.openingTime.split(":").map(Number);
      const [closeH, closeM] = store.closingTime.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      let isOpen = false;

      if (openMinutes === 0 && closeMinutes === 1439) {
        // 24시간 영업 (00:00 ~ 23:59)
        isOpen = true;
      } else if (openMinutes < closeMinutes) {
        // 같은 날 영업 (예: 08:00 ~ 19:00)
        isOpen = nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
      } else {
        // 자정을 넘는 영업 (예: 20:00 ~ 02:00)
        isOpen = nowMinutes >= openMinutes || nowMinutes <= closeMinutes;
      }

      if (isOpen) {
        localStorage.setItem("storeOpenState", "OPEN");
        bottomStatus.textContent = "주문 마감하기";
        bottomStatus.style.background = "#a82d2f";
      } else {
        localStorage.setItem("storeOpenState", "CLOSE");
        bottomStatus.textContent = "주문 받기";
        bottomStatus.style.background = "#777";
      }
    } catch (err) {
      console.error("영업시간 상태 반영 실패:", err);
    }
  }

  // ✅ localStorage 상태 반영
  function applyLocalStoreStatus() {
    const state = localStorage.getItem("storeOpenState");
    const bottomStatus = document.getElementById("countdown");
    const menuTab = document.getElementById("menu-manage-link");

    if (state === "OPEN") {
      bottomStatus.textContent = "주문 마감하기";
      bottomStatus.style.background = "#a82d2f";
      if (menuTab) menuTab.href = `menu_on.html?storeId=${storeId}`;
    } else if (state === "CLOSE") {
      bottomStatus.textContent = "주문 받기";
      bottomStatus.style.background = "#777";
      if (menuTab) menuTab.href = `menu_off.html?storeId=${storeId}`;
    }
  }

  // ✅ 초기 실행
  applyBusinessHoursStatus().then(() => {
    applyLocalStoreStatus();
  });
  loadOrders();
});
