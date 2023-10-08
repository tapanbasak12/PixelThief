import { createFilter, stealthApplyFilter } from './filters_core';
import { SignalData, FilterType, Filter } from './core';

/** Add a constant value to each sample in the signal. */
export const addValue = createFilter<number>("addValue", FilterType.DATA, (value, input) => {
    return input.map(v => v + value);
});

/** Returns a new signal where each sample is an average of `windowSize` samples in the original signal */
export const average = createFilter<number>("average", FilterType.DATA, (windowSize, signal) => {
    if (windowSize > signal.length) {
        throw new RangeError(`windowSize is larger than the signal`);
    }

    let value = 0;

    const output = new SignalData(signal.length - windowSize);

    for (let index = 0; index < windowSize - 1; index++) {
        value += signal[index];
    }
    for (let index = 0; index < signal.length - windowSize; index++) {
        value += signal[index + windowSize];
        output[index] = value / windowSize;
        value -= signal[index];
    }

    return output;
});

/** Keeps frequencies within the "band" of frequencies specified by the `centerFrequency` and `bandwidth` */
export const bandpass = createFilter<BandpassOptions>("bandpass", FilterType.RAW_SIGNAL, (options, input) => {
    const omega    = 2 * Math.PI * options.centerFrequency / options.sampleRate;
    const cosOmega = Math.cos(omega);
    const sinOmega = Math.sin(omega);
    const alpha    = sinOmega * Math.sinh(Math.log(2)/2 * options.bandwidth * omega/sinOmega);
    const a0       = (1 + alpha)

    return stealthApplyFilter(biquad, {
        b0:  sinOmega / 2 / a0,
        b1: 0,
        b2: -sinOmega / 2 / a0,
        a1: -2 * cosOmega / a0,
        a2: (1 - alpha)   / a0,
    }, input);
});
export interface BandpassOptions {
    centerFrequency: number;
    bandwidth: number;
    sampleRate: number;
}

/** Biquadratic Filter used to implement lowpass/highpass/bandpass/etc... */
export const biquad = createFilter<BiquadOptions>("biquad", FilterType.DATA, (options, input) => {
    const output = new SignalData(input.length);

    const {a1, a2, b0, b1, b2} = options;

    if (0 < input.length) {
        output[0] = b0*input[0];
    }
    if (1 < input.length) {
        output[1] = b0*input[1] + b1*input[0] - a1*output[0];
    }
    for (let i = 2; i < output.length; i++) {
        output[i] = b0*input[i] + b1*input[i-1] + b2*input[i-2] - a1*output[i-1] - a2*output[i-2];
    }

    return output;
});
export interface BiquadOptions {
    a1: number;
    a2: number;

    b0: number;
    b1: number;
    b2: number;
}

/** Clamps samples to within the minimum and maximum range specified */
export const clamp = createFilter<ClampOptions>("clamp", FilterType.DATA, (options, input) => {
    const {min, max} = options;
    return input.map(value => value > max ? max : (value < min ? min : value))
});
export interface ClampOptions {
    min: number;
    max: number;
}

/** Multiplies each sample in the signal by a constant value. */
export const divValue = createFilter<number>("divValue", FilterType.DATA, (value, input) => {
    return input.map(v => v / value);
});

/** Excludes samples that are not within the minimum and maximum range specified */
export const exclude = createFilter<ExcludeOptions>("exclude", FilterType.DATA, (options, input) => {
    const { min, max } = options;

    let start = 0;
    let excluding = false;

    const output = input.slice();

    // Find a place where we need to exclude samples
    for (let index = 0; index < input.length; index++) {
        const value = input[index];

        if (min <= value && value <= max) {
            output[index] = value;
        } else {
            output[index] = 500;
        }
    }

    return output;
});
export interface ExcludeOptions {
    min: number;
    max: number;
}

