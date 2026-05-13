import { describe, expect, it } from "vitest";
import {
  createPlaybackTimeline,
  getLaneKeys,
  getPlaybackNoteDurationMs,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import type { PlaybackEvent } from "./types";

const makeEvent = (
  durationBeats: number,
  tempoBpm: number,
  tabs: string[] = [],
  noteName = "C4"
): PlaybackEvent => ({
  durationBeats,
  tempoBpm,
  tabs,
  sourceEventIndex: 0,
  notes: [
    {
      name: noteName,
      durationBeats,
      velocity: 0.68,
      articulation: "normal",
      tieStart: false,
      tieStop: false,
      shouldPlay: true,
    },
  ],
});

describe("playback timeline helpers", () => {
  it("creates cumulative playback timings using each event tempo", () => {
    const timeline = createPlaybackTimeline(
      [makeEvent(1, 120), makeEvent(2, 60)],
      1
    );

    expect(timeline).toEqual([
      { startMs: 0, durationMs: 500, endMs: 500 },
      { startMs: 500, durationMs: 2000, endMs: 2500 },
    ]);
  });

  it("deduplicates and sorts lane holes from tabs", () => {
    expect(
      getLaneKeys([
        makeEvent(1, 120, ["-4", "6o"]),
        makeEvent(1, 120, ["3'", "-4"]),
      ])
    ).toEqual([3, 4, 6]);
  });

  it("selects only the closest playable event inside the hit window", () => {
    const mutedTieStop = makeEvent(1, 120);
    mutedTieStop.notes[0].shouldPlay = false;
    const events = [makeEvent(1, 120), mutedTieStop, makeEvent(1, 120)];
    const timeline = createPlaybackTimeline(events, 1);
    const visibleEvents = getVisibleGameEvents(events, timeline, 495);

    expect(getTargetEventIndex(visibleEvents, 495)).toBeNull();
    expect(getTargetEventIndex(visibleEvents, 995)).toBe(2);
    expect(getTargetEventIndex(visibleEvents, 300)).toBeNull();
  });

  it("uses extended playable note duration for held highway visibility", () => {
    const heldEvent = makeEvent(1, 120);
    const mutedTieStop = makeEvent(1, 120);
    heldEvent.notes[0].durationBeats = 2;
    heldEvent.notes[0].tieStart = true;
    mutedTieStop.notes[0].shouldPlay = false;
    mutedTieStop.notes[0].tieStop = true;

    const events = [heldEvent, mutedTieStop, makeEvent(1, 120, [], "D4")];
    const timeline = createPlaybackTimeline(events, 1);
    const visibleEvents = getVisibleGameEvents(events, timeline, 1200);

    expect(getPlaybackNoteDurationMs(heldEvent, timeline[0], heldEvent.notes[0]))
      .toBe(1000);
    expect(visibleEvents.map(({ index }) => index)).toContain(0);
    expect(getPlayableMidiNumbers(events)).toEqual(new Set([60, 62]));
  });
});
