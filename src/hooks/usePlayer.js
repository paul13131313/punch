import { useRef, useState, useCallback, useEffect } from "react";

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

/* モジュール読み込み時にAPI読み込みを即座に開始（タップまでの待ち時間を短縮） */
loadYTApi();

function onYTReady(cb) {
  if (ytApiReady) cb();
  else ytApiCallbacks.push(cb);
}

/**
 * 1つのYouTubeプレーヤーを管理するフック。
 *
 * 設計方針:
 * - モジュール読み込み時にYT APIロード開始（早期準備）
 * - プレーヤー作成時に最初の動画をcue（プリロード）
 * - タップ時: playVideo() + unMute()（ジェスチャーコンテキスト内で確実に動く）
 * - スクロール時: loadVideoById()（既にPLAYING状態なので自動再生される）
 * - プレーヤー未準備時のタップ: 何もしない（オーバーレイ残る → 再タップ可能）
 */
export function usePlayer(videos, activeIndex) {
  const playerRef = useRef(null);
  const playerDivRef = useRef(null);
  const [started, setStarted] = useState(false);
  const currentVideoRef = useRef(null);
  const startedRef = useRef(false);
  const createdRef = useRef(false);

  /* ─── プレーヤー作成: 最初の動画をcueした状態で作る ─── */
  useEffect(() => {
    if (createdRef.current || videos.length === 0) return;
    createdRef.current = true;

    const firstVideoId = videos[0].videoId;

    onYTReady(() => {
      if (playerRef.current || !playerDivRef.current) return;

      const innerDiv = document.createElement("div");
      playerDivRef.current.appendChild(innerDiv);

      new window.YT.Player(innerDiv, {
        videoId: firstVideoId,
        playerVars: {
          autoplay: 0,
          mute: 1,
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
            currentVideoRef.current = firstVideoId;
          },
          onStateChange: (event) => {
            /* ループ再生 */
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          },
        },
      });
    });

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [videos]);

  /* ─── タップ: 初回再生開始（ジェスチャーコンテキスト内で実行） ─── */
  const startPlayback = useCallback(() => {
    if (startedRef.current) return;

    const player = playerRef.current;
    if (!player) {
      /* プレーヤー未準備 → 何もしない（オーバーレイ残る → ユーザーは再タップ可能） */
      return;
    }

    startedRef.current = true;
    setStarted(true);

    /* アクティブな動画がcue済みの動画と違う場合 → loadVideoById */
    const video = videos[activeIndex];
    if (video && video.videoId !== currentVideoRef.current) {
      currentVideoRef.current = video.videoId;
      player.loadVideoById({ videoId: video.videoId, startSeconds: 0 });
    } else {
      /* cue済みの動画をそのまま再生 */
      player.playVideo();
    }

    /* ジェスチャーコンテキスト内なのでunMuteが確実に効く */
    player.unMute();
    player.setVolume(100);
  }, [videos, activeIndex]);

  /* ─── activeIndex変更時に動画を切り替え ─── */
  useEffect(() => {
    if (!startedRef.current || !playerRef.current) return;
    const video = videos[activeIndex];
    if (!video || video.videoId === currentVideoRef.current) return;

    currentVideoRef.current = video.videoId;
    playerRef.current.loadVideoById({ videoId: video.videoId, startSeconds: 0 });
  }, [activeIndex, videos]);

  return { playerDivRef, started, startPlayback };
}
