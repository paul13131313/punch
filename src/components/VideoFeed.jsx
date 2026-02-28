import { useRef, useState, useEffect, useCallback } from "react";
import { useVideos } from "../hooks/useVideos";
import { useActiveIndex } from "../hooks/useActiveIndex";
import { usePlayerPool } from "../hooks/usePlayerPool";
import PlayerSlot from "./PlayerSlot";
import FeedItem from "./FeedItem";
import Spinner from "./Spinner";

const SLOT_IDS = ["yt-slot-0", "yt-slot-1", "yt-slot-2"];

export default function VideoFeed() {
  const { videos, loading, error, hasMore, loadMore, removeVideo } = useVideos();
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const activeIndex = useActiveIndex(containerRef, videos.length);
  const {
    slotStates,
    audioUnlocked,
    isMuted,
    startPlayback,
    toggleMute,
  } = usePlayerPool(videos, activeIndex, removeVideo);
  const [showOverlay, setShowOverlay] = useState(true);

  /* ─── タップ: ジェスチャーコンテキスト内で同期実行 ─── */
  const handleTap = useCallback(() => {
    if (audioUnlocked) return;
    startPlayback();
    setShowOverlay(false);
  }, [audioUnlocked, startPlayback]);

  /* ─── 無限スクロール ─── */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, videos]);

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
    <div className="feed" ref={containerRef} onClick={handleTap}>
      {/* タップして再生オーバーレイ */}
      {showOverlay && videos.length > 0 && (
        <div className="tap-to-start">
          <div className="tap-to-start-inner">
            <span className="tap-to-start-emoji">🐵</span>
            <span className="tap-to-start-text">タップして再生</span>
          </div>
        </div>
      )}

      {/* 音声ボタン */}
      {audioUnlocked && (
        <button
          className={`mute-btn ${isMuted ? "is-muted" : "is-unmuted"}`}
          onClick={toggleMute}
          aria-label={isMuted ? "音声ON" : "音声OFF"}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          )}
          <span className="mute-btn-label">{isMuted ? "音声ON" : "音声OFF"}</span>
        </button>
      )}

      {/* ★ 固定位置プレーヤースロット（DOMは動かない） */}
      <div className="player-pool">
        {SLOT_IDS.map((id, i) => (
          <PlayerSlot key={id} id={id} state={slotStates[i]} />
        ))}
      </div>

      {/* フィードアイテム（サムネイルのみ） */}
      {videos.map((video, i) => (
        <FeedItem key={video.videoId} video={video} index={i} />
      ))}

      {/* 無限スクロールセンチネル */}
      {hasMore && (
        <div ref={sentinelRef} className="feed-sentinel">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
}
