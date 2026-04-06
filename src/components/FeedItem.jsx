/**
 * フィードアイテム: ベージュ背景のみ（スクロール用の高さ確保）。
 * プレーヤーは固定位置の単一プレーヤーが上に重なる。
 */
export default function FeedItem({ video, index }) {
  return (
    <div className="feed-item" data-index={index} />
  );
}
