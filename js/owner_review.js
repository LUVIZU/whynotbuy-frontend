document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const reviewListEl = document.querySelector(".review-list");
  const reviewTemplate = document.getElementById("review-card-template");
  const summaryEl = document.querySelector(".summary-text");

  let cursor = null;
  let hasNext = true;
  let isLoading = false;

  // ✅ JWT 토큰 가져오기
  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }
  const token = getCookie("accessToken");

  // ✅ storeId 가져오기
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  if (!storeId) {
    alert("storeId가 없습니다.");
    return;
  }

  // ✅ 리뷰 카드 렌더링
  function renderReviewCard(review) {
    const node = reviewTemplate.content.cloneNode(true);
    const card = node.querySelector(".review-card");

    // 날짜 포맷 (2025-08-24 → "8월 24일 (일)")
    const date = new Date(review.reviewDate);
    const options = { month: "numeric", day: "numeric", weekday: "short" };
    const formatted = date.toLocaleDateString("ko-KR", options);

    card.querySelector(".review-date").textContent = formatted;
    card.querySelector(".review-text").textContent =
      review.reviewContent || "리뷰 내용 없음";

    // 주문 메뉴 목록
    const itemsEl = card.querySelector(".review-items");
    if (review.orders?.menus?.length) {
      itemsEl.innerHTML = review.orders.menus
        .map((m) => `${m.name} ${m.quantity}개`)
        .join("<br/>");
    } else {
      itemsEl.textContent = "주문 내역 없음";
    }

    reviewListEl.appendChild(node);
  }

  // ✅ 리뷰 불러오기 (커서 기반 페이징)
  async function loadReviews() {
    if (!hasNext || isLoading) return;
    isLoading = true;

    try {
      let url = `${API_BASE}/api/v1/reviews?targetType=STORE&targetId=${storeId}&offset=10`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const { reviews, hasNext: next, cursor: nextCursor } = data.result;

        if (reviews.length === 0 && !cursor) {
          reviewListEl.innerHTML = "<p>아직 리뷰가 없습니다.</p>";
        } else {
          reviews.forEach(renderReviewCard);
        }

        hasNext = next;
        cursor = nextCursor;
      } else {
        alert("❌ 리뷰 불러오기 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("리뷰 불러오기 오류", err);
      alert("서버 오류로 리뷰를 불러올 수 없습니다.");
    } finally {
      isLoading = false;
    }
  }

  // ✅ 리뷰 요약 불러오기
  async function loadReviewSummary() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/${storeId}/summary`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        summaryEl.textContent = data.result.summary || "요약이 없습니다.";
      } else {
        summaryEl.textContent = "요약을 불러오지 못했습니다.";
      }
    } catch (err) {
      console.error("리뷰 요약 불러오기 오류", err);
      summaryEl.textContent = "서버 오류로 요약을 불러올 수 없습니다.";
    }
  }

  // ✅ 무한 스크롤
  window.addEventListener("scroll", () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
      !isLoading
    ) {
      loadReviews();
    }
  });

  // ✅ 초기 실행
  loadReviewSummary();
  loadReviews();
});
