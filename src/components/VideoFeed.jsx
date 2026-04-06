import { useState, useEffect, useCallback } from "react";
import { useVideos } from "../hooks/useVideos";
import { usePlayer } from "../hooks/usePlayer";
import Spinner from "./Spinner";

export default function VideoFeed() {
  const { videos, loading, error, hasMore, loadMore } = useVideos();
  const [activeIndex, setActiveIndex] = useState(0);
  const { playerDivRef, started, startPlayback } = usePlayer(videos, activeIndex);

  /* ─── 残り少なくなったら追加読み込み ─── */
  useEffect(() => {
    if (activeIndex >= videos.length - 3 && hasMore) {
      loadMore();
    }
  }, [activeIndex, videos.length, hasMore, loadMore]);

  /* ─── タップ: 初回は再生開始 ─── */
  const handleStart = useCallback(() => {
    if (!started) startPlayback();
  }, [started, startPlayback]);

  /* ─── タップ: 次の動画へ ─── */
  const handleNext = useCallback(() => {
    if (!started) return;
    setActiveIndex((prev) => {
      if (prev + 1 < videos.length) return prev + 1;
      if (hasMore) loadMore();
      return prev;
    });
  }, [started, videos.length, hasMore, loadMore]);

  /* ─── エラー / ローディング ─── */
  if (error) {
    return (
      <div className="feed-message">
        <p>読み込みに失敗しました</p>
        <p className="feed-error-detail">{error}</p>
      </div>
    );
  }

  if (loading && videos.length === 0) {
    return <Spinner />;
  }

  return (
    <div className="app-screen">
      <div className="site-title">PUNCH PUNCH PUNCH</div>

      {/* プレーヤー（常に画面中央、pointer-events: none） */}
      <div className={`player-fixed ${started ? "player-fixed--visible" : ""}`}>
        <div className="player-fixed-inner">
          <div ref={playerDivRef} />
        </div>
      </div>

      {/* タップして再生ボタン（画面下部、iframeと重ならない） */}
      {!started && videos.length > 0 && (
        <div className="tap-to-start" onClick={handleStart}>
          <div className="tap-to-start-inner">
            <span className="tap-to-start-emoji">🐵</span>
            <span className="tap-to-start-text">タップして再生</span>
          </div>
        </div>
      )}

      {/* 再生中: 上下のタップエリア（iframeと重ならない黒帯部分） */}
      {started && (
        <>
          <div className="tap-area tap-area--top" onClick={handleNext} />
          <div className="tap-area tap-area--bottom" onClick={handleNext}>
            <span className="tap-next-hint">TAP → NEXT</span>
          </div>
        </>
      )}
    </div>
  );
}
