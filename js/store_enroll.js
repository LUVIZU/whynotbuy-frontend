// store_enroll.js — 휠 피커(12h, 분 1단위)
// - 중앙에 온 값만 선택/입력
// - 마우스/트랙패드 휠 1회당 정확히 한 칸 이동 (스냅 없음)
(function () {
  const pad2 = (n) => String(n).padStart(2, "0");
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1..12
  const mins = Array.from({ length: 60 }, (_, i) => pad2(i)); // 00..59
  const aps = ["am", "pm"];

  // 12h <-> 24h
  const to24h = (h12, ap) => {
    let h = parseInt(h12, 10);
    if (ap === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return pad2(h);
  };
  const from24h = (hh) => {
    const n = parseInt(hh, 10);
    const ap = n >= 12 ? "pm" : "am";
    let h = n % 12;
    if (h === 0) h = 12;
    return { h12: String(h), ap };
  };

  document.addEventListener("DOMContentLoaded", () => {
    const wheel = document.getElementById("time-wheel");
    if (!wheel) return;

    const hourCol = wheel.querySelector(".hour");
    const minCol = wheel.querySelector(".minute");
    const apCol = wheel.querySelector(".ampm");

    const openInput = document.getElementById("open-time");
    const closeInput = document.getElementById("close-time");
    let targetInput = null;

    // 아이템 높이
    const getItemH = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--item-h"
      );
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v > 0) return v;
      const sample = wheel.querySelector(".item");
      if (sample) {
        const h = sample.getBoundingClientRect().height;
        if (h) return h;
      }
      return 34; // fallback
    };

    // 컬럼 구성 (위/아래 여유 아이템 2개)
    const buildColumn = (col, values) => {
      const spacer = ["", ""];
      const items = [...spacer, ...values, ...spacer];
      col.innerHTML = items.map((v) => `<div class="item">${v}</div>`).join("");
      centerToIndex(col, 2); // 시작 위치(첫 값 근처)
      markActive(col);
    };

    // ▼ 중앙 기준 인덱스/값
    const centerOffsetOf = (col) => col.clientHeight / 2 - getItemH() / 2;

    const indexAtCenter = (col) => {
      const itemH = getItemH();
      const centerOffset = centerOffsetOf(col);
      return Math.round((col.scrollTop + centerOffset) / itemH);
    };

    const valueAtCenter = (col) => {
      const i = indexAtCenter(col);
      const els = col.querySelectorAll(".item");
      return els[i] ? els[i].textContent.trim() : "";
    };

    const centerToIndex = (col, idx) => {
      const itemH = getItemH();
      const centerOffset = centerOffsetOf(col);
      col.scrollTop = idx * itemH - centerOffset;
    };

    const setColToValue = (col, values, value) => {
      const i = values.indexOf(value);
      if (i < 0) return;
      centerToIndex(col, i + 2); // spacer 2개 보정
      markActive(col);
    };

    const markActive = (col) => {
      const i = indexAtCenter(col);
      const items = col.querySelectorAll(".item");
      items.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
    };

    // 초기 구성
    buildColumn(hourCol, hours);
    buildColumn(minCol, mins);
    buildColumn(apCol, aps);

    // 디바운스: 스크롤 멈춘 후 값 반영 (자동 스냅 없음)
    const debounce = (fn, d = 120) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), d);
      };
    };

    const updateFromCenter = () => {
      [hourCol, minCol, apCol].forEach(markActive);
      if (!targetInput) return;
      const h = valueAtCenter(hourCol);
      const m = valueAtCenter(minCol);
      const a = valueAtCenter(apCol);
      if (h && m && a) targetInput.value = `${to24h(h, a)}:${m}`;
    };

    const onStop = debounce(updateFromCenter, 120);
    [hourCol, minCol, apCol].forEach((col) => {
      col.addEventListener("scroll", onStop, { passive: true });
    });

    // ── 휠 1회당 정확히 한 칸 이동 (트랙패드/마우스) ──
    function clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }
    const firstValueIdx = 2; // spacer 보정
    const lastValueIdx = (col) => col.querySelectorAll(".item").length - 3;

    function stepOnce(col, dir /* +1 | -1 */) {
      const cur = indexAtCenter(col);
      const next = clamp(cur + dir, firstValueIdx, lastValueIdx(col));
      centerToIndex(col, next);
      markActive(col);
      updateFromCenter();
    }

    function onWheelStep(e) {
      e.preventDefault(); // 기본 스크롤 막고 우리 로직만 수행
      const col = e.currentTarget;

      // 빠른 연속 이벤트를 1스텝으로 제한(잠금)
      if (col._wheelLock) return;
      col._wheelLock = true;
      const dir = e.deltaY > 0 ? +1 : -1;
      stepOnce(col, dir);
      setTimeout(() => {
        col._wheelLock = false;
      }, 140);
    }

    [hourCol, minCol, apCol].forEach((col) => {
      col.addEventListener("wheel", onWheelStep, { passive: false });
      // 키보드 ↑/↓ 지원
      col.tabIndex = 0;
      col.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          e.preventDefault();
          stepOnce(col, +1);
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault();
          stepOnce(col, -1);
        }
      });
    });

    // 휠 열기/닫기
    function showWheelFor(inputEl) {
      targetInput = inputEl;

      const rect = inputEl.getBoundingClientRect();
      const host = document.querySelector("main")?.getBoundingClientRect() || {
        top: 0,
      };
      wheel.style.left = `50%`;
      wheel.style.transform = `translateX(-50%)`;
      wheel.style.top = `${rect.bottom - host.top + 14}px`;

      const init = inputEl.value || "08:00";
      const [hh, mm] = init.split(":");
      const { h12, ap } = from24h(hh);
      setColToValue(hourCol, hours, h12);
      setColToValue(minCol, mins, (mm || "00").padStart(2, "0"));
      setColToValue(apCol, aps, ap);

      wheel.hidden = false;
      updateFromCenter();
    }
    function hideWheel() {
      wheel.hidden = true;
      targetInput = null;
    }

    [openInput, closeInput].forEach((inp) => {
      if (!inp) return;
      inp.readOnly = true;
      const openHandler = (e) => {
        e.preventDefault();
        showWheelFor(inp);
      };
      inp.addEventListener("mousedown", openHandler);
      inp.addEventListener("touchstart", openHandler, { passive: false });
      inp.addEventListener("focus", () => showWheelFor(inp));
      inp.addEventListener("click", openHandler);
    });

    document.addEventListener("click", (e) => {
      if (wheel.hidden) return;
      const insideWheel = wheel.contains(e.target);
      const isInputs = e.target === openInput || e.target === closeInput;
      if (!insideWheel && !isInputs) hideWheel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !wheel.hidden) hideWheel();
    });

    // 리사이즈 시 중앙 강조만 갱신
    window.addEventListener("resize", () => {
      [hourCol, minCol, apCol].forEach(markActive);
    });
  });
})();
