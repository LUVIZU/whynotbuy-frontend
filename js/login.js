document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store"; // 배포 API 고정
  const customerBtn = document.querySelector(".card-button.customer");
  const ownerBtn = document.querySelector(".card-button.owner");

  if (customerBtn)
    customerBtn.addEventListener("click", () => handleLogin("customer"));
  if (ownerBtn) ownerBtn.addEventListener("click", () => handleLogin("owner"));

  async function handleLogin(type) {
    const endpoint =
      type === "customer"
        ? `${API_BASE}/api/v1/auth/login/customer`
        : `${API_BASE}/api/v1/auth/login/owner`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include", // JWT 쿠키 주고받기
        // body: JSON.stringify({ loginId, password }) // 필요 시 여기에 폼 데이터 넣기
      });

      // 네트워크/서버 에러 대비
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
      }

      const data = await res.json();

      if (data.isSuccess) {
        // 팀 규칙: { isSuccess, result:{ role } }
        const role = data.result?.role || "CUSTOMER";

        if (role === "CUSTOMER") {
          window.location.href = "home_store.html";
        } else if (role === "OWNER") {
          window.location.href = "사장님페이지.html"; //사장님페이지 링크 적어줘야함
        } else {
          alert("알 수 없는 사용자 역할입니다.");
        }
      } else {
        alert("로그인 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (error) {
      console.error("로그인 중 오류 발생", error);
      alert("네트워크 오류가 발생했습니다.");
    }
  }
});
