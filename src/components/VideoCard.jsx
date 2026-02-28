export default function VideoCard({ video }) {
  return (
    <div className="video-card">
      <img
        className="video-thumbnail"
        src={video.thumbnail}
        alt={video.title}
        loading="lazy"
      />
    </div>
  );
}
