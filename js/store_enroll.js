(function () {
  const pad2 = (n) => String(n).padStart(2, "0");
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const mins = Array.from({ length: 60 }, (_, i) => pad2(i));
  const aps = ["am", "pm"];

  const to24h = (h12, ap) => {
    let h = parseInt(h12, 10);
    if (ap === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return pad2(h);
  };
  const from24h = (hh) => {
    const n = parseInt(hh, 10);
    const ap = n >= 12 ? "pm" : "am";
    let h = n % 12;
    if (h === 0) h = 12;
    return { h12: String(h), ap };
  };

  document.addEventListener("DOMContentLoaded", () => {
    const wheel = document.getElementById("time-wheel");
    if (!wheel) return;

    const hourCol = wheel.querySelector(".hour");
    const minCol = wheel.querySelector(".minute");
    const apCol = wheel.querySelector(".ampm");

    const openInput = document.getElementById("open-time");
    const closeInput = document.getElementById("close-time");
    let targetInput = null;

    const getItemH = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--item-h"
      );
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v > 0) return v;
      const sample = wheel.querySelector(".item");
      if (sample) {
        const h = sample.getBoundingClientRect().height;
        if (h) return h;
      }
      return 34;
    };

    const buildColumn = (col, values) => {
      const spacer = ["", ""];
      const items = [...spacer, ...values, ...spacer];
      col.innerHTML = items.map((v) => `<div class="item">${v}</div>`).join("");
      centerToIndex(col, 2);
      markActive(col);
    };

    const centerOffsetOf = (col) => col.clientHeight / 2 - getItemH() / 2;
    const indexAtCenter = (col) => {
      const itemH = getItemH();
      const centerOffset = centerOffsetOf(col);
      return Math.round((col.scrollTop + centerOffset) / itemH);
    };
    const valueAtCenter = (col) => {
      const i = indexAtCenter(col);
      const els = col.querySelectorAll(".item");
      return els[i] ? els[i].textContent.trim() : "";
    };
    const centerToIndex = (col, idx) => {
      const itemH = getItemH();
      const centerOffset = centerOffsetOf(col);
      col.scrollTop = idx * itemH - centerOffset;
    };
    const setColToValue = (col, values, value) => {
      const i = values.indexOf(value);
      if (i < 0) return;
      centerToIndex(col, i + 2);
      markActive(col);
    };
    const markActive = (col) => {
      const i = indexAtCenter(col);
      const items = col.querySelectorAll(".item");
      items.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
    };

    buildColumn(hourCol, hours);
    buildColumn(minCol, mins);
    buildColumn(apCol, aps);

    const debounce = (fn, d = 120) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), d);
      };
    };

    const updateFromCenter = () => {
      [hourCol, minCol, apCol].forEach(markActive);
      if (!targetInput) return;
      const h = valueAtCenter(hourCol);
      const m = valueAtCenter(minCol);
      const a = valueAtCenter(apCol);
      if (h && m && a) targetInput.value = `${to24h(h, a)}:${m}`;
    };

    const onStop = debounce(updateFromCenter, 120);
    [hourCol, minCol, apCol].forEach((col) => {
      col.addEventListener("scroll", onStop, { passive: true });
    });

    function clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }
    const firstValueIdx = 2;
    const lastValueIdx = (col) => col.querySelectorAll(".item").length - 3;

    function stepOnce(col, dir) {
      const cur = indexAtCenter(col);
      const next = clamp(cur + dir, firstValueIdx, lastValueIdx(col));
      centerToIndex(col, next);
      markActive(col);
      updateFromCenter();
    }
    function onWheelStep(e) {
      e.preventDefault();
      const col = e.currentTarget;
      if (col._wheelLock) return;
      col._wheelLock = true;
      const dir = e.deltaY > 0 ? +1 : -1;
      stepOnce(col, dir);
      setTimeout(() => {
        col._wheelLock = false;
      }, 140);
    }

    [hourCol, minCol, apCol].forEach((col) => {
      col.addEventListener("wheel", onWheelStep, { passive: false });
      col.tabIndex = 0;
      col.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          e.preventDefault();
          stepOnce(col, +1);
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault();
          stepOnce(col, -1);
        }
      });
    });

    function showWheelFor(inputEl) {
      targetInput = inputEl;
      const rect = inputEl.getBoundingClientRect();
      const host = document.querySelector("main")?.getBoundingClientRect() || {
        top: 0,
      };
      wheel.style.left = `50%`;
      wheel.style.transform = `translateX(-50%)`;
      wheel.style.top = `${rect.bottom - host.top + 14}px`;

      const init = inputEl.value || "08:00";
      const [hh, mm] = init.split(":");
      const { h12, ap } = from24h(hh);
      setColToValue(hourCol, hours, h12);
      setColToValue(minCol, mins, (mm || "00").padStart(2, "0"));
      setColToValue(apCol, aps, ap);

      wheel.hidden = false;
      updateFromCenter();
    }
    function hideWheel() {
      wheel.hidden = true;
      targetInput = null;
    }

    [openInput, closeInput].forEach((inp) => {
      if (!inp) return;
      inp.readOnly = true;
      const openHandler = (e) => {
        e.preventDefault();
        showWheelFor(inp);
      };
      inp.addEventListener("mousedown", openHandler);
      inp.addEventListener("touchstart", openHandler, { passive: false });
      inp.addEventListener("focus", () => showWheelFor(inp));
      inp.addEventListener("click", openHandler);
    });

    document.addEventListener("click", (e) => {
      if (wheel.hidden) return;
      const insideWheel = wheel.contains(e.target);
      const isInputs = e.target === openInput || e.target === closeInput;
      if (!insideWheel && !isInputs) hideWheel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !wheel.hidden) hideWheel();
    });

    window.addEventListener("resize", () => {
      [hourCol, minCol, apCol].forEach(markActive);
    });
  });
})();

