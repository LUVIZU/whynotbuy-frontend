// ../js/home_menu.js
// 규칙: 모든 요청은 credentials:'include' (JWT 쿠키)
// 스웨거 기준(/api/v1/menus): menuId, name, price, discountPercent, menuImage, favorited, storeId, storeName

document.addEventListener("DOMContentLoaded", () => {
  /* ===== 설정 ===== */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;
  const STORE_PAGE = "store_home.html"; // 필요 시 파일명 변경

  const $addr = document.querySelector(".loc_text");
  const $list = document.querySelector(".menu_list");
  const $sortBtn = document.querySelector(".near_btn");
  const $search = document.querySelector(".search_bar input");

  const PLACEHOLDER_IMG = "../images/store_placeholder.png";

  /* ===== 상태 ===== */
  const state = {
    sortType: "DISCOUNT", // DISCOUNT | PRICE_ASC | PRICE_DESC
    cursor: null, // 스웨거의 nextCursor를 그대로 전달
    hasMore: true,
    loading: false,
    menus: [],
    likes: new Set(JSON.parse(localStorage.getItem("likes_menu") || "[]")), // menuId set
  };

  /* ===== 찜(메뉴) 엔드포인트 ===== */
  // POST   /api/v1/menus/{menuId}/favorite     -> 추가
  // DELETE /api/v1/favorites/menus/{menuId}    -> 삭제
  const like_api = {
    like: (id) => `${API_BASE}/api/v1/menus/${id}/favorite`,
    unlike: (id) => `${API_BASE}/api/v1/favorites/menus/${id}`,
  };
  const like_inflight = new Set(); // 클릭 연타 방지

  /* ===== 초기화 ===== */
  const had_alias = applySelectedLocationAlias(); // 세션/캐시 우선 반영
  if (!had_alias && $addr) $addr.textContent = "주소 설정";
  fetchActiveAndApply(); // 서버 활성 위치로 최종 덮어쓰기

  if ($sortBtn) $sortBtn.textContent = sortLabel(state.sortType);
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
    const doc = document.documentElement;
    const nearBottom =
      window.innerHeight + window.scrollY >= doc.scrollHeight - 200;
    if (nearBottom) fetchAndRender();
  });

  /* ===== 유틸 ===== */
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

  function formatWon(n) {
    return Number(n || 0).toLocaleString("ko-KR");
  }
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // 스웨거 우선 키 매핑
  function getStoreId(m) {
    const cand = [m?.storeId, m?.store_id, m?.store?.id, m?.store?.storeId];
    for (const v of cand) if (v !== undefined && v !== null) return v;
    return null;
  }
  function getStoreName(m) {
    return m?.storeName ?? m?.store?.name ?? "";
  }
  function getImageUrl(m) {
    return (
      m?.menuImage ||
      m?.imageUrl ||
      m?.storeImageUrl ||
      m?.store?.imageUrl ||
      PLACEHOLDER_IMG
    );
  }

  function resetAndReload() {
    state.cursor = null;
    state.hasMore = true;
    state.menus = [];
    $list && ($list.innerHTML = "");
    fetchAndRender();
  }

  function filterMenus(keyword) {
    const kw = (keyword || "").trim().toLowerCase();
    if (!kw) return state.menus;
    return state.menus.filter((m) =>
      String(m.name || m.menuName || "")
        .toLowerCase()
        .includes(kw)
    );
  }

  /* ===== 데이터 ===== */
  async function fetchAndRender() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;

    try {
      const res = await fetch(buildUrl(), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`menus ${res.status}`);
      const json = await res.json();

      // 스웨거 구조: { isSuccess, result:{ menus:[], hasData:true, nextCursor:0 } }
      const result = json?.result ?? json;
      const batch = Array.isArray(result?.menus) ? result.menus : [];

      // 서버 favorited 반영 → 초깃값부터 하트 일치
      batch.forEach((m) => {
        const id = m.menuId ?? m.id;
        if (m.favorited && id != null) state.likes.add(id);
      });

      state.menus = state.menus.concat(batch);
      state.cursor = result?.nextCursor ?? state.cursor;
      state.hasMore =
        typeof result?.hasData === "boolean"
          ? result.hasData
          : batch.length === PAGE_SIZE;

      renderList(filterMenus($search?.value || ""));

      // 반영된 likes 저장
      localStorage.setItem(
        "likes_menu",
        JSON.stringify(Array.from(state.likes.values()))
      );
    } catch (e) {
      console.error("메뉴 목록 조회 실패:", e);
    } finally {
      state.loading = false;
    }
  }

  /* ===== 렌더 ===== */
  function renderList(menus) {
    if (!$list) return;

    if (!menus?.length) {
      $list.innerHTML = `
        <li class="menu_empty_card" aria-live="polite">
          <p class="menu_empty_msg">표시할 메뉴가 없습니다</p>
        </li>`;
      return;
    }

    const frag = document.createDocumentFragment();

    menus.forEach((m) => {
      const li = document.createElement("li");
      li.className = "menu_card";

      const menuId = m.menuId ?? m.id;
      const menuName = m.name ?? m.menuName ?? "메뉴";

      const price = Number(m.price ?? m.originalPrice) || 0;
      const discountPct = Number(m.discountPercent ?? m.discount_rate) || 0;
      const hasDiscount = discountPct > 0;
      const salePrice = hasDiscount
        ? Math.max(0, Math.round(price * (1 - discountPct / 100)))
        : price;

      const storeId = getStoreId(m);
      const storeName = getStoreName(m);

      // 상세 페이지 링크(스토어가 있으면 같이 전달)
      const href = storeId
        ? `${STORE_PAGE}?storeId=${encodeURIComponent(
            storeId
          )}&menuId=${encodeURIComponent(menuId)}`
        : `${STORE_PAGE}?menuId=${encodeURIComponent(menuId)}`;

      const liked = state.likes.has(menuId);

      li.innerHTML = `
        <button class="like_btn" aria-label="찜" data-menu-id="${menuId}">
          <img src="${
            liked ? "../images/like_red.svg" : "../images/like.svg"
          }" alt="찜" />
        </button>
        <a href="${href}" class="menu_link" data-store-id="${storeId ?? ""}">
          <div class="menu_top">
            <div class="menu_left">
              <p class="menu_name">${escapeHtml(menuName)}</p>
              <div class="price_block">
                ${
                  hasDiscount
                    ? `<span class="old_price">${formatWon(price)} 원</span>
                       <div class="now_row">
                         <span class="sale_pct">${Math.round(
                           discountPct
                         )}%</span>
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
                   src="${getImageUrl(m)}"
                   alt="${escapeHtml(menuName)}"
                   onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
            </div>
          </div>
          <div class="menu_bottom">
            <div class="store_line">
              <span class="store_name">${escapeHtml(
                storeName || "가게명 없음"
              )}</span>
            </div>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    $list.replaceChildren(frag);

    // 찜 토글 바인딩
    $list.querySelectorAll(".like_btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.menuId);
        toggleLike(id, btn);
      });
    });
  }

  /* ===== 찜 토글(서버 동기화 + 낙관적 UI) ===== */
  async function toggleLike(menuId, btnEl) {
    if (like_inflight.has(menuId)) return; // 연타 방지
    like_inflight.add(menuId);

    const wasLiked = state.likes.has(menuId);
    const nowLiked = !wasLiked;

    // 1) 낙관적 업데이트 (UI + 메모리 + 로컬)
    applyLikeUI(btnEl, nowLiked);
    if (nowLiked) state.likes.add(menuId);
    else state.likes.delete(menuId);
    persistLikes();

    try {
      const url = nowLiked ? like_api.like(menuId) : like_api.unlike(menuId);
      const method = nowLiked ? "POST" : "DELETE";

      const res = await fetch(url, { method, credentials: "include" });
      if (res.status === 401) {
        rollback();
        alert("로그인이 필요합니다. 다시 로그인해주세요.");
        window.location.href = "../pages/login.html";
        return;
      }
      if (!res.ok)
        throw new Error(`menu like api ${method} failed: ${res.status}`);

      // 응답에 favoritedStatus 같은 값이 오면 동기화
      const data = await res.json().catch(() => null);
      const status =
        data?.result?.favoritedStatus ?? data?.favoritedStatus ?? nowLiked;

      if (status !== nowLiked) {
        applyLikeUI(btnEl, status);
        if (status) state.likes.add(menuId);
        else state.likes.delete(menuId);
        persistLikes();
      }
    } catch (e) {
      console.error(e);
      rollback();
      alert("찜 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      like_inflight.delete(menuId);
    }

    function rollback() {
      applyLikeUI(btnEl, wasLiked);
      if (wasLiked) state.likes.add(menuId);
      else state.likes.delete(menuId);
      persistLikes();
    }
  }

  function applyLikeUI(btnEl, liked) {
    const img = btnEl?.querySelector("img");
    if (img) img.src = liked ? "../images/like_red.svg" : "../images/like.svg";
  }

  function persistLikes() {
    localStorage.setItem(
      "likes_menu",
      JSON.stringify(Array.from(state.likes.values()))
    );
  }

  /* ===== 활성 위치 표시 ===== */
  // 별칭(label) 우선, 없으면 도로명(roadAddressName) → 마지막에만 locationName 등 fallback
  async function fetchActiveAndApply() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/locations/active`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return;

      const data = await res.json();
      const loc = data?.result ?? data; // {isSuccess,result:{...}} or {...}

      // 백엔드 필드 호환: locationAlias | alias | nickname | locationName
      const alias =
        loc?.locationAlias ||
        loc?.alias ||
        loc?.nickname ||
        loc?.locationName ||
        null;

      const road = loc?.roadAddressName || null;

      // ✅ 별칭 우선 표시
      const label = alias || road || loc?.locationName || null;

      if (label && $addr) {
        $addr.textContent = label;
        localStorage.setItem("selected_address_label", label);

        if (isFinite(Number(loc.latitude)) && isFinite(Number(loc.longitude))) {
          sessionStorage.setItem(
            "selected_location",
            JSON.stringify({
              id: loc.locationId,
              name: label,
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
