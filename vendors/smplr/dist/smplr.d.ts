type AudioInsert = {
    input: AudioNode;
    output: AudioNode;
};

type ChannelConfig = {
    destination: AudioNode;
    volume: number;
    volumeToGain: (volume: number) => number;
    pan?: number;
};
type OutputChannel = Omit<Channel, "input">;
/**
 * An output channel with audio effects
 * @private
 */
declare class Channel {
    #private;
    readonly context: BaseAudioContext;
    /** @deprecated Use `output.volume = n` instead. */
    readonly setVolume: (vol: number) => void;
    readonly input: AudioNode;
    constructor(context: BaseAudioContext, options?: Partial<ChannelConfig>);
    get volume(): number;
    set volume(value: number);
    get pan(): number;
    set pan(value: number);
    addInsert(effect: AudioNode | AudioInsert): void;
    addEffect(name: string, effect: AudioNode | {
        input: AudioNode;
    }, mixValue: number): void;
    setEffectMix(name: string, mix: number): void;
    /** @deprecated Use `setEffectMix(name, mix)` instead. */
    sendEffect(name: string, mix: number): void;
    disconnect(): void;
}

/**
 * Wrap a class so it is callable both as `X(...)` (preferred) and as
 * `new X(...)` (kept for compatibility with pre-1.0 examples). Returns
 * a value with both call and construct signatures.
 *
 * Used by the auxiliary exports (`Sequencer`, `Reverb`, `CacheStorage`,
 * `Scheduler`, `SampleLoader`) to match the dual signature already shipped
 * by `InstrumentFactory`. Instrument factories themselves use the richer
 * `Instrument()` builder instead, which owns option-splitting and the
 * ready-promise lifecycle.
 */
type Constructable<A extends unknown[], R> = {
    (...args: A): R;
    /** @deprecated Call as a function: `X(...)` instead of `new X(...)`. */
    new (...args: A): R;
};

type StorageResponse = {
    readonly status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
    json(): Promise<any>;
    text(): Promise<string>;
};
type Storage = {
    fetch: (url: string) => Promise<StorageResponse>;
};
declare const HttpStorage: Storage;
declare class CacheStorageImpl implements Storage {
    #private;
    constructor(name?: string);
    fetch(url: string): Promise<StorageResponse>;
}
declare const CacheStorage: Constructable<[name?: string | undefined], CacheStorageImpl>;
type CacheStorage = ReturnType<typeof CacheStorage>;

/**
 * Inheritable playback parameters. Can appear at global defaults, group, or region level.
 * More specific levels override less specific ones.
 */
type PlaybackParams = {
    volume?: number;
    tune?: number;
    detune?: number;
    ampRelease?: number;
    ampAttack?: number;
    lpfCutoffHz?: number;
    offset?: number;
    loop?: boolean;
    loopStart?: number;
    loopEnd?: number;
    reverse?: boolean;
};
/**
 * An individual sample region. Maps a sample to a range of notes and velocities.
 */
type SmplrRegion = PlaybackParams & {
    sample: string;
    key?: number;
    keyRange?: [number, number];
    pitch?: number;
    velRange?: [number, number];
    ccRange?: Record<string, [number, number]>;
    seqPosition?: number;
    group?: number;
    offBy?: number;
    trigger?: "first" | "legato";
    ampVelCurve?: [number, number];
    /** Auto-compute loop points from buffer duration ratios (0–1). */
    loopAuto?: {
        startRatio: number;
        endRatio: number;
    };
};
/**
 * A group of regions sharing common constraints and defaults.
 */
type SmplrGroup = PlaybackParams & {
    label?: string;
    keyRange?: [number, number];
    velRange?: [number, number];
    ccRange?: Record<string, [number, number]>;
    seqLength?: number;
    group?: number;
    offBy?: number;
    trigger?: "first" | "legato";
    regions: SmplrRegion[];
};
/**
 * Defines where and how to locate sample audio files.
 */
type SmplrSamples = {
    baseUrl: string;
    formats: string[];
    map?: Record<string, string>;
};
/**
 * The top-level smplr.json descriptor. Passed to the Smplr constructor.
 */
type SmplrPreset = {
    /** Schema version. Omit for the current format. Reserved for future migrations. */
    smplr?: "1.0";
    meta?: {
        name?: string;
        description?: string;
        license?: string;
        source?: string;
        tags?: string[];
    };
    samples: SmplrSamples;
    defaults?: PlaybackParams;
    groups: SmplrGroup[];
    /** Maps arbitrary string keys to MIDI numbers, resolved before toMidi(). */
    aliases?: Record<string, number>;
};
/**
 * A note event passed to Smplr.start(). Can be a full object, a note name, or a MIDI number.
 */
type NoteEvent = {
    note: string | number;
    velocity?: number;
    time?: number;
    duration?: number | null;
    detune?: number;
    lpfCutoffHz?: number;
    loop?: boolean;
    ampRelease?: number;
    stopId?: string | number;
    onStart?: (event: NoteEvent) => void;
    onEnded?: (event: NoteEvent) => void;
    reverse?: boolean;
} | string | number;
/**
 * Target for Smplr.stop(). Can be a full object, a stopId, or a MIDI number.
 */
type StopTarget = {
    stopId?: string | number;
    time?: number;
} | string | number;
/**
 * Function returned by Smplr.start(). Calling it stops the started voices.
 */
type StopFn = (time?: number) => void;
/**
 * Loading progress snapshot. total is known before loading starts.
 */
type LoadProgress = {
    loaded: number;
    total: number;
};
/**
 * Fully resolved playback parameters for a single Voice.
 * Output of resolveParams() — all fields are required, no optionals except ampVelCurve/loopAuto.
 */
type VoiceParams = {
    detune: number;
    velocity: number;
    volume: number;
    ampRelease: number;
    ampAttack: number;
    lpfCutoffHz: number;
    offset: number;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    ampVelCurve?: [number, number];
    /** If set, loop points are computed from buffer.duration at play time. */
    loopAuto?: {
        startRatio: number;
        endRatio: number;
    };
    reverse?: boolean;
};

