document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const menuList = document.getElementById("menu-list");
  const menuTemplate = document.getElementById("menu-item-template");

  // ===== 삭제 모달 관련 =====
  const modal = document.getElementById("delete-modal");
  const overlay = modal.querySelector(".modal__overlay");
  const cancelBtn = modal.querySelector("[data-role='cancel']");
  const confirmBtn = modal.querySelector("[data-role='confirm']");

  let storeId = null;
  let nextCursor = null;
  let isLoading = false;
  let targetMenuId = null; // 현재 삭제 대상 메뉴 ID
  let targetCard = null; // DOM 노드 저장

  // ===== JWT 쿠키 가져오기 =====
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  // ===== 가게 ID 조회 =====
  async function fetchStoreId() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${getCookie("accessToken")}` },
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        storeId = data.result.storeId;
        console.log("가져온 storeId:", storeId);
        fetchMenus();
      } else {
        alert("가게 정보를 불러올 수 없습니다.");
      }
    } catch (err) {
      console.error("가게 정보 조회 실패", err);
    }
  }

  // ===== 메뉴 목록 조회 =====
  async function fetchMenus() {
    if (!storeId || isLoading) return;
    isLoading = true;

    const size = 10;
    const sort = "DISCOUNT"; // PRICE_ASC / PRICE_DESC / DISCOUNT
    const url = new URL(`${API_BASE}/api/v1/store/${storeId}/menus`);
    url.searchParams.append("size", size);
    url.searchParams.append("menuSortType", sort);
    if (nextCursor) url.searchParams.append("cursor", nextCursor);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${getCookie("accessToken")}` },
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        renderMenuList(data.result.menus);
        nextCursor = data.result.hasData ? data.result.nextCursor : null;
      } else {
        alert("메뉴 목록 불러오기 실패: " + (data.message || ""));
      }
    } catch (err) {
      console.error("메뉴 불러오기 오류", err);
    } finally {
      isLoading = false;
    }
  }

  // ===== 메뉴 렌더링 =====
  function renderMenuList(menus) {
    menus.forEach((menu) => {
      const clone = menuTemplate.content.cloneNode(true);
      const card = clone.querySelector(".menu-card");

      card.dataset.id = menu.menuId;
      clone.querySelector("[data-name]").textContent = menu.name;
      clone.querySelector(
        "[data-origin-price]"
      ).textContent = `${menu.price.toLocaleString()}원`;

      // 할인율 / 할인 가격 반영
      const discountEl = clone.querySelector("[data-discount]");
      discountEl.textContent = `${menu.discountPercent}%`;
      clone.querySelector("[data-sale-price]").textContent = `${(
        menu.price *
        (1 - menu.discountPercent / 100)
      ).toLocaleString()}원`;

      // 재고 반영
      const stockEl = clone.querySelector("[data-stock]");
      stockEl.textContent = menu.quantity;

      if (menu.menuImage) {
        clone.querySelector("[data-thumb]").src = menu.menuImage;
        clone.querySelector("[data-thumb]").alt = menu.name;
      }

      // ✅ 할인율 스텝퍼 이벤트
      clone.querySelectorAll(".discount-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const change = btn.dataset.action === "plus" ? 1 : -1;
          await updateMenuDiscount(
            menu.menuId,
            change,
            discountEl,
            menu.price,
            clone
          );
        });
      });

      // ✅ 재고 스텝퍼 이벤트
      clone.querySelectorAll(".stock-btn").forEach((btn) => {
        btn.disabled = false; // 버튼 활성화
        btn.addEventListener("click", async () => {
          const change = btn.dataset.action === "plus" ? 1 : -1;
          await updateMenuQuantity(menu.menuId, change, stockEl);
        });
      });

      // ✅ 삭제 버튼 → 모달 열기
      clone
        .querySelector(".menu-card__delete")
        .addEventListener("click", () => {
          targetMenuId = menu.menuId;
          targetCard = card;
          modal.hidden = false;
        });

      menuList.appendChild(clone);
    });
  }

  // ===== 메뉴 할인율 수정 =====
  async function updateMenuDiscount(
    menuId,
    change,
    discountEl,
    price,
    cardClone
  ) {
    try {
      const body = { changedValue: change };
      const res = await fetch(
        `${API_BASE}/api/v1/menus/${menuId}/discountPercent`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("accessToken")}`,
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        discountEl.textContent = `${data.result.discountPercent}%`;
        cardClone.querySelector(
          "[data-sale-price]"
        ).textContent = `${data.result.discountPrice.toLocaleString()}원`;
      } else {
        alert("할인율 수정 실패: " + (data.message || ""));
      }
    } catch (err) {
      console.error("할인율 수정 오류", err);
    }
  }

  // ===== 메뉴 재고 수정 =====
  async function updateMenuQuantity(menuId, change, stockEl) {
    try {
      const body = { changedValue: change };
      const res = await fetch(`${API_BASE}/api/v1/menus/${menuId}/quantity`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("accessToken")}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        stockEl.textContent = data.result.quantity;
      } else {
        alert("재고 수정 실패: " + (data.message || ""));
      }
    } catch (err) {
      console.error("재고 수정 오류", err);
    }
  }

  // ===== 메뉴 삭제 =====
  async function deleteMenu(menuId) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/store/${storeId}/menus/${menuId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getCookie("accessToken")}` },
        }
      );
      const data = await res.json();
      if (res.ok && data.isSuccess) {
        if (targetCard) {
          targetCard.remove();
        }
        alert("삭제되었습니다.");
      } else {
        alert("삭제 실패: " + (data.message || ""));
      }
    } catch (err) {
      console.error("삭제 오류", err);
      alert("서버 오류로 삭제할 수 없습니다.");
    }
  }

  // ===== 모달 이벤트 =====
  function closeModal() {
    modal.hidden = true;
    targetMenuId = null;
    targetCard = null;
  }
  overlay.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  confirmBtn.addEventListener("click", () => {
    if (targetMenuId) {
      deleteMenu(targetMenuId);
    }
    closeModal();
  });

  // ===== 무한 스크롤 =====
  window.addEventListener("scroll", () => {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 100
    ) {
      if (nextCursor) fetchMenus();
    }
  });

  // ===== 초기 실행 =====
  fetchStoreId();
});
