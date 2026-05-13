import { Gauge, Mic, Pause, Play, RotateCcw, Target } from "lucide-react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  NOTE_LANE_GAP_PX,
  NOTE_TARGET_LINE_PERCENT,
  NOTE_TILE_WIDTH_PX,
} from "./constants";
import {
  createNoteHighwayTiles,
  type NoteHighwayTile,
} from "./noteHighwayViewModel";
import type { GameStats, VisibleGameEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type NoteHighwayProps = {
  accuracy: number;
  canPlayback: boolean;
  clarity: string | null;
  currentTab: string;
  detectedNote: DetectedNote | null;
  gameStats: GameStats;
  isPlaying: boolean;
  laneKeys: number[];
  lastHitIndex: number | null;
  onRestartPlayback: () => void;
  onTogglePlayback: () => void;
  playbackEventsCount: number;
  pitchError: string | null;
  progress: number;
  setTempo: (tempo: number) => void;
  tempo: number;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
};

type PerformanceMetricsProps = {
  accuracy: number;
  gameStats: GameStats;
};

const PerformanceMetrics = ({ accuracy, gameStats }: PerformanceMetricsProps) => (
  <div
    className="flex flex-wrap items-center gap-2 text-xs"
    aria-label="Performance metrics"
  >
    <span className="text-xs font-semibold uppercase tracking-normal text-gray-500">
      Performance
    </span>
    <span className="app-chip">Hits {gameStats.hits}</span>
    <span className="app-chip">Miss {gameStats.misses}</span>
    <span className="app-chip text-emerald-300">
      Streak {gameStats.streak}
    </span>
    <span className="app-chip">{accuracy}% accuracy</span>
  </div>
);

type PlaybackPanelProps = {
  canPlayback: boolean;
  currentTab: string;
  isPlaying: boolean;
  onRestartPlayback: () => void;
  onTogglePlayback: () => void;
  playbackEventsCount: number;
  progress: number;
  setTempo: (tempo: number) => void;
  tempo: number;
};

const PlaybackPanel = ({
  canPlayback,
  currentTab,
  isPlaying,
  onRestartPlayback,
  onTogglePlayback,
  playbackEventsCount,
  progress,
  setTempo,
  tempo,
}: PlaybackPanelProps) => (
  <div className="app-panel-muted mb-3 border-emerald-500/30 shadow-[0_0_22px_rgba(16,185,129,0.08)]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-sm font-semibold text-gray-100">Tab playback</div>
        <div className="text-xs text-gray-500">{playbackEventsCount} notes</div>
      </div>
      <div className="min-w-24 rounded border border-emerald-500/40 bg-emerald-400/10 px-3 py-2 text-center text-xl font-bold tracking-normal text-emerald-200">
        {currentTab || "-"}
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlayback}
          disabled={!canPlayback}
          className="app-button app-button-success h-12 flex-1 text-base"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          aria-label="Restart playback"
          title="Restart playback"
          onClick={onRestartPlayback}
          disabled={!canPlayback}
          className="app-icon-button h-12 w-12"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <label className="block text-sm text-gray-300">
        <span className="mb-1 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Gauge size={16} />
            Tempo
          </span>
          <span>{tempo} bpm</span>
        </span>
        <input
          type="range"
          min="40"
          max="180"
          value={tempo}
          onChange={(event) => setTempo(Number(event.target.value))}
          className="w-full"
          aria-label="Tempo in beats per minute"
        />
      </label>
    </div>

    <div className="mt-3 h-2 overflow-hidden rounded bg-gray-800">
      <div
        className="h-full bg-emerald-500 transition-[width]"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

type LaneMarkersProps = {
  laneKeys: number[];
};

const LaneMarkers = ({ laneKeys }: LaneMarkersProps) => (
  <>
    {Array.from({ length: Math.max(laneKeys.length - 1, 0) }).map(
      (_, lane) => (
        <div
          key={lane}
          className="absolute bottom-0 top-0 border-l border-gray-800"
          style={{ left: `${((lane + 1) / laneKeys.length) * 100}%` }}
        />
      )
    )}

    {laneKeys.map((hole, lane) => (
      <div
        key={`lane-label-${hole}`}
        className="absolute top-2 -translate-x-1/2 text-[10px] font-semibold text-gray-600"
        style={{ left: `${((lane + 0.5) / laneKeys.length) * 100}%` }}
      >
        {hole}
      </div>
    ))}

    {!laneKeys.length && (
      <div className="absolute inset-x-0 top-2 text-center text-[10px] font-semibold text-gray-600">
        No tab lanes
      </div>
    )}
  </>
);

const TargetBand = () => (
  <>
    <div
      className="absolute left-0 right-0 h-[2px] -translate-y-1/2 bg-emerald-200 shadow-[0_0_14px_rgba(110,231,183,0.65)]"
      style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
    />
    <div
      className="absolute left-2 right-2 h-14 -translate-y-1/2 rounded-lg border border-emerald-300/70 bg-emerald-400/10"
      style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
    />
  </>
);

const getTileShapeClassName = (tile: NoteHighwayTile) =>
  tile.isCompact ? "rounded-sm border" : "rounded border-2";

const getTileStateClassName = (tile: NoteHighwayTile) => {
  if (tile.wasHit) return "scale-110 ring-2 ring-emerald-100 brightness-110";
  if (tile.isActive) return "ring-2 ring-white/80 brightness-110";
  return "ring-1 ring-black/30";
};

type HighwayTileProps = {
  laneCount: number;
  tile: NoteHighwayTile;
};

const HighwayTile = ({ laneCount, tile }: HighwayTileProps) => (
  <div
    title={tile.title}
    className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden whitespace-nowrap font-black shadow-lg transition-[transform,filter,box-shadow] ${getTileShapeClassName(
      tile
    )} ${tile.colorClassName} ${getTileStateClassName(tile)}`}
    style={{
      left: `${tile.leftPercent}%`,
      top: `${tile.topPercent}%`,
      width: `min(${NOTE_TILE_WIDTH_PX}px, calc(${100 / laneCount}% - ${NOTE_LANE_GAP_PX}px))`,
      minHeight: "4px",
      height: `${tile.heightPercent}%`,
      fontSize: `${tile.fontSizePx}px`,
      lineHeight: `${tile.fontSizePx}px`,
      opacity: tile.opacity,
      zIndex: tile.wasHit ? 30 : tile.isActive ? 20 : 10,
    }}
  >
    {tile.label}
  </div>
);

type PitchStatusProps = {
  clarity: string | null;
  detectedNote: DetectedNote | null;
  isPlaying: boolean;
  pitchError: string | null;
};

const getDetectedNoteText = (detectedNote: DetectedNote) => {
  const centsPrefix = detectedNote.cents > 0 ? "+" : "";
  return `${Note.pitchClass(detectedNote.note)} ${centsPrefix}${Math.round(
    detectedNote.cents
  )}c`;
};

const PitchStatus = ({
  clarity,
  detectedNote,
  isPlaying,
  pitchError,
}: PitchStatusProps) => {
  const statusClassName = pitchError
    ? "app-status-error"
    : detectedNote
      ? "app-status-success"
      : "app-status-info";
  const message = pitchError
    ? "Mic unavailable"
    : detectedNote
      ? getDetectedNoteText(detectedNote)
      : isPlaying
        ? "Listening"
        : "Press play";

  return (
    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
      <span
        className={`app-status inline-flex items-center gap-2 bg-gray-900/95 ${statusClassName}`}
        role={pitchError ? "alert" : "status"}
      >
        <Mic size={14} />
        {message}
      </span>
      <span className="app-status app-status-info bg-gray-900/95">
        Clarity {clarity || "-"}
      </span>
    </div>
  );
};

export const NoteHighway = ({
  accuracy,
  canPlayback,
  clarity,
  currentTab,
  detectedNote,
  gameStats,
  isPlaying,
  laneKeys,
  lastHitIndex,
  onRestartPlayback,
  onTogglePlayback,
  playbackEventsCount,
  pitchError,
  progress,
  setTempo,
  tempo,
  visibleGameEvents,
  visualPlayheadMs,
}: NoteHighwayProps) => {
  const highwayTiles = createNoteHighwayTiles({
    laneKeys,
    lastHitIndex,
    visibleGameEvents,
    visualPlayheadMs,
  });
  const laneCount = Math.max(laneKeys.length, 1);

  return (
    <div className="app-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-emerald-300" />
          <span className="text-sm font-semibold text-gray-100">
            Note highway
          </span>
        </div>

        <PerformanceMetrics accuracy={accuracy} gameStats={gameStats} />
      </div>

      <PlaybackPanel
        canPlayback={canPlayback}
        currentTab={currentTab}
        isPlaying={isPlaying}
        onRestartPlayback={onRestartPlayback}
        onTogglePlayback={onTogglePlayback}
        playbackEventsCount={playbackEventsCount}
        progress={progress}
        setTempo={setTempo}
        tempo={tempo}
      />

      <div className="relative h-[360px] overflow-hidden rounded border border-gray-800 bg-gray-950 sm:h-[440px] lg:h-[520px]">
        <LaneMarkers laneKeys={laneKeys} />
        <TargetBand />

        {highwayTiles.map((tile) => (
          <HighwayTile key={tile.key} laneCount={laneCount} tile={tile} />
        ))}

        <PitchStatus
          clarity={clarity}
          detectedNote={detectedNote}
          isPlaying={isPlaying}
          pitchError={pitchError}
        />
      </div>
    </div>
  );
};
