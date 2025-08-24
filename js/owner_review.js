// owner_review.js
(() => {
  // ========================
  // 설정 / 상태
  // ========================
  const API_BASE = "https://api-whynotbuy.store";
  const listEl = document.querySelector(".review-list");
  const tmpl = document.getElementById("review-card-template");
  const backBtn = document.querySelector(".top_bar__back");

  // 요약 영역
  const summaryEl = document.querySelector(".summary-text");

  // URL 쿼리 파싱
  const params = new URLSearchParams(location.search);
  let targetType = (params.get("targetType") || "STORE").toUpperCase();
  let targetId = Number(params.get("targetId") || "1");
  let pageSize = Number(params.get("offset") || "10");

  // 커서 페이징 상태
  let cursor = params.get("cursor") ? Number(params.get("cursor")) : null;
  let hasNext = true;
  let isLoading = false;

  // sentinel (무한스크롤 감시용)
  const sentinel = document.createElement("div");
  sentinel.setAttribute("data-sentinel", "true");
  sentinel.style.height = "1px";
  sentinel.style.marginTop = "8px";
  listEl.appendChild(sentinel);

  // ========================
  // 이벤트
  // ========================
  if (backBtn) {
    backBtn.addEventListener("click", () => history.back());
  }

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
  async function fetchReviews({ targetType, targetId, cursor, offset }) {
    const usp = new URLSearchParams({
      targetType,
      targetId: String(targetId),
      offset: String(offset),
    });
    if (typeof cursor === "number" && !Number.isNaN(cursor)) {
      usp.set("cursor", String(cursor));
    }

    const url = `${API_BASE}/api/v1/reviews?${usp.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "*/*" },
    });

    if (!res.ok) throw new Error(`리뷰 불러오기 실패 (${res.status})`);

    const data = await res.json();
    if (!data?.isSuccess) {
      throw new Error(data?.message || "리뷰 불러오기 실패");
    }
    return data.result ?? { reviews: [], hasNext: false, cursor: null };
  }

  async function fetchReviewSummary(storeId) {
    const url = `${API_BASE}/api/v1/reviews/${storeId}/summary`;
    const res = await fetch(url, { headers: { Accept: "*/*" } });
    if (!res.ok) throw new Error(`요약 불러오기 실패 (${res.status})`);

    const data = await res.json();
    if (!data?.isSuccess) {
      throw new Error(data?.message || "요약 불러오기 실패");
    }
    return data.result?.summary ?? "요약 없음";
  }

  // ========================
  // 렌더링
  // ========================
  function renderReviews(reviews) {
    for (const r of reviews) {
      const node = tmpl.content.cloneNode(true);
      const dateEl = node.querySelector(".review-date");
      const textEl = node.querySelector(".review-text");
      const itemsEl = node.querySelector(".review-items");

      dateEl.textContent = formatKoreanDate(r.reviewDate);
      textEl.textContent = r.reviewContent ?? "";

      const menus = r.orders?.menus ?? [];
      if (menus.length > 0) {
        itemsEl.innerHTML = menus
          .map((m) => `${m.name ?? "-"} ${Number(m.quantity ?? 0)}개`)
          .join("<br/>");
      } else {
        itemsEl.textContent = "-";
      }
      listEl.insertBefore(node, sentinel);
    }
  }

  function renderSummary(text) {
    if (!summaryEl) return;
    summaryEl.textContent = text;
  }

  // ========================
  // 유틸
  // ========================
  function formatKoreanDate(isoString) {
    const d = new Date(isoString);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    const opts = { timeZone: "Asia/Seoul" };
    const m = new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      ...opts,
    }).format(d);
    const day = new Intl.DateTimeFormat("ko-KR", {
      day: "numeric",
      ...opts,
    }).format(d);
    return `${m}월 ${day}일 (${weekday})`;
  }

  function lastEpochMsFrom(reviews) {
    if (!reviews?.length) return null;
    const last = reviews[reviews.length - 1];
    const t = Date.parse(last.reviewDate);
    return Number.isFinite(t) ? t : null;
  }

  function wipeStaticCards() {
    const children = Array.from(listEl.children);
    for (const c of children) {
      if (c.matches('[data-sentinel="true"]') || c.tagName === "TEMPLATE")
        continue;
      listEl.removeChild(c);
    }
  }

  function showError(msg) {
    const card = document.createElement("div");
    card.className = "review-card";
    card.style.border = "1px solid #f00";
    card.style.background = "#fff5f5";
    card.innerHTML = `
      <div class="review-date">오류</div>
      <div class="review-text">${msg}</div>
      <div class="review-items">다시 시도해 주세요.</div>
    `;
    listEl.insertBefore(card, sentinel);
  }

  // ========================
  // 데이터 로드
  // ========================
  async function initialLoad() {
    wipeStaticCards();

    // 리뷰 요약 먼저 불러오기
    try {
      const summary = await fetchReviewSummary(targetId);
      renderSummary(summary);
    } catch (err) {
      console.error(err);
      renderSummary("요약 불러오기 실패");
    }

    // 리뷰 목록 불러오기
    try {
      isLoading = true;
      const {
        reviews,
        hasNext: next,
        cursor: nextCursor,
      } = await fetchReviews({
        targetType,
        targetId,
        cursor,
        offset: pageSize,
      });

      renderReviews(reviews);
      cursor =
        typeof nextCursor === "number" ? nextCursor : lastEpochMsFrom(reviews);
      hasNext = Boolean(next);
    } catch (err) {
      console.error(err);
      showError(err.message || "리뷰 불러오기 실패");
      hasNext = false;
    } finally {
      isLoading = false;
    }
  }

  async function loadMore() {
    try {
      isLoading = true;
      const {
        reviews,
        hasNext: next,
        cursor: nextCursor,
      } = await fetchReviews({
        targetType,
        targetId,
        cursor,
        offset: pageSize,
      });

      renderReviews(reviews);
      cursor =
        typeof nextCursor === "number" ? nextCursor : lastEpochMsFrom(reviews);
      hasNext = Boolean(next);
      if (!hasNext) io.unobserve(sentinel);
    } catch (err) {
      console.error(err);
      showError(err.message || "추가 불러오기 실패");
      hasNext = false;
      io.unobserve(sentinel);
    } finally {
      isLoading = false;
    }
  }

  // 시작
  initialLoad();
})();
