// ../js/purchase_log.js
document.addEventListener("DOMContentLoaded", () => {
  // 모든 상점 이름 클릭 → store_home.html 이동
  document.querySelectorAll(".store_name").forEach((el) => {
    el.addEventListener("click", () => {
      location.href = "store_home.html";
    });
  });

  // 리뷰 남기기 버튼 클릭 → write_review.html 이동
  document.querySelectorAll(".review_btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.href = "write_review.html";
    });
  });
});
