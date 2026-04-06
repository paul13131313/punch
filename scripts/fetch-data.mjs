import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const QUERY = "パンチくん 市川市動植物園 子ザル";
const MAX_PAGES = 8; // 最大8ページ（25件×8 = 200件分検索）

async function searchVideos(pageToken) {
  const params = new URLSearchParams({
    part: "snippet",
    q: QUERY,
    type: "video",
    maxResults: "25",
    order: "relevance",
    videoEmbeddable: "true",
    key: YOUTUBE_API_KEY,
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube Search API error: ${err.error?.message || res.status}`);
  }
  return res.json();
}

async function checkEmbeddable(videoIds) {
  const params = new URLSearchParams({
    part: "status",
    id: videoIds.join(","),
    key: YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) return new Set();
  const data = await res.json();
  const embeddable = new Set();
  for (const item of data.items || []) {
    if (item.status?.embeddable) embeddable.add(item.id);
  }
  return embeddable;
}

async function checkOembed(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { isVertical: false };
    const data = await res.json();
    return { width: data.width, height: data.height, isVertical: data.height > data.width };
  } catch {
    return { isVertical: false };
  }
}

async function main() {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY environment variable is required");

  console.log(`Fetching videos for: "${QUERY}"`);

  const allVideos = [];
  const seenIds = new Set();
  let pageToken = undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`  Page ${page}...`);
    const data = await searchVideos(pageToken);
    const items = (data.items || []).filter((item) => item.id?.videoId);

    if (items.length === 0) break;

    // Check embeddable
    const videoIds = items.map((item) => item.id.videoId);
    const embeddable = await checkEmbeddable(videoIds);

    for (const item of items) {
      const vid = item.id.videoId;
      if (seenIds.has(vid) || !embeddable.has(vid)) continue;
      seenIds.add(vid);
      allVideos.push({
        videoId: vid,
        title: item.snippet.title,
        thumbnail: `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`,
        channelTitle: item.snippet.channelTitle,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Check oEmbed for vertical video filtering (parallel, batched)
  console.log(`  Checking oEmbed for ${allVideos.length} videos...`);
  const BATCH_SIZE = 10;
  const horizontalVideos = [];

  for (let i = 0; i < allVideos.length; i += BATCH_SIZE) {
    const batch = allVideos.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (v) => {
        const oembed = await checkOembed(v.videoId);
        return { video: v, isVertical: oembed.isVertical };
      })
    );
    for (const r of results) {
      if (!r.isVertical) horizontalVideos.push(r.video);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const outputPath = join(__dirname, "..", "public", "data.json");
  writeFileSync(outputPath, JSON.stringify(horizontalVideos, null, 0));
  console.log(`Saved ${horizontalVideos.length} horizontal videos to public/data.json (filtered from ${allVideos.length})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
