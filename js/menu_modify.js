document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";

  // URL 파라미터
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  const menuId = params.get("menuId");

  // 요소 선택
  const nameInput = document.querySelector("#menu-name");
  const priceInput = document.querySelector("#menu-price");
  const finalPriceOutput = document.querySelector("#final-price");
  const discountDisplay = document.querySelector("#discount-display");
  const discountDecBtn = document.querySelector('[data-action="discount-dec"]');
  const discountIncBtn = document.querySelector('[data-action="discount-inc"]');
  const photoInput = document.getElementById("photo-input");
  const photoTrigger = document.getElementById("photo-trigger");
  const descTextarea = document.querySelector("#menu-desc");

  let uploadedFile = null;

  // 숫자 포맷팅
  function formatCurrency(num) {
    return num.toLocaleString("ko-KR") + "원";
  }

  // 최종 가격 업데이트
  function updateFinalPrice() {
    const basePrice = parseInt(priceInput.value || 0, 10);
    const discount = parseInt(discountDisplay.textContent.replace("%", ""), 10);
    const discounted = Math.floor(basePrice * (1 - discount / 100));
    if (finalPriceOutput) {
      finalPriceOutput.textContent = formatCurrency(discounted);
    }
  }

  // ✅ 메뉴 상세 불러오기
  async function loadMenuDetail() {
    try {
      const token = getCookie("accessToken");
      const res = await fetch(
        `${API_BASE}/api/v1/store/${storeId}/menus/${menuId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }
      );

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const menu = data.result;

        if (nameInput) nameInput.value = menu.name || "";
        if (priceInput) priceInput.value = menu.price || 0;
        if (discountDisplay)
          discountDisplay.textContent = (menu.discountPercent || 0) + "%";
        if (descTextarea) descTextarea.value = menu.description || "";

        if (menu.menuImage) {
          let imgUrl = menu.menuImage;
          if (!imgUrl.startsWith("http")) {
            imgUrl = `${API_BASE}${imgUrl}`;
          }
          photoTrigger.innerHTML = `
            <img src="${imgUrl}" 
                 alt="메뉴 사진"
                 style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
          `;
        } else {
          photoTrigger.innerHTML = `
            <img src="../images/placeholder.png"
                 alt="기본 이미지"
                 style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
          `;
        }

        updateFinalPrice();
      } else {
        alert("메뉴 정보를 불러오지 못했습니다.");
      }
    } catch (err) {
      console.error("🚨 메뉴 상세 불러오기 실패:", err);
    }
  }

  loadMenuDetail(); // ✅ 실행

  if (priceInput) {
    priceInput.addEventListener("input", updateFinalPrice);
  }

  // ✅ AI 설명 자동 생성 함수
  async function generateAiDescription() {
    const menuName = nameInput.value.trim();
    if (!menuName || !uploadedFile) return;

    const formData = new FormData();
    formData.append(
      "request",
      new Blob([JSON.stringify({ name: menuName })], {
        type: "application/json",
      })
    );
    formData.append("menuImage", uploadedFile);

    try {
      const res = await fetch(`${API_BASE}/api/v1/menus/description`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getCookie("accessToken")}` },
        body: formData,
        credentials: "include",
      });

      const raw = await res.text();
      console.log("📥 AI 응답 RAW:", raw);

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        console.error("⚠️ JSON 파싱 실패");
        return;
      }

      if (res.ok && data.isSuccess) {
        descTextarea.value = data.result; // ✅ 무조건 덮어쓰기
        console.log("✅ AI 설명 생성 완료:", data.result);
      } else {
        console.warn("❌ 설명 생성 실패:", data.message);
      }
    } catch (err) {
      console.error("🚨 AI 설명 생성 오류", err);
    }
  }

  // 사진 업로드 (미리보기 + AI)
  photoTrigger.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      photoInput.value = "";
      return;
    }

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      photoTrigger.innerHTML = `
        <img src="${e.target.result}" 
             alt="메뉴 사진" 
             style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
      `;
    };
    reader.readAsDataURL(file);

    if (nameInput.value.trim()) generateAiDescription();
  });

  // 메뉴명 입력 시에도 AI 실행
  nameInput.addEventListener("input", () => {
    if (uploadedFile && nameInput.value.trim()) {
      generateAiDescription();
    }
  });

  // 할인율 스텝퍼
  if (discountDecBtn && discountIncBtn && discountDisplay) {
    discountDecBtn.addEventListener("click", () => {
      let val = parseInt(discountDisplay.textContent.replace("%", ""), 10);
      if (val > 0) {
        discountDisplay.textContent = --val + "%";
        updateFinalPrice();
      }
    });
    discountIncBtn.addEventListener("click", () => {
      let val = parseInt(discountDisplay.textContent.replace("%", ""), 10);
      if (val < 100) {
        discountDisplay.textContent = ++val + "%";
        updateFinalPrice();
      }
    });
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

    if (close <= open) {
      return now >= open || now <= close;
    }
    return now >= open && now <= close;
  }

  // ✅ 메뉴 수정 제출
  const form = document.querySelector("#menu-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const currentDiscount = parseInt(
        discountDisplay.textContent.replace("%", ""),
        10
      );
      const token = getCookie("accessToken");
      if (!token) {
        alert("로그인이 필요합니다.");
        return;
      }

      const payload = {
        name: nameInput.value,
        price: Number(priceInput.value),
        discountPercent: currentDiscount,
        description: descTextarea.value,
      };

      const formData = new FormData();
      formData.append(
        "update",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );

      if (photoInput.files[0]) {
        formData.append("menuImage", photoInput.files[0]);
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/v1/store/${storeId}/menus/${menuId}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            credentials: "include",
          }
        );

        const data = await res.json();
        console.log("📌 응답 상태:", res.status);
        console.log("📌 응답 본문:", data);

        if (res.ok && data.isSuccess) {
          alert("메뉴가 수정되었습니다.");

          // ✅ 가게 상태 조회 후 영업중/영업종료 분기
          try {
            const storeRes = await fetch(
              `${API_BASE}/api/v1/store/${storeId}`,
              {
                headers: {
                  Authorization: `Bearer ${getCookie("accessToken")}`,
                },
                credentials: "include",
              }
            );
            const storeData = await storeRes.json();

            if (storeRes.ok && storeData.isSuccess) {
              const store = storeData.result;
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
        } else {
          alert("수정 실패: " + data.message);
        }
      } catch (err) {
        console.error("메뉴 수정 에러:", err);
        alert("에러가 발생했습니다.");
      }
    });
  }

  // ✅ 뒤로가기 버튼
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

  // ✅ 쿠키 가져오기
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }
});
