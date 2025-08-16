// js/home_store.js
// 규칙: JWT는 쿠키에 저장되어 있고, 모든 요청은 credentials: 'include'

document.addEventListener("DOMContentLoaded", () => {
  /* ========= 설정 ========= */
  const API_BASE = "https://api-whynotbuy.store";
  const DEFAULT_COORDS = { lat: 37.602, lng: 126.9565 }; // 스웨거 기본값
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
    sortType: "DISTANCE", // DISTANCE | REVIEW | CREATED_AT
    cursor: null, // 마지막 storeId (커서 기반 페이지네이션)
    hasMore: true,
    loading: false,
    stores: [], // 서버에서 받은 원본 목록 누적
    likes: new Set(JSON.parse(localStorage.getItem("likes_store") || "[]")), // storeId 세트
    searchActive: false, // 검색 모드 여부
  };

  /* ========= 세션 선택 위치 적용 ========= */
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

    // 별칭(라벨) 적용
    if (sel.name) {
      state.address_label = sel.name;
      if ($addr) $addr.textContent = sel.name;
      localStorage.setItem("selected_address_label", sel.name);
    }

    // 좌표 적용(문자/숫자 모두 허용)
    const lat = Number(sel.lat);
    const lng = Number(sel.lng);
    if (isFinite(lat) && isFinite(lng)) {
      state.coords = { lat, lng };
      // 다음 방문 저장(필요 없으면 삭제)
      localStorage.setItem("selected_location", JSON.stringify({ lat, lng }));
    }
  }

  /* ========= 초기 렌더 ========= */
  applySelectedLocation(); // 세션 우선
  if (!$addr?.textContent || $addr.textContent === "주소 설정") {
    fetchActiveAndApply(); // 없으면 서버 active 값 사용(+지오코딩 보강)
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
    }, 120);
  });

  // 무한 스크롤
  window.addEventListener("scroll", () => {
    if (state.loading || !state.hasMore || state.searchActive) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) fetchAndRender();
  });

  /* ========= 유틸 ========= */
  function readCoords() {
    // 1) sessionStorage
    try {
      const s = JSON.parse(
        sessionStorage.getItem("selected_location") || "null"
      );
      if (s?.lat != null && s?.lng != null) {
        const lat = Number(s.lat),
          lng = Number(s.lng);
        if (isFinite(lat) && isFinite(lng)) return { lat, lng };
      }
    } catch {}

    // 2) localStorage
    try {
      const l = JSON.parse(localStorage.getItem("selected_location") || "null");
      if (l?.lat != null && l?.lng != null) {
        const lat = Number(l.lat),
          lng = Number(l.lng);
        if (isFinite(lat) && isFinite(lng)) return { lat, lng };
      }
    } catch {}

    // 3) 기본값
    return DEFAULT_COORDS;
  }

  // 스토어 이미지 URL 필드 호환 (백엔드 컬럼 추가 반영)
  function getStoreImageUrl(s) {
    return (
      s?.thumbnailUrl || // 기존 사용 키
      s?.imageUrl || // 새로 추가될 수 있는 키
      s?.storeImageUrl || // 변형 키
      s?.store?.imageUrl || // 중첩 케이스
      PLACEHOLDER_IMG
    );
  }

  // 주소 → 좌표 (백엔드 후보 엔드포인트들 순차 시도)
  async function geocode_road(road) {
    if (!road) return null;
    const q = encodeURIComponent(road);
    const endpoints = [
      (qs) => `/api/v1/geo/geocode?query=${qs}`,
      (qs) => `/api/v1/users/locations/geocode?roadAddressName=${qs}`,
      (qs) => `/api/v1/locations/geocode?roadAddressName=${qs}`,
    ];
    for (const build of endpoints) {
      try {
        const r = await fetch(API_BASE + build(q), { credentials: "include" });
        if (!r.ok) continue;
        const j = await r.json().catch(() => ({}));
        const lat =
          j?.result?.latitude ?? j?.latitude ?? j?.result?.coords?.lat ?? null;
        const lng =
          j?.result?.longitude ??
          j?.longitude ??
          j?.result?.coords?.lng ??
          null;
        const nlat = Number(lat),
          nlng = Number(lng);
        if (isFinite(nlat) && isFinite(nlng)) return { lat: nlat, lng: nlng };
      } catch {}
    }
    return null;
  }

  // 상점 좌표 키 호환
  function getStoreCoords(s) {
    const lat =
      s?.latitude ?? s?.lat ?? s?.store?.latitude ?? s?.store?.lat ?? null;
    const lng =
      s?.longitude ?? s?.lng ?? s?.store?.longitude ?? s?.store?.lng ?? null;
    const nlat = Number(lat),
      nlng = Number(lng);
    return isFinite(nlat) && isFinite(nlng) ? { lat: nlat, lng: nlng } : null;
  }

  // 하버사인 거리(m)
  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat),
      lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // 거리 텍스트: 클라 계산 우선 → 없을 때만 서버값 사용
  function getDistanceTextForStore(s) {
    let meters = null;
    const storeC = getStoreCoords(s);
    if (
      storeC &&
      state?.coords &&
      isFinite(state.coords.lat) &&
      isFinite(state.coords.lng)
    ) {
      meters = haversineMeters(state.coords, storeC);
    }
    if (!(typeof meters === "number" && isFinite(meters))) {
      const server =
        typeof s.distance === "number"
          ? s.distance
          : typeof s.distanceMeter === "number"
          ? s.distanceMeter
          : null;
      if (typeof server === "number" && isFinite(server)) meters = server;
    }
    return typeof meters === "number" && isFinite(meters)
      ? formatDistance(meters)
      : "";
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
      const distanceText = getDistanceTextForStore(s);
      const storeName = s.name ?? s.storeName ?? "가게";
      const liked = state.likes.has(s.storeId);

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
                liked ? "../images/heart_red.svg" : "../images/like.svg"
              }" alt="찜" />
            </button>
          </div>
        </a>
      `;

      frag.appendChild(li);
    });

    // 전체 교체 (검색 시 깜빡임 최소화)
    $list.replaceChildren(frag);

    // 찜 토글 이벤트
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

      // 별칭 호환 키들
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

      // 좌표 세팅: 우선 서버 lat/lng → 없으면 주소 지오코딩
      if (isFinite(Number(loc.latitude)) && isFinite(Number(loc.longitude))) {
        state.coords = {
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };
      } else if (road || alias || loc.locationName) {
        const g = await geocode_road(road || alias || loc.locationName);
        if (g) state.coords = g;
      }

      // 세션 저장 (다른 페이지 즉시 반영)
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
