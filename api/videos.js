export default async function handler(req, res) {
  const { q, pageToken } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing query parameter: q" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "YOUTUBE_API_KEY is not configured" });
  }

  const searchParams = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    maxResults: "25",
    order: "relevance",
    videoEmbeddable: "true",
    key: apiKey,
  });

  if (pageToken) {
    searchParams.set("pageToken", pageToken);
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();

  if (!searchRes.ok) {
    return res.status(searchRes.status).json({
      error: searchData.error?.message || "YouTube API error",
    });
  }

  const videoIds = (searchData.items || [])
    .filter((item) => item.id?.videoId)
    .map((item) => item.id.videoId);

  if (videoIds.length === 0) {
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(searchData);
  }

  const statusParams = new URLSearchParams({
    part: "status",
    id: videoIds.join(","),
    key: apiKey,
  });

  const statusRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${statusParams}`
  );
  const statusData = await statusRes.json();

  const embeddableIds = new Set();
  if (statusData.items) {
    statusData.items.forEach((item) => {
      if (item.status?.embeddable) {
        embeddableIds.add(item.id);
      }
    });
  }

  searchData.items = (searchData.items || []).filter(
    (item) => item.id?.videoId && embeddableIds.has(item.id.videoId)
  );

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
  return res.status(200).json(searchData);
}
