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

  // 쿠키에서 값 가져오기
  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  // 가게 존재 여부 확인 API 호출
  async function checkStoreExists() {
    const token = getCookie("accessToken");
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/api/v1/store/exists`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        return data.isSuccess ? data.result : null;
      }
    } catch (error) {
      console.error("가게 존재 여부 확인 실패:", error);
    }
    return null;
  }

  // 가게 상세 정보 조회 (영업시간 확인용)
  async function getStoreDetails(storeId) {
    const token = getCookie("accessToken");
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/api/v1/store/${storeId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        return data.isSuccess ? data.result : null;
      }
    } catch (error) {
      console.error("가게 상세 정보 조회 실패:", error);
    }
    return null;
  }

  // 영업시간 확인 함수
  function isWithinBusinessHours(current, open, close) {
    const [ch, cm] = current.split(":").map(Number);
    const [oh, om] = open.split(":").map(Number);
    const [xh, xm] = close.split(":").map(Number);

    if ([ch, cm, oh, om, xh, xm].some(isNaN)) {
      console.warn("🚨 시간 파싱 오류", { current, open, close });
      return false;
    }

    const curMin = ch * 60 + cm;
    const openMin = oh * 60 + om;
    const closeMin = xh * 60 + xm;

    if (openMin <= closeMin) {
      // 같은 날 안에서 열고 닫음
      return curMin >= openMin && curMin < closeMin;
    } else {
      // 자정을 넘기는 경우
      return curMin >= openMin || curMin < closeMin;
    }
  }

  // OWNER 로그인 후 적절한 페이지로 이동
  async function redirectOwnerAfterLogin() {
    const storeInfo = await checkStoreExists();

    if (!storeInfo || !storeInfo.exists) {
      // 가게가 없으면 가게 등록 페이지로
      window.location.href = "store_enroll.html";
      return;
    }

    // 가게가 있으면 영업시간 확인
    const storeDetails = await getStoreDetails(storeInfo.storeId);
    if (!storeDetails) {
      // 가게 상세 정보를 불러올 수 없으면 가게 등록 페이지로
      window.location.href = "store_enroll.html";
      return;
    }

    // 현재 시간
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // 영업시간 확인
    const openTime = storeDetails.openingTime
      ? storeDetails.openingTime.slice(0, 5)
      : "00:00";
    const closeTime = storeDetails.closingTime
      ? storeDetails.closingTime.slice(0, 5)
      : "23:59";

    if (isWithinBusinessHours(currentTime, openTime, closeTime)) {
      // 영업시간 내 - menu_on.html로 이동
      window.location.href = `menu_on.html?storeId=${storeInfo.storeId}`;
    } else {
      // 영업시간 외 - menu_off.html로 이동
      window.location.href = `menu_off.html?storeId=${storeInfo.storeId}`;
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
          // ✅ OWNER의 경우 가게 존재 여부와 영업시간 확인 후 적절한 페이지로 이동
          await redirectOwnerAfterLogin();
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
