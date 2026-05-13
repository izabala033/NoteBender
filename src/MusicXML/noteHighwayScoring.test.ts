import { describe, expect, it } from "vitest";
import {
  getGameAccuracy,
  getTargetMidiNumbers,
  hasPlayableNotes,
  isDetectedPitchHit,
} from "./noteHighwayScoring";
import type { PlaybackEvent, PlaybackNote } from "./types";

const makeNote = (
  name: string,
  shouldPlay = true
): PlaybackNote => ({
  name,
  durationBeats: 1,
  velocity: 0.68,
  articulation: "normal",
  tieStart: false,
  tieStop: false,
  shouldPlay,
});

const makeEvent = (notes: PlaybackNote[]): PlaybackEvent => ({
  durationBeats: 1,
  tempoBpm: 120,
  notes,
  tabs: [],
  sourceEventIndex: 0,
});

describe("note highway scoring helpers", () => {
  it("builds target midi numbers only from playable notes", () => {
    const event = makeEvent([makeNote("C4"), makeNote("E4", false)]);

    expect(getTargetMidiNumbers(event)).toEqual(new Set([60]));
    expect(hasPlayableNotes(event)).toBe(true);
    expect(hasPlayableNotes(makeEvent([makeNote("D4", false)]))).toBe(false);
    expect(hasPlayableNotes(undefined)).toBe(false);
  });

  it("matches detected pitches by midi number and cents tolerance", () => {
    const targetMidiNumbers = new Set([60]);

    expect(
      isDetectedPitchHit(targetMidiNumbers, { note: "C4", cents: 35 })
    ).toBe(true);
    expect(
      isDetectedPitchHit(targetMidiNumbers, { note: "C4", cents: 36 })
    ).toBe(false);
    expect(
      isDetectedPitchHit(targetMidiNumbers, { note: "C#4", cents: 0 })
    ).toBe(false);
    expect(isDetectedPitchHit(targetMidiNumbers, null)).toBe(false);
  });

  it("reports rounded accuracy and keeps empty scoring at zero", () => {
    expect(getGameAccuracy({ hits: 0, misses: 0, streak: 0 })).toBe(0);
    expect(getGameAccuracy({ hits: 2, misses: 1, streak: 2 })).toBe(67);
  });
});