/** Options accepted by `SampleLoader(context, options)`. */
type SampleLoaderOptions = {
    /** Custom storage backend (e.g. `CacheStorage` for offline). Defaults to `HttpStorage`. */
    storage?: Storage;
};
/** Options accepted by `loader.load(json, options)`. */
type SampleLoaderLoadOptions = {
    /** Pre-decoded buffers keyed by sample name — skip fetch for these. */
    buffers?: Map<string, AudioBuffer>;
    /** Called once per sample (including cache hits) with cumulative progress. */
    onProgress?: (loaded: number, total: number) => void;
};
type SampleLoaderFactory = {
    (context: BaseAudioContext, options?: SampleLoaderOptions): SampleLoader;
    /** @deprecated Call as a function: `SampleLoader(...)` instead of `new SampleLoader(...)`. */
    new (context: BaseAudioContext, options?: SampleLoaderOptions): SampleLoader;
};
/**
 * Loads and decodes AudioBuffers for the samples referenced by a {@link SmplrPreset}.
 * Used internally by every smplr instrument; pass an instance via
 * {@link SmplrOptions.loader} to share buffer caching across multiple instruments.
 */
interface SampleLoader {
    /**
     * Load all samples referenced by `json`. Returns a Map keyed by sample
     * name (`region.sample`), values are decoded `AudioBuffer`s. Failed
     * samples are silently omitted (callers handle absence at lookup time).
     *
     * Internally cached by resolved URL, so repeated calls with the same
     * baseUrl/format/path do not re-fetch.
     *
     * @param json The preset describing samples to load.
     * @param options
     *   - `buffers`: pre-decoded buffers keyed by sample name — skip fetch for these.
     *   - `onProgress`: called with `(loaded, total)` per sample (including cache hits).
     */
    load(json: SmplrPreset, options?: SampleLoaderLoadOptions): Promise<Map<string, AudioBuffer>>;
    /**
     * @deprecated Pass `{ onProgress }` instead. The bare-callback form is kept
     * for compatibility; the options form is the canonical 1.x signature.
     */
    load(json: SmplrPreset, onProgress: (loaded: number, total: number) => void): Promise<Map<string, AudioBuffer>>;
}
declare const SampleLoader: SampleLoaderFactory;

/** Options accepted by `Scheduler(context, options)`. */
type SchedulerOptions = {
    /**
     * How far ahead of `currentTime` events are dispatched synchronously.
     * Defaults to 200ms.
     */
    lookaheadMs?: number;
    /**
     * How often the queue is polled for events ready to dispatch.
     * Defaults to 50ms.
     */
    intervalMs?: number;
};
type SchedulerFactory = {
    (context: BaseAudioContext, options?: SchedulerOptions): Scheduler;
    /** @deprecated Call as a function: `Scheduler(...)` instead of `new Scheduler(...)`. */
    new (context: BaseAudioContext, options?: SchedulerOptions): Scheduler;
};
/**
 * Schedules note events for future dispatch. Used internally by every smplr
 * instrument; pass an instance via {@link SmplrOptions.scheduler} to share one
 * scheduler across multiple instruments.
 */
interface Scheduler {
    /**
     * Dispatch `callback` at `event.time`. If `event.time` is within the
     * scheduler's lookahead window (or omitted), the callback fires synchronously
     * and the returned {@link StopFn} is a no-op. Otherwise the event is queued.
     *
     * The returned function removes the event from the queue before dispatch.
     */
    schedule(event: NoteEvent, callback: (event: NoteEvent) => void): StopFn;
    /**
     * Clear all queued (not-yet-dispatched) events and stop the polling
     * interval. Does not affect voices already playing.
     */
    stop(): void;
}
declare const Scheduler: SchedulerFactory;

type SmplrOptions = {
    /** Custom storage backend for sample fetching (e.g. CacheStorage). */
    storage?: Storage;
    /** Destination audio node. Defaults to context.destination. */
    destination?: AudioNode;
    /** Master volume (0–127 MIDI scale). Defaults to 100. */
    volume?: number;
    /** Custom volume-to-gain mapping function. Defaults to midiVelToGain. */
    volumeToGain?: (volume: number) => number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). Defaults to 0. */
    pan?: number;
    /** Default note velocity when not specified in NoteEvent (0–127). Defaults to 100. */
    velocity?: number;
    /** Shared SampleLoader instance. If omitted, a private one is created. */
    loader?: SampleLoader;
    /** Shared Scheduler instance. If omitted, a private one is created. */
    scheduler?: Scheduler;
    /** Called after each buffer is loaded (or served from cache). */
    onLoadProgress?: (progress: LoadProgress) => void;
    /** Called when a note is dispatched to the audio engine (slightly before playback). */
    onStart?: (event: NoteEvent) => void;
    /** Called when each voice's audio node ends. */
    onEnded?: (event: NoteEvent) => void;
};

/**
 * Public Smplr interface — the type plugin authors, helper functions, and
 * users program against. Mirrors the surface of the underlying SmplrImpl
 * class, minus internal helpers.
 *
 * `loadInstrument` is intentionally *not* on this interface — it's the
 * plugin-side API, exposed via {@link PluginSmplr} to plugin bodies only.
 */
