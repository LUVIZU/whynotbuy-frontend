// ../js/write_review.js
// 규칙: JWT 쿠키 인증(credentials: 'include')

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api-whynotbuy.store";
  const ORDERS_PAGE_SIZE = 20; // 소유권 검증 시 한 번에 가져올 주문 수
  const ORDERS_LOOKUP_MAX_PAGES = 5; // 최대 5페이지까지만 훑어서 검증

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
  // target: { order_id, store_name, items:[{name,qty}] | ["문자열"], old_price, sale_pct, now_price, order_date_label, order_code }

  // ===== UI 채우기
  $orderDate.textContent = target.order_date_label || "";
  $orderCode.textContent = target.order_code
    ? `주문번호 ${target.order_code}`
    : "";
  $orderCode.href = "#";
  $storeName.textContent = target.store_name || "";

  // 아이템 리스트 (문자열/객체 모두 대응)
  $orderItems.innerHTML = "";
  (target.items || []).forEach((it) => {
    const li = document.createElement("li");

    if (typeof it === "string") {
      li.textContent = it;
    } else if (it && typeof it === "object") {
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

  /* ===== 현재 로그인/역할 확인 ===== */
  async function getMe() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      // 예상 응답: { isSuccess, result: { userId, nickname, role } }
      return data?.isSuccess ? data.result : null;
    } catch {
      return null;
    }
  }

  /* ===== 소유권 검증: 이 주문이 '내 주문'이 맞는가 ===== */
  async function assertOrderOwnership(orderId) {
    let cursor = null;
    for (let i = 0; i < ORDERS_LOOKUP_MAX_PAGES; i++) {
      const q = new URLSearchParams();
      if (cursor) q.set("cursor", cursor);
      q.set("size", String(ORDERS_PAGE_SIZE));

      const res = await fetch(`${API_BASE}/api/v1/orders?${q}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const list = data?.result?.orderList || [];
      if (list.some((o) => Number(o.orderId) === Number(orderId))) return true;

      const next = data?.result?.nextCursor ?? 0;
      if (!next) return false;
      cursor = next;
    }
    return false;
  }

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
      // 1) 로그인/역할 확인
      const me = await getMe();
      if (!me) {
        alert("로그인이 필요합니다. 다시 로그인해 주세요.");
        window.location.href = "../pages/login.html";
        return;
      }
      if ((me.role || "").toUpperCase() !== "CUSTOMER") {
        alert("고객 계정으로만 리뷰 작성이 가능합니다.");
        return;
      }

      // 2) 소유권 검증 (세션 꼬임 방지)
      const isMine = await assertOrderOwnership(target.order_id);
      if (!isMine) {
        sessionStorage.removeItem("review_target");
        alert(
          "이 주문은 현재 로그인한 사용자에게 속하지 않습니다. 구매내역에서 다시 시도해 주세요."
        );
        window.location.replace("../pages/purchase_log.html?updated=1");
        return;
      }

      // 3) 실제 등록
      const res = await fetch(`${API_BASE}/api/v1/reviews`, {
        method: "POST",
        credentials: "include", // ⬅ JWT 쿠키
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(target.order_id), // 스웨거 명세: { orderId, content }
          content,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        const msg =
          res.status === 403
            ? "해당 주문의 생성자만 리뷰를 작성할 수 있습니다."
            : "로그인이 필요합니다.";
        alert(msg);
        return;
      }

      const data = await res.json().catch(() => null);

      if (res.ok && data?.isSuccess) {
        // 방금 리뷰 쓴 주문ID를 기록 → 구매내역에서 곧바로 '내 리뷰'로 보이도록
        const reviewedIds = new Set(
          JSON.parse(sessionStorage.getItem("reviewed_order_ids") || "[]").map(
            String
          )
        );
        reviewedIds.add(String(target.order_id));
        sessionStorage.setItem(
          "reviewed_order_ids",
          JSON.stringify([...reviewedIds])
        );

        // 방금 쓴 리뷰 내용 로컬 저장(즉시 표시용)
        const localMap = JSON.parse(
          sessionStorage.getItem("my_reviews_local") || "{}"
        );
        localMap[String(target.order_id)] = {
          content,
          dateISO: new Date().toISOString(),
        };
        sessionStorage.setItem("my_reviews_local", JSON.stringify(localMap));

        alert("리뷰가 등록되었습니다.");

        // 사용한 세션 데이터 정리
        sessionStorage.removeItem("review_target");

        // 구매내역으로 복귀 (BFCache 방지 위해 replace + updated=1 쿼리)
        window.location.replace("../pages/purchase_log.html?updated=1");
      } else {
        const msg = data?.message || "리뷰 등록에 실패했습니다.";
        alert(msg);
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
