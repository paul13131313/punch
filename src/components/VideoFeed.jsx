import { useRef, useState, useEffect, useCallback } from "react";
import { useVideos } from "../hooks/useVideos";
import VideoCard from "./VideoCard";
import Spinner from "./Spinner";

export default function VideoFeed() {
  const { videos, loading, error, hasMore, loadMore, removeVideo } = useVideos();
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const cardRefs = useRef([]);

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

  const setCardRef = useCallback((idx) => (el) => {
    cardRefs.current[idx] = el;
  }, []);

  const handleVideoError = useCallback((videoId) => {
    removeVideo(videoId);
  }, [removeVideo]);

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
    <div className="feed" ref={containerRef}>
      {videos.map((video, i) => (
        <div
          key={video.videoId}
          className="feed-item"
          data-index={i}
          ref={setCardRef(i)}
        >
          <VideoCard
            video={video}
            isActive={i === activeIndex}
            onError={handleVideoError}
          />
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