interface Smplr {
    readonly context: BaseAudioContext;
    /** Resolves when the instrument is ready to play. Preferred over `load`. */
    readonly ready: Promise<void>;
    /**
     * @deprecated Use `ready` instead. Returns a Promise that resolves to the
     * instrument for compatibility with `const x = await new X(ctx).load`.
     */
    readonly load: Promise<Smplr>;
    readonly output: OutputChannel;
    /** Shared with other instruments via SmplrOptions.loader. */
    readonly loader: SampleLoader;
    /** Shared with other instruments via SmplrOptions.scheduler. */
    readonly scheduler: Scheduler;
    readonly loadProgress: LoadProgress;
    start(event: NoteEvent): StopFn;
    stop(target?: StopTarget): void;
    setCC(cc: number, value: number): void;
    /**
     * Read the latest value set via `setCC`. Returns `0` for any CC that has
     * not been set (matches MIDI's "undefined controller defaults to 0" convention).
     */
    getCC(cc: number): number;
    /**
     * Set the cents detune applied to every future note. Mutates the instrument's
     * playback defaults in place; takes effect on notes scheduled after the call.
     * In-flight notes are unaffected.
     */
    setDetune(cents: number): void;
    /**
     * Set whether every future note plays its sample reversed. Mutates the
     * instrument's playback defaults in place. The reversed-buffer cache is
     * populated lazily on demand; no cache invalidation is needed in either
     * direction.
     */
    setReverse(reverse: boolean): void;
    /**
     * Stop all voices, dispose the output channel, and stop the scheduler.
     * The instance must not be used after this call — subsequent `start`/`stop`/
     * `setCC`/`getCC`/`setControlValue`/`loadInstrument` calls throw. Subsequent
     * `dispose()` calls are no-ops.
     */
    dispose(): void;
    /** @deprecated Use `dispose()` instead. */
    disconnect(): void;
}
/**
 * Plugin-facing widening of {@link Smplr} that exposes `loadInstrument` —
 * the primary plugin → smplr API for wiring an async-loaded JSON.
 *
 * This interface is *not* exported from the package barrel. Plugin authors
 * receive it as the third argument to their {@link SmplrPlugin}.
 */
interface PluginSmplr extends Smplr {
    /**
     * Replace the current instrument JSON and re-fetch buffers. Pre-decoded
     * buffers (e.g. base64-decoded from a soundfont) can be passed via the
     * `buffers` parameter.
     *
     * Resolves when all samples are ready.
     */
    loadInstrument(json: SmplrPreset, buffers?: Map<string, AudioBuffer>): Promise<void>;
}
/**
 * Permitted return shapes for an {@link SmplrPlugin}:
 *
 * - `void` — sync plugin, no async load, no extras
 * - `Promise<void>` — async load, no extras
 * - `{ extras: E; ready: Promise<void> }` — sync extras + async load
 * - `{ ready: Promise<void> }` — async load, no extras (explicit form)
 *
 * Extras keys are merged onto the smplr instance via `Object.assign` and
 * may shadow base {@link Smplr} methods (e.g. DrumMachine overrides `start`
 * to inject `stopId: sample.note`). For sync extras with no async load,
 * use `{ extras, ready: Promise.resolve() }`.
 */
type SmplrPluginResult<E extends object> = void | Promise<void> | {
    extras: E;
    ready: Promise<void>;
} | {
    ready: Promise<void>;
};
/**
 * Plugin signature. Receives the audio context, the user options (with
 * SmplrOptions keys already stripped by the {@link Instrument} builder),
 * and a {@link PluginSmplr} the plugin can wire up.
 */
type SmplrPlugin<O, E extends object = {}> = (ctx: BaseAudioContext, options: O, smplr: PluginSmplr) => SmplrPluginResult<E>;
/**
 * The dual call/construct factory produced by {@link Instrument}. Callable
 * without `new` (preferred) or with `new` (kept for compatibility with
 * pre-1.0 examples).
 */
/**
 * The full instance type produced by an {@link InstrumentFactory} — a Smplr
 * with its plugin extras, plus a `load` Promise refined to resolve back to
 * the same intersection (so `await x.load` preserves the extras shape).
 */
type InstrumentInstance<E extends object = {}> = Smplr & E & {
    readonly load: Promise<Smplr & E>;
};
type InstrumentFactory<O, E extends object = {}> = {
    (ctx: BaseAudioContext, options?: O & Partial<SmplrOptions>): InstrumentInstance<E>;
    /**
     * @deprecated Call as a function: `MyInstrument(ctx, opts)` instead of
     * `new MyInstrument(...)`. Kept for compatibility with pre-1.0 examples.
     */
    new (ctx: BaseAudioContext, options?: O & Partial<SmplrOptions>): InstrumentInstance<E>;
};
/**
 * Builder for smplr instruments. Wraps a plugin function into a dual
 * call/construct factory that produces ready-to-play {@link Smplr} instances
 * augmented with plugin extras.
 *
 * ```ts
 * type MyOptions = { instrument: string };
 *
 * export const MyInstrument = Instrument<MyOptions>((ctx, options, smplr) => {
 *   return smplr.loadInstrument(fetchJson(options.instrument));
 * });
 *
 * const inst = MyInstrument(ctx, { instrument: "piano", volume: 80 });
 * await inst.ready;
 * inst.start("C4");
 * ```
 */
declare function Instrument<O, E extends object = {}>(plugin: SmplrPlugin<O, E>): InstrumentFactory<O, E>;

type DrumMachineInstrument = {
    baseUrl: string;
    name: string;
    samples: string[];
    groupNames: string[];
    nameToSampleName: Record<string, string | undefined>;
    sampleGroupVariations: Record<string, string[]>;
};

declare function getDrumMachineNames(): string[];
type DrumMachineConfig = {
    instrument: string | DrumMachineInstrument;
    url: string;
    storage: Storage;
};
type DrumMachineOptions = Partial<DrumMachineConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
type DrumMachineExtras = {
    getSampleNames(): string[];
    getGroupNames(): string[];
    getSampleNamesForGroup(groupName: string): string[];
    start(event: NoteEvent): StopFn;
};
declare const DrumMachine: InstrumentFactory<Partial<DrumMachineConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, DrumMachineExtras>;
/** Instance type returned by the {@link DrumMachine} factory. */
type DrumMachine = ReturnType<typeof DrumMachine>;
/**
 * Convert a DrumMachineInstrument to a SmplrPreset descriptor.
 *
 * Each sample gets a sequential MIDI number starting at 36 (GM drum map base).
 * Aliases are created for both the full sample name ("kick/1") and the group
 * name ("kick") so both forms work with Smplr.start({ note: "kick" }).
 */
declare function drumMachineToPreset(instrument: DrumMachineInstrument): SmplrPreset;

