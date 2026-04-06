import { useState, useEffect, useRef } from "react";

/**
 * スクロール位置からアクティブな動画インデックスを検出する。
 * isScrolling も返す（スクロール中はプレーヤーを非表示にするため）。
 */
export function useActiveIndex(containerRef, videoCount) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef(null);

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

    /* --- スクロール状態の検知 --- */
    const onScrollStart = () => {
      setIsScrolling(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };

    const onScrollEnd = () => {
      setIsScrolling(false);
      /* インデックスも再計算 */
      const h = container.clientHeight;
      if (h > 0) {
        const idx = Math.round(container.scrollTop / h);
        setActiveIndex(Math.max(0, Math.min(idx, videoCount - 1)));
      }
    };

    if ("onscrollend" in window) {
      container.addEventListener("scroll", onScrollStart, { passive: true });
      container.addEventListener("scrollend", onScrollEnd, { passive: true });
    } else {
      const handleScroll = () => {
        onScrollStart();
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = setTimeout(onScrollEnd, 150);
      };
      container.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      if ("onscrollend" in window) {
        container.removeEventListener("scroll", onScrollStart);
        container.removeEventListener("scrollend", onScrollEnd);
      }
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [containerRef, videoCount]);

  return { activeIndex, isScrolling };
}
