document.querySelectorAll(".like_btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const img = btn.querySelector("img");
    if (img.getAttribute("src").includes("like_red.svg")) {
      img.setAttribute("src", "../images/like.svg"); // 원래 회색/비활성
    } else {
      img.setAttribute("src", "../images/like_red.svg"); // 빨간색 활성
    }
  });
});