declare const DRUM_ABUSE_PACKS: readonly ["vol1", "vol2", "vol3", "vol4", "vol5"];
type DrumAbusePackId = (typeof DRUM_ABUSE_PACKS)[number];
declare function getDrumAbuseMachineNames(): string[];
declare function getDrumAbuseMachinesForPack(pack: DrumAbusePackId): readonly string[];
declare function getDrumAbusePackNames(): readonly DrumAbusePackId[];
declare function getDrumAbuseMachinePack(id: string): DrumAbusePackId | undefined;
/** Build a full sample URL. Exported so external row-level Sampler use
 * (e.g. the sequencer engine) can share the same URL convention. */
declare function drumAbuseSampleUrl(pack: DrumAbusePackId, urlPath: string, fileNoExt: string, format?: string, baseUrl?: string): string;
type DrumAbuseSource = {
    kind: "machine";
    machine: string;
    set?: string;
} | {
    kind: "pack";
    pack: DrumAbusePackId;
    instrument: string;
};
type DrumAbuseConfig = {
    source: DrumAbuseSource;
    baseUrl: string;
    storage: Storage;
};
type DrumAbuseOptions = Partial<DrumAbuseConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
type DrumAbuseExtras = {
    readonly mode: "machine" | "pack";
    getSampleNames(): string[];
    getGroupNames(): string[];
    getSampleNamesForGroup(groupName: string): string[];
    getMachineId(): string | null;
    getSetPath(): string | null;
    getPackId(): DrumAbusePackId;
    start(event: NoteEvent): StopFn;
};
declare const DrumAbuse: InstrumentFactory<Partial<DrumAbuseConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, DrumAbuseExtras>;
type DrumAbuse = ReturnType<typeof DrumAbuse>;

/**
 * The result of an offline render. Provides the raw AudioBuffer and
 * lazy WAV encoding / download convenience methods.
 */
declare class RenderResult {
    #private;
    readonly audioBuffer: AudioBuffer;
    readonly duration: number;
    readonly sampleRate: number;
    constructor(audioBuffer: AudioBuffer);
    /** Encode as 32-bit float WAV. Cached after first call. */
    toWav(): Blob;
    /** Encode as 16-bit integer WAV. Cached after first call. */
    toWav16(): Blob;
    /** Download as 32-bit float WAV file. */
    downloadWav(filename?: string): void;
    /** Download as 16-bit integer WAV file. */
    downloadWav16(filename?: string): void;
}

interface RenderOfflineOptions {
    /** Total duration in seconds. When omitted, uses 60s max and trims trailing silence. */
    duration?: number;
    /** Sample rate. Default: 48000. */
    sampleRate?: number;
    /** Number of output channels. Default: 2 (stereo). */
    channels?: number;
}
/**
 * Render audio offline using an OfflineAudioContext.
 *
 * The callback receives an OfflineAudioContext. Create instruments,
 * schedule notes using absolute times (starting from 0), then return.
 * The audio is rendered as fast as possible (not real-time).
 *
 * Returns a RenderResult with the rendered AudioBuffer and
 * convenience methods for WAV encoding and download.
 *
 * @example
 * ```ts
 * const result = await renderOffline(async (context) => {
 *   const piano = await new SplendidGrandPiano(context).load;
 *   piano.start({ note: "C4", time: 0, duration: 1 });
 * });
 * result.downloadWav("export.wav");
 * ```
 */
declare function renderOffline(callback: (context: OfflineAudioContext) => Promise<void>, options?: RenderOfflineOptions): Promise<RenderResult>;

/**
 * Encode an AudioBuffer as a WAV file Blob.
 *
 * Supports 32-bit float (lossless) and 16-bit integer (CD quality) formats.
 */
/** Encode AudioBuffer as 32-bit float WAV. */
declare function audioBufferToWav(buffer: AudioBuffer): Blob;
/** Encode AudioBuffer as 16-bit integer WAV. */
declare function audioBufferToWav16(buffer: AudioBuffer): Blob;

/**
 * Trim trailing silence from an AudioBuffer.
 *
 * Scans all channels from the end to find the last sample above the threshold,
 * then returns a new AudioBuffer trimmed to that length.
 */
declare function trimSilence(buffer: AudioBuffer): AudioBuffer;

/**
 * TransportClock
 *
 * Converts between musical ticks and AudioContext time with support for:
 *   - BPM changes mid-playback (via checkpoints)
 *   - Pause / resume
 *   - Seek to arbitrary tick position
 *   - Loop restart (seekAt a future audio time)
 *
 * All time values are in AudioContext seconds (context.currentTime).
 * Ticks are the internal unit: ppq ticks per quarter note.
 *
 * Principle: a Checkpoint records that at a specific audio time, a specific
 * tick position was reached at a specific BPM. Checkpoints are always ordered
 * by audioTime. The conversion functions find the last checkpoint whose
 * audioTime (or tick) is <= the query value and interpolate from there.
 */
type TransportState = "stopped" | "playing" | "paused";

type SequencerNote = {
    /** Optional identifier for this note. Used as `noteId` in noteOn/noteOff events. Defaults to the note's array index. */
    id?: string | number;
    note: string | number;
    /** Musical position: ticks, "4n", "1m", "2:1", "1:1.5", etc. */
    at: string | number;
    /** Note duration: ticks, "4n", "8n", etc. Omit for a one-shot trigger. */
    duration?: string | number;
    velocity?: number;
    /** Probability (0–100) that this note fires on each pass. Default 100 (always). */
    chance?: number;
    /**
     * Expand into N evenly-spaced sub-notes over `duration`. Requires `duration`;
     * silently ignored if `duration` is omitted. Default 1 (no ratchet). When >1,
     * each sub-note's `noteId` is suffixed with `#0`, `#1`, … so individual
     * ratchet voices can be stopped via `stopNote("id#0")`.
     */
    ratchet?: number;
    /**
     * Multiplicative velocity decay per ratchet step: each step's velocity is
     * scaled by `(1 - decay) ** step_index`. 0 = constant, 1 = silence by last
     * step. Default 0.
     */
    ratchetVelocityDecay?: number;
};
/**
 * Any instrument the Sequencer can drive.
 * Compatible with SplendidGrandPiano, DrumMachine, Smplr, and any object
 * that has a `start()` method accepting note + optional scheduling params.
 */
