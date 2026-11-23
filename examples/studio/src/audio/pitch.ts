/**
 * Speed without the chipmunk. Speed plays the files faster, which on its own raises their pitch like a record spun
 * fast. So at any speed but 1× the master goes through a pitch shifter that puts the pitch back: master → shifter →
 * gate → speakers. The shifter holds the sound for a moment (`lag`), so the playhead waits that long too, and the gate
 * shuts while what is left inside it from before a seek or a pause drains.
 *
 * The shifter (Signalsmith Stretch, an audio worklet) is fetched the first time a speed needs it. Where it can't run,
 * speed keeps its raised pitch.
 */
import type { StretchNode } from "signalsmith-stretch";

export interface Pitch {
  /** Seconds between the sound going in and coming out: the shifter's latency while the master goes through it. */
  lag(): number;
  /** Put the pitch back at `rate`: through the shifter at any speed but 1×, straight out at 1× or while `bypass`
   *  (a hand scrubbing plays grains as recorded, with nothing to put back). */
  set(rate: number, bypass: boolean): void;
  /** Shut the output now; open it again when sound that goes in at `from` (context time) comes out. */
  shut(from?: number): void;
}

/** `ready` is called once the shifter has arrived, for the transport to start again through it. */
export function createPitch(ctx: AudioContext, master: GainNode, ready: () => void): Pitch {
  let shifter: StretchNode | null = null;
  let gate: GainNode | null = null;
  let latency = 0;
  let asked = false;
  /** The master is going through the shifter. */
  let shifting = false;

  function fetchShifter() {
    asked = true;
    import("signalsmith-stretch")
      .then(async ({ default: create }) => {
        const node = await create(ctx);
        const out = ctx.createGain();
        node.connect(out).connect(ctx.destination);
        latency = await node.latency();
        shifter = node;
        gate = out;
        ready();
      })
      .catch(() => {
        // no worklet here: speed keeps its raised pitch
      });
  }

  return {
    lag: () => (shifting ? latency : 0),
    set(rate, bypass) {
      if (rate !== 1 && !asked) fetchShifter();
      const on = rate !== 1 && !bypass && shifter !== null;
      if (on !== shifting && shifter) {
        master.disconnect(on ? ctx.destination : shifter);
        master.connect(on ? shifter : ctx.destination);
        shifting = on;
      }
      if (on) void shifter!.schedule({ active: true, semitones: -12 * Math.log2(rate) });
    },
    shut(from) {
      if (!gate) return;
      const g = gate.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(0, ctx.currentTime);
      if (from !== undefined) g.setTargetAtTime(1, from + latency - 0.01, 0.004);
    },
  };
}
