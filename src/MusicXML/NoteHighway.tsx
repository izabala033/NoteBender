import { Gauge, Mic, Pause, Play, RotateCcw, Target } from "lucide-react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIT_WINDOW_MS,
  NOTE_LANE_GAP_PX,
  NOTE_TARGET_LINE_PERCENT,
  NOTE_TILE_HEIGHT_PX,
  NOTE_TILE_WIDTH_PX,
} from "./constants";
import { getTabHole } from "./playbackParser";
import { getPlaybackNoteDurationMs } from "./playbackTimeline";
import type { GameStats, PlaybackNote, VisibleGameEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type HighwayTile = {
  heightPercent: number;
  hole: number | null;
  isActive: boolean;
  key: string;
  left: number;
  note: PlaybackNote;
  opacity: number;
  tab: string;
  top: number;
  wasHit: boolean;
};

const NOTE_TILE_COLORS = [
  "border-sky-200 bg-sky-500 text-gray-950 shadow-sky-950/30",
  "border-violet-200 bg-violet-500 text-white shadow-violet-950/30",
  "border-amber-200 bg-amber-400 text-gray-950 shadow-amber-950/30",
  "border-emerald-200 bg-emerald-500 text-gray-950 shadow-emerald-950/30",
  "border-rose-200 bg-rose-500 text-white shadow-rose-950/30",
  "border-lime-200 bg-lime-400 text-gray-950 shadow-lime-950/30",
  "border-orange-200 bg-orange-500 text-gray-950 shadow-orange-950/30",
  "border-cyan-200 bg-cyan-400 text-gray-950 shadow-cyan-950/30",
  "border-fuchsia-200 bg-fuchsia-500 text-white shadow-fuchsia-950/30",
  "border-yellow-200 bg-yellow-300 text-gray-950 shadow-yellow-950/30",
];

const getHoleTileColor = (hole: number | null) =>
  hole === null
    ? "border-gray-500 bg-gray-800 text-gray-100 shadow-black/30"
    : NOTE_TILE_COLORS[(hole - 1) % NOTE_TILE_COLORS.length];

const getHighwayTiles = (
  visibleGameEvents: VisibleGameEvent[],
  laneKeys: number[],
  visualPlayheadMs: number,
  lastHitIndex: number | null
): HighwayTile[] => {
  const laneCount = Math.max(laneKeys.length, 1);
  return visibleGameEvents.flatMap(({ event, index, timing }) =>
    event.notes.flatMap((note, noteIndex) => {
      if (!note.shouldPlay) return [];

      const tab = event.tabs[noteIndex] || event.tabs[0] || "";
      const hole = getTabHole(tab);
      const laneIndex =
        hole === null ? noteIndex % laneCount : laneKeys.indexOf(hole);
      const safeLaneIndex =
        laneIndex >= 0 ? laneIndex : noteIndex % laneCount;
      const left = ((safeLaneIndex + 0.5) / laneCount) * 100;
      const noteDurationMs = getPlaybackNoteDurationMs(event, timing, note);
      const noteEndMs = timing.startMs + noteDurationMs;
      const startTop =
        NOTE_TARGET_LINE_PERCENT -
        ((timing.startMs - visualPlayheadMs) / NOTE_HIGHWAY_LOOKAHEAD_MS) *
          NOTE_TARGET_LINE_PERCENT;
      const endTop =
        NOTE_TARGET_LINE_PERCENT -
        ((noteEndMs - visualPlayheadMs) / NOTE_HIGHWAY_LOOKAHEAD_MS) *
          NOTE_TARGET_LINE_PERCENT;
      const top = (startTop + endTop) / 2;
      const heightPercent = Math.abs(startTop - endTop);
      const isActive =
        visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS &&
        visualPlayheadMs <= noteEndMs + NOTE_HIT_WINDOW_MS;

      return [
        {
          heightPercent,
          hole,
          isActive,
          key: `${index}-${note.name}-${noteIndex}`,
          left,
          note,
          opacity:
            Math.max(startTop, endTop) < -4 ||
            Math.min(startTop, endTop) > 94
              ? 0
              : 1,
          tab,
          top,
          wasHit: lastHitIndex === index && isActive,
        },
      ];
    })
  );
};

type NoteHighwayProps = {
  accuracy: number;
  canPlayback: boolean;
  clarity: string | null;
  currentEventIndex: number;
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

export const NoteHighway = ({
  accuracy,
  canPlayback,
  clarity,
  currentEventIndex,
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
  const highwayTiles = getHighwayTiles(
    visibleGameEvents,
    laneKeys,
    visualPlayheadMs,
    lastHitIndex
  );
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
      </div>

      <div className="app-panel-muted mb-3 border-emerald-500/30 shadow-[0_0_22px_rgba(16,185,129,0.08)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-100">
              Tab playback
            </div>
            <div className="text-xs text-gray-500">
              {playbackEventsCount} notes
            </div>
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

      <div className="grid gap-3 sm:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-[116px_minmax(0,1fr)]">
        <div className="app-panel-muted">
          <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-gray-500">
            Tab
          </div>
          <div className="mb-3 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-3 text-center text-2xl font-bold text-emerald-200">
            {currentTab || "-"}
          </div>
          <div className="space-y-2">
            {visibleGameEvents
              .filter(
                ({ event, index }) =>
                  index > currentEventIndex &&
                  event.notes.some((note) => note.shouldPlay)
              )
              .slice(0, 7)
              .map(({ event, index }) => (
                <div
                  key={`tab-${index}`}
                  className="flex min-h-8 items-center justify-center rounded border border-gray-800 bg-gray-900 px-2 text-sm font-semibold text-gray-300"
                >
                  {event.tabs.join("  ") || "rest"}
                </div>
              ))}
          </div>
        </div>

        <div className="relative h-[360px] overflow-hidden rounded border border-gray-800 bg-gray-950 sm:h-[440px] lg:h-[520px]">
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

          <div
            className="absolute left-0 right-0 h-[2px] -translate-y-1/2 bg-emerald-200 shadow-[0_0_14px_rgba(110,231,183,0.65)]"
            style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
          />
          <div
            className="absolute left-2 right-2 h-14 -translate-y-1/2 rounded-lg border border-emerald-300/70 bg-emerald-400/10"
            style={{ top: `${NOTE_TARGET_LINE_PERCENT}%` }}
          />

          {highwayTiles.map(
            ({
              heightPercent,
              hole,
              isActive,
              key,
              left,
              note,
              opacity,
              tab,
              top,
              wasHit,
            }) => (
              <div
                key={key}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded border-2 text-xs font-black leading-none shadow-lg transition-[transform,filter,box-shadow] ${getHoleTileColor(
                  hole
                )} ${
                  wasHit
                    ? "scale-110 ring-2 ring-emerald-100 brightness-110"
                    : isActive
                      ? "ring-2 ring-white/80 brightness-110"
                      : "ring-1 ring-black/30"
                }`}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `min(${NOTE_TILE_WIDTH_PX}px, calc(${100 / laneCount}% - ${NOTE_LANE_GAP_PX}px))`,
                  height: `max(${NOTE_TILE_HEIGHT_PX}px, ${heightPercent}%)`,
                  opacity,
                  zIndex: wasHit ? 30 : isActive ? 20 : 10,
                }}
              >
                {tab || Note.pitchClass(note.name)}
              </div>
            )
          )}

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
            <span
              className={`app-status inline-flex items-center gap-2 bg-gray-900/95 ${
                pitchError
                  ? "app-status-error"
                  : detectedNote
                    ? "app-status-success"
                    : "app-status-info"
              }`}
              role={pitchError ? "alert" : "status"}
            >
              <Mic size={14} />
              {pitchError
                ? "Mic unavailable"
                : detectedNote
                  ? `${Note.pitchClass(detectedNote.note)} ${
                      detectedNote.cents > 0 ? "+" : ""
                    }${Math.round(detectedNote.cents)}c`
                  : isPlaying
                    ? "Listening"
                    : "Press play"}
            </span>
            <span className="app-status app-status-info bg-gray-900/95">
              Clarity {clarity || "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
