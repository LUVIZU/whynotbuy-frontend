document.addEventListener("DOMContentLoaded", function () {
  const cards = document.querySelectorAll(".location_card");
  const lastClicked = localStorage.getItem("last_location_card");

  // 저장된 위치가 있다면 active 클래스 적용
  if (lastClicked) {
    const activeCard = document.querySelector(`[data-id="${lastClicked}"]`);
    if (activeCard) activeCard.classList.add("active");
  }

  // 카드 클릭 시 active 부여 + localStorage 저장
  cards.forEach((card) => {
    card.addEventListener("click", function () {
      // active 초기화
      cards.forEach((c) => c.classList.remove("active"));

      // 현재 클릭된 카드에 active
      card.classList.add("active");

      // localStorage에 id 저장
      localStorage.setItem("last_location_card", card.dataset.id);
    });
  });

  // 뒤로가기 버튼 클릭 시, 해당 위치로 이동
  const backButton = document.getElementById("back_arrow");
  backButton.addEventListener("click", function () {
    const selected = localStorage.getItem("last_location_card");

    switch (selected) {
      case "first":
        window.location.href = "첫번째 주소.html";
        break;
      case "second":
        window.location.href = "두번째 주소.html";
        break;
      case "third":
        window.location.href = "세번째 주소.html";
        break;
      default:
        alert("주소를 선택해주세요!");
    }
  });
});