type SequencerInstrument = {
    start(event: {
        note: string | number;
        time?: number;
        duration?: number;
        velocity?: number;
        noteId?: string | number;
        onStart?: (event: unknown) => void;
        onEnded?: (event: unknown) => void;
    }): unknown;
};
/** Emitted with "noteOn" and "noteOff" events. */
type SequencerNoteEvent = {
    noteId: string | number;
    trackIndex: number;
    noteIndex: number;
    note: SequencerNote;
};
/**
 * Time signature as a `{ numerator, denominator }` pair (e.g. `{ numerator: 7, denominator: 8 }`
 * for 7/8). The numerator counts beats per bar; the denominator defines the
 * note value of one beat (4 = quarter note, 8 = eighth note, …).
 */
type TimeSignature = {
    numerator: number;
    denominator: number;
};
type SequencerOptions = {
    bpm?: number;
    ppq?: number;
    /** Time signature. Accepts `4` (interpreted as 4/4) or `{ numerator, denominator }`. */
    timeSignature?: number | TimeSignature;
    loop?: boolean;
    loopStart?: string | number;
    loopEnd?: string | number;
    /** How far ahead (ms) to pre-schedule notes. Default 200. */
    lookaheadMs?: number;
    /** How often (ms) the flush loop runs. Default 50. */
    intervalMs?: number;
    /** Randomise timing (ms) and velocity per note for a human feel. */
    humanize?: {
        timingMs?: number;
        velocity?: number;
    };
    /** Emit a "step" event at this interval. Accepts musical notation or ticks: "16n", "8n", ticks, etc. */
    stepSize?: string | number;
};
/**
 * Per-track options accepted by {@link Sequencer.addTrack} and
 * {@link Sequencer.setPatterns}.
 */
type AddTrackOptions = {
    /**
     * Stable track id. Required to address this track via
     * {@link Sequencer.setTrackVolume}, {@link Sequencer.muteTrack},
     * {@link Sequencer.soloTrack}, etc.
     */
    id?: string;
    /** Per-track humanize. Overrides {@link SequencerOptions.humanize} when set. */
    humanize?: {
        timingMs?: number;
        velocity?: number;
    };
    /** Multiplicative velocity scalar in [0, 1+]. Default 1. */
    volume?: number;
    /** When true, this track does not dispatch any notes. Default false. */
    muted?: boolean;
    /**
     * When true, only soloed tracks dispatch notes. If any track in the pattern
     * is soloed, every non-soloed track is silenced. Default false.
     */
    solo?: boolean;
};
/**
 * Public shape for one pattern accepted by {@link Sequencer.setPatterns}.
 */
