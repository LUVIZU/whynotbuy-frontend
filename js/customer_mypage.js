// js/customer_mypage.js
console.log("[mypage] customer_mypage.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store"; // 로컬 테스트면 http://127.0.0.1:8080

  const logoutBtn = document.getElementById("logout_btn");
  const nicknameEl = document.getElementById("nickname");

  // --- 사용자 정보 불러오기 ---
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users`, {
        method: "GET",
        credentials: "include", // ✅ 쿠키 전송 필수
      });
      const data = await res.json();
      console.log("[user] status:", res.status, data);

      if (res.ok && data.isSuccess && data.result) {
        nicknameEl.textContent = data.result.nickname || "회원";
      } else {
        nicknameEl.textContent = "회원";
      }
    } catch (err) {
      console.error("[user] 불러오기 실패:", err);
      nicknameEl.textContent = "회원";
    }
  })();

  // --- 로그아웃 ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      console.log("[mypage] logout clicked");
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        console.log("[logout] status:", res.status, data);

        if (res.ok || [401, 403].includes(res.status)) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "../pages/login.html";
        } else {
          alert("로그아웃 실패: " + (data.message || res.status));
        }
      } catch (err) {
        console.error("[logout] error:", err);
        alert("네트워크 오류로 로그아웃 실패");
      }
    });
  }
});
