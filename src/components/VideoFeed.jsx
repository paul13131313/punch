import { useRef, useState, useEffect, useCallback } from "react";
import { useVideos } from "../hooks/useVideos";
import VideoCard from "./VideoCard";
import Spinner from "./Spinner";

/* ─── YouTube IFrame API ローダー ─── */
let ytApiReady = false;
let ytApiCallbacks = [];

function loadYTApi() {
  if (window.YT?.Player) {
    ytApiReady = true;
    return;
  }
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiCallbacks.forEach((cb) => cb());
    ytApiCallbacks = [];
  };

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

function onYTReady(cb) {
  if (ytApiReady) {
    cb();
  } else {
    ytApiCallbacks.push(cb);
    loadYTApi();
  }
}

export default function VideoFeed() {
  const { videos, loading, error, hasMore, loadMore, removeVideo } = useVideos();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const cardRefs = useRef([]);

  /* 単一プレーヤーの管理 */
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);       // プレーヤーiframeの親div
  const currentVideoIdRef = useRef(null);
  const bufferTimerRef = useRef(null);
  const hasPlayedRef = useRef(false);

  /* ─── IntersectionObserver: アクティブ動画検出 ─── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [videos]);

  /* ─── IntersectionObserver: 無限スクロール ─── */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, videos]);

  /* ─── プレーヤー初期化（1回だけ） ─── */
  useEffect(() => {
    if (!started || playerRef.current) return;

    const video = videos[activeIndex];
    if (!video) return;

    /* プレーヤーホスト要素を作成 */
    const host = document.createElement("div");
    host.className = "player-overlay";
    playerHostRef.current = host;

    /* アクティブなカードに配置 */
    const card = cardRefs.current[activeIndex];
    if (card) {
      const videoCard = card.querySelector(".video-card");
      if (videoCard) videoCard.appendChild(host);
    }

    const playerDiv = document.createElement("div");
    host.appendChild(playerDiv);

    onYTReady(() => {
      currentVideoIdRef.current = video.videoId;
      hasPlayedRef.current = false;

      const player = new window.YT.Player(playerDiv, {
        videoId: video.videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          loop: 1,
          playlist: video.videoId,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            event.target.mute();
            event.target.playVideo();

            bufferTimerRef.current = setTimeout(() => {
              if (!hasPlayedRef.current) {
                handleVideoError(currentVideoIdRef.current);
              }
            }, 8000);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              hasPlayedRef.current = true;
              if (bufferTimerRef.current) {
                clearTimeout(bufferTimerRef.current);
                bufferTimerRef.current = null;
              }
            }
            /* ループ再生: 動画が終了したら先頭に戻す */
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          },
          onError: () => {
            if (bufferTimerRef.current) {
              clearTimeout(bufferTimerRef.current);
              bufferTimerRef.current = null;
            }
            handleVideoError(currentVideoIdRef.current);
          },
        },
      });
    });
  }, [started, videos, activeIndex]);

  /* ─── 動画切り替え（loadVideoById） ─── */
  useEffect(() => {
    if (!started || !playerRef.current) return;

    const video = videos[activeIndex];
    if (!video) return;

    /* 同じ動画なら何もしない */
    if (currentVideoIdRef.current === video.videoId) {
      /* ただしプレーヤーの位置は更新 */
      movePlayerToCard(activeIndex);
      return;
    }

    /* バッファタイマーリセット */
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    hasPlayedRef.current = false;
    currentVideoIdRef.current = video.videoId;

    /* プレーヤーを新しいカード位置に移動 */
    movePlayerToCard(activeIndex);

    /* 動画を切り替え */
    playerRef.current.loadVideoById({
      videoId: video.videoId,
      startSeconds: 0,
    });

    /* ミュート状態を維持 */
    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }

    /* バッファタイムアウト */
    bufferTimerRef.current = setTimeout(() => {
      if (!hasPlayedRef.current) {
        handleVideoError(video.videoId);
      }
    }, 8000);
  }, [activeIndex, started, videos]);

  /* ─── ミュート切り替え反映 ─── */
  useEffect(() => {
    if (!playerRef.current?.mute) return;

    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [muted]);

  /* ─── ヘルパー: プレーヤーをカードに移動 ─── */
  function movePlayerToCard(index) {
    const host = playerHostRef.current;
    if (!host) return;

    const card = cardRefs.current[index];
    if (!card) return;

    const videoCard = card.querySelector(".video-card");
    if (videoCard && host.parentElement !== videoCard) {
      videoCard.appendChild(host);
    }
  }

  /* ─── コールバック ─── */
  const setCardRef = useCallback((idx) => (el) => {
    cardRefs.current[idx] = el;
  }, []);

  const handleVideoError = useCallback((videoId) => {
    removeVideo(videoId);
  }, [removeVideo]);

  const handleStart = useCallback(() => {
    if (!started) {
      setStarted(true);
    }
  }, [started]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    setMuted((prev) => !prev);
  }, []);

  /* ─── レンダリング ─── */
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
    <div className="feed" ref={containerRef} onClick={handleStart}>
      {!started && videos.length > 0 && (
        <div className="tap-to-start">
          <div className="tap-to-start-inner">
            <span className="tap-to-start-emoji">🐵</span>
            <span className="tap-to-start-text">タップして再生</span>
          </div>
        </div>
      )}

      <button
        className={`mute-btn ${muted ? "is-muted" : "is-unmuted"}`}
        onClick={toggleMute}
        aria-label={muted ? "音声ON" : "音声OFF"}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        )}
        <span className="mute-btn-label">{muted ? "音声ON" : "音声OFF"}</span>
      </button>

      {videos.map((video, i) => (
        <div
          key={video.videoId}
          className="feed-item"
          data-index={i}
          ref={setCardRef(i)}
        >
          <VideoCard video={video} />
          <div className="site-title">PUNCH PUNCH PUNCH</div>
        </div>
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="feed-sentinel">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
}
