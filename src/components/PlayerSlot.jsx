/**
 * 固定位置のYouTubeプレーヤーコンテナ。
 * DOMは移動しない。YT.Playerがこのdiv内にiframeを生成する。
 */
export default function PlayerSlot({ id, state }) {
  return (
    <div className={`player-slot player-slot--${state.toLowerCase()}`}>
      <div className="player-slot-inner">
        <div id={id} />
      </div>
    </div>
  );
}
