// order_manage.js
(function () {
  const API_BASE_URL = "http://3.39.89.75:8080/api/v1"; // Swagger 기준
  const STORAGE_KEY = "accessToken";

  // 로컬스토리지에서 토큰 가져오기
  function getToken() {
    return localStorage.getItem(STORAGE_KEY);
  }

  // 주문 목록 가져오기
  async function fetchOrders() {
    const token = getToken();
    if (!token) {
      alert("로그인이 필요합니다.");
      window.location.href = "login.html"; // 로그인 페이지로 이동
      return [];
    }

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
      });

      const data = await res.json();

      if (res.ok && data.isSuccess) {
        return data.result; // 서버 응답 형식: { isSuccess, result: [...] }
      } else {
        console.error("주문 조회 실패:", data.message);
        alert("주문 조회 실패: " + data.message);
        return [];
      }
    } catch (err) {
      console.error("API 요청 에러:", err);
      alert("서버 오류로 주문 조회에 실패했습니다.");
      return [];
    }
  }

  // 주문 목록 렌더링
  function renderOrders(orders) {
    const orderList = document.getElementById("order-list");
    const template = document.getElementById("order-card-template");

    orderList.innerHTML = ""; // 초기화

    orders.forEach((order) => {
      const clone = template.content.cloneNode(true);
      const li = clone.querySelector(".order-card");

      li.dataset.id = order.id;
      clone.querySelector("[data-order-number]").textContent =
        order.orderNumber;
      clone.querySelector("[data-remain-time]").textContent =
        order.remainTime || "곧 마감";

      // 주문 품목 리스트
      const itemsUl = clone.querySelector("[data-items]");
      order.items.forEach((item) => {
        const liItem = document.createElement("li");
        liItem.classList.add("order-item");
        liItem.textContent = `${item.menuName} x ${item.quantity}`;
        itemsUl.appendChild(liItem);
      });

      // 픽업 시간
      clone.querySelector("[data-pickup-time]").textContent = order.pickupTime;

      // 가격
      clone.querySelec(
        // menu_manage.js
        () => {
          const API_BASE = "https://api-whynotbuy.store";
          const listEl = document.getElementById("order-list");
          const tmpl = document.getElementById("order-card-template");

          // 커서 기반 페이지네이션 상태
          let cursor = null; // 마지막 orderId
          let hasNext = true;
          let isLoading = false;
          const pageSize = 10;

          // sentinel (무한 스크롤 감시용)
          const sentinel = document.createElement("div");
          sentinel.setAttribute("data-sentinel", "true");
          sentinel.style.height = "1px";
          listEl.appendChild(sentinel);

          // IntersectionObserver: 스크롤 시 다음 데이터 로드
          const io = new IntersectionObserver(
            async (entries) => {
              const entry = entries[0];
              if (!entry.isIntersecting) return;
              if (isLoading || !hasNext) return;
              await loadMore();
            },
            { rootMargin: "400px 0px" }
          );
          io.observe(sentinel);

          // ========================
          // API 호출
          // ========================
          async function fetchOrders(cursor, size) {
            const usp = new URLSearchParams({ size: String(size) });
            if (cursor !== null) usp.set("cursor", String(cursor));

            const url = `${API_BASE}/api/v1/orders?${usp.toString()}`;
            const res = await fetch(url, { headers: { Accept: "*/*" } });

            if (!res.ok) throw new Error(`주문 불러오기 실패 (${res.status})`);
            const data = await res.json();

            if (!data?.isSuccess) {
              throw new Error(data?.message || "주문 불러오기 실패");
            }
            return data.result ?? { orderList: [], nextCursor: -1 };
          }

          // ========================
          // 렌더링
          // ========================
          function renderOrders(orderList) {
            for (const o of orderList) {
              const node = tmpl.content.cloneNode(true);
              const card = node.querySelector(".order-card");

              // data-id
              card.dataset.id = o.orderId;

              // 주문번호
              const orderNumEl = card.querySelector("[data-order-number]");
              orderNumEl.textContent = o.orderNum ?? "-";
              orderNumEl.href = "#"; // 상세 페이지가 있다면 여기 수정

              // 남은 시간 (여기서는 예시: 주문시간 + 20분 → 남은 분)
              const remainEl = card.querySelector("[data-remain-time]");
              remainEl.textContent = calcRemain(o.orderTime);

              // 메뉴 아이템
              const itemsEl = card.querySelector("[data-items]");
              itemsEl.innerHTML = "";
              (o.menuSummaries || []).forEach((m) => {
                const li = document.createElement("li");
                li.className = "order-item";
                li.innerHTML = `
          <span class="order-item__name">${m}</span>
          <span class="order-item__qty">1개</span>
        `;
                itemsEl.appendChild(li);
              });

              // 픽업 시간 (orderTime 기준으로 표시)
              const pickupEl = card.querySelector("[data-pickup-time]");
              pickupEl.textContent = formatPickup(o.orderTime);

              // 가격 (여기서는 totalPrice만 내려오므로 할인율 계산 불가 → 그냥 totalPrice만 표시)
              const originEl = card.querySelector("[data-origin-price]");
              const discountEl = card.querySelector("[data-discount-rate]");
              const finalEl = card.querySelector("[data-final-price]");

              originEl.textContent = `${numberFormat(o.totalPrice)}원`;
              discountEl.textContent = "";
              finalEl.textContent = `${numberFormat(o.totalPrice)}원`;

              listEl.insertBefore(node, sentinel);
            }
          }

          // ========================
          // 유틸
          // ========================
          function numberFormat(n) {
            return new Intl.NumberFormat("ko-KR").format(n ?? 0);
          }

          function calcRemain(orderTime) {
            const now = new Date();
            const orderDate = new Date(orderTime);
            const diffMs = orderDate.getTime() + 20 * 60000 - now.getTime(); // 20분 후 픽업 가정
            const diffMin = Math.max(0, Math.floor(diffMs / 60000));
            return `${diffMin}분 후`;
          }

          function formatPickup(orderTime) {
            const d = new Date(orderTime);
            return d.toLocaleTimeString("ko-KR", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
          }

          function wipeStaticCards() {
            const children = Array.from(listEl.children);
            for (const c of children) {
              if (
                c.matches('[data-sentinel="true"]') ||
                c.tagName === "TEMPLATE"
              )
                continue;
              listEl.removeChild(c);
            }
          }

          function showError(msg) {
            const li = document.createElement("li");
            li.className = "order-card";
            li.style.border = "1px solid red";
            li.innerHTML = `
      <div class="order-card__head">
        <div class="order-card__order-info">
          <span class="order-card__label">에러</span>
          <span class="order-card__number">${msg}</span>
        </div>
      </div>
    `;
            listEl.insertBefore(li, sentinel);
          }

          // ========================
          // 데이터 로드
          // ========================
          async function initialLoad() {
            wipeStaticCards();

            try {
              isLoading = true;
              const { orderList, nextCursor } = await fetchOrders(
                cursor,
                pageSize
              );
              renderOrders(orderList);
              cursor = nextCursor >= 0 ? nextCursor : null;
              hasNext = nextCursor !== -1;
            } catch (err) {
              console.error(err);
              showError(err.message || "주문을 불러오지 못했습니다.");
              hasNext = false;
            } finally {
              isLoading = false;
            }
          }

          async function loadMore() {
            try {
              isLoading = true;
              const { orderList, nextCursor } = await fetchOrders(
                cursor,
                pageSize
              );
              renderOrders(orderList);
              cursor = nextCursor >= 0 ? nextCursor : null;
              hasNext = nextCursor !== -1;
              if (!hasNext) io.unobserve(sentinel);
            } catch (err) {
              console.error(err);
              showError(err.message || "추가 주문 불러오기 실패");
              hasNext = false;
              io.unobserve(sentinel);
            } finally {
              isLoading = false;
            }
          }

          // 시작
          initialLoad();
        }
      )();
      tor("[data-origin-price]").textContent =
        order.originPrice.toLocaleString() + "원";
      clone.querySelector("[data-discount-rate]").textContent =
        order.discountRate + "%";
      clone.querySelector("[data-final-price]").textContent =
        order.finalPrice.toLocaleString() + "원";

      orderList.appendChild(clone);
    });
  }

  // 페이지 로드 시 실행
  document.addEventListener("DOMContentLoaded", async () => {
    const orders = await fetchOrders();
    renderOrders(orders);
  });
})();
