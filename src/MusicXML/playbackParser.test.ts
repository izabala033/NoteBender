import { describe, expect, it } from "vitest";
import { getPitchNoteName, getTabHole, parsePlaybackEvents } from "./playbackParser";

const parsePitch = (xml: string) =>
  new DOMParser()
    .parseFromString(xml, "application/xml")
    .getElementsByTagName("pitch")[0];

describe("getPitchNoteName", () => {
  it("includes sharps and flats from MusicXML alter values", () => {
    expect(
      getPitchNoteName(parsePitch("<pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>"))
    ).toBe("F#4");
    expect(
      getPitchNoteName(parsePitch("<pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch>"))
    ).toBe("Bb3");
  });
});

describe("getTabHole", () => {
  it("extracts the absolute harmonica hole from tab text", () => {
    expect(getTabHole("-4''")).toBe(4);
    expect(getTabHole("6o")).toBe(6);
    expect(getTabHole("rest")).toBeNull();
  });
});

describe("parsePlaybackEvents", () => {
  it("builds timed note events with chords, rests, tabs, and articulations", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure>
            <attributes><divisions>2</divisions></attributes>
            <direction>
              <sound tempo="120" />
              <direction-type><dynamics><f /></dynamics></direction-type>
            </direction>
            <note dynamics="80">
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>2</duration>
              <notations>
                <technical><fingering>1</fingering></technical>
                <articulations><accent /></articulations>
              </notations>
            </note>
            <note>
              <chord />
              <pitch><step>E</step><octave>4</octave></pitch>
              <duration>2</duration>
              <notations><technical><fingering>2</fingering></technical></notations>
            </note>
            <note>
              <rest />
              <duration>1</duration>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.detectedTempo).toBe(120);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      durationBeats: 1,
      tempoBpm: 120,
      tabs: ["1", "2"],
    });
    expect(result.events[0].notes).toMatchObject([
      { name: "C4", articulation: "accent", velocity: 0.8 },
      { name: "E4", articulation: "normal" },
    ]);
    expect(result.events[1]).toMatchObject({
      durationBeats: 0.5,
      notes: [],
      tabs: [],
    });
  });

  it("only parses the first staff from the first part", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part id="P1">
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
              <staff>1</staff>
              <notations><technical><fingering>1</fingering></technical></notations>
            </note>
            <note>
              <pitch><step>C</step><octave>3</octave></pitch>
              <duration>1</duration>
              <staff>2</staff>
              <notations><technical><fingering>-1</fingering></technical></notations>
            </note>
          </measure>
        </part>
        <part id="P2">
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>G</step><octave>5</octave></pitch>
              <duration>1</duration>
              <notations><technical><fingering>6</fingering></technical></notations>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].notes).toMatchObject([{ name: "C4" }]);
    expect(result.events[0].tabs).toEqual(["1"]);
  });

  it("maps first-staff events to score-wide cursor positions", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part id="P1">
          <measure>
            <attributes><divisions>1</divisions><staves>2</staves></attributes>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>2</duration>
              <staff>1</staff>
            </note>
            <note>
              <pitch><step>D</step><octave>4</octave></pitch>
              <duration>1</duration>
              <staff>1</staff>
            </note>
            <backup><duration>3</duration></backup>
            <forward><duration>1</duration></forward>
            <note>
              <pitch><step>G</step><octave>3</octave></pitch>
              <duration>1</duration>
              <staff>2</staff>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events.map((event) => event.notes[0]?.name)).toEqual([
      "C4",
      "D4",
    ]);
    expect(result.events.map((event) => event.sourceEventIndex)).toEqual([
      0,
      2,
    ]);
  });

  it("parses all notes when the first part has no staff numbers", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
            <note>
              <pitch><step>D</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events.map((event) => event.notes[0]?.name)).toEqual([
      "C4",
      "D4",
    ]);
  });

  it("expands simple repeat blocks while keeping source event indexes", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <barline location="left">
              <repeat direction="forward" />
            </barline>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
          </measure>
          <measure number="2">
            <note>
              <pitch><step>D</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
            <barline location="right">
              <repeat direction="backward" />
            </barline>
          </measure>
          <measure number="3">
            <note>
              <pitch><step>E</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events.map((event) => event.notes[0]?.name)).toEqual([
      "C4",
      "D4",
      "C4",
      "D4",
      "E4",
    ]);
    expect(result.events.map((event) => event.sourceEventIndex)).toEqual([
      0,
      1,
      0,
      1,
      2,
    ]);
  });

  it("repeats from the beginning when a backward repeat has no forward repeat", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
          </measure>
          <measure number="2">
            <note>
              <pitch><step>D</step><octave>4</octave></pitch>
              <duration>1</duration>
            </note>
            <barline location="right">
              <repeat direction="backward" times="3" />
            </barline>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events.map((event) => event.notes[0]?.name)).toEqual([
      "C4",
      "D4",
      "C4",
      "D4",
      "C4",
      "D4",
    ]);
  });

  it("extends tie starts and disables repeated tie-stop playback", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>G</step><octave>4</octave></pitch>
              <duration>1</duration>
              <tie type="start" />
            </note>
            <note>
              <pitch><step>G</step><octave>4</octave></pitch>
              <duration>1</duration>
              <tie type="stop" />
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events[0].notes[0]).toMatchObject({
      name: "G4",
      durationBeats: 2,
      shouldPlay: true,
    });
    expect(result.events[1].notes[0]).toMatchObject({
      name: "G4",
      durationBeats: 1,
      shouldPlay: false,
    });
  });

  it("resolves notation-only tied notes as a single held playback note", () => {
    const result = parsePlaybackEvents(`
      <score-partwise>
        <part>
          <measure>
            <attributes><divisions>1</divisions></attributes>
            <note>
              <pitch><step>A</step><octave>4</octave></pitch>
              <duration>1</duration>
              <notations><tied type="start" /></notations>
            </note>
            <note>
              <pitch><step>A</step><octave>4</octave></pitch>
              <duration>1</duration>
              <notations><tied type="continue" /></notations>
            </note>
            <note>
              <pitch><step>A</step><octave>4</octave></pitch>
              <duration>2</duration>
              <notations><tied type="stop" /></notations>
            </note>
          </measure>
        </part>
      </score-partwise>
    `);

    expect(result.events[0].notes[0]).toMatchObject({
      name: "A4",
      durationBeats: 4,
      shouldPlay: true,
    });
    expect(result.events[1].notes[0]).toMatchObject({
      name: "A4",
      shouldPlay: false,
    });
    expect(result.events[2].notes[0]).toMatchObject({
      name: "A4",
      shouldPlay: false,
    });
  });
});
