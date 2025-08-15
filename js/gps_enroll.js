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
  const addr_input = inputs[1]; // 주소(표시용 텍스트)
  const search_icon = document.querySelector(".search_icon");
  const btn_delete = document.querySelector(".delete_button");
  const btn_submit = document.querySelector(".submit_button");
  const title_el = document.querySelector(".top_title");

  if (!alias_input || !addr_input || !btn_submit) {
    console.error("gps_enroll: 필수 요소 누락");
    return;
  }

  // 좌표는 내부 상태로 관리(숨김 input 없어도 가능)
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
  // 검색 아이콘: 브라우저 현재 위치 사용(간단 버전)
  search_icon?.addEventListener("click", () => {
    if (!navigator.geolocation)
      return alert("이 브라우저는 위치 접근을 지원하지 않습니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        current_lat = pos.coords.latitude;
        current_lng = pos.coords.longitude;
        // 주소 입력칸에는 좌표를 표시(지오코딩이 없다면 이렇게라도 보여주자)
        addr_input.value = `(${current_lat.toFixed(5)}, ${current_lng.toFixed(
          5
        )})`;
        if (!alias_input.value.trim()) alias_input.value = "내 위치";
      },
      (err) => {
        console.warn("geolocation error", err);
        alert("현재 위치를 가져오지 못했습니다. 위치 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // 등록/수정 제출
  btn_submit.addEventListener("click", async (e) => {
    e.preventDefault();

    const name = alias_input.value.trim();

    // 1) 주소칸에서 좌표 패턴을 우선 파싱
    const parsed = parse_latlng_from_text(addr_input.value);
    if (parsed) {
      current_lat = parsed.lat;
      current_lng = parsed.lng;
    }

    if (!name) return alert("주소지 별칭을 입력해 주세요.");
    if (!is_finite_num(current_lat) || !is_finite_num(current_lng)) {
      return alert(
        "좌표가 없습니다. 검색 아이콘을 눌러 현재 위치를 가져오거나, (lat, lng) 형식으로 입력해 주세요."
      );
    }

    try {
      lock(btn_submit, true);

      const body = {
        name,
        latitude: Number(current_lat),
        longitude: Number(current_lng),
      };

      if (is_edit) {
        await api(`/api/v1/users/locations/${encodeURIComponent(edit_id)}`, {
          method: "PATCH", // 서버가 PUT이라면 PUT으로 교체
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
      alert("저장에 실패했습니다. 로그인/권한을 확인해 주세요.");
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
      alert("삭제에 실패했습니다. 로그인/권한을 확인해 주세요.");
    } finally {
      lock(btn_delete, false);
    }
  });

  // ===== 함수들 =====
  async function load_for_edit(id) {
    // 단건 조회가 명세에 없어서 목록에서 찾아 채움
    const list_json = await api("/api/v1/users/locations", { method: "GET" });
    const list = unwrap(list_json); // {isSuccess,result:{locationInfoList}} 대응

    const item = Array.isArray(list)
      ? list.find((x) => String(x.locationId ?? x.id) === String(id))
      : null;

    if (!item) throw new Error("NOT_FOUND");

    alias_input.value = item.locationName || item.name || "";
    current_lat = item.latitude;
    current_lng = item.longitude;
    addr_input.value = `(${Number(current_lat).toFixed(5)}, ${Number(
      current_lng
    ).toFixed(5)})`;
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
    // 지원 패턴 예: "37.123,127.456" / "(37.123, 127.456)" / "37.123 127.456"
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

  function lock(el, on) {
    el?.setAttribute("aria-busy", on ? "true" : "false");
    if (el?.style) {
      el.style.pointerEvents = on ? "none" : "";
      el.style.opacity = on ? "0.7" : "";
    }
  }
});
