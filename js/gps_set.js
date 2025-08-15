// ../js/gps_set.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const ENDPOINT = `${API_BASE}/api/v1/users/locations`;

  const list_el = document.querySelector(".location_list");

  // 기존 더미 카드 제거
  list_el.innerHTML = "";

  render_loading();

  load_locations().then(({ ok, data, status }) => {
    if (!ok) {
      if (status === 401 || status === 403) {
        alert("로그인이 필요합니다.");
        window.location.href = "./login.html";
        return;
      }
      render_error();
      return;
    }

    const list = data?.result?.locationInfoList || [];
    if (!Array.isArray(list) || list.length === 0) {
      render_empty();
      return;
    }

    // 활성 먼저
    list.sort((a, b) => Number(b.active) - Number(a.active));

    // 렌더
    list_el.innerHTML = "";
    list.forEach((item) => list_el.appendChild(make_card(item)));

    // 이전에 선택했던 카드가 있으면 active 적용
    const saved = get_saved_selection();
    if (saved?.id) {
      const el = list_el.querySelector(`.location_card[data-id="${saved.id}"]`);
      if (el) set_active_card(el);
    }
  });

  /* ============== functions ============== */

  async function load_locations() {
    try {
      const res = await fetch(ENDPOINT, {
        method: "GET",
        credentials: "include",
      });
      const status = res.status;
      const json = await res.json().catch(() => ({}));
      const ok =
        res.ok &&
        json?.isSuccess === true &&
        json?.result?.locationInfoList !== undefined;
      return { ok, data: json, status };
    } catch (err) {
      console.error("위치 목록 조회 실패:", err);
      return { ok: false, data: null, status: 0 };
    }
  }

  function make_card(item) {
    const { locationId, locationName, latitude, longitude, active, address } =
      item;

    const el = document.createElement("div");
    el.className = "location_card";
    el.dataset.id = String(locationId ?? "");
    el.dataset.active = String(!!active);

    const address_text =
      address ??
      (isFinite(latitude) && isFinite(longitude)
        ? `(${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)})`
        : "-");

    // 데이터 저장용
    el.dataset.name = locationName ?? "";
    el.dataset.address = address_text;
    el.dataset.lat = latitude ?? "";
    el.dataset.lng = longitude ?? "";

    el.innerHTML = `
      <img src="../images/gps_red.svg" class="icon" alt="GPS 아이콘" />
      <div class="location_info">
        <div class="location_name">${escape_html(locationName ?? "이름 없음")}${
      active ? ' <span class="active_badge">기본</span>' : ""
    }</div>
        <div class="location_address">${escape_html(address_text)}</div>
      </div>
      <img src="../images/pencil.svg" class="icon edit_icon" alt="수정 아이콘" />
    `;

    // (1) 카드 클릭 → 선택 표시 + 세션 저장 + 서버 active 전환
    el.addEventListener("click", async () => {
      set_active_card(el);
      save_selection({
        id: el.dataset.id,
        name: el.dataset.name,
        address: el.dataset.address,
        lat: el.dataset.lat,
        lng: el.dataset.lng,
      });
      // 서버의 기본 위치도 이 아이디로 전환
      await set_active_on_server(el.dataset.id).catch(console.warn);
    });

    async function set_active_on_server(id) {
      if (!id) return false;
      const res = await fetch(
        `${API_BASE}/api/v1/users/locations/active/${encodeURIComponent(id)}`,
        { method: "PATCH", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    }

    // (2) 연필 클릭 → 수정모드 이동 (선택 이벤트와 분리)
    el.querySelector(".edit_icon")?.addEventListener("click", (e) => {
      e.stopPropagation(); // 카드 클릭 이벤트 막기
      const id = el.dataset.id;
      if (!id) return;
      // 수정모드 플래그도 같이 보냄
      window.location.href = `./gps_enroll.html?edit_id=${encodeURIComponent(
        id
      )}`;
      id;
    });

    return el;
  }

  function set_active_card(target_el) {
    // 전체 active 해제
    list_el.querySelectorAll(".location_card.active").forEach((n) => {
      n.classList.remove("active");
    });
    // 선택한 카드에 active 부여
    target_el.classList.add("active");
  }

  function save_selection(obj) {
    sessionStorage.setItem("selected_location", JSON.stringify(obj));
  }
  function get_saved_selection() {
    try {
      return JSON.parse(sessionStorage.getItem("selected_location") || "null");
    } catch {
      return null;
    }
  }

  function render_loading() {
    list_el.innerHTML = `
      <div class="location_card skeleton">
        <div class="icon" style="width:24px;height:24px;background:#eee;border-radius:50%"></div>
        <div class="location_info" style="flex:1">
          <div style="height:14px;background:#eee;border-radius:6px;width:40%;margin:6px 0;"></div>
          <div style="height:12px;background:#eee;border-radius:6px;width:60%;"></div>
        </div>
      </div>
    `;
  }
  function render_empty() {
    list_el.innerHTML = `
      <div class="empty_box">
        <p>등록된 위치가 없어요.</p>
        <a href="./gps_enroll.html" class="btn_primary">위치 등록하기</a>
      </div>
    `;
  }
  function render_error() {
    list_el.innerHTML = `
      <div class="empty_box">
        <p>위치 목록을 불러오지 못했어요.</p>
        <button class="btn_primary" id="retry_btn">다시 시도</button>
      </div>
    `;
    document.getElementById("retry_btn")?.addEventListener("click", () => {
      list_el.innerHTML = "";
      render_loading();
      location.reload();
    });
  }
  function escape_html(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});
