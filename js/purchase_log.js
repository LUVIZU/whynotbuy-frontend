// ../js/purchase_log.js
document.addEventListener("DOMContentLoaded", () => {
  /* ===== 설정 ===== */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;

  /* ===== 엘리먼트 ===== */
  const $list = document.getElementById("purchase_list");
  const $empty = document.getElementById("empty_state");
  const $loading = document.getElementById("loading");

  /* ===== 상태 ===== */
  const state = {
    cursor: null,
    hasMore: true,
    loading: false,
  };

  /* ===== 유틸 ===== */
  const fmtPrice = (n) => (n ?? 0).toLocaleString("ko-KR") + " 원";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000); // UTC→KST 보정(백엔드가 KST면 제거 가능)
      return `${kst.getMonth() + 1}월 ${kst.getDate()}일 (${
        weekday[kst.getDay()]
      })`;
    } catch {
      return "";
    }
  };
  const xss = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const setLoading = (on) => ($loading.hidden = !on);

  /* ===== API ===== */
  async function fetchOrders() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;
    setLoading(true);

    const q = new URLSearchParams();
    if (state.cursor) q.set("cursor", state.cursor);
    q.set("size", PAGE_SIZE);

    try {
      const res = await fetch(`${API_BASE}/api/v1/orders?` + q.toString(), {
        method: "GET",
        credentials: "include", // JWT 쿠키 인증
      });

      if (res.status === 401 || res.status === 403) {
        alert("로그인이 필요합니다.");
        location.href = "../pages/login.html";
        return;
      }

      const data = await res.json();
      if (!data?.isSuccess) throw new Error(data?.message || "주문 조회 실패");

      const list = data.result?.orderList ?? [];
      renderAppend(list);

      const next = data.result?.nextCursor ?? 0;
      state.cursor = next || null;
      state.hasMore = !!next;

      $empty.hidden = $list.children.length > 0;
    } catch (e) {
      console.error(e);
      alert("구매내역을 불러오지 못했습니다.");
    } finally {
      state.loading = false;
      setLoading(false);
    }
  }

  /* ===== 렌더 ===== */
  function renderAppend(items) {
    const frag = document.createDocumentFragment();

    items.forEach((o) => {
      const orderId = o.orderId;
      const orderNum = o.orderNum;
      const storeName = o.storeName;
      const orderTime = o.orderTime;

      // 가격
      const nowPrice = o.totalPrice ?? o.salePrice ?? o.price ?? 0;
      const oldPrice = o.originalPrice ?? o.beforePrice ?? null;
      const salePct =
        o.discountRate ??
        (oldPrice && nowPrice
          ? Math.round(((oldPrice - nowPrice) / oldPrice) * 100)
          : null);

      // 아이템 요약: 문자열 배열로 들어온다고 가정 (예: ["버섯 피자 1개", "다른 피자 1개"])
      const summaries = Array.isArray(o.menuSummaries) ? o.menuSummaries : [];
      const itemsHtml = summaries.map((s) => `<li>${xss(s)}</li>`).join("");

      const hasReview = !!(o.myReview || o.hasReview);
      const myReviewText = o.myReview?.content || o.myReview?.text || "";

      const li = document.createElement("li");
      li.className = "order_card";
      li.innerHTML = `
        <header class="order_header">
          <div class="order_date">${fmtDate(orderTime)}</div>
          <a class="order_id" href="#" data-order-id="${orderId}">
            주문번호&nbsp;${xss(orderNum)}
          </a>
        </header>
        <div class="divider"></div>
        <section class="order_body">
          <h3 class="store_name" data-store-id="${o.storeId || ""}">
          ${xss(storeName)}
          </h3>

          <ul class="order_items">${itemsHtml}</ul>
          <div class="price_row">
            ${
              oldPrice
                ? `<span class="old_price">${fmtPrice(oldPrice)}</span>`
                : ""
            }
            ${
              salePct != null ? `<span class="sale_pct">${salePct}%</span>` : ""
            }
            <span class="now_price">${fmtPrice(nowPrice)}</span>
          </div>
        </section>
        ${
          hasReview
            ? `
          <footer class="order_footer order_footer--mine">
            <div class="my_review_title">내 리뷰</div>
            <p class="my_review_txt">${xss(
              myReviewText || "작성한 리뷰를 불러왔어요."
            )}</p>
          </footer>`
            : `
          <footer class="order_footer order_footer--cta">
            <button type="button" class="review_btn"
              data-order-id="${orderId}"
              data-order-num="${xss(orderNum)}"
              data-store-name="${xss(storeName)}"
              data-items='${JSON.stringify(summaries)}'
              data-old-price="${oldPrice ?? ""}"
              data-sale-pct="${salePct ?? ""}"
              data-now-price="${nowPrice}"
              data-order-date="${xss(fmtDate(orderTime))}">
              리뷰 남기기
            </button>
          </footer>`
        }
      `;
      frag.appendChild(li);
    });

    $list.appendChild(frag);
  }

  /* ===== 이벤트 ===== */
  // 리뷰 남기기 → write_review로 이동(sessionStorage로 페이로드 전달)
  $list.addEventListener("click", (e) => {
    const storeEl = e.target.closest(".store_name");
    if (storeEl) {
      const storeId = storeEl.dataset.storeId;
      const storeName = storeEl.textContent.trim();

      if (storeId) {
        // storeId가 있으면 id 기반으로 이동
        location.href = `../pages/store_home.html?storeId=${encodeURIComponent(
          storeId
        )}`;
      } else {
        // storeName으로 이동 (백엔드에 따라 다르게 처리)
        location.href = `../pages/store_home.html?storeName=${encodeURIComponent(
          storeName
        )}`;
      }
      return;
    }
    const btn = e.target.closest(".review_btn");
    if (!btn) return;

    const payload = {
      order_id: Number(btn.dataset.orderId),
      store_name: btn.dataset.storeName,
      items: JSON.parse(btn.dataset.items || "[]"), // 문자열 배열 ex) ["버섯 피자 1개", ...]
      old_price: btn.dataset.oldPrice ? Number(btn.dataset.oldPrice) : null,
      sale_pct: btn.dataset.salePct ? Number(btn.dataset.salePct) : null,
      now_price: Number(btn.dataset.nowPrice || 0),
      order_date_label: btn.dataset.orderDate || "",
      order_code: btn.dataset.orderNum || "",
    };

    if (!payload.order_id) {
      alert("주문 식별자가 없습니다.");
      return;
    }

    sessionStorage.setItem("review_target", JSON.stringify(payload));
    location.href = "../pages/write_review.html";
  });

  // 인피니트 스크롤(바닥 200px 근처)
  window.addEventListener("scroll", () => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchOrders();
  });

  /* ===== 시작 ===== */
  fetchOrders();
});
