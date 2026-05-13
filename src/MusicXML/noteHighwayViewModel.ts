import { Note } from "tonal";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIT_WINDOW_MS,
  NOTE_TARGET_LINE_PERCENT,
} from "./constants";
import { getTabHole } from "./playbackParser";
import { getPlaybackNoteDurationMs } from "./playbackTimeline";
import type { VisibleGameEvent } from "./types";

export type NoteHighwayTile = {
  colorClassName: string;
  fontSizePx: number;
  heightPercent: number;
  isActive: boolean;
  isCompact: boolean;
  key: string;
  label: string;
  leftPercent: number;
  opacity: number;
  title: string;
  topPercent: number;
  wasHit: boolean;
};

type CreateNoteHighwayTilesOptions = {
  laneKeys: number[];
  lastHitIndex: number | null;
  visibleGameEvents: VisibleGameEvent[];
  visualPlayheadMs: number;
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

const BEND_TILE_COLORS: Record<string, string> = {
  "-1'": "border-sky-100 bg-sky-600 text-white shadow-sky-950/30",
  "-2'": "border-violet-100 bg-violet-600 text-white shadow-violet-950/30",
  "-2''": "border-violet-50 bg-violet-700 text-white shadow-violet-950/30",
  "-3'": "border-amber-100 bg-amber-500 text-gray-950 shadow-amber-950/30",
  "-3''": "border-amber-50 bg-amber-600 text-white shadow-amber-950/30",
  "-3'''": "border-amber-50 bg-amber-700 text-white shadow-amber-950/30",
  "-4'": "border-emerald-100 bg-emerald-600 text-white shadow-emerald-950/30",
  "-6'": "border-lime-100 bg-lime-500 text-gray-950 shadow-lime-950/30",
  "8'": "border-cyan-100 bg-cyan-500 text-gray-950 shadow-cyan-950/30",
  "9'": "border-fuchsia-100 bg-fuchsia-600 text-white shadow-fuchsia-950/30",
  "10'": "border-yellow-100 bg-yellow-400 text-gray-950 shadow-yellow-950/30",
  "10''": "border-yellow-50 bg-yellow-500 text-gray-950 shadow-yellow-950/30",
};

const OVERNOTE_TILE_COLORS: Record<string, string> = {
  "1o": "border-sky-50 bg-sky-400 text-gray-950 shadow-sky-950/30",
  "4o": "border-emerald-50 bg-emerald-400 text-gray-950 shadow-emerald-950/30",
  "5o": "border-rose-50 bg-rose-400 text-white shadow-rose-950/30",
  "6o": "border-lime-50 bg-lime-300 text-gray-950 shadow-lime-950/30",
  "-7o": "border-orange-50 bg-orange-400 text-gray-950 shadow-orange-950/30",
  "-9o": "border-fuchsia-50 bg-fuchsia-400 text-white shadow-fuchsia-950/30",
  "-10o": "border-yellow-50 bg-yellow-200 text-gray-950 shadow-yellow-950/30",
};

const getTechniqueTileColor = (tab: string) => {
  const normalizedTab = tab.trim().toLowerCase();
  return BEND_TILE_COLORS[normalizedTab] ?? OVERNOTE_TILE_COLORS[normalizedTab];
};

export const getNoteHighwayTileColor = (hole: number | null, tab: string) =>
  hole === null
    ? "border-gray-500 bg-gray-800 text-gray-100 shadow-black/30"
    : getTechniqueTileColor(tab) ??
      NOTE_TILE_COLORS[(hole - 1) % NOTE_TILE_COLORS.length];

export const getNoteHighwayTileFontSizePx = (heightPercent: number) =>
  Math.round(Math.max(7, Math.min(12, heightPercent * 2.6)));

const getLaneIndex = (
  hole: number | null,
  noteIndex: number,
  laneKeys: number[],
  laneCount: number
) => {
  if (hole === null) return noteIndex % laneCount;

  const laneIndex = laneKeys.indexOf(hole);
  return laneIndex >= 0 ? laneIndex : noteIndex % laneCount;
};

const getHighwayPositionPercent = (eventMs: number, visualPlayheadMs: number) =>
  NOTE_TARGET_LINE_PERCENT -
  ((eventMs - visualPlayheadMs) / NOTE_HIGHWAY_LOOKAHEAD_MS) *
    NOTE_TARGET_LINE_PERCENT;

const getTileOpacity = (startTop: number, endTop: number) =>
  Math.max(startTop, endTop) < -4 || Math.min(startTop, endTop) > 94 ? 0 : 1;

const getTileLabel = (tab: string, noteName: string) =>
  tab || Note.pitchClass(noteName);

export const createNoteHighwayTiles = ({
  laneKeys,
  lastHitIndex,
  visibleGameEvents,
  visualPlayheadMs,
}: CreateNoteHighwayTilesOptions): NoteHighwayTile[] => {
  const laneCount = Math.max(laneKeys.length, 1);

  return visibleGameEvents.flatMap(({ event, index, timing }) =>
    event.notes.flatMap((note, noteIndex) => {
      if (!note.shouldPlay) return [];

      const tab = event.tabs[noteIndex] || event.tabs[0] || "";
      const hole = getTabHole(tab);
      const laneIndex = getLaneIndex(hole, noteIndex, laneKeys, laneCount);
      const noteDurationMs = getPlaybackNoteDurationMs(event, timing, note);
      const noteEndMs = timing.startMs + noteDurationMs;
      const startTop = getHighwayPositionPercent(
        timing.startMs,
        visualPlayheadMs
      );
      const endTop = getHighwayPositionPercent(noteEndMs, visualPlayheadMs);
      const topPercent = (startTop + endTop) / 2;
      const heightPercent = Math.abs(startTop - endTop);
      const isActive =
        visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS &&
        visualPlayheadMs <= noteEndMs + NOTE_HIT_WINDOW_MS;
      const label = getTileLabel(tab, note.name);

      return [
        {
          colorClassName: getNoteHighwayTileColor(hole, tab),
          fontSizePx: getNoteHighwayTileFontSizePx(heightPercent),
          heightPercent,
          isActive,
          isCompact: heightPercent < 3.5,
          key: `${index}-${note.name}-${noteIndex}`,
          label,
          leftPercent: ((laneIndex + 0.5) / laneCount) * 100,
          opacity: getTileOpacity(startTop, endTop),
          title: label,
          topPercent,
          wasHit: lastHitIndex === index && isActive,
        },
      ];
    })
  );
};
