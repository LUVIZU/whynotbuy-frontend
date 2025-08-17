// ../js/gps_enroll.js
// 위치 등록/수정/삭제 (쿠키 인증)
// 검색 아이콘: 입력값 있으면 카카오 키워드 검색 → 결과 선택
//             입력값 없으면 현재 위치 → 역지오로 주소 채움

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const KAKAO_JS_KEY =
    window.RUNTIME_CONFIG?.KAKAO_JS_KEY || "YOUR_KAKAO_JS_KEY"; // 도메인 제한 필수!

  const qs = new URLSearchParams(location.search);
  const edit_id = qs.get("edit_id");

  // ===== 요소 =====
  const inputs = Array.from(document.querySelectorAll(".input_field"));
  const alias_input = inputs[0]; // 별칭
  const addr_input = inputs[1]; // 도로명
  const search_icon = document.querySelector(".search_icon");
  const btn_delete = document.querySelector(".delete_button");
  const btn_submit = document.querySelector(".submit_button");
  const title_el = document.querySelector(".top_title");

  if (!alias_input || !addr_input || !btn_submit) {
    console.error("gps_enroll: 필수 요소 누락");
    return;
  }

  // 내부 좌표 상태
  let current_lat = null;
  let current_lng = null;

  // Kakao SDK 준비
  let kakaoReady = loadKakao();

  // ===== 초기 =====
  const is_edit = !!edit_id;
  if (is_edit) {
    show(btn_delete, true);
    btn_submit.textContent = "수정하기";
    title_el && (title_el.textContent = "위치 수정");
    load_for_edit(edit_id).catch((e) => {
      console.error(e);
      alert("위치 정보를 불러오지 못했습니다.");
    });
  } else {
    show(btn_delete, false);
    btn_submit.textContent = "등록하기";
    title_el && (title_el.textContent = "위치 등록");
  }

  // ===== 이벤트 =====
  // 돋보기: 입력값 있으면 키워드 검색, 없으면 현재위치→역지오
  search_icon?.addEventListener("click", async () => {
    const q = addr_input.value.trim();

    await kakaoReady.catch(() => {
      alert("카카오 SDK 로드 실패");
    });

    if (q) {
      // 키워드 검색 → 결과 선택 UI
      const results = await kakaoSearchKeyword(q).catch(() => []);
      if (!results.length) return alert("검색 결과가 없습니다.");

      openResultPanel(results, (doc) => {
        setFromKakaoDoc(doc);
      });
    } else {
      if (!navigator.geolocation) {
        return alert("이 브라우저는 위치 접근을 지원하지 않습니다.");
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          current_lat = pos.coords.latitude;
          current_lng = pos.coords.longitude;
          const road = await kakaoReverse(current_lat, current_lng).catch(
            () => ""
          );
          if (road) addr_input.value = road;
          if (!alias_input.value.trim()) alias_input.value = "내 위치";
        },
        (err) => {
          console.warn("geolocation error", err);
          alert("현재 위치를 가져올 수 없습니다. 위치 권한을 확인해 주세요.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  });

  // 좌표 텍스트 붙여넣으면 → 도로명으로 치환
  addr_input?.addEventListener("input", async () => {
    const parsed = parse_latlng_from_text(addr_input.value);
    if (parsed) {
      current_lat = parsed.lat;
      current_lng = parsed.lng;
      const road = await kakaoReverse(current_lat, current_lng).catch(() => "");
      if (road) addr_input.value = road;
    }
  });

  // 저장 (등록/수정)
  btn_submit.addEventListener("click", async (e) => {
    e.preventDefault();

    const name = alias_input.value.trim();
    let road = addr_input.value.trim();

    // (lat,lng) 텍스트로 들어온 경우 역지오
    const parsed = parse_latlng_from_text(road);
    if (parsed) {
      current_lat = parsed.lat;
      current_lng = parsed.lng;
      const r = await kakaoReverse(current_lat, current_lng).catch(() => "");
      if (r) road = r;
    }

    // 좌표 없고 도로명만 있으면 지오코딩
    if ((!is_finite_num(current_lat) || !is_finite_num(current_lng)) && road) {
      const g = await kakaoGeocodeRoad(road).catch(() => null);
      if (g) {
        current_lat = g.lat;
        current_lng = g.lng;
      }
    }

    if (!name) return alert("주소지 별칭을 입력해 주세요.");
    if (!is_edit && !road) return alert("도로명 주소를 입력해 주세요.");

    try {
      lock(btn_submit, true);

      // POST에는 roadAddressName 포함, PATCH에는 기본 제외
      let body = is_edit
        ? { name, roadAddressName: road } // ← 수정에도 도로명 포함
        : { name, roadAddressName: road };
      if (is_finite_num(current_lat)) body.latitude = Number(current_lat);
      if (is_finite_num(current_lng)) body.longitude = Number(current_lng);
      // 만약 백엔드가 PATCH에서도 roadAddressName 허용하면 ↓ 주석 해제
      // if (is_edit) body.roadAddressName = road;

      if (is_edit) {
        await api(`/api/v1/users/locations/${encodeURIComponent(edit_id)}`, {
          method: "PATCH",
          body,
        });
        alert("수정되었습니다.");
      } else {
        await api(`/api/v1/users/locations`, {
          method: "POST",
          body,
        });
        alert("등록되었습니다.");
      }

      window.location.href = "gps_set.html";
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      lock(btn_submit, false);
    }
  });

  // 삭제
  btn_delete?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!is_edit) return;
    if (!confirm("이 위치를 삭제할까요?")) return;

    try {
      lock(btn_delete, true);
      await api(`/api/v1/users/locations/${encodeURIComponent(edit_id)}`, {
        method: "DELETE",
      });
      alert("삭제되었습니다.");
      window.location.href = "gps_set.html";
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      lock(btn_delete, false);
    }
  });

  /* ===== 함수들 ===== */

  // Kakao SDK 로더
  function loadKakao() {
    if (window.kakao?.maps?.services) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(
        KAKAO_JS_KEY
      )}&libraries=services`;
      s.onload = () => window.kakao.maps.load(resolve);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Kakao: 키워드 검색
  function kakaoSearchKeyword(query) {
    return new Promise((resolve, reject) => {
      const places = new kakao.maps.services.Places();
      places.keywordSearch(query, (docs, status) => {
        if (status === kakao.maps.services.Status.OK) resolve(docs || []);
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error("kakao search failed"));
      });
    });
  }

  // Kakao: 도로명 → 좌표
  function kakaoGeocodeRoad(road) {
    return new Promise((resolve) => {
      const g = new kakao.maps.services.Geocoder();
      g.addressSearch(road, (r, status) => {
        if (status !== kakao.maps.services.Status.OK || !r?.length)
          return resolve(null);
        resolve({ lat: Number(r[0].y), lng: Number(r[0].x) });
      });
    });
  }

  // Kakao: 좌표 → 도로명
  function kakaoReverse(lat, lng) {
    return new Promise((resolve) => {
      const g = new kakao.maps.services.Geocoder();
      // coord2Address(x, y) 이므로 x=lng, y=lat
      g.coord2Address(Number(lng), Number(lat), (r, status) => {
        if (status !== kakao.maps.services.Status.OK || !r?.length)
          return resolve("");
        resolve(
          r[0].road_address?.address_name || r[0].address?.address_name || ""
        );
      });
    });
  }

  function setFromKakaoDoc(doc) {
    addr_input.value =
      doc.road_address_name || doc.address_name || doc.place_name || "";
    current_lat = Number(doc.y); // y=lat
    current_lng = Number(doc.x); // x=lng
    if (!alias_input.value.trim())
      alias_input.value = doc.place_name || "내 위치";
  }

  // 간단한 결과 패널
  function openResultPanel(results, onPick) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.35);display:flex;justify-content:center;align-items:flex-start;padding-top:80px;";
    const panel = document.createElement("div");
    panel.style.cssText =
      "width:min(560px,92%);max-height:70vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee;">
        <strong>주소 선택</strong>
        <button id="kakao_close_btn" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <ul id="kakao_list" style="list-style:none;margin:0;padding:0;">
        ${results
          .map((r) => {
            const title = escape_html(
              r.place_name || r.road_address_name || r.address_name || "-"
            );
            const road = escape_html(
              r.road_address_name || r.address_name || ""
            );
            return `<li class="kakao_item" style="padding:12px 16px;border-bottom:1px solid #f2f2f2;cursor:pointer;">
              <div style="font-weight:700">${title}</div>
              <div style="color:#666;font-size:13px;margin-top:4px">${road}</div>
            </li>`;
          })
          .join("")}
      </ul>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target.id === "kakao_close_btn" || e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    panel.querySelectorAll(".kakao_item").forEach((li, idx) => {
      li.addEventListener("click", () => {
        onPick?.(results[idx]);
        document.body.removeChild(overlay);
      });
    });
  }

  // ========== 공용 유틸 ==========
  async function api(path, opt = {}) {
    const res = await fetch(API_BASE + path, {
      method: opt.method || "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${path} 실패(${res.status}): ${text}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : null;
  }

  function parse_latlng_from_text(t) {
    if (!t) return null;
    const m = String(t).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!is_finite_num(lat) || !is_finite_num(lng)) return null;
    return { lat, lng };
  }

  function is_finite_num(n) {
    const v = Number(n);
    return Number.isFinite(v);
  }

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.style.display = visible ? "" : "none";
  }

  function lock(el, on) {
    el?.setAttribute("aria-busy", on ? "true" : "false");
    if (el?.style) {
      el.style.pointerEvents = on ? "none" : "";
      el.style.opacity = on ? "0.7" : "";
    }
  }

  function escape_html(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function load_for_edit(id) {
    const list_json = await api("/api/v1/users/locations", { method: "GET" });
    const list = Array.isArray(list_json?.result?.locationInfoList)
      ? list_json.result.locationInfoList
      : Array.isArray(list_json)
      ? list_json
      : list_json?.result || [];

    const item = Array.isArray(list)
      ? list.find((x) => String(x.locationId ?? x.id) === String(id))
      : null;

    if (!item) throw new Error("NOT_FOUND");

    alias_input.value = item.locationName || item.name || "";

    const road =
      item.roadAddressName ||
      item.addressRoad ||
      item.roadAddr ||
      item.addressName ||
      "";

    current_lat = Number(item.latitude);
    current_lng = Number(item.longitude);
    if (!Number.isFinite(current_lat)) current_lat = null;
    if (!Number.isFinite(current_lng)) current_lng = null;

    if (road) {
      addr_input.value = road;
    } else if (is_finite_num(current_lat) && is_finite_num(current_lng)) {
      const r = await kakaoReverse(current_lat, current_lng).catch(() => "");
      addr_input.value = r || "";
    } else {
      addr_input.value = "";
    }
  }
});
