// js/home_store.js
// 규칙: JWT는 쿠키에 저장되어 있고, 모든 요청은 credentials: 'include'

document.addEventListener("DOMContentLoaded", () => {
  /* ========= 설정 ========= */
  const API_BASE = "https://api-whynotbuy.store";
  const DEFAULT_COORDS = { lat: 37.602, lng: 126.9565 }; // fallback
  const PAGE_SIZE = 10;
  const PLACEHOLDER_IMG = "../images/store_placeholder.png"; // 없으면 하나 추가 권장

  const $addr = document.querySelector(".loc_text");
  const $list = document.querySelector(".store_list");
  const $nearBtn = document.querySelector(".near_btn");
  const $searchInput = document.querySelector(".search_bar input");

  /* ========= 상태 ========= */
  const state = {
    coords: readCoords(),
    address_label:
      localStorage.getItem("selected_address_label") || "주소 설정",
    sortType: "DISTANCE", // DISTANCE | REVIEW | CREATED_AT (서버 정렬 파라미터)
    cursor: null,
    hasMore: true,
    loading: false,
    stores: [],
    likes: new Set(JSON.parse(localStorage.getItem("likes_store") || "[]")), // storeId 세트
    searchActive: false,
  };

  /* ========= 세션 선택 위치 적용 ========= */
  applySelectedLocationFromSession();

  /* ========= 초기 렌더 ========= */
  if (!$addr?.textContent || $addr.textContent === "주소 설정") {
    fetchActiveAndApply(); // 서버 active 값으로 덮어쓰기
  } else {
    $addr.textContent = state.address_label;
  }

  if ($nearBtn) {
    $nearBtn.textContent =
      state.sortType === "DISTANCE"
        ? "가까운순"
        : state.sortType === "REVIEW"
        ? "리뷰순"
        : "신규순";
  }

  fetchAndRender();

  /* ========= 이벤트 ========= */
  // 정렬 토글: 가까운순 → 리뷰순 → 최신순
  $nearBtn?.addEventListener("click", () => {
    state.sortType =
      state.sortType === "DISTANCE"
        ? "REVIEW"
        : state.sortType === "REVIEW"
        ? "CREATED_AT"
        : "DISTANCE";

    $nearBtn.textContent =
      state.sortType === "DISTANCE"
        ? "가까운순"
        : state.sortType === "REVIEW"
        ? "리뷰순"
        : "신규순";

    resetAndReload();
  });

  // 검색(클라이언트 필터)
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
    }, 150);
  });

  // 무한 스크롤
  window.addEventListener("scroll", () => {
    if (state.loading || !state.hasMore || state.searchActive) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchAndRender();
  });

  /* ========= 유틸 ========= */

  // 세션/로컬/기본 순서로 좌표 읽기(숫자 보장)
  function readCoords() {
    // 1) sessionStorage
    try {
      const s = JSON.parse(
        sessionStorage.getItem("selected_location") || "null"
      );
      if (s?.lat != null && s?.lng != null) {
        const lat = Number(s.lat),
          lng = Number(s.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch {}

    // 2) localStorage
    try {
      const l = JSON.parse(localStorage.getItem("selected_location") || "null");
      if (l?.lat != null && l?.lng != null) {
        const lat = Number(l.lat),
          lng = Number(l.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch {}

    // 3) 기본값
    return DEFAULT_COORDS;
  }

  function applySelectedLocationFromSession() {
    try {
      const sel = JSON.parse(
        sessionStorage.getItem("selected_location") || "null"
      );
      if (!sel) return;

      if (sel.name) {
        state.address_label = sel.name;
        if ($addr) $addr.textContent = sel.name;
        localStorage.setItem("selected_address_label", sel.name);
      }

      const lat = Number(sel.lat);
      const lng = Number(sel.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        state.coords = { lat, lng };
        // 다음 방문을 위해 저장(선택)
        localStorage.setItem("selected_location", JSON.stringify({ lat, lng }));
      }
    } catch {}
  }

  // 스토어 이미지 URL 호환
  function getStoreImageUrl(s) {
    return (
      s?.thumbnailUrl ||
      s?.imageUrl ||
      s?.storeImageUrl ||
      s?.store?.imageUrl ||
      PLACEHOLDER_IMG
    );
  }

  // 상점 응답 URL
  function buildStoresUrl() {
    const q = new URLSearchParams();
    if (state.cursor != null) q.set("cursor", String(state.cursor));
    q.set("size", String(PAGE_SIZE));
    q.set("type", state.sortType); // DISTANCE | REVIEW | CREATED_AT
    q.set("lat", String(state.coords.lat));
    q.set("lng", String(state.coords.lng));
    return `${API_BASE}/api/v1/store?${q.toString()}`;
  }

  /* ========= 거리 계산 ========= */

  // 상점 좌표 읽기(키 호환)
  function getStoreCoords(s) {
    const lat = Number(
      s?.latitude ?? s?.lat ?? s?.store?.latitude ?? s?.store?.lat
    );
    const lng = Number(
      s?.longitude ?? s?.lng ?? s?.store?.longitude ?? s?.store?.lng
    );
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  // 하버사인(m)
  function haversineMeters(a, b) {
    const R = 6371000; // meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function formatDistance(meters) {
    if (!(typeof meters === "number" && isFinite(meters))) return "";
    return meters < 1000
      ? `${Math.round(meters)}m`
      : `${(meters / 1000).toFixed(1)}km`;
  }

  // 서버 distance 우선, 없으면 클라 계산
  function getDistanceTextForStore(s) {
    let meters =
      typeof s.distance === "number"
        ? s.distance
        : typeof s.distanceMeter === "number"
        ? s.distanceMeter
        : null;

    if (!(typeof meters === "number" && isFinite(meters) && meters > 0)) {
      const store = getStoreCoords(s);
      if (store && state.coords) {
        meters = haversineMeters(state.coords, store);
      }
    }
    return formatDistance(meters);
  }

  /* ========= 데이터 조회 & 렌더 ========= */

  async function fetchAndRender() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;

    try {
      const res = await fetch(buildStoresUrl(), {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();

      // { stores:[...], nextData, nextCursor }  |  { result:{...} }
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

      state.cursor =
        payload.nextCursor !== undefined
          ? payload.nextCursor
          : getLastId(batch);

      state.hasMore =
        typeof payload.nextData === "boolean"
          ? payload.nextData
          : batch.length === PAGE_SIZE;

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

    // 비어있으면 placeholder
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
      const storeName = s.name ?? s.storeName ?? "가게";
      const liked = state.likes.has(s.storeId);

      const distanceText = getDistanceTextForStore(s);

      li.innerHTML = `
        <a href="${href}">
          ${renderBadge(s)}
          <img class="thumb" src="${getStoreImageUrl(s)}" alt="${escapeHtml(
        storeName
      )}" />
          <div class="meta">
            <div class="title_row">
              <strong class="name">${escapeHtml(storeName)}</strong>
              <a class="distance">${distanceText}</a>
            </div>
            <button class="like_btn" type="button" aria-label="찜" data-store-id="${
              s.storeId
            }">
              <img src="${
                liked ? "../images/like_red.svg" : "../images/like.svg"
              }" alt="찜" />
            </button>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    // 전체 교체
    $list.replaceChildren(frag);

    // 찜 토글
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
    if (typeof s.discountRate === "number" && s.discountRate > 0) {
      return `<span class="badge">최대 ${Math.round(
        s.discountRate
      )}% 할인중</span>`;
    }
    return "";
  }

  function toggleLike(storeId, btnEl) {
    if (state.likes.has(storeId)) state.likes.delete(storeId);
    else state.likes.add(storeId);

    localStorage.setItem(
      "likes_store",
      JSON.stringify(Array.from(state.likes.values()))
    );

    const img = btnEl.querySelector("img");
    if (img) {
      img.src = state.likes.has(storeId)
        ? "../images/like_red.svg"
        : "../images/like.svg";
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ========= 활성 위치 불러와 상단 라벨/좌표 반영 ========= */
  // 별칭(label) 우선 → 없으면 도로명(roadAddressName) → 마지막으로 locationName
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

      const alias =
        loc.locationAlias ||
        loc.alias ||
        loc.nickname ||
        loc.locationName ||
        null;
      const road = loc.roadAddressName || null;

      const label = alias || road || loc.locationName || "주소 설정";
      state.address_label = label;

      if ($addr) $addr.textContent = label;
      localStorage.setItem("selected_address_label", label);

      if (isFinite(Number(loc.latitude)) && isFinite(Number(loc.longitude))) {
        state.coords = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };
      }

      // 세션에도 동일하게 저장 (다른 페이지 즉시 반영)
      sessionStorage.setItem(
        "selected_location",
        JSON.stringify({
          id: loc.locationId,
          name: label,
          lat: state.coords.lat,
          lng: state.coords.lng,
        })
      );
    } catch (e) {
      console.warn("활성 위치 로드 실패", e);
    }
  }
});
