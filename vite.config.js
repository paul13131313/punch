import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

function apiPlugin() {
  let env = {};
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
    envFile.split("\n").forEach((line) => {
      const [key, ...val] = line.split("=");
      if (key && val.length) env[key.trim()] = val.join("=").trim();
    });
  } catch {}

  return {
    name: "api-proxy",
    configureServer(server) {
      server.middlewares.use("/api/videos", async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const q = url.searchParams.get("q");
        const pageToken = url.searchParams.get("pageToken");
        const apiKey = env.YOUTUBE_API_KEY;

        if (!q) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing query parameter: q" }));
          return;
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
        if (pageToken) searchParams.set("pageToken", pageToken);

        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${searchParams}`
        );
        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          res.statusCode = searchRes.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(searchData));
          return;
        }

        const videoIds = (searchData.items || [])
          .filter((item) => item.id?.videoId)
          .map((item) => item.id.videoId);

        if (videoIds.length > 0) {
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

          searchData.items = searchData.items.filter(
            (item) => item.id?.videoId && embeddableIds.has(item.id.videoId)
          );
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(searchData));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
});
