import { useState, useRef, useEffect, useCallback } from "react";

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

export default function VideoCard({ video, isActive, onError }) {
  const [muted, setMuted] = useState(true);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const bufferTimerRef = useRef(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      hasPlayedRef.current = false;
      return;
    }

    if (playerRef.current) return;

    onYTReady(() => {
      if (!containerRef.current) return;

      const player = new window.YT.Player(containerRef.current, {
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
            setPlayerReady(true);
            event.target.mute();
            event.target.playVideo();

            bufferTimerRef.current = setTimeout(() => {
              if (!hasPlayedRef.current && onError) {
                onError(video.videoId);
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
          },
          onError: () => {
            if (bufferTimerRef.current) {
              clearTimeout(bufferTimerRef.current);
              bufferTimerRef.current = null;
            }
            if (onError) onError(video.videoId);
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
        setPlayerReady(false);
      }
    };
  }, [isActive, video.videoId, onError]);

  useEffect(() => {
    if (!playerReady || !playerRef.current?.playVideo) return;

    if (isActive) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isActive, playerReady]);

  useEffect(() => {
    if (!playerReady || !playerRef.current?.mute) return;

    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [muted, playerReady]);

  const handleMuteToggle = useCallback((e) => {
    e.stopPropagation();
    setMuted((prev) => !prev);
  }, []);

  return (
    <div className="video-card">
      {!isActive && (
        <img
          className="video-thumbnail"
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
        />
      )}

      {isActive && (
        <div className="video-iframe-wrapper">
          <div ref={containerRef} className="video-player-container" />
        </div>
      )}

      <div className="video-overlay">
        <div className="video-info">
          <p className="video-title">{video.title}</p>
          <p className="video-channel">{video.channelTitle}</p>
        </div>
        <button className="mute-btn" onClick={handleMuteToggle}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
