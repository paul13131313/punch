import { useRef, useEffect } from "react";

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

export default function VideoCard({ video, isActive, muted, onError }) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
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
      }
    };
  }, [isActive, video.videoId, onError]);

  useEffect(() => {
    if (!playerRef.current?.playVideo) return;

    if (isActive) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isActive]);

  useEffect(() => {
    if (!playerRef.current?.mute) return;

    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [muted]);

  return (
    <div className="video-card">
      <img
        className="video-bg-blur"
        src={video.thumbnail}
        alt=""
        loading="lazy"
      />

      {!isActive && (
        <img
          className="video-thumbnail"
          src={video.thumbnail}
          alt=""
          loading="lazy"
        />
      )}

      {isActive && (
        <div className="video-iframe-wrapper">
          <div ref={containerRef} className="video-player-container" />
        </div>
      )}
    </div>
  );
}
