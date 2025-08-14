// reviews.js — 무한 스크롤 리뷰 목록
(() => {
    const API_URL  = '/api/reviews';   // 실제 API로 바꾸세요
    const PAGE_SIZE = 10;

    const contentEl = document.querySelector('.content');
    const listEl    = document.querySelector('.review_list');
    if (!contentEl || !listEl) return;

    let page = 1;
    let isLoading = false;
    let hasMore = true;

    const days = ['일','월','화','수','목','금','토'];
    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const fmtDate = (isoOrDate) => {
      const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
      return `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    };

    function renderCard(r){
      const card = el('article', 'review_card');
      card.append(
        el('div', 'review_date', fmtDate(r.date)),
        el('p', 'review_text', r.text)
      );

      const box = el('div', 'review_items');
      (r.items || []).forEach(it => {
        const row = el('div', 'item_row');
        row.append(el('span', '', it.name), el('span', 'qty', `${it.qty} 개`));
        box.appendChild(row);
      });
      card.appendChild(box);
      return card;
    }

    async function fetchReviews(page, limit){
      try {
        const res = await fetch(`${API_URL}?page=${page}&limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          return { items: data, hasMore: data.length === limit };
        }
        return { items: data.items ?? [], hasMore: !!data.hasMore };
      } catch (e) {
        // 데모 데이터(백엔드 없이도 동작)
        const TOTAL = 10;
        const start = (page-1)*limit;
        const end = Math.min(start+limit, TOTAL);
        const items = [];
        for (let i=start; i<end; i++){
          items.push({
            id: i+1,
            date: new Date(Date.now() - i*86400000),
            text: '버섯 피자 하나랑 다른 피자 하나를 먹었는데 어쩌구 저쩌구 사장님이 다시 구워 주셔서 따뜻하게 먹을 수 있었어요. 최고최고',
            items: [
              { name: '버섯 피자', qty: 1 },
              { name: '다른 피자', qty: 1 },
            ]
          });
        }
        return { items, hasMore: end < TOTAL };
      }
    }

    async function loadNextPage(){
      if (isLoading || !hasMore) return;
      isLoading = true;

      const { items, hasMore: more } = await fetchReviews(page, PAGE_SIZE);
      items.forEach(r => listEl.insertBefore(renderCard(r), sentinel));
      hasMore = more;
      page += 1;
      isLoading = false;

      if (!hasMore) {
        observer?.disconnect();
        sentinel.remove();
      }
    }

    // 센티넬(리스트 끝 감지)
    const sentinel = el('div', 'io-sentinel'); sentinel.style.height = '1px';
    listEl.appendChild(sentinel);

    // IntersectionObserver로 무한 스크롤
    let observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) loadNextPage();
      }, {
        root: contentEl,     // ⬅️ 스크롤 컨테이너 기준
        rootMargin: '200px', // 바닥 200px 전에 미리 로드
        threshold: 0
      });
      observer.observe(sentinel);
    } else {
      // 폴백
      contentEl.addEventListener('scroll', () => {
        const nearBottom = contentEl.scrollTop + contentEl.clientHeight >= contentEl.scrollHeight - 200;
        if (nearBottom) loadNextPage();
      });
    }

    // 초기 로드
    loadNextPage();
  })();