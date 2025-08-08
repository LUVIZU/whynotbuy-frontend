document.querySelectorAll(".like_btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // 카드 클릭 이벤트 막기
    const img = btn.querySelector("img");
    if (img.getAttribute("src").includes("like_red.svg")) {
      img.setAttribute("src", "../images/like.svg");
    } else {
      img.setAttribute("src", "../images/like_red.svg");
    }
  });
});
