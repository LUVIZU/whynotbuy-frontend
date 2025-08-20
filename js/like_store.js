// ../js/like_store.js
// 규칙: JWT는 쿠키에 저장되어 있고, 모든 요청은 credentials: 'include'

document.addEventListener("DOMContentLoaded", () => {
  /* ===== 설정 ===== */
  const API_BASE = "https://api-whynotbuy.store";
  const PAGE_SIZE = 10;
  const PLACEHOLDER_IMG = "../images/store_placeholder.png";

  /* ===== 엘리먼트 ===== */
  const $list = document.querySelector(".store_list");
  const $search = document.querySelector(".search_bar input");
  const $sortBtn = document.querySelector(".near_btn"); // 즐겨찾기 API는 최신순 고정이므로 비활성화 표시만

  /* ===== 상태 ===== */
  const state = {
    cursor: null, // 마지막으로 본 favoriteId
    hasMore: true, // 다음 페이지 여부
    loading: false,
    raw: [], // 서버에서 받은 원본(최신순)
    view: [], // 검색 필터 적용된 뷰
    likes: new Set(JSON.parse(localStorage.getItem("likes_store") || "[]")), // storeId 캐시
    inflight: new Set(), // 삭제 연타 방지 (storeId)
  };

  // 버튼 라벨/상태(즐겨찾기 목록은 서버가 최신순으로 내려줌)
  if ($sortBtn) {
    $sortBtn.textContent = "최신순";
    $sortBtn.style.opacity = "0.5";
    $sortBtn.style.pointerEvents = "none";
    $sortBtn.title = "최신순 고정 정렬";
  }

  /* ===== 초기 로드 ===== */
  fetchAndAppend();

  /* ===== 이벤트 ===== */
  // 검색 (클라이언트 필터)
  let timer;
  $search?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      applyFilter(($search.value || "").trim());
    }, 120);
  });

  // 무한 스크롤
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
    return `${API_BASE}/api/v1/favorites/stores?${q.toString()}`;
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

      // 스웨거 예시: { isSuccess, result:{ favoriteStores:[], nextCursor, hasData } }
      const payload = data?.result ?? data;
      const batch = Array.isArray(
        payload?.favoriteStores || payload?.FavoriteStores
      )
        ? payload.favoriteStores || payload.FavoriteStores
        : [];

      state.raw = state.raw.concat(batch);
      state.cursor =
        payload?.nextCursor !== undefined
          ? payload.nextCursor
          : getLastFavId(batch);
      state.hasMore =
        typeof payload?.hasData === "boolean"
          ? payload.hasData
          : batch.length === PAGE_SIZE;

      // 첫 로드 시 캐시 동기화(없던 storeId면 추가)
      // 이 페이지는 "내가 찜한 것"만 보이므로, 캐시에 없으면 추가해 둔다.
      for (const it of batch) {
        if (it?.storeId != null) state.likes.add(it.storeId);
      }
      persistLikes();

      applyFilter($search?.value || "");
    } catch (e) {
      console.error("내 찜 가게 목록 조회 실패:", e);
    } finally {
      state.loading = false;
    }
  }

  function getLastFavId(list) {
    if (!list?.length) return state.cursor ?? null;
    const last = list[list.length - 1];
    return last?.favoriteId ?? state.cursor ?? null;
  }

  async function deleteFavorite(storeId, btnEl) {
    if (state.inflight.has(storeId)) return;
    state.inflight.add(storeId);

    // 낙관적 제거: UI/상태에서 먼저 빼기
    const beforeRaw = state.raw.slice();
    const beforeLikes = new Set(state.likes);
    removeFromState(storeId);
    render(state.view);

    try {
      const url = `${API_BASE}/api/v1/favorites/stores/${storeId}`;
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error(`unfavorite failed: ${res.status}`);

      // (선택) 서버 응답에 favoritedStatus가 오면 불일치 시 되돌릴 수 있음
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
      state.inflight.delete(storeId);
    }
  }

  /* ===== 렌더/필터 ===== */

  function applyFilter(keyword) {
    const kw = (keyword || "").toLowerCase();
    if (!kw) {
      state.view = state.raw.slice();
    } else {
      state.view = state.raw.filter((s) =>
        String(s.storeName || "")
          .toLowerCase()
          .includes(kw)
      );
    }
    render(state.view);
  }

  function render(items) {
    if (!$list) return;

    if (!items?.length) {
      $list.innerHTML = `
        <li class="store_card empty_card" aria-live="polite">
          <div class="meta" style="justify-content:center; padding:25px 0">
            <strong class="name empty_msg">찜한 가게가 없습니다</strong>
          </div>
        </li>`;
      return;
    }

    const frag = document.createDocumentFragment();

    items.forEach((s) => {
      const li = document.createElement("li");
      li.className = "store_card";

      const storeId = s.storeId;
      const name = s.storeName || "가게";
      const img = s.storeImage || PLACEHOLDER_IMG;

      li.innerHTML = `
        <a href="store_home.html?storeId=${encodeURIComponent(storeId)}">
          <img class="thumb" src="${img}" alt="${escapeHtml(name)}" />
          <div class="meta">
            <div class="title_row">
              <strong class="name">${escapeHtml(name)}</strong>
              <a class="distance"></a>
            </div>
            <button class="like_btn" type="button" aria-label="찜 해제" data-store-id="${storeId}">
              <img src="../images/like_red.svg" alt="찜 해제" />
            </button>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    $list.replaceChildren(frag);

    // 하트(빨강) 클릭 → 찜 삭제
    $list.querySelectorAll(".like_btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.storeId);
        deleteFavorite(id, btn);
      });
    });
  }

  /* ===== 상태 업데이트 유틸 ===== */

  function removeFromState(storeId) {
    // raw에서 제거
    state.raw = state.raw.filter((x) => x.storeId !== storeId);
    // view도 제거
    state.view = state.view.filter((x) => x.storeId !== storeId);
    // 캐시에서도 제거
    if (state.likes.has(storeId)) {
      state.likes.delete(storeId);
      persistLikes();
    }
  }

  function persistLikes() {
    localStorage.setItem("likes_store", JSON.stringify([...state.likes]));
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
