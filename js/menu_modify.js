document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";

  // URL 파라미터
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  const menuId = params.get("menuId");
  const name = params.get("name") || "";
  const price = parseInt(params.get("price") || 0, 10);
  let menuImage = params.get("menuImage") || "";

  // 요소 선택
  const nameInput = document.querySelector("#menu-name");
  const priceInput = document.querySelector("#menu-price");
  const finalPriceOutput = document.querySelector("#final-price");
  const discountDisplay = document.querySelector("#discount-display");
  const discountDecBtn = document.querySelector('[data-action="discount-dec"]');
  const discountIncBtn = document.querySelector('[data-action="discount-inc"]');
  const photoInput = document.getElementById("photo-input");
  const photoTrigger = document.getElementById("photo-trigger");

  // 값 채워넣기
  if (nameInput) nameInput.value = name;
  if (priceInput) priceInput.value = price;
  if (discountDisplay) discountDisplay.textContent = "0%";

  // 기존 이미지 표시
  if (menuImage) {
    // 절대경로가 아니면 API_BASE 붙이기
    if (!menuImage.startsWith("http")) {
      menuImage = `${API_BASE}${menuImage}`;
    }

    photoTrigger.innerHTML = `
    <img src="${menuImage}" 
         alt="메뉴 사진"
         style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
  `;
  } else {
    // 기본 placeholder
    photoTrigger.innerHTML = `
    <img src="../images/placeholder.png"
         alt="기본 이미지"
         style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
  `;
  }

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
  updateFinalPrice();

  if (priceInput) {
    priceInput.addEventListener("input", updateFinalPrice);
  }

  // 사진 업로드 (미리보기)
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
             alt="메뉴 사진" 
             style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
      `;
    };
    reader.readAsDataURL(file);
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

      // JSON payload
      const payload = {
        name: nameInput.value,
        price: Number(priceInput.value),
        discountPercent: currentDiscount,
      };

      // FormData 구성
      const formData = new FormData();
      formData.append(
        "update",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );

      // 새로 업로드한 이미지가 있으면 파일만 append
      if (photoInput.files[0]) {
        formData.append("menuImage", photoInput.files[0]);
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/v1/store/${storeId}/menus/${menuId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
            credentials: "include",
          }
        );

        const data = await res.json();
        console.log("📌 응답 상태:", res.status);
        console.log("📌 응답 본문:", data);
        if (res.ok && data.isSuccess) {
          alert("메뉴가 수정되었습니다.");
          // 수정 완료 후 → 기본은 menu_off로 이동
          window.location.href = `menu_off.html?storeId=${storeId}`;
        } else {
          alert("수정 실패: " + data.message);
        }
      } catch (err) {
        console.error("메뉴 수정 에러:", err);
        alert("에러가 발생했습니다.");
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

    // 자정을 넘기는 경우 처리
    if (close <= open) {
      return now >= open || now <= close;
    }
    return now >= open && now <= close;
  }

  // ✅ 뒤로가기 버튼 → 영업 상태에 따라 이동
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

  // 쿠키 읽기
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }
});
