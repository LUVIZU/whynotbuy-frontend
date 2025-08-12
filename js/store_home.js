// ../js/store_home.js
document.addEventListener('DOMContentLoaded', () => {
  /* ============== 상태 ============== */
  // likes: 찜한 menuId 집합
  // cart:  { items: [{ id, name, qty, price, salePrice }] }
  const state = {
    likes: new Set(JSON.parse(localStorage.getItem('likes') || '[]')),
    cart: JSON.parse(localStorage.getItem('cart') || '{"items":[]}'),
  };

  /* ============== 더미 데이터 (API 연결 전) ============== */
  // 실제 API 연결 시 이 배열을 서버 응답으로 대체하면 됨.
  const menus = [
    { id: 1, name: '버섯 피자',   price: 15000, discountRate: 14, salePrice: 13000, imageUrl: 'https://i.namu.wiki/i/umI-heVYVS9miQNqXM13FRUOHHL4l1nzsZgN9XRLFG7nI_7Dyf-Myr6HmiWf9Qd7SAZQz3WYSQHPXXtGAwLTag.webp' },
    { id: 2, name: '콤비네이션', price: 17000, discountRate: 25, salePrice: 14000, imageUrl: 'https://www.7thpizza.com/img/sub/intro_pizza03.png' },
    { id: 3, name: '치즈 피자',   price: 16000, discountRate: 10, salePrice: 14400, imageUrl: 'https://cdn.imweb.me/thumbnail/20230208/ce2392523295d.png' },
  ];

  /* ============== 가게 정보 (데모) ============== */
  // API 연동 시 서버 데이터로 치환
  document.querySelector('.top_title').textContent = 'Lanespan Pizza & Pub';
  document.querySelector('.business_hours').textContent = '영업시간 09:30~22:00';
  document.querySelector('.address').textContent = '서울 관악구 신림로 59길 14 (2층 209호, 올레순대)';

  /* ============== 요소 캐시 ============== */
  const listEl = document.getElementById('menuList');
  const tpl = document.getElementById('menuItemTpl');

  const cartBtn = document.getElementById('floatingCart');
  const cartCountEl = document.querySelector('.cart_count'); // 배지
  const cartOldEl = document.getElementById('cartOld');      // 정가 합계(취소선)
  const cartNowEl = document.getElementById('cartNow');      // 최종 합계(민트색)

  /* ============== 렌더 ============== */
  renderMenus(menus);
  updateFloatingCart(); // 장바구니 초기 표시/숨김

  function renderMenus(arr) {
    listEl.innerHTML = '';
    if (!arr || arr.length === 0) {
      listEl.innerHTML = '<li class="menu_empty">등록된 메뉴가 없어요.</li>';
      return;
    }
    const frag = document.createDocumentFragment();
    arr.forEach(m => frag.appendChild(makeItem(m)));
    listEl.appendChild(frag);
  }

  function makeItem(m) {
    // 템플릿 복제
    const li = tpl.content.firstElementChild.cloneNode(true);

    // id 보관(이벤트/찜/장바구니 용)
    li.dataset.menuId = String(m.id);

    // 텍스트
    li.querySelector('.menu_name').textContent = m.name;

    const strike = li.querySelector('.price_strike');        // div (정가, 취소선)
    const rate   = li.querySelector('.price_sale_rate');     // span (할인율)
    const sale   = li.querySelector('.price_sale');          // span (판매가)

    if (m.discountRate && m.discountRate > 0) {
      strike.textContent = won(m.price);                     // 정가 줄
      rate.textContent   = `${m.discountRate}%`;
      sale.textContent   = won(m.salePrice ?? calcSale(m.price, m.discountRate));
    } else {
      strike.remove();                                       // 할인 없으면 줄 자체 제거
      rate.remove();
      sale.textContent = won(m.price);
    }

    // 이미지
    const img = li.querySelector('.menu_thumb');
    img.src = m.imageUrl || '../images/placeholder_food.png';
    img.alt = m.name;

    // 찜 버튼 상태 반영
    const likeBtn = li.querySelector('.menu_like');
    likeBtn.setAttribute('aria-pressed', state.likes.has(m.id) ? 'true' : 'false');

    return li;
  }

  /* ============== 이벤트 ============== */
  // 이벤트 위임: 찜 토글 & (데모) 카드 클릭 시 장바구니 담기
  listEl.addEventListener('click', (e) => {
    const like = e.target.closest('.menu_like');
    if (like) {
      e.stopPropagation();
      const id = Number(like.closest('.menu_item').dataset.menuId);
      toggleLike(id, like);
      return;
    }

    // [데모] 카드 아무데나 클릭하면 1개 담기
    const item = e.target.closest('.menu_item');
    if (item) {
      const id = Number(item.dataset.menuId);
      const menu = menus.find(x => x.id === id);
      addToCart(menu);
    }
  });

  // 장바구니 버튼 클릭 → 장바구니 페이지로 이동/모달 열기 등
  cartBtn.addEventListener('click', () => {
    // TODO: 라우팅 연결
    alert('장바구니로 이동!');
  });

  /* ============== 동작 ============== */
  function toggleLike(id, btn) {
    if (state.likes.has(id)) state.likes.delete(id);
    else state.likes.add(id);

    btn.setAttribute('aria-pressed', state.likes.has(id) ? 'true' : 'false');
    localStorage.setItem('likes', JSON.stringify([...state.likes]));
    // TODO: 서버 찜 API 호출 (POST/DELETE)
  }

  function addToCart(menu) {
    if (!menu) return;
    const items = state.cart.items || [];
    const found = items.find(it => it.id === menu.id);
    const sale = (menu.discountRate && menu.discountRate > 0)
      ? (menu.salePrice ?? calcSale(menu.price, menu.discountRate))
      : menu.price;

    if (found) found.qty += 1;
    else items.push({ id: menu.id, name: menu.name, qty: 1, price: menu.price, salePrice: sale });

    state.cart.items = items;
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateFloatingCart();
    // TODO: 서버 장바구니 API 호출 (POST/PATCH)
  }

  function updateFloatingCart() {
    const items = state.cart.items || [];
    const qty = items.reduce((s, it) => s + it.qty, 0);
  
    // 메뉴가 렌더되어 있는지(또는 menus.length 사용)
    const hasMenus = document.querySelectorAll('#menuList .menu_item').length > 0;
    // const hasMenus = menus && menus.length > 0;  // 데이터 배열로 체크해도 OK
  
    if (qty > 0 && hasMenus) {
      cartBtn.hidden = false;
  
      const original   = items.reduce((s, it) => s + it.price * it.qty, 0);
      const discounted = items.reduce((s, it) => s + (it.salePrice ?? it.price) * it.qty, 0);
  
      cartCountEl.textContent = String(qty);
      cartNowEl.textContent = won(discounted);
  
      if (discounted < original) {
        cartOldEl.style.display = '';
        cartOldEl.textContent = won(original);
      } else {
        cartOldEl.style.display = 'none';
      }
    } else {
      cartBtn.hidden = true;     // ❗ 장바구니 비어있거나 메뉴가 없으면 버튼 숨김
    }
  }

  /* ============== 유틸 ============== */
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function calcSale(price, rate) { return Math.round(price * (100 - rate) / 100); }

  /* ============== API 붙일 때 가이드 ============== */
  // 1) 최초 진입 시:
  //    const res = await fetch(`/api/stores/{storeId}/menus`);
  //    const menus = await res.json(); renderMenus(menus);
  //
  // 2) 찜:
  //    toggleLike 안에서 POST/DELETE /likes/{menuId} 호출 후 state.likes 업데이트
  //
  // 3) 장바구니:
  //    addToCart 안에서 POST /cart/items (id, qty=1) 호출하고
  //    updateFloatingCart() 전에 서버 응답의 cart 요약(수량/금액)을 반영하면 UI 동기화 OK
});
