import { useState, useEffect } from "react";

/**
 * スクロール位置からアクティブな動画インデックスを検出する。
 * IntersectionObserver（メイン）+ scrollend/scroll（フォールバック）のハイブリッド方式。
 */
export function useActiveIndex(containerRef, videoCount) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || videoCount === 0) return;

    /* --- IntersectionObserver（メイン検知） --- */
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    container.querySelectorAll(".feed-item").forEach((el) => observer.observe(el));

    /* --- scrollend / scroll フォールバック --- */
    const calcIndex = () => {
      const h = container.clientHeight;
      if (h <= 0) return;
      const idx = Math.round(container.scrollTop / h);
      setActiveIndex(Math.max(0, Math.min(idx, videoCount - 1)));
    };

    let scrollTimer = null;

    if ("onscrollend" in window) {
      container.addEventListener("scrollend", calcIndex, { passive: true });
    } else {
      const handleScroll = () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(calcIndex, 150);
      };
      container.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      if ("onscrollend" in window) {
        container.removeEventListener("scrollend", calcIndex);
      }
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [containerRef, videoCount]);

  return activeIndex;
}
