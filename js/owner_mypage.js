document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("edit-store-btn");
  const token = getCookie("accessToken");

  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      if (!token) {
        alert("❌ 로그인 후 이용해주세요.");
        return;
      }

      try {
        // ✅ URL에서 storeId 우선 가져오기
        const params = new URLSearchParams(window.location.search);
        let storeId = params.get("storeId");

        if (!storeId) {
          // ✅ storeId 없으면 전체 가게 조회
          const res = await fetch(
            "https://api-whynotbuy.store/api/v1/store?size=10&cursor=0",
            {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
            }
          );

          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || "API 오류");

          console.log("📌 전체 가게:", data);

          const stores = data.result?.stores || [];
          if (stores.length > 0) {
            storeId = stores[0].storeId;
          }
        }

        if (storeId) {
          // ✅ 수정 페이지 이동
          window.location.href = `store_enroll.html?storeId=${storeId}`;
        } else {
          alert("⚠️ 등록된 가게가 없습니다.");
        }
      } catch (err) {
        console.error("가게 정보 요청 에러:", err);
        alert("가게 정보를 불러올 수 없습니다.");
      }
    });
  }
});

// ✅ 쿠키 유틸 함수
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}
