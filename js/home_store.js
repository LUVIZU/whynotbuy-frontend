// js/home_store.js
// 규칙: JWT는 쿠키에 저장되어 있고, 모든 요청은 credentials: 'include'

document.addEventListener("DOMContentLoaded", () => {
  /* ========= 설정 ========= */
  const API_BASE = "https://api-whynotbuy.store";
  const DEFAULT_COORDS = { lat: 37.602, lng: 126.9565 }; // 스웨거 기본값
  const PAGE_SIZE = 10;

  const $addr = document.querySelector(".loc_text");
  const $list = document.querySelector(".store_list");
  const $nearBtn = document.querySelector(".near_btn");
  const $searchInput = document.querySelector(".search_bar input");

  /* ========= 상태 ========= */
  const state = {
    coords: readCoords(),
    address_label:
      localStorage.getItem("selected_address_label") || "주소 설정",
    sortType: "DISTANCE", // DISTANCE | REVIEW | CREATED_AT
    cursor: null, // 마지막 storeId (커서 기반 페이지네이션)
    hasMore: true,
    loading: false,
    stores: [], // 서버에서 받은 원본 목록 누적
    likes: new Set(JSON.parse(localStorage.getItem("likes_store") || "[]")), // storeId 세트
    searchActive: false, // 검색 모드 여부
    address_label:
      localStorage.getItem("selected_address_label") || "주소 설정",
  };
  // ...상단 변수/상태 선언 아래에 추가
  function getSelectedFromSession() {
    try {
      return JSON.parse(sessionStorage.getItem("selected_location") || "null");
    } catch {
      return null;
    }
  }
  function applySelectedLocation() {
    const sel = getSelectedFromSession();
    if (!sel) return;

    // 별칭 적용
    if (sel.name) {
      state.address_label = sel.name;
      $addr && ($addr.textContent = sel.name);
      localStorage.setItem("selected_address_label", sel.name);
    }

    // 좌표 적용
    const lat = Number(sel.lat);
    const lng = Number(sel.lng);
    if (isFinite(lat) && isFinite(lng)) {
      state.coords = { lat, lng };
      // 다음 방문을 위해 저장(필요 없으면 이 줄 삭제)
      localStorage.setItem("selected_location", JSON.stringify({ lat, lng }));
    }
  }

  /* ========= 초기 렌더 ========= */
  applySelectedLocation(); // 세션 우선
  if (!$addr.textContent || $addr.textContent === "주소 설정") {
    fetchActiveAndApply(); // 없으면 서버 active 값 사용
  }
  $addr.textContent = state.address_label;
  // 첫 페이지 로드
  fetchAndRender();

  /* ========= 이벤트 ========= */
  // 정렬 토글: 가까운순 → 리뷰순 → 최신순 순환
  $nearBtn?.addEventListener("click", () => {
    state.sortType =
      state.sortType === "DISTANCE"
        ? "REVIEW"
        : state.sortType === "REVIEW"
        ? "CREATED_AT"
        : "DISTANCE";

    // 버튼 라벨 갱신
    $nearBtn.textContent =
      state.sortType === "DISTANCE"
        ? "가까운순"
        : state.sortType === "REVIEW"
        ? "리뷰순"
        : "신규순";

    // 리스트 리셋 후 재조회
    resetAndReload();
  });

  // 검색(클라이언트 필터) — 스웨거에 keyword 파라미터가 없어서 로컬 필터로 처리
  let searchTimer;
  $searchInput?.addEventListener("input", () => {
    const q = ($searchInput.value || "").trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (q === "") {
        if (state.searchActive) {
          state.searchActive = false;
          resetAndReload(); // 서버에서 다시 첫 페이지부터
        } else {
          renderList(state.stores); // 이미 전체가 있으면 그냥 렌더
        }
        return;
      }
      state.searchActive = true;
      renderList(filterStores(q));
    }, 120);
  });

  // 무한 스크롤
  window.addEventListener("scroll", () => {
    if (state.loading || !state.hasMore || state.searchActive) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchAndRender();
  });

  /* ========= 함수들 ========= */
  function readCoords() {
    // 1) sessionStorage 우선
    try {
      const s = JSON.parse(
        sessionStorage.getItem("selected_location") || "null"
      );
      if (s && typeof s.lat === "number" && typeof s.lng === "number") return s;
    } catch {}

    // 2) localStorage 다음
    try {
      const l = JSON.parse(localStorage.getItem("selected_location") || "null");
      if (l && typeof l.lat === "number" && typeof l.lng === "number") return l;
    } catch {}

    // 3) 기본값
    return DEFAULT_COORDS;
  }

  // API URL 작성
  function buildStoresUrl() {
    const q = new URLSearchParams();
    if (state.cursor != null) q.set("cursor", String(state.cursor));
    q.set("size", String(PAGE_SIZE));
    q.set("type", state.sortType); // DISTANCE | REVIEW | CREATED_AT
    q.set("lat", String(state.coords.lat));
    q.set("lng", String(state.coords.lng));
    return `${API_BASE}/api/v1/store?${q.toString()}`;
  }

  async function fetchAndRender() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;

    try {
      const res = await fetch(buildStoresUrl(), {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      // 스웨거 예시: { isSuccess, code, message, stores: [...], nextData: true, nextCursor: 0 }
      // 혹시 백엔드가 result 래핑을 쓰면 둘 다 안전하게 처리
      const payload = data?.stores
        ? data
        : data?.result && data.result.stores
        ? data.result
        : null;

      if (!payload) {
        console.error("응답 구조 예상과 다름:", data);
        return;
      }

      const batch = Array.isArray(payload.stores) ? payload.stores : [];
      state.stores = state.stores.concat(batch);

      // 커서/페이지네이션 갱신
      state.cursor =
        payload.nextCursor !== undefined
          ? payload.nextCursor
          : getLastId(batch);
      state.hasMore =
        typeof payload.nextData === "boolean"
          ? payload.nextData
          : batch.length === PAGE_SIZE;

      // 렌더 (검색어 있으면 필터링 후)
      renderList(filterStores($searchInput?.value || ""));
    } catch (err) {
      console.error("가게 목록 조회 실패:", err);
    } finally {
      state.loading = false;
    }
  }

  function getLastId(list) {
    if (!list?.length) return state.cursor ?? null;
    const last = list[list.length - 1];
    return last?.storeId ?? state.cursor ?? null;
  }

  function resetAndReload() {
    state.cursor = null;
    state.hasMore = true;
    state.stores = [];
    $list.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "auto" });
    fetchAndRender();
  }

  function filterStores(keyword) {
    const kw = (keyword || "").trim().toLowerCase();
    if (!kw) return state.stores;
    return state.stores.filter((s) =>
      String(s.name ?? s.storeName ?? "")
        .toLowerCase()
        .includes(kw)
    );
  }

  function renderList(stores) {
    if (!$list) return;

    // 비어있으면 place-holder
    if (!stores?.length) {
      if (!$list.dataset.empty) {
        $list.dataset.empty = "1";
        $list.innerHTML = `
        <li class="store_card empty_card" aria-live="polite">
        <div class="meta" style="justify-content:center; padding:25px 0">
        <strong class="name empty_msg">표시할 가게가 없습니다</strong>
        </div>
        </li>`;
      }
      return;
    } else {
      if ($list.dataset.empty) {
        delete $list.dataset.empty;
        $list.innerHTML = "";
      }
    }

    const frag = document.createDocumentFragment();

    stores.forEach((s) => {
      const li = document.createElement("li");
      li.className = "store_card";

      const href = `store_home.html?storeId=${encodeURIComponent(s.storeId)}`;

      const distanceText =
        typeof s.distance === "number"
          ? formatDistance(s.distance)
          : typeof s.distanceMeter === "number"
          ? formatDistance(s.distanceMeter)
          : "";

      const storeName = s.name ?? s.storeName ?? "가게";

      const liked = state.likes.has(s.storeId);

      li.innerHTML = `
        <a href="${href}">
          ${renderBadge(s)}
          <img class="thumb" src="${
            s.thumbnailUrl || "../images/sample_bingsu_1.jpg"
          }" alt="${escapeHtml(storeName)}" />
          <div class="meta">
            <div class="title_row">
              <strong class="name">${escapeHtml(storeName)}</strong>
              <a class="distance">${distanceText}</a>
            </div>
            <button class="like_btn" type="button" aria-label="찜" data-store-id="${
              s.storeId
            }">
              <img src="${
                liked ? "../images/heart_red.svg" : "../images/like.svg"
              }" alt="찜" />
            </button>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    // 기존 노드 싹 지우고 다시 채우는 대신, 전체를 교체 (검색때 깜빡임 줄임)
    $list.replaceChildren(frag);

    // 찜 토글 이벤트(버튼이 a 안에 있어도 동작하도록 기본 이동 막음)
    $list.querySelectorAll(".like_btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.dataset.storeId);
        toggleLike(id, btn);
      });
    });
  }

  function renderBadge(s) {
    // 백엔드에 할인율(예: s.discountRate)이 있으면 표시, 없으면 미표시
    if (typeof s.discountRate === "number" && s.discountRate > 0) {
      return `<span class="badge">최대 ${Math.round(
        s.discountRate
      )}% 할인중</span>`;
    }
    return "";
  }

  function toggleLike(storeId, btnEl) {
    if (state.likes.has(storeId)) {
      state.likes.delete(storeId);
    } else {
      state.likes.add(storeId);
    }
    localStorage.setItem(
      "likes_store",
      JSON.stringify(Array.from(state.likes.values()))
    );

    // 아이콘 갱신
    const img = btnEl.querySelector("img");
    if (img) {
      img.src = state.likes.has(storeId)
        ? "../images/heart_red.svg"
        : "../images/like.svg";
    }
  }

  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
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
      const loc =
        data?.result && data.result.locationId != null
          ? data.result
          : data?.locationId != null
          ? data
          : null;
      if (!loc) return;
      const alias = loc.locationName || "주소 설정";
      state.address_label = alias;
      $addr && ($addr.textContent = alias);
      if (isFinite(loc.latitude) && isFinite(loc.longitude)) {
        state.coords = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };
      }
    } catch (e) {
      console.warn("활성 위치 로드 실패", e);
    }
  }
});
