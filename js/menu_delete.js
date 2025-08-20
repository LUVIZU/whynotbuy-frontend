document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("delete-modal");
  const deleteButtons = document.querySelectorAll(".menu-card__delete");
  const overlay = modal.querySelector(".modal__overlay");
  const cancelBtn = modal.querySelector("[data-role='cancel']");
  const confirmBtn = modal.querySelector("[data-role='confirm']");

  let targetCard = null; // 삭제 대상 카드 저장

  // 삭제 버튼 클릭 → 모달 열기
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      targetCard = e.target.closest(".menu-card"); // 클릭한 카드 기억
      modal.hidden = false;
    });
  });

  // 취소 / 오버레이 클릭 → 모달 닫기
  overlay.addEventListener("click", () => (modal.hidden = true));
  cancelBtn.addEventListener("click", () => (modal.hidden = true));

  // 확인 → 실제 카드 삭제
  confirmBtn.addEventListener("click", () => {
    if (targetCard) {
      targetCard.remove(); // DOM에서 삭제
      targetCard = null;
    }
    modal.hidden = true;
  });
});
