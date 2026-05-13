import { describe, expect, it } from "vitest";
import {
  createNoteHighwayTiles,
  getNoteHighwayTileColor,
  getNoteHighwayTileFontSizePx,
} from "./noteHighwayViewModel";
import type {
  PlaybackEvent,
  PlaybackNote,
  PlaybackTiming,
  VisibleGameEvent,
} from "./types";

const makeNote = (
  name: string,
  durationBeats = 1,
  shouldPlay = true
): PlaybackNote => ({
  name,
  durationBeats,
  velocity: 0.68,
  articulation: "normal",
  tieStart: false,
  tieStop: false,
  shouldPlay,
});

const makeEvent = (notes: PlaybackNote[], tabs: string[]): PlaybackEvent => ({
  durationBeats: 1,
  tempoBpm: 120,
  notes,
  tabs,
  sourceEventIndex: 0,
});

const makeVisibleEvent = (
  event: PlaybackEvent,
  timing: PlaybackTiming,
  index = 0
): VisibleGameEvent => ({
  event,
  index,
  timing,
});

describe("note highway view model", () => {
  it("places playable tiles in their harmonica lane", () => {
    const event = makeEvent([makeNote("C4")], ["-4'"]);
    const tiles = createNoteHighwayTiles({
      laneKeys: [2, 4, 6],
      lastHitIndex: 7,
      visibleGameEvents: [
        makeVisibleEvent(event, { startMs: 1000, durationMs: 500, endMs: 1500 }, 7),
      ],
      visualPlayheadMs: 1000,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({
      colorClassName:
        "border-emerald-100 bg-emerald-600 text-white shadow-emerald-950/30",
      fontSizePx: 12,
      isActive: true,
      isCompact: false,
      label: "-4'",
      leftPercent: 50,
      opacity: 1,
      title: "-4'",
      wasHit: true,
    });
    expect(tiles[0].heightPercent).toBeCloseTo(7.5);
    expect(tiles[0].topPercent).toBeCloseTo(74.25);
  });

  it("falls back to pitch labels and neutral colors when no tab is available", () => {
    const event = makeEvent([makeNote("D4")], []);
    const [tile] = createNoteHighwayTiles({
      laneKeys: [],
      lastHitIndex: null,
      visibleGameEvents: [
        makeVisibleEvent(event, { startMs: 0, durationMs: 500, endMs: 500 }),
      ],
      visualPlayheadMs: 0,
    });

    expect(tile.label).toBe("D");
    expect(tile.leftPercent).toBe(50);
    expect(tile.colorClassName).toBe(
      "border-gray-500 bg-gray-800 text-gray-100 shadow-black/30"
    );
  });

  it("skips muted notes and hides tiles that are far outside the highway", () => {
    const event = makeEvent([makeNote("C4", 1, false), makeNote("E4")], ["4"]);
    const tiles = createNoteHighwayTiles({
      laneKeys: [4],
      lastHitIndex: null,
      visibleGameEvents: [
        makeVisibleEvent(event, { startMs: 10000, durationMs: 500, endMs: 10500 }),
      ],
      visualPlayheadMs: 0,
    });

    expect(tiles).toHaveLength(1);
    expect(tiles[0].label).toBe("4");
    expect(tiles[0].opacity).toBe(0);
  });

  it("centralizes tile color and font sizing rules", () => {
    expect(getNoteHighwayTileColor(6, "6o")).toContain("bg-lime-300");
    expect(getNoteHighwayTileColor(3, "3")).toContain("bg-amber-400");
    expect(getNoteHighwayTileFontSizePx(1)).toBe(7);
    expect(getNoteHighwayTileFontSizePx(10)).toBe(12);
  });
});