/* ===== 카카오 SDK 로딩 ===== */
(function loadKakaoSDK() {
  const key = window.RUNTIME_CONFIG?.KAKAO_JS_KEY;
  if (!key) {
    console.error("❌ KAKAO_JS_KEY가 config.js에 정의되지 않았습니다.");
    return;
  }
  const script = document.createElement("script");
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
  script.onload = () => {
    kakao.maps.load(() => {
      console.log("✅ Kakao SDK 초기화 완료");

      initStoreForm();

      // ✅ SDK 로드된 뒤에만 가게 정보 불러오기
      const params = new URLSearchParams(window.location.search);
      const storeId = params.get("storeId");
      if (storeId) loadStoreInfo(storeId);
    });
  };
  document.head.appendChild(script);
})();

/* ===== Kakao 유틸 ===== */
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
function kakaoReverse(lat, lng) {
  return new Promise((resolve) => {
    const g = new kakao.maps.services.Geocoder();
    g.coord2Address(Number(lng), Number(lat), (r, status) => {
      if (status !== kakao.maps.services.Status.OK || !r?.length)
        return resolve("");
      resolve(
        r[0].road_address?.address_name || r[0].address?.address_name || ""
      );
    });
  });
}
function setFromKakaoDoc(doc, inputEl) {
  inputEl.value =
    doc.road_address_name || doc.address_name || doc.place_name || "";
}

/* ===== JWT 쿠키 유틸 ===== */
function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}
function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decode 실패", e);
    return null;
  }
}

/* ===== 가게 등록 폼 처리 ===== */

