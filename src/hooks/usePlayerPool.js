import { useRef, useState, useEffect, useCallback } from "react";

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

const PLAYER_VARS = {
  autoplay: 0,
  mute: 1,
  loop: 0,
  controls: 0,
  modestbranding: 1,
  rel: 0,
  showinfo: 0,
  iv_load_policy: 3,
  fs: 0,
  disablekb: 1,
  playsinline: 1,
};

const SLOT_COUNT = 3;

/**
 * 3つのYouTubeプレーヤーを回転管理するフック。
 * DOMの移動は一切行わない。固定位置のスロットにloadVideoById/cueVideoByIdで動画を切り替える。
 */
export function usePlayerPool(videos, activeIndex, removeVideo) {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  /* slotStates[i] = 'IDLE' | 'PRELOADING' | 'ACTIVE' */
  const [slotStates, setSlotStates] = useState(["IDLE", "IDLE", "IDLE"]);

  const audioUnlockedRef = useRef(false);
  const slotsRef = useRef(
    Array.from({ length: SLOT_COUNT }, (_, i) => ({
      id: `yt-slot-${i}`,
      player: null,
      videoId: null,
      ready: false,
      playing: false,
    }))
  );

  /* どのスロットがどの役割か */
  const activeSlotIdx = useRef(0);
  const preloadSlotIdx = useRef(1);
  const idleSlotIdx = useRef(2);

  /* バッファタイムアウト */
  const bufferTimerRef = useRef(null);

  /* 前回のactiveIndex（重複実行防止） */
  const prevActiveIndexRef = useRef(-1);

  /* ─── スロット状態を更新するヘルパー ─── */
  const updateSlotState = useCallback((slotIdx, state) => {
    setSlotStates((prev) => {
      const next = [...prev];
      next[slotIdx] = state;
      return next;
    });
  }, []);

  /* ─── プレーヤー作成（マウント時1回だけ） ─── */
  useEffect(() => {
    onYTReady(() => {
      slotsRef.current.forEach((slot) => {
        if (slot.player) return;

        const div = document.getElementById(slot.id);
        if (!div) return;

        const playerDiv = document.createElement("div");
        div.appendChild(playerDiv);

        new window.YT.Player(playerDiv, {
          playerVars: PLAYER_VARS,
          events: {
            onReady: (event) => {
              slot.player = event.target;
              slot.ready = true;
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                slot.playing = true;
                /* バッファタイムアウト解除 */
                if (bufferTimerRef.current) {
                  clearTimeout(bufferTimerRef.current);
                  bufferTimerRef.current = null;
                }
              }
              /* ループ再生 */
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
              if (slot.videoId) {
                removeVideo(slot.videoId);
              }
            },
          },
        });
      });
    });

    return () => {
      slotsRef.current.forEach((slot) => {
        if (slot.player) {
          try { slot.player.destroy(); } catch {}
          slot.player = null;
        }
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── activeIndex変更時のスロット回転 ─── */
  useEffect(() => {
    if (!audioUnlockedRef.current) return;
    if (prevActiveIndexRef.current === activeIndex) return;

    const video = videos[activeIndex];
    if (!video) return;

    const prevIdx = prevActiveIndexRef.current;
    prevActiveIndexRef.current = activeIndex;

    const aSlot = slotsRef.current[activeSlotIdx.current];
    const pSlot = slotsRef.current[preloadSlotIdx.current];
    const iSlot = slotsRef.current[idleSlotIdx.current];

    /* バッファタイマーリセット */
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }

    /* 順方向スクロール: preloadスロットが次の動画を持っている場合 */
    if (pSlot.videoId === video.videoId && pSlot.ready) {
      /* preload → ACTIVE */
      pSlot.playing = false;
      pSlot.player.playVideo();
      if (!isMuted) {
        pSlot.player.unMute();
        pSlot.player.setVolume(100);
      }
      updateSlotState(preloadSlotIdx.current, "ACTIVE");

      /* active → IDLE */
      if (aSlot.player) aSlot.player.pauseVideo();
      updateSlotState(activeSlotIdx.current, "IDLE");

      /* idle → PRELOADING（次の次の動画） */
      const nextVideo = videos[activeIndex + 1];
      if (nextVideo && iSlot.ready && iSlot.player) {
        iSlot.videoId = nextVideo.videoId;
        iSlot.playing = false;
        iSlot.player.cueVideoById(nextVideo.videoId);
        updateSlotState(idleSlotIdx.current, "PRELOADING");
      }

      /* インデックス回転 */
      const oldActive = activeSlotIdx.current;
      activeSlotIdx.current = preloadSlotIdx.current;
      preloadSlotIdx.current = idleSlotIdx.current;
      idleSlotIdx.current = oldActive;
    } else {
      /* ジャンプ or 逆方向: activeスロットで直接ロード */
      if (aSlot.ready && aSlot.player) {
        aSlot.videoId = video.videoId;
        aSlot.playing = false;
        aSlot.player.loadVideoById({ videoId: video.videoId, startSeconds: 0 });
        if (!isMuted) {
          aSlot.player.unMute();
          aSlot.player.setVolume(100);
        }
      }

      /* 次の動画をpreloadスロットにキュー */
      const nextVideo = videos[activeIndex + 1];
      if (nextVideo && pSlot.ready && pSlot.player) {
        pSlot.videoId = nextVideo.videoId;
        pSlot.playing = false;
        pSlot.player.cueVideoById(nextVideo.videoId);
        updateSlotState(preloadSlotIdx.current, "PRELOADING");
      }
    }

    /* バッファタイムアウト: 8秒以内にPLAYING状態にならなければスキップ */
    bufferTimerRef.current = setTimeout(() => {
      const currentSlot = slotsRef.current[activeSlotIdx.current];
      if (!currentSlot.playing && currentSlot.videoId) {
        removeVideo(currentSlot.videoId);
      }
    }, 8000);
  }, [activeIndex, videos, isMuted, updateSlotState, removeVideo]);

  /* ─── startPlayback: 初回タップ時（ジェスチャーコンテキスト内で同期実行） ─── */
  const startPlayback = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    setIsMuted(false);

    const slot = slotsRef.current[activeSlotIdx.current];
    const video = videos[0];
    if (!video) return;

    prevActiveIndexRef.current = 0;

    if (slot.ready && slot.player) {
      slot.videoId = video.videoId;
      slot.playing = false;
      /* ★ ジェスチャーコンテキスト内で同期呼び出し */
      slot.player.loadVideoById({ videoId: video.videoId, startSeconds: 0 });
      slot.player.unMute();
      slot.player.setVolume(100);
      updateSlotState(activeSlotIdx.current, "ACTIVE");

      /* 次の動画をプリロード */
      const nextVideo = videos[1];
      const pSlot = slotsRef.current[preloadSlotIdx.current];
      if (nextVideo && pSlot.ready && pSlot.player) {
        pSlot.videoId = nextVideo.videoId;
        pSlot.player.cueVideoById(nextVideo.videoId);
        updateSlotState(preloadSlotIdx.current, "PRELOADING");
      }
    }

    /* バッファタイムアウト */
    bufferTimerRef.current = setTimeout(() => {
      const currentSlot = slotsRef.current[activeSlotIdx.current];
      if (!currentSlot.playing && currentSlot.videoId) {
        removeVideo(currentSlot.videoId);
      }
    }, 8000);
  }, [videos, updateSlotState, removeVideo]);

  /* ─── toggleMute ─── */
  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const slot = slotsRef.current[activeSlotIdx.current];
    if (!slot.player) return;

    if (slot.player.isMuted()) {
      slot.player.unMute();
      slot.player.setVolume(100);
      setIsMuted(false);
    } else {
      slot.player.mute();
      setIsMuted(true);
    }
  }, []);

  return {
    slotStates,
    audioUnlocked,
    isMuted,
    startPlayback,
    toggleMute,
  };
}
