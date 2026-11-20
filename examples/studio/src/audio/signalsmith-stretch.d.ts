/** The part of Signalsmith Stretch the engine uses: a live-input pitch shifter. The package ships no types. */
declare module "signalsmith-stretch" {
  export interface StretchNode extends AudioWorkletNode {
    schedule(change: { output?: number; active?: boolean; semitones?: number }): Promise<unknown>;
    /** Seconds between audio going in and coming out. */
    latency(): Promise<number>;
  }
  export default function SignalsmithStretch(
    context: BaseAudioContext,
    options?: AudioWorkletNodeOptions,
  ): Promise<StretchNode>;
}