/** Keeps frequencies above `cutoffFrequency` and rejects frequencies below it. */
export const highpass = createFilter<HighpassOptions>("highpass", FilterType.RAW_SIGNAL, (options, input) => {
    const q        = options.q ?? 0.707;
    const omega    = 2 * Math.PI * options.cutoffFrequency / options.sampleRate;
    const alpha    = Math.sin(omega) / (2 * q);
    const cosOmega = Math.cos(omega);
    const a0       = (1 + alpha)

    return stealthApplyFilter(biquad, {
        b0:  (1 + cosOmega) / 2 / a0,
        b1: -(1 + cosOmega)     / a0,
        b2:  (1 + cosOmega) / 2 / a0,
        a1:  -2 * cosOmega      / a0,
        a2:  (1 - alpha)        / a0,
    }, input);
});
export interface HighpassOptions {
    cutoffFrequency: number;
    sampleRate: number;
    q?: number;
}

/** Keeps frequencies below `cutoffFrequency` and rejects frequencies above it. */
export const lowpass = createFilter<LowpassOptions>("lowpass", FilterType.RAW_SIGNAL, (options, input) => {
    const q        = options.q ?? 0.707;
    const omega    = 2 * Math.PI * options.cutoffFrequency / options.sampleRate;
    const alpha    = Math.sin(omega) / (2 * q);
    const cosOmega = Math.cos(omega);
    const a0       = (1 + alpha)

    return stealthApplyFilter(biquad, {
        b0: (1 - cosOmega) / 2 / a0,
        b1: (1 - cosOmega)     / a0,
        b2: (1 - cosOmega) / 2 / a0,
        a1: -2 * cosOmega      / a0,
        a2: (1 - alpha)        / a0,
    }, input);
});
export interface LowpassOptions {
    cutoffFrequency: number;
    sampleRate: number;
    q?: number;
}

/** Sets each sample to the maximum of the value provided and the value of the sample. @see Math.max */
export const max = createFilter<number>("max", FilterType.DATA, (max, input) => {
    return input.map(value => value < max ? max : value);
});

/** Multiplies each sample in the signal by a constant value. */
export const mulValue = createFilter<number>("mulValue", FilterType.DATA, (value, input) => {
    return input.map(v => v * value);
});

/** Sets each sample to the minimum of the value provided and the value of the sample. @see Math.min */
export const min = createFilter<number>("min", FilterType.DATA, (min, input) => {
    return input.map(value => value > min ? min : value);
}
);

/** Subtracts a constant value from each sample in the signal. */
export const subValue = createFilter<number>("subValue", FilterType.DATA, (value, input) => {
    return input.map(v => v - value);
});

/** Repeats the signal `count` times. */
export const repeat = createFilter<number>("repeat", FilterType.DATA, (count, input) => {
    const output = new SignalData(input.length * count);

    let i = 0; let j = 0;

    while (i < output.length) {
        output[i] = input[j];
        i++; j++;
        
        if (j === input.length) { j = 0; }
    }


    return output;
});

/** Slices a signal: Analogous to array.slice. */
export const slice = createFilter<SliceOptions>("slice", FilterType.DATA, (options, input) => {
    return input.slice(options.start, options.end);
});
interface SliceOptions {
    start?: number;
    end?: number;
}

/** Repeats each sample in the signal `count` times. */
export const stretch = createFilter<number>("stretch", FilterType.DATA, (count, input) => {
    const output = new SignalData(input.length * count);

    let offset = 0;
    for (let i = 0; i < input.length; i++) {
        for (let j = 0; j < count; j++) {
            output[offset + j] = input[i];
        }
        offset += count;
    }

    return output;
});

/** Replaces any value above `cutoff` with one and any value equal to or below with zero */
export const threshold = createFilter<ThresholdOptions>("threshold", FilterType.DATA, (options, input) => {
    const cutoff = options.cutoff;
    const lower  = options.lower ?? 0;
    const upper  = options.upper ?? 1;

    return input.map(value => value <= cutoff ? lower : upper);
});
interface ThresholdOptions {
    upper?: number;
    lower?: number;
    cutoff: number;
}

export const filters = {
    addValue,
    average,
    bandpass,
    biquad,
    clamp,
    divValue,
    exclude,
    highpass,
    lowpass,
    max,
    min,
    mulValue,
    repeat,
    slice,
    subValue,
    stretch,
    threshold,
}