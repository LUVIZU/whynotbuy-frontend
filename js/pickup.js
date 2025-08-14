// pickup.js — iOS 휠 타임피커 (12h, 분: 00/30, 탭해서 선택 가능)
(function () {
    // ▼ 아이템 높이는 폰트/배율 영향 받으므로 '실측' 사용
    let ITEM_HEIGHT = 40;
  
    const hourWheel   = document.querySelector('.wheel[data-type="hour"]');
    const minuteWheel = document.querySelector('.wheel[data-type="minute"]');
    const ampmWheel   = document.querySelector('.wheel[data-type="ampm"]');
  
    const resultEl = document.getElementById('result');
    const getBtn   = document.getElementById('getValueBtn');
  
    /* ---------- 리스트 채우기 ---------- */
    function makeItem(t) {
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = t;
      return el;
    }
    function fill() {
      for (let h = 1; h <= 12; h++) hourWheel.appendChild(makeItem(String(h)));
      ['00', '30'].forEach(m => minuteWheel.appendChild(makeItem(m)));
      ['AM', 'PM'].forEach(p => ampmWheel.appendChild(makeItem(p)));
    }
    fill();
  
    /* ---------- 아이템 높이 실측 + 중앙 패딩 계산 ---------- */
    function measureItemHeight() {
      const sample =
        hourWheel.querySelector('.item') ||
        minuteWheel.querySelector('.item') ||
        ampmWheel.querySelector('.item');
      if (sample) {
        const h = sample.getBoundingClientRect().height;
        if (h && Math.abs(h - ITEM_HEIGHT) > 0.1) ITEM_HEIGHT = h;
      }
    }
    function setWheelPad(wheel) {
      const pad = Math.max(0, (wheel.clientHeight - ITEM_HEIGHT) / 2);
      wheel.style.setProperty('--pad', pad + 'px'); // CSS padding/scroll-padding용
    }
    function recalcAll() {
      measureItemHeight();
      [hourWheel, minuteWheel, ampmWheel].forEach(setWheelPad);
    }
    recalcAll();
  
    window.addEventListener('resize', () => {
      recalcAll();
      [hourWheel, minuteWheel, ampmWheel].forEach(w => snapToNearest(w, false));
    });
  
    /* ---------- 공통 유틸 ---------- */
    function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  
    function setActiveByIndex(wheel, idx) {
      const items = wheel.querySelectorAll('.item');
      items.forEach((it, i) => it.classList.toggle('active', i === idx));
    }
  
    /* ---------- 스냅(스크롤 멈추면 중앙 정렬) ---------- */
    function snapToNearest(wheel, smooth = true) {
      const count = wheel.querySelectorAll('.item').length;
      const idx   = clamp(Math.round(wheel.scrollTop / ITEM_HEIGHT), 0, count - 1);
      const top   = idx * ITEM_HEIGHT;
      wheel.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
      setActiveByIndex(wheel, idx);
    }
  
    function onScroll(e) {
      const w = e.currentTarget;
      clearTimeout(w._snapTimer);
      w._snapTimer = setTimeout(() => snapToNearest(w, true), 80);
    }
    [hourWheel, minuteWheel, ampmWheel].forEach(w =>
      w.addEventListener('scroll', onScroll, { passive: true })
    );
  
    /* ---------- 초기값: 현재 시각을 00/30으로 반올림 ---------- */
    function roundTo00or30(d = new Date()) {
      const m = d.getMinutes();
      return m < 15 ? 0 : (m < 45 ? 30 : 0);
    }
    function to12h(h24) {
      const p = h24 >= 12 ? 'PM' : 'AM';
      let h   = h24 % 12; if (h === 0) h = 12;
      return { h, p };
    }
    function setInitialNow() {
      const now = new Date();
      let h24 = now.getHours();
      let m   = roundTo00or30(now);
      if (now.getMinutes() >= 45) h24 = (h24 + 1) % 24; // 45~59 → 다음 시의 00
      const { h, p } = to12h(h24);
      setInitial(h, m, p);
    }
  
    function setInitial(h12 = 7, m = 0, period = 'PM') {
      const hourIdx   = clamp(h12 - 1, 0, 11);
      const minuteIdx = m === 30 ? 1 : 0;
      const periodIdx = period.toUpperCase() === 'AM' ? 0 : 1;
  
      [[hourWheel, hourIdx], [minuteWheel, minuteIdx], [ampmWheel, periodIdx]]
        .forEach(([w, idx]) => {
          w.scrollTop = idx * ITEM_HEIGHT;           // 패딩은 CSS가 처리
          setActiveByIndex(w, idx);
        });
  
      paintResult();
    }
  
    setInitialNow();
  
    /* ---------- 값 읽기/표시 ---------- */
    function getActiveIndex(wheel) {
      const count = wheel.querySelectorAll('.item').length;
      return clamp(Math.round(wheel.scrollTop / ITEM_HEIGHT), 0, count - 1);
    }
  
    function getValue() {
      const hIdx = getActiveIndex(hourWheel);
      const mIdx = getActiveIndex(minuteWheel);
      const pIdx = getActiveIndex(ampmWheel);
  
      const hour12 = hIdx + 1;
      const minute = mIdx === 1 ? 30 : 0;
      const period = pIdx === 0 ? 'AM' : 'PM';
  
      let hour24 = hour12 % 12;
      if (period === 'PM') hour24 += 12;
      if (period === 'AM' && hour12 === 12) hour24 = 0;
  
      return { hour12, minute, period, hour24 };
    }
  
    function paintResult() {
      if (!resultEl) return;
      const v = getValue();
      const mm = String(v.minute).padStart(2, '0');
      resultEl.textContent =
        `선택: ${v.hour12}:${mm} ${v.period} (${String(v.hour24).padStart(2, '0')}:${mm})`;
    }
  
    if (getBtn) getBtn.addEventListener('click', paintResult);
    [hourWheel, minuteWheel, ampmWheel].forEach(w => {
      w.addEventListener('scroll', () => {
        clearTimeout(w._paintTimer);
        w._paintTimer = setTimeout(paintResult, 120);
      });
    });
  
    /* ---------- 탭해서 해당 항목으로 이동 ---------- */
    function enableTapToSelect(wheel) {
      let startY = 0, moved = false;
  
      wheel.addEventListener('pointerdown', (e) => {
        startY = e.clientY;
        moved  = false;
      }, { passive: true });
  
      wheel.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientY - startY) > 7) moved = true; // 드래그면 탭 취소
      }, { passive: true });
  
      function goToItem(item) {
        const items = Array.from(wheel.querySelectorAll('.item'));
        let idx = items.indexOf(item);
        if (idx < 0) return;
        idx = clamp(idx, 0, items.length - 1);
  
        wheel.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
        // 애니메이션 후 스냅으로 한 번 더 정확히 보정
        setTimeout(() => snapToNearest(wheel, true), 120);
      }
  
      wheel.addEventListener('pointerup', (e) => {
        if (moved) return;
        const item = e.target.closest('.item');
        if (item && wheel.contains(item)) goToItem(item);
      });
  
      // 폴백(오래된 브라우저)
      wheel.addEventListener('click', (e) => {
        if (moved) return;
        const item = e.target.closest('.item');
        if (item && wheel.contains(item)) goToItem(item);
      });
    }
  
    enableTapToSelect(hourWheel);
    enableTapToSelect(minuteWheel);
    enableTapToSelect(ampmWheel);
  
    // 외부에서 접근(선택)
    window.timePicker = {
      get : getValue,
      set : setInitial,
      setNow: setInitialNow,
      recalc: recalcAll
    };
  })();
  