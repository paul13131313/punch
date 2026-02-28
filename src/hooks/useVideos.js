import { useState, useEffect, useCallback, useRef } from "react";

/* 1つのクエリに統合して重複を根本排除 */
const QUERY = "パンチくん 市川市動植物園 子ザル";

const CACHE_KEY = "punch_videos_v2";
const CACHE_TTL = 30 * 60 * 1000; /* 30分 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* videoIdのSetで重複排除（単一クエリなのでこれで十分） */
function dedup(videos) {
  const seen = new Set();
  return videos.filter((v) => {
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

function parseItems(items) {
  return items
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
    }));
}

export function useVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageTokenRef = useRef(null);
  const loadingRef = useRef(false);

  const fetchVideos = useCallback(async (pageToken) => {
    const params = new URLSearchParams({ q: QUERY });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`/api/videos?${params}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "API error");
    }
    return res.json();
  }, []);

  const loadVideos = useCallback(async (isLoadMore = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      /* キャッシュ読み込み（初回のみ） */
      if (!isLoadMore) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL) {
            setVideos(parsed.videos);
            pageTokenRef.current = parsed.pageToken;
            setHasMore(parsed.hasMore);
            setLoading(false);
            loadingRef.current = false;
            return;
          }
          sessionStorage.removeItem(CACHE_KEY);
        }
      }

      const data = await fetchVideos(isLoadMore ? pageTokenRef.current : undefined);
      const parsed = parseItems(data.items || []);
      const newVideos = shuffle(parsed);

      pageTokenRef.current = data.nextPageToken || null;
      const moreAvailable = !!data.nextPageToken;
      setHasMore(moreAvailable);

      setVideos((prev) => {
        const all = isLoadMore ? dedup([...prev, ...newVideos]) : dedup(newVideos);
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            videos: all,
            pageToken: pageTokenRef.current,
            hasMore: moreAvailable,
            timestamp: Date.now(),
          })
        );
        return all;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetchVideos]);

  useEffect(() => {
    loadVideos(false);
  }, [loadVideos]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      loadVideos(true);
    }
  }, [hasMore, loadVideos]);

  const removeVideo = useCallback((videoId) => {
    setVideos((prev) => {
      const filtered = prev.filter((v) => v.videoId !== videoId);
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          videos: filtered,
          pageToken: pageTokenRef.current,
          hasMore,
          timestamp: Date.now(),
        })
      );
      return filtered;
    });
  }, [hasMore]);

  return { videos, loading, error, hasMore, loadMore, removeVideo };
}
