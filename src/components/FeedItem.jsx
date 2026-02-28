/**
 * フィードアイテム: サムネイルとタイトルのみ。
 * プレーヤーは含まない（PlayerSlotが固定位置で重なる）。
 */
export default function FeedItem({ video, index }) {
  return (
    <div className="feed-item" data-index={index}>
      <div className="site-title">PUNCH PUNCH PUNCH</div>
      <div className="feed-item-card">
        <img
          className="video-thumbnail"
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
        />
      </div>
    </div>
  );
}