type PatternInput = {
    tracks: Array<{
        instrument: SequencerInstrument;
        notes: SequencerNote[];
    } & AddTrackOptions>;
    /**
     * Pattern length override in ticks or musical time. Defaults to the longest
     * track in this pattern.
     */
    loopEnd?: string | number;
};
declare class SequencerImpl {
    private readonly _context;
    private readonly _clock;
    private readonly _ppq;
    private _timeSignature;
    private _stepTicks;
    /**
     * Patterns. Always at least one (the implicit default pattern). Replaced
     * atomically by {@link setPatterns}.
     */
    private _patterns;
    /** Indices into {@link _patterns} defining playback order. */
    private _chainOrder;
    /** Current position within {@link _chainOrder}. */
    private _chainIndex;
    /**
     * True once {@link setPatterns} has been called. After this point,
     * `addTrack` / `removeTrack` / `clearTracks` throw because the chain shape
     * is owned by the patterns array.
     */
    private _patternsExplicit;
    private _repeatEvents;
    private _listeners;
    private _loop;
    private _loopStartTick;
    private _lookaheadSec;
    private _intervalMs;
    private _humanize;
    private _intervalId;
    /** AudioContext time high-water mark: notes up to here have been scheduled. */
    private _scheduledThrough;
    /** Guards against scheduling the auto-stop setTimeout more than once. */
    private _endScheduled;
    /** Active voices keyed by noteId, so individual notes can be stopped. */
    private _activeVoices;
    constructor(context: BaseAudioContext, options?: SequencerOptions);
    /**
     * Add a track to the (implicit, default) pattern. Throws after
     * {@link setPatterns} has been called — use {@link setPatterns} to mutate
     * the chain.
     */
    addTrack(instrument: SequencerInstrument, notes: SequencerNote[], options?: AddTrackOptions): this;
    removeTrack(instrument: SequencerInstrument): this;
    clearTracks(): this;
    /**
     * Replace the sequencer's patterns. Each pattern owns its own tracks and
     * optional `loopEnd`. After this call, `addTrack` / `removeTrack` /
     * `clearTracks` throw — the chain is owned by the patterns array.
     *
     * `chainOrder` is reset to `[0, 1, …, patterns.length - 1]`.
     */
    setPatterns(patterns: PatternInput[]): this;
    /** Current chain order: indices into the patterns array, in playback order. */
    get chainOrder(): number[];
    /**
     * Set a new chain order. Each entry must be a valid pattern index.
     * Throws if `order` is empty or contains an out-of-range index.
     */
    set chainOrder(order: number[]);
    /**
     * Set a track's multiplicative volume scalar. Affects every note dispatched
     * by the track from the next flush onwards. No-op if no track has the
     * given id. Search is scoped to the currently-playing pattern.
     */
    setTrackVolume(id: string, volume: number): this;
    /** Mute a track by id. No-op if no track has the given id. */
    muteTrack(id: string): this;
    /** Unmute a track by id. No-op if no track has the given id. */
    unmuteTrack(id: string): this;
    /** Solo a track by id. While any track is soloed, non-soloed tracks are silenced. */
    soloTrack(id: string): this;
    /** Remove the solo flag from a track. */
    unsoloTrack(id: string): this;
    /**
     * Locate a track by id, scoped to the currently-playing pattern.
     */
    private _findTrack;
    private _setTrackFlag;
    private _buildTrack;
    private _currentPattern;
    private _assertImplicitPattern;
    private _computePatternTotalTicks;
    get state(): TransportState;
    /**
     * Start playback from `offsetTick`, or resume from pause if no offset given.
     */
    start(offsetTick?: number): this;
    pause(): this;
    stop(): this;
    /**
     * Stop a single note that was scheduled by the sequencer.
     * @param noteId  The id of the note (from SequencerNote.id or auto-assigned index).
     * @param time    Optional AudioContext time to schedule the stop.
     */
    stopNote(noteId: string | number, time?: number): this;
    /**
     * Toggle between playing and paused. If stopped, starts from the beginning.
     */
    togglePlayPause(): this;
    get bpm(): number;
    set bpm(value: number);
    get timeSignature(): TimeSignature;
    set timeSignature(value: number | TimeSignature);
    /** Current transport position as "bar:beat:tick" (1-indexed). */
    get position(): string;
    /**
     * Seek to a position. Accepts ticks or any time string ("2:1", "4n", …).
     * Works while playing (seamless) or stopped/paused.
     */
    set position(value: string | number);
    get loop(): boolean;
    set loop(value: boolean);
    /** Loop start in ticks. */
    get loopStart(): number;
    set loopStart(value: string | number);
    /**
     * Loop end in ticks for the currently-playing pattern. Defaults to the end
     * of the pattern's longest track.
     */
    get loopEnd(): number;
    set loopEnd(value: string | number);
    /**
     * Normalised loop position [0, 1]. Always 0 when loop=false.
     */
    get progress(): number;
    /**
     * Schedule a callback to fire on every `interval` while the sequencer plays.
     * Returns a cancel function.
     *
     * @param callback  Called with the exact AudioContext time of each firing.
     * @param interval  Musical interval: "4n", "8n", "1m", ticks, etc.
     * @param startAt   First firing position (default 0 = beginning).
     */
    scheduleRepeat(callback: (time: number) => void, interval: string | number, startAt?: string | number): () => void;
    /**
     * Listen to a sequencer event.
     *
     * | Event           | Args                                              |
     * |-----------------|---------------------------------------------------|
     * | "statechange"   | (state: "playing" \| "paused" \| "stopped")       |
     * | "start"         |                                                   |
     * | "stop"          |                                                   |
     * | "pause"         |                                                   |
     * | "end"           |                                                   |
     * | "loop"          |                                                   |
     * | "patternChange" | (patternIndex: number, time: number)              |
     * | "beat"          | (beat: number, time: number)                      |
     * | "bar"           | (bar: number, time: number)                       |
     * | "step"          | (stepIndex: number, time: number)                 |
     * | "noteOn"        | (event: SequencerNoteEvent)                       |
     * | "noteOff"       | (event: SequencerNoteEvent)                       |
     */
    on(event: string, callback: (...args: any[]) => void): this;
    off(event: string, callback: (...args: any[]) => void): this;
    private _startLoop;
    private _stopLoop;
    private _flush;
    private _scheduleWindow;
    private _emitStepsInWindow;
    private _emitBeatsInWindow;
    private _emit;
    /** Emit both the specific state event ("start"/"pause"/"stop") and the unified "statechange" event. */
    private _emitStateChange;
    /** Format a raw tick count as "bar:beat:tick" (all 1-indexed). */
    private _tickToPosition;
    /**
     * Reset all repeat events so their next firing is the first occurrence
     * at or after `fromTick`.
     */
    private _resetRepeatEvents;
}
declare const Sequencer: Constructable<[context: BaseAudioContext, options?: SequencerOptions | undefined], SequencerImpl>;
type Sequencer = ReturnType<typeof Sequencer>;

declare function getElectricPianoNames(): string[];
type ElectricPianoOptions = Partial<{
    instrument: string;
    storage: Storage;
    destination: AudioNode;
    volume: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan: number;
    velocity: number;
    onLoadProgress: (progress: LoadProgress) => void;
    /** Audio formats to try, in order of preference. Defaults to ["ogg", "m4a"]. */
    formats: string[];
}>;
declare const ElectricPiano: InstrumentFactory<Partial<{
    instrument: string;
    storage: Storage;
    destination: AudioNode;
    volume: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan: number;
    velocity: number;
    onLoadProgress: (progress: LoadProgress) => void;
    /** Audio formats to try, in order of preference. Defaults to ["ogg", "m4a"]. */
    formats: string[];
}> & {
    instrument: string;
}, {
    tremolo: Readonly<{
        level: (value: number) => void;
    }>;
}>;
/** Instance type returned by the {@link ElectricPiano} factory. */
type ElectricPiano = ReturnType<typeof ElectricPiano>;

declare function getVersilianInstruments(): Promise<string[]>;
type VersilianConfig = {
    instrument: string;
    storage: Storage;
};
type VersilianOptions = Partial<VersilianConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
/**
 * Versilian
 *
 * The Versilian Community Sample Library is an open CC0 general-purpose sample
 * library created by Versilian Studios LLC.
 */
declare const Versilian: InstrumentFactory<Partial<VersilianConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, {}>;
/** Instance type returned by the {@link Versilian} factory. */
type Versilian = ReturnType<typeof Versilian>;
/**
 * Fetch the SFZ for a VCSL instrument and load it into `smplr`. Shared by
 * the {@link Versilian} and {@link Mallet} factories — not exported from the
 * package barrel.
 */
declare function loadVersilianInstrument(smplr: PluginSmplr, options: VersilianOptions): Promise<void>;

declare function getMalletNames(): string[];
declare const Mallet: InstrumentFactory<Partial<VersilianConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, {}>;
/** Instance type returned by the {@link Mallet} factory. */
type Mallet = ReturnType<typeof Mallet>;
declare const NAME_TO_PATH: Record<string, string | undefined>;

