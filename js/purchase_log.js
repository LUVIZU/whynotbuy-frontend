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
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000); // UTC→KST 보정(백엔드가 KST면 제거해도 됨)
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

      const nowPrice = o.totalPrice ?? o.salePrice ?? o.price ?? 0;
      const oldPrice = o.originalPrice ?? o.beforePrice ?? null;
      const salePct =
        o.discountRate ??
        (oldPrice && nowPrice
          ? Math.round(((oldPrice - nowPrice) / oldPrice) * 100)
          : null);

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
          <h3 class="store_name">${xss(storeName)}</h3>
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
              data-order-id="${orderId}" data-order-num="${encodeURIComponent(
                orderNum
              )}">
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
  // 리뷰 남기기 → write_review로 이동
  $list.addEventListener("click", (e) => {
    const btn = e.target.closest(".review_btn");
    if (!btn) return;
    const { orderId, orderNum } = btn.dataset;
    location.href = `write_review.html?orderId=${orderId}&orderNum=${orderNum}`;
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
