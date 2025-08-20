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

  let storeId = null; // ✅ 실제 가게 ID
  let menuId = null; // ✅ 등록된 메뉴 ID (등록 성공 시 저장)

  // 사진 추가 버튼 → input[type=file] 클릭
  photoTrigger.addEventListener("click", () => photoInput.click());

  // JWT 가져오기 (쿠키에서)
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  // ✅ 사장님 가게 ID 가져오기
  async function fetchStoreId() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getCookie("accessToken")}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        storeId = data.result.storeId;
        console.log("가져온 storeId:", storeId);
      } else {
        alert("가게 정보를 불러올 수 없습니다.");
      }
    } catch (err) {
      console.error("가게 정보 조회 오류", err);
    }
  }

  // ✅ 메뉴 설명 자동 생성
  async function generateDescription() {
    const name = document.getElementById("menu-name").value.trim();
    const file = photoInput.files[0];
    if (!name || !file) {
      alert("메뉴명과 이미지를 모두 입력해주세요.");
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
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        descTextarea.value = data.result;
      } else {
        alert("설명 생성 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("설명 생성 중 오류", err);
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  // ✅ 메뉴 등록
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!storeId) {
      alert("가게 ID를 찾을 수 없습니다. 다시 시도해주세요.");
      return;
    }

    const name = document.getElementById("menu-name").value.trim();
    const price = parseInt(priceInput.value, 10) || 0;
    const discountPercent =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    const description = descTextarea.value.trim();
    const file = photoInput.files[0];
    const discountPrice = Math.round(price * (1 - discountPercent / 100));

    const createDto = {
      name,
      price,
      discountPercent,
      discountPrice,
      description,
      quantity: 10,
    };

    const formData = new FormData();
    formData.append(
      "create",
      new Blob([JSON.stringify(createDto)], { type: "application/json" })
    );
    if (file) {
      formData.append("menuImage", file);
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/menu`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCookie("accessToken")}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        menuId = data.result.menuId; // ✅ 등록된 메뉴 ID 저장
        alert("메뉴가 성공적으로 등록되었습니다!");
      } else {
        alert("메뉴 등록 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("메뉴 등록 중 오류", err);
      alert("네트워크 오류가 발생했습니다.");
    }
  });

  // ✅ 할인율 서버 반영
  async function updateDiscountOnServer(newDiscount) {
    if (!menuId) {
      console.warn("menuId 없음, 등록 후에만 수정 가능");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/menus/${menuId}/discountPercent`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("accessToken")}`,
          },
          body: JSON.stringify({ changedValue: newDiscount }),
        }
      );

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        console.log("할인율 수정 성공:", data.result);
      } else {
        alert("할인율 수정 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("할인율 수정 오류", err);
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  // ✅ 최종 가격 갱신
  function updateFinalPrice(newDiscount) {
    const price = parseInt(priceInput.value, 10) || 0;
    const discountPrice = Math.round(price * (1 - newDiscount / 100));
    finalPriceOutput.textContent = `${discountPrice.toLocaleString()} 원`;
  }

  // 스텝퍼 이벤트 연결
  decBtn.addEventListener("click", () => {
    let current =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    if (current > 0) {
      const newVal = current - 1;
      discountDisplay.textContent = `${newVal}%`;
      updateFinalPrice(newVal);
      updateDiscountOnServer(newVal);
    }
  });

  incBtn.addEventListener("click", () => {
    let current =
      parseInt(discountDisplay.textContent.replace("%", ""), 10) || 0;
    if (current < 100) {
      const newVal = current + 1;
      discountDisplay.textContent = `${newVal}%`;
      updateFinalPrice(newVal);
      updateDiscountOnServer(newVal);
    }
  });

  // ✅ 페이지 로드 시 가게 ID 불러오기
  fetchStoreId();
});