declare function getMellotronNames(): string[];
type MellotronConfig = {
    instrument: string;
    storage: Storage;
};
type MellotronOptions = Partial<MellotronConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    decayTime?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
declare const Mellotron: InstrumentFactory<Partial<MellotronConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    decayTime?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, {}>;
/** Instance type returned by the {@link Mellotron} factory. */
type Mellotron = ReturnType<typeof Mellotron>;
type MellotronJsonConfig = {
    instrument: string;
    variation?: string;
};
/**
 * Convert a Mellotron files.json sample list to SmplrPreset.
 *
 * - Filters by variation string if provided.
 * - Extracts MIDI from the first word of each sample name.
 * - Uses spreadKeyRanges so nearby notes pitch-shift to the nearest sample.
 * - All regions get loopAuto to produce tape-loop playback.
 */
declare function mellotronToPreset(sampleNames: string[], config: MellotronJsonConfig): SmplrPreset;

declare const PARAMS: readonly ["preDelay", "bandwidth", "inputDiffusion1", "inputDiffusion2", "decay", "decayDiffusion1", "decayDiffusion2", "damping", "excursionRate", "excursionDepth", "wet", "dry"];
declare class ReverbImpl {
    #private;
    readonly input: AudioNode;
    constructor(context: AudioContext);
    get paramNames(): readonly ["preDelay", "bandwidth", "inputDiffusion1", "inputDiffusion2", "decay", "decayDiffusion1", "decayDiffusion2", "damping", "excursionRate", "excursionDepth", "wet", "dry"];
    getParam(name: (typeof PARAMS)[number]): AudioParam | undefined;
    get isReady(): boolean;
    ready(): Promise<this>;
    connect(output: AudioNode): void;
}
declare const Reverb: Constructable<[context: AudioContext], ReverbImpl>;
type Reverb = ReturnType<typeof Reverb>;

type AudioBuffers = Record<string | number, AudioBuffer | undefined>;
/**
 * A function that downloads audio into a AudioBuffers
 */
type AudioBuffersLoader = (context: BaseAudioContext, buffers: AudioBuffers) => Promise<void>;

type SamplerBase = {
    storage?: Storage;
    detune?: number;
    volume?: number;
    pan?: number;
    velocity?: number;
    decayTime?: number;
    lpfCutoffHz?: number;
    destination?: AudioNode;
    volumeToGain?: (volume: number) => number;
    onLoadProgress?: (progress: LoadProgress) => void;
};
type SamplerBuffers = Record<string | number, string | AudioBuffer | AudioBuffers> | AudioBuffersLoader;
type SamplerBuffersInput = {
    buffers?: SamplerBuffers;
    preset?: never;
};
type SamplerPresetInput = {
    preset: SmplrPreset;
    buffers?: never;
};
type SamplerConfig = SamplerBase & (SamplerBuffersInput | SamplerPresetInput);
/** Input accepted by {@link Sampler.reload}: a `SmplrPreset` schema or a flat buffers record/loader. */
type SamplerReloadInput = SmplrPreset | SamplerBuffers;
type SamplerExtras = {
    reload: (input: SamplerReloadInput) => Promise<void>;
};
type SamplerJsonOptions = Pick<SamplerConfig, "decayTime" | "lpfCutoffHz" | "detune">;
type InternalConvertResult = {
    json: SmplrPreset;
    urlMap: Record<string, string>;
    preloaded: Map<string, AudioBuffer>;
};
/**
 * Convert a flat source Record to SmplrPreset + separated URL map + pre-loaded buffers.
 *
 * - Keys that are valid MIDI names/numbers → MIDI-mapped regions.
 *   If ALL keys are MIDI-parseable, spread key ranges (pitch-shifting).
 *   Otherwise each MIDI key gets an exact [n, n] range.
 * - Non-MIDI keys are assigned sequential MIDI numbers and added to `aliases`.
 * - AudioBuffer values → pre-loaded map (no fetch).
 * - String URL values → urlMap (fetched asynchronously by caller).
 */
declare function samplerToPreset(source: Record<string | number, string | AudioBuffer>, options?: Partial<SamplerJsonOptions>): InternalConvertResult;
/**
 * A Sampler instrument. Accepts either a flat record of samples
 * (`{ buffers: { C4: "url" } }`) or a full `SmplrPreset`
 * (`{ preset: { samples, groups, ... } }`) for advanced use cases including
 * per-region pitch/velocity/round-robin control.
 *
 * Use `sampler.reload(input)` to swap content at runtime. `reload` accepts
 * either shape (flat record or `SmplrPreset`), regardless of which mode was
 * used at construction.
 */
declare const Sampler: InstrumentFactory<SamplerConfig, SamplerExtras>;
/** Instance type returned by the {@link Sampler} factory. */
type Sampler = ReturnType<typeof Sampler>;

declare function getSmolkenNames(): string[];
type SmolkenConfig = {
    instrument: string;
    storage: Storage;
};
type SmolkenOptions = Partial<SmolkenConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
declare const Smolken: InstrumentFactory<Partial<SmolkenConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, {}>;
/** Instance type returned by the {@link Smolken} factory. */
type Smolken = ReturnType<typeof Smolken>;

type LoopData = Record<number, [number, number]>;

declare function getSoundfontKits(): string[];
declare function getSoundfontNames(): string[];
type SoundfontConfig = {
    kit: "FluidR3_GM" | "MusyngKite" | string;
    instrument?: string;
    instrumentUrl: string;
    storage: Storage;
    extraGain: number;
    loadLoopData: boolean;
    loopDataUrl?: string;
};
type SoundfontOptions = Partial<SoundfontConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>;
declare const Soundfont: InstrumentFactory<Partial<SoundfontConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
}>, {}>;
/** Instance type returned by the {@link Soundfont} factory. */
type Soundfont = ReturnType<typeof Soundfont>;
/**
 * Convert a list of note names (with optional loop data) to SmplrPreset.
 * Uses spreadKeyRanges so notes between recorded pitches pitch-shift correctly.
 */
