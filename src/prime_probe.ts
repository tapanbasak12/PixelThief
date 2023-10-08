import { groupBy, inParallel, loadModule, runWasm, shuffle } from './utils'
import { Metadata, Signal, Source, SourceSet } from './signal';
import { CACHE_L3_ASSOCIATIVITY, CACHE_LINE_SIZE, CACHE_PAGE_SIZE, CACHE_SET_BITS } from './config';

const END_MARKER = 0;
class List {
    public readonly buffer: Uint32Array;
    public readonly elements: ReadonlyArray<number>;
    public fwd: number;
    public bwd: number;

    public constructor(
        buffer: Uint32Array,
        elements: number[]
    ) {
        this.buffer = buffer;
        this.elements = elements;

        const BWD = 8;

        if (elements.length > 0) {
            this.fwd = elements[0];
            this.bwd = elements[elements.length - 1] + BWD;

            // Link elements together
            for (let i = 1; i < this.elements.length; i++) {
                buffer[elements[i - 1]] = elements[i];
            }
            buffer[elements[elements.length - 1]] = END_MARKER;

            for (let i = 1; i < this.elements.length; i++) {
                buffer[elements[i] + BWD] = elements[i - 1] + BWD;
            }
            buffer[elements[0] + BWD] = END_MARKER;
        } else {
            this.fwd = END_MARKER;
            this.bwd = END_MARKER;
        }
    }
}

let global = 0
function sample_once(list: List, timer: Timer): number {
    const buffer = list.buffer;

    for (const v of list.elements) {
        global += list.buffer[v];
    }
    return timer.get_time();
}

function sample_multiple(
    list1: List,
    timer: Timer,
    sampleCount: number,
) {
    const samples = new Int32Array(sampleCount)
    samples.fill(MISSED_SAMPLE);

    for (let sample = 0; sample < sampleCount; sample++) {
        samples[sample] = sample_once(list1, timer);
    }

    // Compute the difference
    for (let sample = 1; sample < sampleCount; sample++) {
        samples[sample - 1] = samples[sample] - samples[sample - 1];
    }
    samples[samples.length - 1] = 0;

    return samples;
}

const MISSED_SAMPLE = -1;

interface Timer {
    get_time(): number;
    mask: number;
}

interface Entry {
    index: number;
    offset: number;
    physical: string;
    set: number;
    slice: number;
    id: number;
}

async function virt_to_phys(offsets: readonly number[]) {
    const result = await fetch("/virt_to_phys", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(offsets),
    });

    const data = await result.json() as Entry[];

    // Populate extra fields not provided by server
    for (let index = 0; index < data.length; index++) {
        const entry = data[index];

        entry.id = entry.set | (entry.slice << CACHE_SET_BITS);
        entry.offset = offsets[index];
        entry.index = entry.offset / 4;
    }

    return data;
}

interface Timer {
    get_time(): number;
    mask: number;

    start(): Promise<void>;
    stop(): Promise<void>;
}

export class Config {
    public sampleCount = 1000; // Default sample count
    public slotLength = 1500; // Default slot length

    public constructor(
        public readonly timer: Timer
    ) { }
}

export interface L3Metadata extends Metadata {
    type: 'cache/l3',
    time: number,

    slotLength: number,
    method: 'prime-probe',
}

export function isL3Metadata(metadata: Metadata): metadata is L3Metadata {
    return metadata.type === 'cache/l3';
}

export class SourceImpl implements Source<SourceImpl> {
    public constructor(
        public readonly config: Config,
        public readonly list: List,
    ) { }

    public async getData() {
        const data = sample_multiple(
            this.list,
            this.config.timer,
            this.config.sampleCount,
        );

        const x = {} as Metadata;

        return Signal.fromSource(this, new Float64Array(data), {
            type: 'cache/l3',
            time: Date.now(),

            slotLength: this.config.slotLength,
            method: 'prime-probe',
        } as L3Metadata);
    }
}

export class PrimeProbe implements SourceSet<SourceImpl> {
    public idMapping: Map<number, SourceImpl> | null = null;
    public reverseIdMapping: Map<SourceImpl, number> | null = null;

    public constructor(
        public readonly memory: WebAssembly.Memory,
        public readonly buffer: SharedArrayBuffer,
        public readonly array: Uint32Array,
        public readonly config: Config,
        public readonly sources: SourceImpl[],
    ) { }

    public async findById(id: number) {
        // Fetch the mapping from the server
        if (this.idMapping === null) {
            const mapping = await virt_to_phys(this.sources.map(x => x.list.elements[0] * 4));
            this.idMapping = new Map();
            this.reverseIdMapping = new Map();

            for (let index = 0; index < this.sources.length; index++) {
                this.idMapping.set(mapping[index].id, this.sources[index]);
                this.reverseIdMapping.set(this.sources[index], mapping[index].id);
            }
        }

        const set = this.idMapping.get(id);

        if (set === undefined) {
            return null;
        }

        return set;
    }

    public static async setup() {
        // Setup memory
        const memory = new WebAssembly.Memory({
            initial: 128 * 1024 * 1024 / (64 * 1024),
            maximum: 128 * 1024 * 1024 / (64 * 1024),
            shared: true,
        } as any);

        const buffer = memory.buffer as SharedArrayBuffer;

        const array = new Uint32Array(buffer);
        array.fill(1);
        array.fill(0);

        // Start the clock
        const clock = await loadModule('clock.wasm');
        inParallel(runWasm, clock, memory);

        let sets = await ConstructEvictionSets(array);

        // TODO: Allow users to specify this
        const config = new Config({
            get_time: function () { return Atomics.load(array, 64); },
            mask: 0x7FFFFFFF,
            start: function () { return Promise.resolve(); },
            stop: function () { return Promise.resolve(); },
            clock: clock,
        } as any);

        const sources = sets.map((set) => {
            const first = set.slice(0, CACHE_L3_ASSOCIATIVITY);
            const list = new List(array, first);
            return new SourceImpl(config, list);
        });

        // Warmup probe functions
        if (sources.length > 0) {
            for (let i = 0; i < 50; i++) {
                const list = sources[i % sources.length].list;
                sample_multiple(list, config.timer, 1000);
            }
        }

        return new PrimeProbe(
            memory,
            buffer,
            array,
            config,
            sources,
        );
    }
}

function expandSets(sets: number[][]) {
    const expanded = [];

    for (const set of sets) {
        for (let offset = 0; offset < CACHE_PAGE_SIZE / 4; offset += CACHE_LINE_SIZE / 4) {
            expanded.push(set.map(x => x + offset));
        }
    }

    return expanded;
}

async function ConstructEvictionSets(buffer: Uint32Array) {
    const SIZE = buffer.BYTES_PER_ELEMENT;
    const start = CACHE_PAGE_SIZE / SIZE;
    const end = buffer.length / SIZE;
    const step = CACHE_PAGE_SIZE / SIZE;

    const offsets = [];
    for (let offset = start; offset < end; offset += step) {
        offsets.push(offset * SIZE);
    }

    const data = await virt_to_phys(offsets);
    const sets = Array.from(groupBy(data, (x) => x.id).values()).
        map((set) => set.map((entry) => entry.offset)).
        map((set) => set.map((entry) => entry / SIZE)).
        map((set) => shuffle(set));

    return expandSets(sets);
}