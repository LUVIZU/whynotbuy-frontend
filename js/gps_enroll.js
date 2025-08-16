// ../js/gps_enroll.js
// 위치 등록/수정/삭제 (실서버 전용, 쿠키 인증)
// HTML: .input_field(별칭/주소 순서), .search_icon, .delete_button, .submit_button

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const qs = new URLSearchParams(location.search);
  const edit_id = qs.get("edit_id"); // 있으면 수정 모드

  // ===== 요소 캐시 =====
  const inputs = Array.from(document.querySelectorAll(".input_field"));
  const alias_input = inputs[0]; // 별칭(name)
  const addr_input = inputs[1]; // 도로명 주소(roadAddressName)
  const search_icon = document.querySelector(".search_icon");
  const btn_delete = document.querySelector(".delete_button");
  const btn_submit = document.querySelector(".submit_button");
  const title_el = document.querySelector(".top_title");

  if (!alias_input || !addr_input || !btn_submit) {
    console.error("gps_enroll: 필수 요소 누락");
    return;
  }

  // 좌표는 내부 상태로 관리
  let current_lat = null;
  let current_lng = null;

  // ===== 초기 상태 =====
  const is_edit = !!edit_id;
  if (is_edit) {
    btn_delete?.classList.remove("hidden");
    if (btn_delete?.style) btn_delete.style.display = "";
    btn_submit.textContent = "수정하기";
    if (title_el) title_el.textContent = "위치 수정";

    load_for_edit(edit_id).catch((e) => {
      console.error(e);
      alert("위치 정보를 불러오지 못했습니다.");
    });
  } else {
    btn_delete?.classList.add("hidden");
    if (btn_delete?.style) btn_delete.style.display = "none";
    btn_submit.textContent = "등록하기";
    if (title_el) title_el.textContent = "위치 등록";
  }

  // ===== 이벤트 =====
  // (1) 현재 위치 → 좌표 획득 후 역지오코딩으로 도로명 주소 자동 채움
  search_icon?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 접근을 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        current_lat = pos.coords.latitude;
        current_lng = pos.coords.longitude;

        // 역지오코딩으로 도로명 주소 자동 세팅
        const road = await reverse_geocode(current_lat, current_lng);
        if (road) {
          addr_input.value = road;
        } else if (!addr_input.value.trim()) {
          addr_input.placeholder = "도로명 주소를 입력하세요";
        }

        if (!alias_input.value.trim()) alias_input.value = "내 위치";
      },
      (err) => {
        console.warn("geolocation error", err);
        alert("현재 위치를 가져올 수 없습니다. 위치 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // (2) 주소 입력칸에 (lat,lng) 텍스트가 들어오면 자동 역지오 → 도로명으로 치환
  addr_input?.addEventListener("input", async () => {
    const parsed = parse_latlng_from_text(addr_input.value);
    if (parsed) {
      current_lat = parsed.lat;
      current_lng = parsed.lng;
      const road = await reverse_geocode(current_lat, current_lng);
      if (road) addr_input.value = road;
    }
  });

  // (3) 등록/수정 제출
  btn_submit.addEventListener("click", async (e) => {
    e.preventDefault();

    const name = alias_input.value.trim();
    let road = addr_input.value.trim();

    // 주소칸에 좌표가 들어왔을 가능성 대비
    const parsed = parse_latlng_from_text(road);
    if (parsed) {
      current_lat = parsed.lat;
      current_lng = parsed.lng;
      const r = await reverse_geocode(current_lat, current_lng);
      if (r) road = r;
    }

    // ★ lat/lng이 없고 도로명만 있을 때 → 지오코딩으로 좌표 채움
    if ((!is_finite_num(current_lat) || !is_finite_num(current_lng)) && road) {
      const g = await geocode_road(road);
      if (g) {
        current_lat = g.lat;
        current_lng = g.lng;
      }
    }

    if (!name) return alert("주소지 별칭을 입력해 주세요.");
    if (!is_edit && !road) return alert("도로명 주소를 입력해 주세요.");

    try {
      lock(btn_submit, true);

      // 스웨거:
      // - POST:  { name, latitude?, longitude?, roadAddressName }
      // - PATCH: { name?, latitude?, longitude? }  (일반적으로 roadAddressName 미수용)
      let body = {};
      if (is_edit) {
        body = { name };
      } else {
        body = { name, roadAddressName: road };
      }
      if (is_finite_num(current_lat)) body.latitude = Number(current_lat);
      if (is_finite_num(current_lng)) body.longitude = Number(current_lng);

      if (is_edit) {
        await api(`/api/v1/users/locations/${encodeURIComponent(edit_id)}`, {
          method: "PATCH", // 서버가 PUT이면 PUT으로 변경
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

      // 성공 → 목록으로
      window.location.href = "gps_set.html";
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다. 돋보기 버튼을 클릭 후 시도해주세요.");
    } finally {
      lock(btn_submit, false);
    }
  });

  // (4) 삭제
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
      alert("삭제에 실패했습니다. 현재 위치는 삭제할 수 없습니다.");
    } finally {
      lock(btn_delete, false);
    }
  });

  // ===== 함수들 =====
  async function load_for_edit(id) {
    // 단건 조회가 없어서 목록에서 찾아 채움
    const list_json = await api("/api/v1/users/locations", { method: "GET" });
    const list = unwrap(list_json); // {isSuccess,result:{locationInfoList}} / 배열

    const item = Array.isArray(list)
      ? list.find((x) => String(x.locationId ?? x.id) === String(id))
      : null;

    if (!item) throw new Error("NOT_FOUND");

    alias_input.value = item.locationName || item.name || "";

    // 도로명 주소 우선 세팅, 없고 좌표만 있으면 역지오코딩
    const road =
      item.roadAddressName ||
      item.addressRoad ||
      item.roadAddr ||
      item.addressName ||
      "";

    current_lat = item.latitude ?? null;
    current_lng = item.longitude ?? null;

    if (road) {
      addr_input.value = road;
    } else if (is_finite_num(current_lat) && is_finite_num(current_lng)) {
      const r = await reverse_geocode(current_lat, current_lng);
      addr_input.value = r || "";
    } else {
      addr_input.value = "";
    }
  }

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

  // {isSuccess, result:{locationInfoList:[...]}} 형태/단순 배열 모두 대응
  function unwrap(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (data.result?.locationInfoList) return data.result.locationInfoList;
    return data.result ?? data;
  }

  function parse_latlng_from_text(text) {
    if (!text) return null;
    // "(37.123, 127.456)" / "37.123,127.456" / "37.123 127.456"
    const m = String(text).match(
      /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/
    );
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!is_finite_num(lat) || !is_finite_num(lng)) return null;
    return { lat, lng };
  }

  function is_finite_num(n) {
    return typeof n === "number" && isFinite(n);
  }

  // ✅ 역지오코딩: 백엔드 가능한 엔드포인트들을 순차 시도
  // ✅ 역지오코딩: 다양한 스펙을 순차 시도하고, 실패해도 조용히 빈 문자열 반환
  async function reverse_geocode(lat, lng) {
    const tryFetch = async (path, init) => {
      try {
        const r = await fetch(path, { credentials: "include", ...init });
        if (!r.ok) return null;
        const j = await r.json().catch(() => ({}));
        return (
          j?.result?.roadAddressName ||
          j?.roadAddressName ||
          j?.result?.address?.roadAddressName ||
          null
        );
      } catch {
        return null;
      }
    };

    // 1) GET 다양한 쿼리 키
    const getCandidates = [
      `${API_BASE}/api/v1/geo/reverse?lat=${lat}&lng=${lng}`,
      `${API_BASE}/api/v1/geo/reverse?latitude=${lat}&longitude=${lng}`,
      `${API_BASE}/api/v1/users/locations/reverse?lat=${lat}&lng=${lng}`,
      `${API_BASE}/api/v1/locations/reverse?latitude=${lat}&longitude=${lng}`,
    ];
    for (const url of getCandidates) {
      const road = await tryFetch(url);
      if (road) return road;
    }

    // 2) POST JSON 바디를 요구하는 경우
    const postCandidates = [
      `${API_BASE}/api/v1/geo/reverse`,
      `${API_BASE}/api/v1/users/locations/reverse`,
      `${API_BASE}/api/v1/locations/reverse`,
    ];
    const bodies = [
      { lat, lng },
      { latitude: lat, longitude: lng },
    ];
    for (const url of postCandidates) {
      for (const body of bodies) {
        const road = await tryFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (road) return road;
      }
    }

    // 전부 실패 → 자동 채움 생략
    return "";
  }

  // 주소 → 좌표: 등록/수정 시 좌표가 비어 있으면 보강
  async function geocode_road(road) {
    const qs = encodeURIComponent(road);
    const candidates = [
      (q) => `/api/v1/geo/geocode?query=${q}`,
      (q) => `/api/v1/users/locations/geocode?roadAddressName=${q}`,
      (q) => `/api/v1/locations/geocode?roadAddressName=${q}`,
    ];
    for (const build of candidates) {
      try {
        const r = await fetch(API_BASE + build(qs), { credentials: "include" });
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

  function lock(el, on) {
    el?.setAttribute("aria-busy", on ? "true" : "false");
    if (el?.style) {
      el.style.pointerEvents = on ? "none" : "";
      el.style.opacity = on ? "0.7" : "";
    }
  }
});
