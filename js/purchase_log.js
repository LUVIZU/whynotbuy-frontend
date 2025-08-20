// ../js/purchase_log.js
document.addEventListener("DOMContentLoaded", () => {
  /* ========== 상수 ========== */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 33; // 주문 목록 페이지 크기
  const REVIEW_OFFSET = 50; // 내 리뷰 조회(offset=한 번에 몇 개)

  /* ========== 엘리먼트 ========== */
  const $list = document.getElementById("purchase_list");
  const $empty = document.getElementById("empty_state");
  const $loading = document.getElementById("loading");

  /* ========== 상태 ========== */
  const state = { cursor: null, hasMore: true, loading: false };

  // 낙관적 표시: 방금 작성한 리뷰의 orderId 문자열 보관
  const reviewedLocal = new Set(
    JSON.parse(sessionStorage.getItem("reviewed_order_ids") || "[]").map(String)
  );
  // 방금 작성한 리뷰 내용(로컬 캐시): { [orderId]: { content, dateISO } }
  const reviewedLocalMap = JSON.parse(
    sessionStorage.getItem("my_reviews_local") || "{}"
  );

  // 내 리뷰 캐시: orderId -> { reviewId, reviewContent, reviewDate }
  const myReviewMap = new Map();
  // 내 리뷰 페이징 커서(별도 관리)
  let myReviewCursor = null;
  let myReviewHasNext = true;

  /* ========== 유틸 ========== */
  const fmtPrice = (n) => (n ?? 0).toLocaleString("ko-KR") + " 원";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      const kst = new Date(d.getTime() + 9 * 3600 * 1000);
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
  const truthy = (v) =>
    v === true ||
    v === 1 ||
    v === "1" ||
    v === "true" ||
    v === "Y" ||
    v === "y";

  /* ========== 내 리뷰 조회(스웨거: GET /api/v1/reviews/users) ========== */
  // orderIds 중 캐시에 없는 것들을 커버할 때까지 내 리뷰 페이지를 따라가며 읽어옴.
  async function fetchMyReviewsFor(orderIds) {
    const need = new Set(
      orderIds
        .map(String)
        .filter((id) => !myReviewMap.has(Number(id)) && !myReviewMap.has(id))
    );
    if (need.size === 0) return;

    // 너무 깊게 돌지 않도록 가드
    let guard = 0;
    while (need.size > 0 && myReviewHasNext && guard++ < 50) {
      const q = new URLSearchParams();
      if (myReviewCursor != null) q.set("cursor", String(myReviewCursor));
      q.set("offset", String(REVIEW_OFFSET));
      // 캐시 버스터
      q.set("ts", String(Date.now()));

      const res = await fetch(`${API_BASE}/api/v1/reviews/users?${q}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) break;

      const data = await res.json().catch(() => null);
      if (!data?.isSuccess) break;

      const reviews = data.result?.reviews ?? [];
      myReviewHasNext = !!data.result?.hasNext;
      myReviewCursor = data.result?.cursor ?? null;

      // 캐시에 저장
      for (const r of reviews) {
        const orderId = r?.orders?.orderId;
        if (orderId == null) continue;
        myReviewMap.set(Number(orderId), {
          reviewId: r.reviewId,
          reviewContent: r.reviewContent ?? "",
          reviewDate: r.reviewDate ?? "",
        });
        // 충족되면 need에서 제거
        need.delete(String(orderId));
      }

      // 더 이상 필요 없으면 종료
      if (need.size === 0) break;
      // 더 가져올 게 없으면 종료
      if (!myReviewHasNext) break;
    }
  }

  /* ========== BFCache/뒤로가기 새로고침 대응 ========== */
  function resetAndFetch() {
    state.cursor = null;
    state.hasMore = true;
    state.loading = false;
    $list.innerHTML = "";
    $empty.hidden = true;
    fetchOrders();
  }
  window.addEventListener("pageshow", (e) => {
    if (
      e.persisted ||
      performance.getEntriesByType("navigation")[0]?.type === "back_forward"
    ) {
      resetAndFetch();
    }
  });
  if (new URLSearchParams(location.search).get("updated") === "1") {
    resetAndFetch();
  }

  /* ========== 주문 목록 조회 ========== */
  async function fetchOrders() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;
    setLoading(true);

    const q = new URLSearchParams();
    if (state.cursor) q.set("cursor", state.cursor);
    q.set("size", PAGE_SIZE);

    try {
      const res = await fetch(`${API_BASE}/api/v1/orders?${q}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (res.status === 401 || res.status === 403) {
        alert("로그인이 필요합니다.");
        location.href = "../pages/login.html";
        return;
      }

      const data = await res.json();
      if (!data?.isSuccess) throw new Error(data?.message || "주문 조회 실패");

      const list = data.result?.orderList ?? [];

      // 1) 먼저 화면에 붙인다(사용자 체감속도 ↑)
      renderAppend(list);

      // 2) 방금 받은 주문들의 orderId에 대응하는 "내 리뷰"를 서버에서 끌어온다
      const orderIds = list.map((o) => o.orderId).filter((v) => v != null);
      await fetchMyReviewsFor(orderIds);

      // 3) DOM에 내 리뷰 반영(CTA → 내 리뷰 블록 교체)
      applyMyReviewsToDom(orderIds);

      // 페이징 진행
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

  /* ========== 화면에 추가 렌더 ========== */
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

      // 기본값: 서버 플래그 + 낙관적(로컬) 체크
      const optimistic = reviewedLocal.has(String(orderId));
      const serverFlag =
        truthy(o?.hasReview) ||
        truthy(o?.reviewExists) ||
        truthy(o?.reviewed) ||
        truthy(o?.isReviewed) ||
        ["DONE", "WRITTEN", "EXISTS", "Y", "YES"].includes(
          String(o?.reviewStatus || "").toUpperCase()
        ) ||
        !!o?.reviewId ||
        (typeof o?.reviewCount === "number" && o.reviewCount > 0);

      // 내 리뷰 캐시(아직 없을 수 있음)
      const mine = myReviewMap.get(orderId);

      // 로컬(방금 작성) 내용 우선
      const local = reviewedLocalMap[String(orderId)];
      const myReviewText =
        (local && local.content) || (mine && mine.reviewContent) || "";

      const hasReview = optimistic || serverFlag || !!mine || !!local;

      const li = document.createElement("li");
      li.className = "order_card";
      li.dataset.orderId = String(orderId || "");
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

  /* ========== DOM에 내 리뷰 반영(CTA → 내 리뷰) ========== */
  function applyMyReviewsToDom(orderIds) {
    for (const id of orderIds) {
      const li = $list.querySelector(`li.order_card[data-order-id="${id}"]`);
      if (!li) continue;

      // 이미 내 리뷰 블록이면 스킵
      if (li.querySelector(".order_footer--mine")) continue;

      const mine = myReviewMap.get(id);
      const optimistic = reviewedLocal.has(String(id));
      const local = reviewedLocalMap[String(id)];
      if (!mine && !optimistic && !local) continue;

      // CTA 푸터를 내 리뷰 푸터로 교체
      const cta = li.querySelector(".order_footer--cta");
      if (!cta) continue;

      const html = `
        <footer class="order_footer order_footer--mine">
          <div class="my_review_title">내 리뷰</div>
          <p class="my_review_txt">${xss(
            (local && local.content) ||
              (mine && mine.reviewContent) ||
              "작성한 리뷰를 불러왔어요."
          )}</p>
        </footer>
      `;
      cta.insertAdjacentHTML("afterend", html);
      cta.remove();
    }
  }

  /* ========== 이벤트 ========== */
  $list.addEventListener("click", (e) => {
    const storeEl = e.target.closest(".store_name");
    if (storeEl) {
      const storeId = storeEl.dataset.storeId;
      const storeName = storeEl.textContent.trim();
      if (storeId) {
        location.href = `../pages/store_home.html?storeId=${encodeURIComponent(
          storeId
        )}`;
      } else {
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
      items: JSON.parse(btn.dataset.items || "[]"),
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

  // 무한 스크롤
  window.addEventListener("scroll", () => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchOrders();
  });

  /* ========== 시작 ========== */
  fetchOrders();
});
