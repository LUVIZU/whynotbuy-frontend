// ../js/like_menu.js
// 규칙: 모든 요청은 credentials:'include' (JWT 쿠키)

document.addEventListener("DOMContentLoaded", () => {
  /* ===== 설정 ===== */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;
  const PLACEHOLDER_IMG = "../images/store_placeholder.png";

  /* ===== 엘리먼트 ===== */
  const $list = document.querySelector(".menu_list");
  const $search = document.querySelector(".search_bar input");
  const $sortBtn = document.querySelector(".near_btn"); // 최신순 고정 → 비활성

  /* ===== 상태 ===== */
  const state = {
    cursor: null, // 마지막으로 본 favoriteId
    hasMore: true,
    loading: false,
    raw: [], // 서버 원본(최신순)
    view: [], // 검색 적용 뷰
    likes: new Set(JSON.parse(localStorage.getItem("likes_menu") || "[]")), // menuId 캐시
    inflight: new Set(), // 삭제 연타 방지(menuId)
  };

  // 버튼 비활성(최신순 고정)
  if ($sortBtn) {
    $sortBtn.textContent = "최신순";
    $sortBtn.style.opacity = "0.5";
    $sortBtn.style.pointerEvents = "none";
    $sortBtn.title = "최신순 고정 정렬";
  }

  /* ===== 초기 로드 ===== */
  fetchAndAppend();

  /* ===== 이벤트 ===== */
  let timer;
  $search?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => applyFilter(($search.value || "").trim()), 120);
  });

  window.addEventListener("scroll", () => {
    if (state.loading || !state.hasMore) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchAndAppend();
  });

  /* ===== API ===== */
  function buildListUrl() {
    const q = new URLSearchParams();
    if (state.cursor != null) q.set("cursor", String(state.cursor));
    q.set("size", String(PAGE_SIZE));
    return `${API_BASE}/api/v1/favorites/menus?${q.toString()}`;
  }

  async function fetchAndAppend() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;

    try {
      const res = await fetch(buildListUrl(), {
        method: "GET",
        credentials: "include",
      });
      if (res.status === 401) {
        alert("로그인이 필요합니다. 다시 로그인해주세요.");
        window.location.href = "../pages/login.html";
        return;
      }

      const data = await res.json();
      // Swagger: result.FavoriteMenus / favoriteMenus
      const result = data?.result ?? data;
      const list = result?.favoriteMenus ?? result?.FavoriteMenus ?? [];

      const batch = Array.isArray(list) ? list : [];
      state.raw = state.raw.concat(batch);

      // cursor / hasData 키 호환
      state.cursor =
        result?.nextCursor !== undefined
          ? result.nextCursor
          : getLastFavId(batch);
      state.hasMore =
        typeof result?.hasData === "boolean"
          ? result.hasData
          : batch.length === PAGE_SIZE;

      // 캐시 동기화(이 페이지는 '내가 찜한 메뉴'라 캐시에 추가)
      for (const it of batch) {
        if (it?.menuId != null) state.likes.add(it.menuId);
      }
      persistLikes();

      applyFilter($search?.value || "");
    } catch (e) {
      console.error("내 찜 메뉴 목록 조회 실패:", e);
    } finally {
      state.loading = false;
    }
  }

  function getLastFavId(list) {
    if (!list?.length) return state.cursor ?? null;
    return list[list.length - 1]?.favoriteId ?? state.cursor ?? null;
  }

  async function deleteFavorite(menuId) {
    if (state.inflight.has(menuId)) return;
    state.inflight.add(menuId);

    // 낙관적 제거
    const beforeRaw = state.raw.slice();
    const beforeLikes = new Set(state.likes);
    removeFromState(menuId);
    render(state.view);

    try {
      const url = `${API_BASE}/api/v1/favorites/menus/${menuId}`;
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`unfavorite menu failed: ${res.status}`);

      // (선택) 응답에 favoritedStatus 있으면 검증 가능
      // const data = await res.json().catch(() => null);
    } catch (e) {
      console.error(e);
      // 롤백
      state.raw = beforeRaw;
      state.likes = beforeLikes;
      persistLikes();
      applyFilter($search?.value || "");
      alert("찜 해제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      state.inflight.delete(menuId);
    }
  }

  /* ===== 렌더/필터 ===== */
  function applyFilter(keyword) {
    const kw = (keyword || "").toLowerCase();
    state.view = !kw
      ? state.raw.slice()
      : state.raw.filter((m) =>
          [String(m.menuName || ""), String(m.storeName || "")]
            .join(" ")
            .toLowerCase()
            .includes(kw)
        );
    render(state.view);
  }

  function render(items) {
    if (!$list) return;

    if (!items?.length) {
      $list.innerHTML = `
    <li class="menu_empty_card" aria-live="polite">
      <p class="menu_empty_msg">찜한 메뉴가 없습니다</p>
    </li>`;
      return;
    }

    const frag = document.createDocumentFragment();

    items.forEach((m) => {
      const li = document.createElement("li");
      li.className = "menu_card";

      const menuId = m.menuId;
      const storeId = m.storeId;
      const menuName = m.menuName || "메뉴";
      const storeName = m.storeName || "";
      const price = Number(m.price) || 0;
      const discount = Number(m.discountPercent) || 0;
      const hasDiscount = discount > 0;
      const salePrice =
        "discountPrice" in m
          ? Number(m.discountPrice) || Math.round(price * (1 - discount / 100))
          : Math.round(price * (1 - discount / 100));
      const img = m.menuImage || PLACEHOLDER_IMG;
      const liked = state.likes.has(menuId);

      li.innerHTML = `
        <button class="like_btn" aria-label="찜 해제" data-menu-id="${menuId}">
          <img src="${
            liked ? "../images/like_red.svg" : "../images/like.svg"
          }" alt="찜" />
        </button>
        <a href="order.html?storeId=${encodeURIComponent(
          storeId
        )}&menuId=${encodeURIComponent(menuId)}" class="menu_link">
          <div class="menu_top">
            <div class="menu_left">
              <p class="menu_name">${escapeHtml(menuName)}</p>
              <div class="price_block">
                ${
                  hasDiscount
                    ? `
                      <span class="old_price">${fmt(price)} 원</span>
                      <div class="now_row">
                        <span class="sale_pct">${Math.round(discount)}%</span>
                        <span class="now_price">${fmt(salePrice)} 원</span>
                      </div>
                    `
                    : `
                      <div class="now_row">
                        <span class="now_price">${fmt(price)} 원</span>
                      </div>
                    `
                }
              </div>
            </div>
            <div class="menu_right">
              <img class="menu_thumb"
                   src="${img}"
                   alt="${escapeHtml(menuName)}"
                   onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            </div>
          </div>
          <div class="menu_bottom">
            <div class="store_line">
              <span class="store_name">${escapeHtml(storeName)}</span>
            </div>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    $list.replaceChildren(frag);

    // 하트 클릭 → 찜 해제(DELETE) + 카드 제거
    $list.querySelectorAll(".like_btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.menuId);
        deleteFavorite(id);
      });
    });
  }

  /* ===== 상태 유틸 ===== */
  function removeFromState(menuId) {
    state.raw = state.raw.filter((x) => x.menuId !== menuId);
    state.view = state.view.filter((x) => x.menuId !== menuId);
    if (state.likes.has(menuId)) {
      state.likes.delete(menuId);
      persistLikes();
    }
  }

  function persistLikes() {
    localStorage.setItem("likes_menu", JSON.stringify([...state.likes]));
  }

  /* ===== 포맷/공통 ===== */
  function fmt(n) {
    return Number(n).toLocaleString("ko-KR");
  }
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
