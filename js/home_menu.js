// ../js/home_menu.js
// 규칙: JWT 쿠키 인증(credentials:'include')

document.addEventListener("DOMContentLoaded", () => {
  /* ===== 설정 ===== */
  const API_BASE = "https://api-whynotbuy.store";

  const PAGE_SIZE = 10;

  const $addr = document.querySelector(".loc_text");
  const $list = document.querySelector(".menu_list");
  const $sortBtn = document.querySelector(".near_btn");
  const $search = document.querySelector(".search_bar input");

  /* ===== 상태 ===== */
  const state = {
    sortType: "DISCOUNT", // DISCOUNT | PRICE_ASC | PRICE_DESC
    cursor: null,
    hasMore: true,
    loading: false,
    menus: [],
    likes: new Set(JSON.parse(localStorage.getItem("likes_menu") || "[]")), // menuId set
    searchActive: false,
  };

  /* ===== 초기화 ===== */
  const hadAlias = applySelectedLocationAlias(); // 세션/캐시 우선 반영
  if (!hadAlias && $addr) $addr.textContent = "주소 설정"; // "홍제동" 가리기
  fetchActiveAndApply(); // 서버 활성 위치로 최종 덮어쓰기
  $sortBtn.textContent = sortLabel(state.sortType);
  fetchAndRender();

  /* ===== 이벤트 ===== */
  // 정렬 토글
  $sortBtn?.addEventListener("click", () => {
    state.sortType =
      state.sortType === "DISCOUNT"
        ? "PRICE_ASC"
        : state.sortType === "PRICE_ASC"
        ? "PRICE_DESC"
        : "DISCOUNT";
    $sortBtn.textContent = sortLabel(state.sortType);
    resetAndReload();
  });

  // 검색(클라이언트 필터)
  $search?.addEventListener("input", () => {
    renderList(filterMenus($search.value));
  });

  // 무한 스크롤
  window.addEventListener("scroll", () => {
    if (state.loading || !state.hasMore) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchAndRender();
  });

  /* ===== 함수들 ===== */
  function sortLabel(t) {
    return t === "DISCOUNT"
      ? "할인순"
      : t === "PRICE_ASC"
      ? "가격 ⬇️"
      : "가격 ⬆️";
  }

  function applySelectedLocationAlias() {
    try {
      // 1) 세션(주소 선택 페이지에서 저장)
      const raw = sessionStorage.getItem("selected_location");
      if (raw) {
        const sel = JSON.parse(raw);
        if (sel?.name && $addr) {
          $addr.textContent = sel.name;
          return true;
        }
      }
      // 2) 로컬 캐시(이전에 활성 위치 불러온 적 있으면)
      const cached = localStorage.getItem("selected_address_label");
      if (cached && $addr) {
        $addr.textContent = cached;
        return true;
      }
    } catch {}
    return false;
  }

  function buildUrl() {
    const q = new URLSearchParams();
    if (state.cursor != null) q.set("cursor", String(state.cursor));
    q.set("size", String(PAGE_SIZE));
    q.set("menuSortType", state.sortType); // DISCOUNT | PRICE_ASC | PRICE_DESC
    return `${API_BASE}/api/v1/menus?${q.toString()}`;
  }

  async function fetchAndRender() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;

    try {
      const res = await fetch(buildUrl(), {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();

      // 스웨거 예시: { isSuccess, result:{ menus:[], hasData:true, nextCursor:0 } }
      const payload = data?.result?.menus ? data.result : data;
      const batch = Array.isArray(payload?.menus) ? payload.menus : [];

      state.menus = state.menus.concat(batch);
      state.cursor =
        payload?.nextCursor !== undefined
          ? payload.nextCursor
          : getLastMenuId(batch);
      state.hasMore =
        typeof payload?.hasData === "boolean"
          ? payload.hasData
          : batch.length === PAGE_SIZE;

      renderList(filterMenus($search?.value || ""));
    } catch (e) {
      console.error("메뉴 목록 조회 실패:", e);
    } finally {
      state.loading = false;
    }
  }

  function getLastMenuId(list) {
    if (!list?.length) return state.cursor ?? null;
    const last = list[list.length - 1];
    return last?.menuId ?? state.cursor ?? null;
  }

  function resetAndReload() {
    state.cursor = null;
    state.hasMore = true;
    state.menus = [];
    $list.innerHTML = "";
    fetchAndRender();
  }

  function filterMenus(keyword) {
    const kw = (keyword || "").trim().toLowerCase();
    if (!kw) return state.menus;
    return state.menus.filter((m) =>
      String(m.name || "")
        .toLowerCase()
        .includes(kw)
    );
  }

  function renderList(menus) {
    if (!$list) return;

    if (!menus?.length) {
      $list.innerHTML = `
    <li class="menu_card empty_card" aria-live="polite">
      <div class="menu_link" style="display:flex;justify-content:center;padding:10px 0">
        <strong class="name empty_msg">표시할 메뉴가 없습니다</strong>
      </div>
    </li>`;
      return;
    }

    const frag = document.createDocumentFragment();
    menus.forEach((m) => {
      const li = document.createElement("li");
      li.className = "menu_card";

      const liked = state.likes.has(m.menuId);

      // 가격/할인 계산
      const price = Number(m.price) || 0;
      const discount = Number(m.discountPercent) || 0;
      const hasDiscount = discount > 0;
      const salePrice = hasDiscount
        ? Math.round(price * (1 - discount / 100))
        : price;

      li.innerHTML = `
        <button class="like_btn" aria-label="찜" data-menu-id="${m.menuId}">
          <img src="${
            liked ? "../images/heart_red.svg" : "../images/like.svg"
          }" alt="찜" />
        </button>
        <a href="order.html?menuId=${encodeURIComponent(
          m.menuId
        )}" class="menu_link">
          <div class="menu_top">
            <div class="menu_left">
              <p class="menu_name">${escapeHtml(m.name || "메뉴")}</p>

              <div class="price_block">
                ${
                  hasDiscount
                    ? `<span class="old_price">${formatWon(price)} 원</span>
                       <div class="now_row">
                         <span class="sale_pct">${Math.round(discount)}%</span>
                         <span class="now_price">${formatWon(
                           salePrice
                         )} 원</span>
                       </div>`
                    : `<div class="now_row">
                         <span class="now_price">${formatWon(price)} 원</span>
                       </div>`
                }
              </div>
            </div>

            <div class="menu_right">
              <img class="menu_thumb"
                   src="${m.menuImage || "../images/sample_mango.jpg"}"
                   alt="${escapeHtml(m.name || "메뉴")}">
            </div>
          </div>

          <!-- 스펙상 storeName/distance 없음 → 하단 라인은 숨김 -->
        </a>
      `;

      frag.appendChild(li);
    });

    $list.replaceChildren(frag);

    // 찜 토글
    $list.querySelectorAll(".like_btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.menuId);
        toggleLike(id, btn);
      });
    });
  }

  function toggleLike(menuId, btnEl) {
    if (state.likes.has(menuId)) state.likes.delete(menuId);
    else state.likes.add(menuId);
    localStorage.setItem(
      "likes_menu",
      JSON.stringify(Array.from(state.likes.values()))
    );
    const img = btnEl.querySelector("img");
    if (img) {
      img.src = state.likes.has(menuId)
        ? "../images/heart_red.svg"
        : "../images/like.svg";
    }
  }

  function formatWon(n) {
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
  async function fetchActiveAndApply() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/locations/active`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return;

      const data = await res.json();
      const loc = data?.result ?? data; // {isSuccess,result:{...}} or {...}
      const alias = loc?.locationName;

      if (alias && $addr) {
        $addr.textContent = alias; // 화면 반영
        localStorage.setItem("selected_address_label", alias); // 캐시
        // 다음 방문 빠른 표시용(선택)
        if (isFinite(loc.latitude) && isFinite(loc.longitude)) {
          sessionStorage.setItem(
            "selected_location",
            JSON.stringify({
              id: loc.locationId,
              name: alias,
              lat: Number(loc.latitude),
              lng: Number(loc.longitude),
            })
          );
        }
      }
    } catch (e) {
      console.warn("활성 위치 불러오기 실패:", e);
    }
  }
});
