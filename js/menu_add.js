document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";

  const form = document.getElementById("menu-form");
  const photoInput = document.getElementById("photo-input");
  const photoTrigger = document.getElementById("photo-trigger");
  const descTextarea = document.getElementById("menu-desc");
  const discountDisplay = document.getElementById("discount-display");
  const decBtn = document.querySelector('[data-action="discount-dec"]');
  const incBtn = document.querySelector('[data-action="discount-inc"]');
  const finalPriceOutput = document.getElementById("final-price");
  const priceInput = document.getElementById("menu-price");

  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  if (!storeId) {
    alert("storeId가 없습니다. 다시 시도해주세요.");
    return;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  // ✅ 영업 여부 판별 함수
  function isStoreOpen(store) {
    if (!store.openingTime || !store.closingTime) return false;

    const now = new Date();

    const [openH, openM, openS] = store.openingTime.split(":").map(Number);
    const [closeH, closeM, closeS] = store.closingTime.split(":").map(Number);

    const open = new Date();
    open.setHours(openH, openM, openS, 0);

    const close = new Date();
    close.setHours(closeH, closeM, closeS, 0);

    // 자정을 넘기는 경우 처리
    if (close <= open) {
      return now >= open || now <= close;
    }
    return now >= open && now <= close;
  }

  // ✅ 뒤로가기 버튼 → 영업 상태 따라 이동
  const backBtn = document.querySelector(".top_bar__back");
  if (backBtn) {
    backBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
          headers: { Authorization: `Bearer ${getCookie("accessToken")}` },
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.isSuccess) {
          const store = data.result;
          if (isStoreOpen(store)) {
            window.location.href = `menu_on.html?storeId=${storeId}`;
          } else {
            window.location.href = `menu_off.html?storeId=${storeId}`;
          }
        } else {
          window.location.href = `menu_off.html?storeId=${storeId}`;
        }
      } catch (err) {
        console.error("가게 상태 조회 오류", err);
        window.location.href = `menu_off.html?storeId=${storeId}`;
      }
    });
  }

  // ✅ 사진 선택 버튼 → input 클릭
  photoTrigger.addEventListener("click", () => photoInput.click());

  // ✅ 사진 선택 시 미리보기 + AI 설명 생성
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      photoInput.value = "";
      return;
    }

    // 미리보기
    const reader = new FileReader();
    reader.onload = (e) => {
      photoTrigger.innerHTML = `<img src="${e.target.result}" alt="메뉴 사진" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
    };
    reader.readAsDataURL(file);

    // ✅ AI 메뉴 설명 자동 생성 호출
    const name = document.getElementById("menu-name").value.trim();
    if (!name) {
      alert("메뉴명을 먼저 입력해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("request", name);
    formData.append("menuImage", file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/menus/description`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCookie("accessToken")}`,
        },
        body: formData,
        credentials: "include",
      });

      const rawText = await res.text();
      console.log("📥 AI 응답 RAW:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error("⚠️ JSON 파싱 실패:", e);
        alert("서버 응답이 올바른 JSON이 아닙니다.");
        return;
      }

      if (res.ok && data.isSuccess) {
        descTextarea.value = data.result;
        console.log("✅ AI 설명 생성 완료:", data.result);
      } else {
        alert("❌ 설명 생성 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("🚨 AI 설명 생성 중 오류", err);
      alert("서버 오류가 발생했습니다.");
    }
  });

  // ✅ 최종 가격 갱신
  function updateFinalPrice(newDiscount) {
    const price = parseInt(priceInput.value, 10) || 0;
    const discountPrice = Math.round(price * (1 - newDiscount / 100));
    finalPriceOutput.textContent = `${discountPrice.toLocaleString()} 원`;
  }

  decBtn.addEventListener("click", () => {
    let current =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    if (current > 0) {
      const newVal = current - 1;
      discountDisplay.textContent = `${newVal}%`;
      updateFinalPrice(newVal);
    }
  });

  incBtn.addEventListener("click", () => {
    let current =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    if (current < 100) {
      const newVal = current + 1;
      discountDisplay.textContent = `${newVal}%`;
      updateFinalPrice(newVal);
    }
  });

  priceInput.addEventListener("input", () => {
    const discountPercent =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    updateFinalPrice(discountPercent);
  });

  // ✅ 메뉴 등록
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("menu-name").value.trim();
    const price = parseInt(priceInput.value, 10) || 0;
    const discountPercent =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    const description = descTextarea.value.trim();
    const file = photoInput.files[0];
    const discountPrice = Math.round(price * (1 - discountPercent / 100));

    if (!name || !price || !file) {
      alert("메뉴명, 가격, 이미지를 모두 입력해주세요.");
      return;
    }

    const createDto = {
      name,
      price,
      discountPercent,
      discountPrice,
      description,
      quantity: 0,
    };

    const formData = new FormData();
    formData.append("create", JSON.stringify(createDto));
    if (file) formData.append("menuImage", file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/menu`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCookie("accessToken")}`,
        },
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        alert("✅ 메뉴가 성공적으로 등록되었습니다!");
        window.location.href = `menu_off.html?storeId=${storeId}`;
      } else {
        alert("❌ 메뉴 등록 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("메뉴 등록 중 오류", err);
      alert("서버 오류가 발생했습니다.");
    }
  });
});