declare function soundfontToPreset(noteNames: string[], loopData?: LoopData): SmplrPreset;

type Sf2 = {
    instruments: Sf2Instrument[];
};
type Sf2Instrument = {
    header: {
        name: string;
    };
    zones: Sf2Zone[];
};
type Sf2Zone = {
    sample: Sf2Sample;
    keyRange?: {
        lo: number;
        hi: number;
    };
};
type Sf2Sample = {
    data: Int16Array;
    header: {
        name: string;
        sampleRate: number;
        originalPitch: number;
        pitchCorrection: number;
        start: number;
        end: number;
        startLoop: number;
        endLoop: number;
    };
};
type Soundfont2Options = {
    url: string;
    createSoundfont: (data: Uint8Array) => Sf2;
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
};
declare function sf2InstrumentToPreset(sf2Instrument: Sf2Instrument, context: BaseAudioContext): {
    json: SmplrPreset;
    buffers: Map<string, AudioBuffer>;
};
type Soundfont2SamplerExtras = {
    readonly instrumentNames: string[];
    loadInstrument(instrumentName: string): Promise<void> | undefined;
};
declare const Soundfont2: InstrumentFactory<Soundfont2Options, Soundfont2SamplerExtras>;
/** Instance type returned by the {@link Soundfont2} factory. */
type Soundfont2 = ReturnType<typeof Soundfont2>;
/** @deprecated Use `Soundfont2` instead. */
declare const Soundfont2Sampler: InstrumentFactory<Soundfont2Options, Soundfont2SamplerExtras>;
/** @deprecated Use `Soundfont2` instead. */
type Soundfont2Sampler = Soundfont2;

/**
 * Configuration options for SplendidGrandPiano.
 */
type SplendidGrandPianoConfig = {
    baseUrl: string;
    storage: Storage;
    /** Global detune in cents, applied to all notes. */
    detune: number;
    /** Default velocity (0–127) when not specified per note. */
    velocity: number;
    /** Release time in seconds. Maps to SmplrPreset defaults.ampRelease. */
    decayTime: number;
    /** Destination audio node. Defaults to context.destination. */
    destination?: AudioNode;
    /** Master volume (0–127 MIDI scale). */
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    /** Called after each buffer is loaded or served from cache. */
    onLoadProgress?: (progress: LoadProgress) => void;
    /** Audio formats to try, in order of preference. Defaults to ["ogg", "m4a"]. */
    formats?: string[];
    /** Limit which notes are fetched. Useful for reducing initial load time. */
    notesToLoad?: {
        notes: number[];
        velocityRange: [number, number];
    };
};
declare const SplendidGrandPiano: InstrumentFactory<Partial<SplendidGrandPianoConfig>, {}>;
/** Instance type returned by the {@link SplendidGrandPiano} factory. */
type SplendidGrandPiano = ReturnType<typeof SplendidGrandPiano>;
type PianoJsonOptions = Pick<SplendidGrandPianoConfig, "baseUrl" | "detune" | "decayTime" | "notesToLoad" | "formats">;
/**
 * Convert the LAYERS array and user options into a SmplrPreset descriptor.
 *
 * Each layer becomes a SmplrGroup with its velRange. If `notesToLoad` is
 * specified, layers and samples are filtered accordingly. The PPP layer
 * includes a low-pass filter cutoff.
 *
 * `spreadKeyRanges` is used to pre-compute which key range each sample
 * covers, replacing the old on-the-fly `findNearestMidiInLayer` logic.
 */
declare function pianoToPreset(options: PianoJsonOptions): SmplrPreset;
declare const LAYERS: ({
    name: string;
    vel_range: number[];
    cutoff: number;
    samples: (string | number)[][];
} | {
    name: string;
    vel_range: number[];
    samples: (string | number)[][];
    cutoff?: undefined;
})[];

export { type AddTrackOptions, CacheStorage, DRUM_ABUSE_PACKS, DrumAbuse, type DrumAbuseConfig, type DrumAbuseExtras, type DrumAbuseOptions, type DrumAbusePackId, type DrumAbuseSource, DrumMachine, type DrumMachineOptions, ElectricPiano, type ElectricPianoOptions, HttpStorage, Instrument, LAYERS, type LoadProgress, Mallet, Mellotron, type MellotronConfig, type MellotronOptions, NAME_TO_PATH, type NoteEvent, type PatternInput, type PlaybackParams, type RenderOfflineOptions, RenderResult, Reverb, SampleLoader, type SampleLoaderLoadOptions, type SampleLoaderOptions, Sampler, type SamplerConfig, type SamplerReloadInput, Scheduler, type SchedulerOptions, Sequencer, type SequencerInstrument, type SequencerNote, type SequencerNoteEvent, type SequencerOptions, Smolken, type SmolkenConfig, type SmolkenOptions, type Smplr, type SmplrGroup, type SmplrOptions, type SmplrPlugin, type SmplrPreset, type SmplrRegion, type SmplrSamples, Soundfont, Soundfont2, type Soundfont2Options, Soundfont2Sampler, type SoundfontOptions, SplendidGrandPiano, type SplendidGrandPianoConfig, type StopFn, type StopTarget, type Storage, type StorageResponse, type TimeSignature, Versilian, type VersilianConfig, type VersilianOptions, type VoiceParams, audioBufferToWav, audioBufferToWav16, drumAbuseSampleUrl, drumMachineToPreset, getDrumAbuseMachineNames, getDrumAbuseMachinePack, getDrumAbuseMachinesForPack, getDrumAbusePackNames, getDrumMachineNames, getElectricPianoNames, getMalletNames, getMellotronNames, getSmolkenNames, getSoundfontKits, getSoundfontNames, getVersilianInstruments, loadVersilianInstrument, mellotronToPreset, pianoToPreset, renderOffline, samplerToPreset, sf2InstrumentToPreset, soundfontToPreset, trimSilence };
