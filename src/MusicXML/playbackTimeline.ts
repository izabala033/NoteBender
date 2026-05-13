import { Note } from "tonal";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIGHWAY_TRAIL_MS,
  NOTE_HIT_WINDOW_MS,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type {
  PlaybackEvent,
  PlaybackNote,
  PlaybackTiming,
  VisibleGameEvent,
} from "./types";

const getPlayableNotes = (event: PlaybackEvent) =>
  event.notes.filter((note) => note.shouldPlay);

export const getPlaybackNoteDurationMs = (
  event: PlaybackEvent,
  timing: PlaybackTiming,
  note: PlaybackNote
) => {
  if (event.durationBeats <= 0) return timing.durationMs;

  return Math.max(
    80,
    timing.durationMs * (note.durationBeats / event.durationBeats)
  );
};

const getVisibleEventEndMs = (
  event: PlaybackEvent,
  timing: PlaybackTiming
) => {
  const playableNotes = getPlayableNotes(event);
  if (!playableNotes.length) return timing.endMs;

  return Math.max(
    timing.endMs,
    ...playableNotes.map(
      (note) => timing.startMs + getPlaybackNoteDurationMs(event, timing, note)
    )
  );
};

export const getPlayableMidiNumbers = (events: PlaybackEvent[]) => {
  const midiNumbers = events
    .flatMap(getPlayableNotes)
    .map((note) => Note.midi(note.name))
    .filter((midi): midi is number => midi !== null);

  return new Set(midiNumbers);
};

export const createPlaybackTimeline = (
  events: PlaybackEvent[],
  tempoScale: number
) => {
  let cursorMs = 0;

  return events.map((event): PlaybackTiming => {
    const effectiveTempo = Math.max(20, event.tempoBpm * tempoScale);
    const durationMs = Math.max(
      80,
      (60000 / effectiveTempo) * event.durationBeats
    );
    const timing = {
      startMs: cursorMs,
      durationMs,
      endMs: cursorMs + durationMs,
    };

    cursorMs = timing.endMs;
    return timing;
  });
};

export const getLaneKeys = (events: PlaybackEvent[]) => {
  const holes = new Set<number>();

  events.forEach((event) => {
    event.tabs.forEach((tab) => {
      const hole = getTabHole(tab);
      if (hole !== null) holes.add(hole);
    });
  });

  return Array.from(holes).sort((a, b) => a - b);
};

export const getVisibleGameEvents = (
  events: PlaybackEvent[],
  timeline: PlaybackTiming[],
  visualPlayheadMs: number
): VisibleGameEvent[] =>
  events
    .map((event, index) => ({
      event,
      index,
      timing: timeline[index],
    }))
    .filter(({ event, timing }) => {
      if (!timing) return false;
      const visibleEndMs = getVisibleEventEndMs(event, timing);
      return (
        visibleEndMs >= visualPlayheadMs - NOTE_HIGHWAY_TRAIL_MS &&
        timing.startMs <= visualPlayheadMs + NOTE_HIGHWAY_LOOKAHEAD_MS
      );
    });

export const getTargetEventIndex = (
  visibleGameEvents: VisibleGameEvent[],
  visualPlayheadMs: number
) => {
  let closestIndex: number | null = null;
  let closestDistanceMs = Number.POSITIVE_INFINITY;

  visibleGameEvents.forEach(({ event, index, timing }) => {
    if (!getPlayableNotes(event).length || !timing) return;

    const distanceMs = Math.abs(timing.startMs - visualPlayheadMs);
    if (distanceMs > NOTE_HIT_WINDOW_MS || distanceMs >= closestDistanceMs) {
      return;
    }

    closestIndex = index;
    closestDistanceMs = distanceMs;
  });

  return closestIndex;
};
