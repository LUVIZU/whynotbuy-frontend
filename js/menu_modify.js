// menu_edit.js
(function () {
  const BASE_URL = "https://api-whynotbuy.store/api/v1";
  const token = localStorage.getItem("accessToken"); // JWT 토큰 저장했다고 가정

  // ===== 메뉴 전체 수정 =====
  async function updateMenu(storeId, menuId, formData) {
    try {
      const res = await fetch(`${BASE_URL}/store/${storeId}/menus/${menuId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
        body: formData, // FormData 그대로 전송
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "메뉴 수정 실패");

      console.log("✅ 메뉴 전체 수정 성공:", data.result);
      alert("메뉴가 수정되었습니다!");
      return data.result;
    } catch (err) {
      console.error("❌ 메뉴 전체 수정 오류:", err.message);
      alert("메뉴 수정에 실패했습니다: " + err.message);
    }
  }

  // ===== 메뉴 할인율만 수정 =====
  async function updateMenuDiscount(menuId, newDiscountPercent) {
    try {
      const res = await fetch(`${BASE_URL}/menus/${menuId}/discountPercent`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
        body: JSON.stringify({ changedValue: newDiscountPercent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "할인율 수정 실패");

      console.log("✅ 할인율 수정 성공:", data.result);
      alert("할인율이 수정되었습니다!");
      return data.result;
    } catch (err) {
      console.error("❌ 할인율 수정 오류:", err.message);
      alert("할인율 수정에 실패했습니다: " + err.message);
    }
  }

  // ===== 폼 이벤트 연결 =====
  document.addEventListener("DOMContentLoaded", () => {
    // 메뉴 전체 수정 폼
    const menuForm = document.getElementById("menu-edit-form");
    menuForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const storeId = localStorage.getItem("storeId"); // 동적으로 불러오기
      const menuId = localStorage.getItem("menuId"); // 동적으로 불러오기

      const formData = new FormData(menuForm);
      // update 필드에 JSON으로 묶어서 넣기
      const updateData = {
        name: formData.get("name"),
        price: Number(formData.get("price")),
        discountPercent: Number(formData.get("discountPercent")),
        description: formData.get("description"),
        quantity: Number(formData.get("quantity")),
      };

      const newFormData = new FormData();
      newFormData.append("update", JSON.stringify(updateData));

      const file = formData.get("menuImage");
      if (file && file.size > 0) {
        newFormData.append("menuImage", file);
      }

      await updateMenu(storeId, menuId, newFormData);
    });

    // 할인율만 수정 폼
    const discountForm = document.getElementById("discount-edit-form");
    discountForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const menuId = localStorage.getItem("menuId"); // 동적으로 불러오기
      const discountValue = e.target.discountPercent.value;

      await updateMenuDiscount(menuId, Number(discountValue));
    });
  });
})();
