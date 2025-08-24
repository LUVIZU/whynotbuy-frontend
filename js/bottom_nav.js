document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("storeId");

  if (storeId) {
    document.querySelectorAll(".bottom_nav a").forEach((a) => {
      let href = a.getAttribute("href");

      // 자기 자신 페이지는 굳이 덮어씌우지 않음
      if (href.includes(window.location.pathname.split("/").pop())) return;

      if (href.includes("?")) {
        href += `&storeId=${storeId}`;
      } else {
        href += `?storeId=${storeId}`;
      }

      a.setAttribute("href", href);
    });
  }
});
