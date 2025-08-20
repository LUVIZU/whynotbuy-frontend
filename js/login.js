document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store"; // 배포 API 고정
  const customerBtn = document.querySelector(".card-button.customer");
  const ownerBtn = document.querySelector(".card-button.owner");

  if (customerBtn)
    customerBtn.addEventListener("click", () => handleLogin("customer"));
  if (ownerBtn) ownerBtn.addEventListener("click", () => handleLogin("owner"));

  // JWT payload 디코딩 함수
  function decodeJwt(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT decode 실패", e);
      return null;
    }
  }

  async function handleLogin(type) {
    const endpoint =
      type === "customer"
        ? `${API_BASE}/api/v1/auth/login/customer`
        : `${API_BASE}/api/v1/auth/login/owner`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
      }

      const data = await res.json();

      if (data.isSuccess) {
        const { accessToken, refreshToken } = data.result;

        // ✅ 쿠키 저장
        if (accessToken) {
          document.cookie = `accessToken=${accessToken}; Path=/; SameSite=Lax; Secure`;
        }
        if (refreshToken) {
          document.cookie = `refreshToken=${refreshToken}; Path=/; SameSite=Lax; Secure`;
        }

        // ✅ JWT에서 role 추출
        const payload = decodeJwt(accessToken);
        const role = payload?.role || "CUSTOMER";

        if (role.includes("CUSTOMER")) {
          window.location.href = "home_store.html";
        } else if (role.includes("OWNER")) {
          window.location.href = "store_enroll.html";
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
