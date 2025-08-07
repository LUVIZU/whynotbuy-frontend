document.addEventListener("DOMContentLoaded", () => {
    const customerBtn = document.querySelector(".card-button.customer");
    const ownerBtn = document.querySelector(".card-button.owner");
  
    customerBtn.addEventListener("click", () => handleLogin("customer"));
    ownerBtn.addEventListener("click", () => handleLogin("owner"));
  
    async function handleLogin(type) {
      const endpoint =
        type === "customer"
          ? "http://127.0.0.1:8080/api/v1/auth/login/customer" // Todo : 나중에 API 서버 배포하면 도메인 바꾸기
          : "http://127.0.0.1:8080/api/v1/auth/login/owner";
  
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include", // JWT 쿠키 받아서 쿠키에 저장
        });
  
        const data = await res.json();
  
        if (data.isSuccess) {
          window.location.href = "../pages/home.html"; // 홈화면 만들어지면 바꾸기(사장님이랑 고객이랑 화면 다르니까 if문 사용하기)
        } else {
          alert("로그인 실패: " + data.message);
        }
      } catch (error) {
        console.error("로그인 중 오류 발생", error);
        alert("네트워크 오류가 발생했습니다.");
      }

      // 이런식으로
      // if (data.isSuccess) {
      //   const role = data.result.role; // "CUSTOMER" 또는 "OWNER"
      
      //   if (role === "CUSTOMER") {
      //     window.location.href = "../pages/home_store.html";
      //   } else if (role === "OWNER") {
      //     window.location.href = "../pages/menu_off.html";
      //   } else {
      //     alert("알 수 없는 사용자 역할입니다.");
      //   }
      // } else {
      //   alert("로그인 실패: " + data.message);
      // }
    }
  });
  