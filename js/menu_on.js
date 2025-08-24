document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";

  const menuList = document.getElementById("menu-list");
  const menuTemplate = document.getElementById("menu-item-template");

  // ✅ 삭제 모달 관련
  const modal = document.getElementById("delete-modal");
  const overlay = modal.querySelector(".modal__overlay");
  const cancelBtn = modal.querySelector("[data-role='cancel']");
  const confirmBtn = modal.querySelector("[data-role='confirm']");
  let deleteTarget = null;

  // ✅ storeId 가져오기
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");
  if (!storeId) {
    alert("storeId가 없습니다.");
    return;
  }

  // ✅ "다른 메뉴 추가하기" 버튼에 storeId 붙이기
  const fabAdd = document.querySelector(".fab-add");
  if (fabAdd) fabAdd.href = `menu_add.html?storeId=${storeId}`;

  // ✅ JWT 쿠키
  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }
  const token = getCookie("accessToken");

  // ✅ 메뉴 불러오기
  async function loadMenus() {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/store/${storeId}/menus?size=20&menuSortType=DISCOUNT`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok || !data.isSuccess) throw new Error(data.message);

      menuList.innerHTML = "";
      data.result.menus.forEach((menu) => renderMenu(menu));
    } catch (err) {
      console.error("메뉴 목록 불러오기 실패:", err);
      alert("메뉴를 불러오지 못했습니다.");
    }
  }

  // ✅ 메뉴 렌더링
  function renderMenu(menu) {
    const node = menuTemplate.content.cloneNode(true);
    const li = node.querySelector("li");
    li.dataset.id = menu.menuId;

    // 이름
    const nameEl = li.querySelector("[data-name]");
    if (nameEl.tagName === "H2") {
      nameEl.textContent = menu.name || "이름없음";
    } else {
      nameEl.innerText = menu.name || "이름없음";
    }

    // 원가
    li.querySelector("[data-origin-price]").textContent =
      menu.price != null ? `${menu.price.toLocaleString()}원` : "0원";

    // 할인율
    const discountEls = li.querySelectorAll("[data-discount]");
    const discountPercent = menu.discountPercent ?? 0;
    discountEls.forEach((el) => (el.textContent = `${discountPercent}%`));

    // 최종 가격
    let finalPrice;
    if (menu.discountPrice != null && menu.discountPrice > 0) {
      finalPrice = menu.discountPrice;
    } else if (menu.price != null && discountPercent > 0) {
      finalPrice = Math.floor(menu.price * (1 - discountPercent / 100));
    } else {
      finalPrice = menu.price ?? 0;
    }
    li.querySelector(
      "[data-sale-price]"
    ).textContent = `${finalPrice.toLocaleString()}원`;

    // 재고
    const stockEl = li.querySelector("[data-stock]");
    stockEl.textContent = menu.quantity ?? 0;

    // 이미지
    li.querySelector("[data-thumb]").src =
      menu.menuImage && menu.menuImage.trim() !== ""
        ? menu.menuImage.startsWith("http")
          ? menu.menuImage
          : `${API_BASE}${menu.menuImage}`
        : "../images/placeholder.png";

    li.querySelector("[data-thumb]").alt = menu.name || "메뉴 이미지";

    // "수정하기" 링크
    const editLink = li.querySelector(".menu-card__edit");
    if (editLink) {
      editLink.addEventListener("click", (e) => {
        e.preventDefault(); // a 태그 기본 이동 막기

        const params = new URLSearchParams({
          storeId,
          menuId: menu.menuId,
          name: menu.name || "",
          price: menu.price ?? 0,
          discountPercent: menu.discountPercent ?? 0,
          quantity: menu.quantity ?? 0,
          menuImage: menu.menuImage || "",
        });

        // ✅ 수정 페이지로 이동하면서 데이터 전달
        window.location.href = `menu_modify.html?${params.toString()}`;
      });
    }

    // ✅ 삭제 버튼
    li.querySelector(".menu-card__delete").addEventListener("click", () => {
      deleteTarget = li;
      modal.hidden = false;
    });

    // ✅ 할인율 스텝퍼
    const decBtn = li.querySelector('[data-action="discount-dec"]');
    const incBtn = li.querySelector('[data-action="discount-inc"]');
    const discountOutput = li.querySelector(".menu-card__discount-ctrl output");

    decBtn.addEventListener("click", () =>
      updateDiscount(li, menu.menuId, -1, discountOutput)
    );
    incBtn.addEventListener("click", () =>
      updateDiscount(li, menu.menuId, +1, discountOutput)
    );

    // ✅ 재고 스텝퍼
    const stockDec = li.querySelector('[data-action="decrement"]');
    const stockInc = li.querySelector('[data-action="increment"]');

    stockDec.addEventListener("click", () =>
      updateQuantity(li, menu.menuId, -1, stockEl)
    );
    stockInc.addEventListener("click", () =>
      updateQuantity(li, menu.menuId, +1, stockEl)
    );

    menuList.appendChild(node);
  }

  // ✅ 할인율 PATCH
  async function updateDiscount(li, menuId, diff, outputEl) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/menus/${menuId}/discountPercent`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ changedValue: diff }), // 🔥 증감값만 보냄
          credentials: "include",
        }
      );
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const updated = data.result;
        outputEl.textContent = `${updated.discountPercent}%`;
        li.querySelectorAll("[data-discount]").forEach((el) => {
          el.textContent = `${updated.discountPercent}%`;
        });
        // 최종가 갱신
        const originPrice = parseInt(
          li
            .querySelector("[data-origin-price]")
            .textContent.replace(/[^0-9]/g, "")
        );
        const finalPrice = Math.floor(
          originPrice * (1 - updated.discountPercent / 100)
        );
        li.querySelector(
          "[data-sale-price]"
        ).textContent = `${finalPrice.toLocaleString()}원`;
      } else {
        alert("할인율 변경 실패: " + data.message);
      }
    } catch (err) {
      console.error("할인율 변경 오류", err);
    }
  }

  // ✅ 재고 PATCH
  async function updateQuantity(li, menuId, diff, stockEl) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/menus/${menuId}/quantity`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ changedValue: diff }), // 🔥 증감값만 보냄
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        const updated = data.result;
        stockEl.textContent = updated.quantity;
      } else {
        alert("재고 변경 실패: " + data.message);
      }
    } catch (err) {
      console.error("재고 변경 오류", err);
    }
  }

  // ✅ 메뉴 삭제
  confirmBtn.addEventListener("click", async () => {
    if (!deleteTarget) return;
    const menuId = deleteTarget.dataset.id;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/store/${storeId}/menus/${menuId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include", // ✅ 쿠키 기반 인증 포함
        }
      );
      const data = await res.json();

      if (res.ok && data.isSuccess) {
        deleteTarget.remove();
        alert("삭제되었습니다.");
      } else {
        alert("삭제 실패: " + data.message);
      }
    } catch (err) {
      console.error("삭제 오류", err);
      alert("서버 오류로 삭제하지 못했습니다.");
    } finally {
      modal.hidden = true;
      deleteTarget = null;
    }
  });

  cancelBtn.addEventListener("click", () => {
    modal.hidden = true;
    deleteTarget = null;
  });

  overlay.addEventListener("click", () => cancelBtn.click());

  async function closeStore() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/close`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        alert("✅ 가게가 즉시 마감되었습니다!");
        console.log("📌 이전 마감 시간:", data.result.previousClosingTime);
        console.log("📌 새로운 마감 시간:", data.result.newClosingTime);

        // ✅ 마감 성공 시 menu_off.html로 이동
        window.location.href = `menu_off.html?storeId=${storeId}`;
      } else {
        alert("❌ 가게 마감 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 마감 중 오류", err);
      alert("서버 오류가 발생했습니다.");
    }
  }

  // ✅ 하단 상태 배지 클릭 → 즉시 마감
  const bottomStatus = document.getElementById("countdown");

  if (bottomStatus) {
    bottomStatus.addEventListener("click", () => {
      if (bottomStatus.textContent.includes("주문 받기")) {
        // 현재 닫힘 상태 → 클릭하면 즉시 오픈
        openStore();
      } else {
        // 현재 열림 상태 → 클릭하면 즉시 마감
        closeStore();
      }
    });
  }

  // ✅ 초기 로드
  loadMenus();
});
