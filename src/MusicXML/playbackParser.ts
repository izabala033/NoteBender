import type { PlaybackEvent, PlaybackNote } from "./types";
import {
  getFirstPartMeasures,
  getFirstStaffNumber,
  isFirstStaffNote,
} from "./musicXmlSelection";
import { parseMusicXmlDocument } from "./musicXmlParser";

export const getPitchNoteName = (pitch: Element): string | null => {
  const step = pitch.getElementsByTagName("step")[0]?.textContent ?? "";
  const alter = pitch.getElementsByTagName("alter")[0]?.textContent;
  const octave = pitch.getElementsByTagName("octave")[0]?.textContent ?? "";

  if (!step || !octave) return null;

  const accidental = Number(alter || 0);
  return `${step}${"#".repeat(Math.max(accidental, 0))}${"b".repeat(
    Math.max(-accidental, 0)
  )}${octave}`;
};

export const getTabHole = (tab: string) => {
  const match = tab.match(/^-?\d+/);
  if (!match) return null;

  return Math.abs(Number(match[0]));
};

const getChildNumber = (parent: Element, tagName: string, fallback: number) => {
  const value = Number(parent.getElementsByTagName(tagName)[0]?.textContent);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getTabFromNote = (note: Element) =>
  note.getElementsByTagName("fingering")[0]?.textContent?.trim() || "";

const getMeasureCursorPositionIndexes = (
  measure: Element,
  divisions: number,
  startIndex: number
) => {
  const positions = new Set<number>();
  let cursorPosition = 0;

  Array.from(measure.children).forEach((child) => {
    if (child.tagName === "backup") {
      cursorPosition -= getChildNumber(child, "duration", 0);
      return;
    }

    if (child.tagName === "forward") {
      cursorPosition += getChildNumber(child, "duration", 0);
      return;
    }

    if (child.tagName !== "note") return;

    const isChord = Boolean(child.getElementsByTagName("chord")[0]);
    if (!isChord) {
      positions.add(cursorPosition);
      cursorPosition += getChildNumber(child, "duration", divisions);
    }
  });

  return new Map(
    Array.from(positions)
      .sort((left, right) => left - right)
      .map((position, index) => [position, startIndex + index])
  );
};

const dynamicVelocities: Record<string, number> = {
  ppp: 0.25,
  pp: 0.32,
  p: 0.42,
  mp: 0.52,
  mf: 0.68,
  f: 0.82,
  ff: 0.94,
  fff: 1,
};

const getDynamicVelocity = (direction: Element) => {
  const dynamics = direction.getElementsByTagName("dynamics")[0];
  const dynamic = Array.from(dynamics?.children ?? []).find(
    (child) => child.tagName in dynamicVelocities
  );

  return dynamic ? dynamicVelocities[dynamic.tagName] : null;
};

const getNoteArticulation = (
  note: Element
): PlaybackNote["articulation"] => {
  const articulations = note.getElementsByTagName("articulations")[0];
  if (!articulations) return "normal";
  if (articulations.getElementsByTagName("accent")[0]) return "accent";
  if (articulations.getElementsByTagName("staccato")[0]) return "staccato";
  if (articulations.getElementsByTagName("tenuto")[0]) return "tenuto";

  return "normal";
};

const getNoteVelocity = (note: Element, currentVelocity: number) => {
  const velocity = Number(note.getAttribute("dynamics"));
  if (Number.isFinite(velocity) && velocity > 0) {
    return Math.min(1, Math.max(0.15, velocity / 100));
  }

  return currentVelocity;
};

const getTies = (note: Element) => {
  const tieTypes = [
    ...Array.from(note.getElementsByTagName("tie")),
    ...Array.from(note.getElementsByTagName("tied")),
  ].map((tie) => tie.getAttribute("type"));
  const tieContinues = tieTypes.includes("continue");

  return {
    tieStart: tieTypes.includes("start") || tieContinues,
    tieStop: tieTypes.includes("stop") || tieContinues,
  };
};

const resolveTiedNotes = (events: PlaybackEvent[]) => {
  events.forEach((event, eventIndex) => {
    event.notes.forEach((note) => {
      if (note.tieStop) {
        note.shouldPlay = false;
      }

      if (!note.tieStart || note.tieStop) return;

      for (
        let nextEventIndex = eventIndex + 1;
        nextEventIndex < events.length;
        nextEventIndex += 1
      ) {
        const tiedNote = events[nextEventIndex].notes.find(
          (candidate) => candidate.name === note.name && candidate.tieStop
        );

        if (!tiedNote) break;

        note.durationBeats += events[nextEventIndex].durationBeats;
        tiedNote.shouldPlay = false;

        if (!tiedNote.tieStart) break;
      }
    });
  });

  return events;
};

const clonePlaybackEvent = (event: PlaybackEvent): PlaybackEvent => ({
  ...event,
  notes: event.notes.map((note) => ({ ...note })),
  tabs: [...event.tabs],
});

const getRepeatDirection = (
  measure: Element,
  direction: "forward" | "backward"
) =>
  Array.from(measure.getElementsByTagName("repeat")).find(
    (repeat) => repeat.getAttribute("direction") === direction
  );

const getRepeatTimes = (repeat: Element | undefined) => {
  const times = Number(repeat?.getAttribute("times"));
  return Number.isFinite(times) && times > 1 ? Math.floor(times) : 2;
};

const expandRepeats = (
  measures: { element: Element; events: PlaybackEvent[] }[]
) => {
  const expanded: PlaybackEvent[] = [];
  let repeatStartMeasureIndex = 0;

  measures.forEach((measure, measureIndex) => {
    const forwardRepeat = getRepeatDirection(measure.element, "forward");
    const backwardRepeat = getRepeatDirection(measure.element, "backward");

    if (forwardRepeat) {
      repeatStartMeasureIndex = measureIndex;
    }

    expanded.push(...measure.events.map(clonePlaybackEvent));

    if (!backwardRepeat) return;

    const repeatTimes = getRepeatTimes(backwardRepeat);
    const repeatedMeasures = measures.slice(
      repeatStartMeasureIndex,
      measureIndex + 1
    );

    for (let repeatIndex = 1; repeatIndex < repeatTimes; repeatIndex += 1) {
      repeatedMeasures.forEach((repeatedMeasure) => {
        expanded.push(...repeatedMeasure.events.map(clonePlaybackEvent));
      });
    }

    repeatStartMeasureIndex = measureIndex + 1;
  });

  return expanded;
};

export const parsePlaybackEvents = (xml: string) => {
  const xmlDoc = parseMusicXmlDocument(xml);
  const measuresWithEvents: { element: Element; events: PlaybackEvent[] }[] = [];
  let divisions = 1;
  let detectedTempo = 90;
  let currentTempo = detectedTempo;
  let currentVelocity = dynamicVelocities.mf;
  let nextCursorPositionIndex = 0;
  const firstPart = xmlDoc.getElementsByTagName("part")[0];
  const firstStaffNumber = firstPart ? getFirstStaffNumber(firstPart) : null;

  Array.from(xmlDoc.getElementsByTagName("sound")).some((sound) => {
    const tempo = Number(sound.getAttribute("tempo"));
    if (!Number.isFinite(tempo) || tempo <= 0) return false;

    detectedTempo = tempo;
    return true;
  });

  getFirstPartMeasures(xmlDoc).forEach((measure) => {
    const measureEvents: PlaybackEvent[] = [];
    const attributes = measure.getElementsByTagName("attributes")[0];
    if (attributes) {
      divisions = getChildNumber(attributes, "divisions", divisions);
    }
    const cursorPositionIndexes = getMeasureCursorPositionIndexes(
      measure,
      divisions,
      nextCursorPositionIndex
    );
    let cursorPosition = 0;

    Array.from(measure.children).forEach((child) => {
      if (child.tagName === "direction") {
        const sound = child.getElementsByTagName("sound")[0];
        const tempo = Number(sound?.getAttribute("tempo"));
        const dynamics = Number(sound?.getAttribute("dynamics"));
        const dynamicVelocity = getDynamicVelocity(child);

        if (Number.isFinite(tempo) && tempo > 0) {
          currentTempo = tempo;
        }
        if (Number.isFinite(dynamics) && dynamics > 0) {
          currentVelocity = Math.min(1, Math.max(0.15, dynamics / 100));
        }
        if (dynamicVelocity !== null) {
          currentVelocity = dynamicVelocity;
        }
        return;
      }

      if (child.tagName === "backup") {
        cursorPosition -= getChildNumber(child, "duration", 0);
        return;
      }

      if (child.tagName === "forward") {
        cursorPosition += getChildNumber(child, "duration", 0);
        return;
      }

      if (child.tagName !== "note") return;

      const noteStartPosition = cursorPosition;
      const duration = getChildNumber(child, "duration", divisions);
      const durationBeats = duration / divisions;
      const pitch = child.getElementsByTagName("pitch")[0];
      const noteName = pitch ? getPitchNoteName(pitch) : null;
      const isChord = Boolean(child.getElementsByTagName("chord")[0]);
      const isRest = Boolean(child.getElementsByTagName("rest")[0]);

      if (!isChord) {
        cursorPosition += duration;
      }

      if (!isFirstStaffNote(child, firstStaffNumber)) return;

      const tab = getTabFromNote(child);
      const ties = getTies(child);
      const note = noteName
        ? {
            name: noteName,
            durationBeats,
            velocity: getNoteVelocity(child, currentVelocity),
            articulation: getNoteArticulation(child),
            shouldPlay: true,
            ...ties,
          }
        : null;

      if (isChord && measureEvents.length) {
        if (note) measureEvents[measureEvents.length - 1].notes.push(note);
        if (tab) measureEvents[measureEvents.length - 1].tabs.push(tab);
        return;
      }

      measureEvents.push({
        durationBeats,
        tempoBpm: currentTempo,
        notes: note && !isRest ? [note] : [],
        tabs: tab ? [tab] : [],
        sourceEventIndex: cursorPositionIndexes.get(noteStartPosition) ?? 0,
      });
    });

    measuresWithEvents.push({ element: measure, events: measureEvents });
    nextCursorPositionIndex += cursorPositionIndexes.size;
  });

  const events = expandRepeats(measuresWithEvents);

  return { events: resolveTiedNotes(events), detectedTempo };
};
