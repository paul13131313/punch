import { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = import.meta.env.BASE_URL;
const PAGE_SIZE = 20;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useVideos() {
  const [allVideos, setAllVideos] = useState([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataLoaded = useRef(false);

  useEffect(() => {
    if (dataLoaded.current) return;
    dataLoaded.current = true;

    fetch(`${BASE_URL}data.json`)
      .then((res) => res.json())
      .then((data) => {
        setAllVideos(shuffle(data));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const videos = allVideos.slice(0, displayCount);
  const hasMore = displayCount < allVideos.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, allVideos.length));
    }
  }, [hasMore, allVideos.length]);

  const removeVideo = useCallback((videoId) => {
    setAllVideos((prev) => prev.filter((v) => v.videoId !== videoId));
  }, []);

  return { videos, loading, error, hasMore, loadMore, removeVideo };
}
