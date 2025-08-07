document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("http://127.0.0.1:8080/api/v1/users", { // Todo : 나중에 API 서버 배포하면 도메인 바꾸기
        method: "GET",
        credentials: "include",
      });
  
      const data = await res.json();
  
      if (data.isSuccess && data.result) {
        document.getElementById("nickname").textContent = data.result.nickname;
        document.getElementById("role").textContent = data.result.role;
      } else {
        alert("로그인 정보 없음");
        window.location.href = "../pages/login.html";
      }
    } catch (err) {
      console.error("인증 확인 실패", err);
      window.location.href = "../pages/login.html";
    }
  });
  