import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import type { GameStats, PlaybackEvent } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type UseNoteHighwayScoringOptions = {
  currentEventIndex: number;
  currentGameEvent: PlaybackEvent | undefined;
  detectedNote: DetectedNote | null;
  playbackEvents: PlaybackEvent[];
  targetEventIndex: number | null;
};

const emptyGameStats: GameStats = {
  hits: 0,
  misses: 0,
  streak: 0,
};

export const useNoteHighwayScoring = ({
  currentEventIndex,
  currentGameEvent,
  detectedNote,
  playbackEvents,
  targetEventIndex,
}: UseNoteHighwayScoringOptions) => {
  const [gameStats, setGameStats] = useState<GameStats>(emptyGameStats);
  const [lastHitIndex, setLastHitIndex] = useState<number | null>(null);
  const scoredEventIndexRef = useRef<number | null>(null);
  const previousEventIndexRef = useRef(0);

  const currentTargetMidiNumbers = useMemo(
    () =>
      new Set(
        (currentGameEvent?.notes ?? [])
          .filter((note) => note.shouldPlay)
          .map((note) => Note.midi(note.name))
          .filter((midi): midi is number => midi !== null)
      ),
    [currentGameEvent]
  );
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const isCurrentHit =
    targetEventIndex !== null &&
    detectedMidi !== null &&
    currentTargetMidiNumbers.has(detectedMidi) &&
    Math.abs(detectedNote?.cents ?? 99) <= 35;
  const accuracy =
    gameStats.hits + gameStats.misses > 0
      ? Math.round((gameStats.hits / (gameStats.hits + gameStats.misses)) * 100)
      : 0;

  const resetScoring = useCallback(() => {
    setGameStats(emptyGameStats);
    setLastHitIndex(null);
    scoredEventIndexRef.current = null;
    previousEventIndexRef.current = 0;
  }, []);

  useEffect(() => {
    if (
      targetEventIndex === null ||
      !isCurrentHit ||
      scoredEventIndexRef.current === targetEventIndex
    ) {
      return;
    }

    scoredEventIndexRef.current = targetEventIndex;
    setLastHitIndex(targetEventIndex);
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
  }, [isCurrentHit, targetEventIndex]);

  useEffect(() => {
    const previousIndex = previousEventIndexRef.current;
    if (currentEventIndex <= previousIndex) {
      previousEventIndexRef.current = currentEventIndex;
      return;
    }

    const previousEvent = playbackEvents[previousIndex];
    const shouldScoreMiss =
      previousEvent?.notes.some((note) => note.shouldPlay) &&
      scoredEventIndexRef.current !== previousIndex;

    if (shouldScoreMiss) {
      setGameStats((stats) => ({
        ...stats,
        misses: stats.misses + 1,
        streak: 0,
      }));
    }

    previousEventIndexRef.current = currentEventIndex;
  }, [currentEventIndex, playbackEvents]);

  return {
    accuracy,
    gameStats,
    lastHitIndex,
    resetScoring,
  };
};