// =====================
// 📌 폼 초기화 & 이벤트
// =====================
function initStoreForm() {
  const form = document.querySelector(".enroll-form");
  if (!form) return;

  const addrInput = document.getElementById("store-location");
  const nameInput = document.getElementById("store-name");
  const openInput = document.getElementById("open-time");
  const closeInput = document.getElementById("close-time");
  const search_icon = document.querySelector(".search_icon");

  // ✅ 가게 대표 사진 업로드
  const photoInput = document.getElementById("photo-input");
  const photoTrigger = document.getElementById("photo-trigger");

  if (photoInput && photoTrigger) {
    photoTrigger.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드 가능합니다.");
        photoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        photoTrigger.innerHTML = `
          <img src="${e.target.result}" 
               alt="가게 사진" 
               style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
        `;
      };
      reader.readAsDataURL(file);
    });
  }

  window.current_lat = null;
  window.current_lng = null;

  // 📌 주소 검색 또는 현재 위치
  search_icon?.addEventListener("click", async () => {
    const q = addrInput.value.trim();
    if (q) {
      const results = await kakaoSearchKeyword(q).catch(() => []);
      if (!results.length) return alert("검색 결과가 없습니다.");
      openResultPanel(results, (doc) => {
        setFromKakaoDoc(doc, addrInput);
        if (doc.y && doc.x) {
          window.current_lat = Number(doc.y);
          window.current_lng = Number(doc.x);
        }
      });
    } else {
      if (!navigator.geolocation) return alert("위치 접근 불가");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          window.current_lat = pos.coords.latitude;
          window.current_lng = pos.coords.longitude;
          const road = await kakaoReverse(
            window.current_lat,
            window.current_lng
          ).catch(() => "");
          if (road) addrInput.value = road;
        },
        () => alert("현재 위치를 가져올 수 없습니다."),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  });

  // 📌 폼 제출 이벤트
  // =====================
  // 📌 폼 제출 이벤트
  // =====================
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getCookie("accessToken");
    if (!token) {
      alert("❌ 인증 토큰이 없습니다. 먼저 접속해주세요.");
      return;
    }

    // JWT 디코드해서 현재 로그인한 계정 확인
    const user = decodeJwt(token);
    const currentOwner = user?.sub; // 이메일 (예: test-owner@gmail.com)

    const name = nameInput.value.trim();
    let addr = addrInput.value.trim();
    const openTime = openInput.value.trim() + ":00";
    const closeTime = closeInput.value.trim() + ":00";
    const imageFile = document.getElementById("photo-input")?.files[0] || null;

    // 주소가 비어있으면 reverse geocoding 시도
    if (!addr) {
      try {
        addr = await kakaoReverse(window.current_lat, window.current_lng);
        if (!addr) {
          alert("주소를 확인할 수 없습니다. 검색 후 다시 시도해주세요.");
          return;
        }
        addrInput.value = addr;
      } catch (e) {
        console.error("주소 변환 실패:", e);
        alert("주소를 확인할 수 없습니다.");
        return;
      }
    }

    // ✅ storeId 확인 로직
    let params = new URLSearchParams(window.location.search);
    let storeId = params.get("storeId");

    if (!storeId) {
      const savedId = localStorage.getItem("myStoreId");
      const savedOwner = localStorage.getItem("myStoreOwner");

      if (savedId && savedOwner === currentOwner) {
        storeId = savedId;
      } else {
        localStorage.removeItem("myStoreId");
        localStorage.removeItem("myStoreOwner");
      }
    }

    // ✅ FormData 구성
    const formData = new FormData();
    const payload = {
      name,
      roadAddressName: addr,
      latitude: window.current_lat,
      longitude: window.current_lng,
      openingTime: openTime,
      closingTime: closeTime,
    };

    formData.append(storeId ? "update" : "create", JSON.stringify(payload));
    if (imageFile) {
      formData.append("storeImage", imageFile);
    }

    // ✅ URL & METHOD 결정
    const url = storeId
      ? `https://api-whynotbuy.store/api/v1/store/${storeId}`
      : `https://api-whynotbuy.store/api/v1/store`;
    const method = storeId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      console.log("📌 서버 응답:", data);

      if (res.ok && data.isSuccess) {
        const id = storeId || data.result.storeId;

        // 🚩 등록 성공 시 계정별로 storeId 저장
        if (!storeId && data.result.storeId) {
          localStorage.setItem("myStoreId", data.result.storeId);
          localStorage.setItem("myStoreOwner", currentOwner);
        }

        alert(storeId ? "✅ 가게 정보 수정 성공!" : "✅ 가게 등록 성공!");

        // ✅ 영업시간 체크 후 menu_on / menu_off 분기
        const open = openInput.value.trim() || "00:00";
        const close = closeInput.value.trim() || "23:59";

        const now = new Date();
        const nowStr = now.toTimeString().slice(0, 5); // "HH:MM"

        if (isWithinBusinessHours(nowStr, open, close)) {
          window.location.href = `menu_on.html?storeId=${id}`;
        } else {
          window.location.href = `menu_off.html?storeId=${id}`;
        }
      } else {
        // 🚩 이미 가게 보유 (409 Conflict)
        if (res.status === 409 || data.code === "STORE409_1") {
          alert(
            "이미 가게를 보유하고 있습니다. 가게 관리 화면으로 이동합니다."
          );

          try {
            const myRes = await fetch(
              "https://api-whynotbuy.store/api/v1/store/me",
              {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
              }
            );
            const myData = await myRes.json();

            if (myRes.ok && myData.isSuccess && myData.result) {
              const myId = myData.result.storeId;

              // localStorage에 저장
              localStorage.setItem("myStoreId", myId);
              localStorage.setItem("myStoreOwner", currentOwner);

              // 가게 관리 페이지로 이동
              window.location.href = `menu_off.html?storeId=${myId}`;
            } else {
              alert("❌ 등록된 가게 ID를 불러올 수 없습니다.");
            }
          } catch (err) {
            console.error("가게 조회 실패:", err);
            alert("❌ 내 가게 정보를 불러오는데 실패했습니다.");
          }
        } else {
          alert("❌ 실패: " + (data.message || "알 수 없는 오류"));
        }
      }
    } catch (err) {
      console.error("가게 등록/수정 오류", err);
      alert("서버 오류가 발생했습니다.");
    }
  });
}
function isWithinBusinessHours(current, open, close) {
  const [ch, cm] = current.split(":").map(Number);
  const [oh, om] = open.split(":").map(Number);
  const [xh, xm] = close.split(":").map(Number);

  if ([ch, cm, oh, om, xh, xm].some(isNaN)) {
    console.warn("🚨 시간 파싱 오류", { current, open, close });
    return false;
  }

  const curMin = ch * 60 + cm;
  const openMin = oh * 60 + om;
  const closeMin = xh * 60 + xm;

  if (openMin <= closeMin) {
    // 같은 날 안에서 열고 닫음
    return curMin >= openMin && curMin < closeMin;
  } else {
    // 자정을 넘기는 경우
    return curMin >= openMin || curMin < closeMin;
  }
}

