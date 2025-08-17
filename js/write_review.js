// ../js/write_review.js
// 규칙: JWT 쿠키 인증(credentials: 'include')

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store"; // 배포 API 고정

  // ===== 엘리먼트
  const $orderDate = document.getElementById("order_date");
  const $orderCode = document.getElementById("order_code");
  const $storeName = document.getElementById("store_name");
  const $orderItems = document.getElementById("order_items");
  const $oldPrice = document.getElementById("old_price");
  const $salePct = document.getElementById("sale_pct");
  const $nowPrice = document.getElementById("now_price");
  const $textarea = document.getElementById("review_text");
  const $submit = document.getElementById("upload_review");

  // ===== 구매내역 페이지에서 전달된 대상 읽기
  const targetRaw = sessionStorage.getItem("review_target");
  if (!targetRaw) {
    alert("리뷰 대상 주문 정보가 없습니다.");
    window.location.href = "../pages/purchase_log.html";
    return;
  }
  const target = JSON.parse(targetRaw);
  // target: { order_id, store_name, items:[{name,qty}], old_price, sale_pct, now_price, order_date_label, order_code }

  // ===== UI 채우기
  $orderDate.textContent = target.order_date_label || "";
  $orderCode.textContent = target.order_code
    ? `주문번호 ${target.order_code}`
    : "";
  $orderCode.href = "#";
  $storeName.textContent = target.store_name || "";

  // 아이템 리스트
  // 아이템 리스트 (문자열/객체 모두 대응)
  $orderItems.innerHTML = "";
  (target.items || []).forEach((it) => {
    const li = document.createElement("li");

    if (typeof it === "string") {
      // 예: "버섯 피자 1개"
      li.textContent = it;
    } else if (it && typeof it === "object") {
      // 예: { name: '버섯 피자', qty: 1 } 혹은 {menuName, quantity}
      const name = it.name ?? it.menuName ?? "";
      const qty = it.qty ?? it.quantity ?? "";
      li.textContent = `${name}  ${qty ? qty + "개" : ""}`.trim();
    } else {
      li.textContent = "";
    }

    $orderItems.appendChild(li);
  });

  // 가격 영역
  const fmt = (n) => (!n && n !== 0 ? "" : `${Number(n).toLocaleString()} 원`);
  if (target.old_price) $oldPrice.textContent = fmt(target.old_price);
  if (typeof target.sale_pct === "number")
    $salePct.textContent = `${target.sale_pct}%`;
  if (target.now_price) $nowPrice.textContent = fmt(target.now_price);

  // ===== 전송
  let sending = false;
  $submit.addEventListener("click", async () => {
    if (sending) return;

    const content = ($textarea.value || "").trim();
    if (!content) {
      alert("리뷰 내용을 입력해 주세요.");
      $textarea.focus();
      return;
    }

    sending = true;
    $submit.disabled = true;
    $submit.textContent = "업로드 중...";

    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews`, {
        method: "POST",
        credentials: "include", // ⬅ JWT 쿠키
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(target.order_id), // 스웨거 명세: { orderId, content }
          content,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 401 등 인증 실패 시 로그인으로
        if (res.status === 401 || res.status === 403) {
          alert("로그인이 필요합니다. 다시 로그인 해주세요.");
          window.location.href = "../pages/login.html";
          return;
        }
        throw new Error(data?.message || `서버 오류(${res.status})`);
      }

      if (data?.isSuccess) {
        alert("리뷰가 등록되었습니다.");
        // 사용한 세션 데이터 정리
        sessionStorage.removeItem("review_target");
        // 구매내역으로 복귀
        window.location.href = "../pages/purchase_log.html";
      } else {
        throw new Error(data?.message || "리뷰 등록에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "리뷰 등록 중 오류가 발생했습니다.");
    } finally {
      sending = false;
      $submit.disabled = false;
      $submit.textContent = "리뷰 올리기";
    }
  });
});
