import { useState, useEffect, useCallback, useRef } from "react";

const QUERIES = [
  "パンチくん 市川市動植物園",
  "パンチ 子ザル ぬいぐるみ",
];

const CACHE_KEY = "punch_videos_cache";
const CACHE_TTL = 30 * 60 * 1000; /* 30分でキャッシュ失効 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* videoIdの完全一致 + タイトル類似度による重複排除 */
function dedup(videos) {
  const seen = new Set();
  const titles = [];

  return videos.filter((v) => {
    /* videoId重複チェック */
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);

    /* タイトル類似チェック: 正規化して比較 */
    const normalized = v.title
      .replace(/[【】「」『』（）()\[\]#＃]/g, "")
      .replace(/\s+/g, "")
      .slice(0, 20); /* 先頭20文字で比較 */

    for (const t of titles) {
      if (normalized === t || (normalized.length > 8 && t.includes(normalized.slice(0, 8)))) {
        return false;
      }
    }
    titles.push(normalized);
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
  const pageTokens = useRef({});
  const loadingRef = useRef(false);

  const fetchQuery = useCallback(async (q, pageToken) => {
    const params = new URLSearchParams({ q });
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
      if (!isLoadMore) {
        /* キャッシュ読み込み（TTL超過していなければ） */
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL) {
            setVideos(parsed.videos);
            pageTokens.current = parsed.pageTokens;
            setHasMore(parsed.hasMore);
            setLoading(false);
            loadingRef.current = false;
            return;
          }
          /* TTL切れ → キャッシュ破棄 */
          sessionStorage.removeItem(CACHE_KEY);
        }
      }

      const results = await Promise.all(
        QUERIES.map((q) => fetchQuery(q, isLoadMore ? pageTokens.current[q] : undefined))
      );

      const newVideos = [];
      let anyHasMore = false;

      results.forEach((data, i) => {
        const parsed = parseItems(data.items || []);
        newVideos.push(...parsed);
        if (data.nextPageToken) {
          pageTokens.current[QUERIES[i]] = data.nextPageToken;
          anyHasMore = true;
        }
      });

      const merged = dedup(shuffle(newVideos));
      setHasMore(anyHasMore);

      setVideos((prev) => {
        const all = isLoadMore ? dedup([...prev, ...merged]) : merged;
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            videos: all,
            pageTokens: pageTokens.current,
            hasMore: anyHasMore,
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
  }, [fetchQuery]);

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
          pageTokens: pageTokens.current,
          hasMore,
          timestamp: Date.now(),
        })
      );
      return filtered;
    });
  }, [hasMore]);

  return { videos, loading, error, hasMore, loadMore, removeVideo };
}