// ======================
// 📌 기존 가게 정보 불러오기
// ======================
// ======================
// 📌 기존 가게 정보 불러오기 (수정된 버전)
// ======================
async function loadStoreInfo(storeId) {
  const token = getCookie("accessToken");
  if (!token) return;

  try {
    const res = await fetch(
      `https://api-whynotbuy.store/api/v1/store/${storeId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      }
    );

    if (!res.ok) throw new Error("가게 정보를 불러올 수 없습니다.");
    const data = await res.json();

    if (data.isSuccess && data.result) {
      const store = data.result;
      console.log("📌 불러온 가게 정보:", store);

      // ✅ 기본 필드 채우기
      document.getElementById("store-name").value = store.name || "";
      document.getElementById("open-time").value =
        store.openingTime?.slice(0, 5) || "";
      document.getElementById("close-time").value =
        store.closingTime?.slice(0, 5) || "";

      window.current_lat = store.latitude;
      window.current_lng = store.longitude;

      // ✅ 주소 세팅 로직 보강
      let addr =
        store.roadAddressName || store.addressName || store.address || "";

      // 주소가 없으면 placeholder 먼저 표시
      const addrInput = document.getElementById("store-location");
      if (!addr || addr.trim() === "") {
        addrInput.value = "주소 로딩중...";

        if (store.latitude && store.longitude) {
          try {
            const kakaoAddr = await kakaoReverse(
              store.latitude,
              store.longitude
            );
            if (kakaoAddr) {
              addr = kakaoAddr;
            }
          } catch (e) {
            console.warn("주소 변환 실패:", e);
          }
        }
      }

      // 최종 주소 반영
      addrInput.value = addr || "주소 정보 없음";

      // ✅ 이미지 세팅
      if (store.imageUrl) {
        const photoTrigger = document.getElementById("photo-trigger");
        if (photoTrigger) {
          let imageUrl = store.imageUrl;
          if (!imageUrl.startsWith("http")) {
            imageUrl = `https://api-whynotbuy.store${imageUrl}`;
          }

          photoTrigger.innerHTML = `
            <img src="${imageUrl}" 
                 alt="가게 사진" 
                 style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
          `;
        }
      }
    }
  } catch (err) {
    console.error(err);
    alert("가게 정보를 불러오는데 실패했습니다.");
  }
}
// ======================
// 📌 쿠키에서 토큰 가져오기
// ======================
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

/* ===== 주소 선택 패널 ===== */
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
          const title =
            r.place_name || r.road_address_name || r.address_name || "-";
          const road = r.road_address_name || r.address_name || "";
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
