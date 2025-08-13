document.addEventListener('DOMContentLoaded', () => {
    // 템플릿과 기준 요소들
    const cartListTemplate = document.querySelector('.cart_list_template');
    const mainContent = document.querySelector('.content');
    const addMenuEl = document.querySelector('.add_menu'); // 항상 이 앞에 끼워 넣음
  
    // 예시 데이터
    const cartItems = [
      {
        title: '버섯 피자',
        imgSrc: 'https://i.namu.wiki/i/umI-heVYVS9miQNqXM13FRUOHHL4l1nzsZgN9XRLFG7nI_7Dyf-Myr6HmiWf9Qd7SAZQz3WYSQHPXXtGAwLTag.webp',
        regularPrice: 15000,
        salePercent: 14,
        salePrice: 13000,
        quantity: 1
      },
      {
        title: '치즈 피자',
        imgSrc: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkNDXNTBVlDFIpM-8tiMHv8liytuY8qgniBA&s',
        regularPrice: 18000,
        salePercent: 10,
        salePrice: 16200,
        quantity: 2
      },
      
    ];
  
    // 아이템 렌더
    function renderCartItems() {
      cartItems.forEach(item => {
        // 템플릿 복제
        const frag = document.importNode(cartListTemplate.content, true);
  
        // 엘리먼트 참조
        const root = frag.querySelector('.menu_item');
        const menuTitle = frag.querySelector('.menu_title');
        const menuImg = frag.querySelector('.menu_img img');
        const regularPrice = frag.querySelector('.regular_price');
        const salePercent = frag.querySelector('.sale_percent');
        const salePrice = frag.querySelector('.sale_price');
        const quantityValue = frag.querySelector('.quantity_value');
        const deleteButton = frag.querySelector('.menu_delete img');
        const quantityMinusBtn = frag.querySelector('.quantity_button1');
        const quantityPlusBtn = frag.querySelector('.quantity_button2');
  
        // 데이터 바인딩
        menuTitle.textContent = item.title;
        menuImg.src = item.imgSrc;
        regularPrice.textContent = `${item.regularPrice.toLocaleString('ko-KR')} 원`;
  
        if (!item.salePercent || item.salePercent === 0) {
          salePercent.style.display = 'none';
        } else {
          salePercent.textContent = `${item.salePercent}%`;
        }
        salePrice.textContent = `${item.salePrice.toLocaleString('ko-KR')} 원`;
        quantityValue.textContent = `${item.quantity} 개`;
  
        // 이벤트 바인딩
        deleteButton.addEventListener('click', (e) => {
          const menuItem = e.target.closest('.menu_item');
          if (menuItem) {
            menuItem.remove();
            alert(`${item.title} 메뉴를 삭제했습니다.`);
          }
        });
  
        quantityMinusBtn.addEventListener('click', () => {
          if (item.quantity > 1) {
            item.quantity--;
            quantityValue.textContent = `${item.quantity} 개`;
          }
        });
  
        quantityPlusBtn.addEventListener('click', () => {
          item.quantity++;
          quantityValue.textContent = `${item.quantity} 개`;
        });
  
        // 항상 .add_menu 바로 앞에 삽입 → 버튼이 마지막에 유지
        mainContent.insertBefore(frag, addMenuEl);
      });
    }
  
    renderCartItems();
  });
  