document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";

  const menuList = document.getElementById("menu-list");
  const menuTemplate = document.getElementById("menu-item-template");

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
        `${API_BASE}/api/v1/store/${storeId}/menus?size=10&menuSortType=DISCOUNT`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
    li.querySelector("[data-name]").textContent = menu.name || "이름없음";

    // 원래 가격
    li.querySelector("[data-origin-price]").textContent =
      menu.price != null ? `${menu.price.toLocaleString()}원` : "0원";

    // 할인율
    li.querySelector("[data-discount]").textContent =
      menu.discountPercent != null ? `${menu.discountPercent}%` : "0%";

    // ✅ 최종 가격 계산 (discountPrice → 직접 계산 → 원가)
    let finalPrice;
    if (menu.discountPrice != null && menu.discountPrice > 0) {
      finalPrice = menu.discountPrice;
    } else if (
      menu.price != null &&
      menu.discountPercent != null &&
      menu.discountPercent > 0
    ) {
      finalPrice = Math.floor(menu.price * (1 - menu.discountPercent / 100));
    } else {
      finalPrice = menu.price ?? 0;
    }

    li.querySelector(
      "[data-sale-price]"
    ).textContent = `${finalPrice.toLocaleString()}원`;

    // 재고 (지금 API에선 0으로 고정?)
    li.querySelector("[data-stock]").textContent =
      menu.quantity != null ? menu.quantity : "0";

    // 이미지
    li.querySelector("[data-thumb]").src =
      menu.menuImage && menu.menuImage.trim() !== ""
        ? menu.menuImage.startsWith("http")
          ? menu.menuImage
          : `${API_BASE}${menu.menuImage}`
        : "../images/placeholder.png";

    li.querySelector("[data-thumb]").alt = menu.name || "메뉴 이미지";
    // ✅ 여기 추가: 수정하기 버튼에 storeId와 menu 정보 붙여주기
    const editLink = li.querySelector(".menu-card__edit");
    editLink.href = `menu_modify.html?storeId=${storeId}&menuId=${
      menu.menuId
    }&name=${encodeURIComponent(menu.name)}&price=${
      menu.price
    }&menuImage=${encodeURIComponent(menu.menuImage || "")}`;

    // 삭제 버튼
    li.querySelector(".menu-card__delete").addEventListener("click", () => {
      deleteTarget = li;
      modal.hidden = false;
    });

    // 재고 버튼 비활성화
    li.querySelectorAll(".stock-btn").forEach((btn) => (btn.disabled = true));
    menuList.appendChild(node);

    // 삭제 버튼
    li.querySelector(".menu-card__delete").addEventListener("click", () => {
      deleteTarget = li;
      modal.hidden = false;
    });

    // 재고 버튼 비활성화
    li.querySelectorAll(".stock-btn").forEach((btn) => (btn.disabled = true));

    menuList.appendChild(node);
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
  async function openStore() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}/open`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.isSuccess) {
        alert("✅ 가게가 즉시 오픈되었습니다!");
        console.log("📌 이전 오픈 시간:", data.result.previousOpeningTime);
        console.log("📌 새로운 오픈 시간:", data.result.newOpeningTime);

        // ✅ 오픈 성공 시 menu_on.html로 이동
        window.location.href = `menu_on.html?storeId=${storeId}`;
      } else {
        alert("❌ 가게 오픈 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (err) {
      console.error("가게 오픈 중 오류", err);
      alert("서버 오류가 발생했습니다.");
    }
  }

  // ✅ 하단 배지 클릭 → 즉시 오픈
  const bottomStatus = document.getElementById("countdown");

  if (bottomStatus) {
    bottomStatus.addEventListener("click", () => {
      if (bottomStatus.textContent.includes("주문 받기")) {
        // 현재 "주문 받기" 버튼 → 클릭하면 오픈
        openStore();
      } else {
        // 현재 "주문 마감하기" 버튼 → 클릭하면 마감
        closeStore();
      }
    });
  }
  // ✅ 초기 로드
  loadMenus();
});
