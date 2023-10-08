import { Signal } from './signal';

export interface RunLength {
    value: number;
    length: number;
    offset: number;
}

export function runLengthEncode(signal: Signal<unknown>) {
    const array = signal.data;
    const output = new Array<RunLength>();

    let offset = 0;
    let value = array[0];

    for (let index = 1; index < array.length; index++) {
        if (array[index] !== value) {
            output.push({ value, offset, length: index - offset });

            offset = index;
            value = array[index];
        }
    }

    output.push({ value, offset, length: array.length - offset });
    return output;
}

export function extract<T>(options: ExtractOptions, input: Found<T>) {
    const { bits } = options;

    const output = new Array(bits);

    let bit = 0;
    let index = input.bits.end;

    while (bit < bits && index < input.rle.length) {
        const { length, value } = input.rle[index];

        const end = Math.min(
            bit + Math.round(length / (value === 0 ? input.zero : input.one)),
            bits
        );

        while (bit < end) {
            output[bit] = value;
            bit++;
        }

        index++;
    }

    return output;
};
export interface ExtractOptions {
    bits: number,
}

export interface Found<T> {
    bits: {
        start: number,
        end: number,
    },

    samples: {
        start: number,
        end: number,
    }

    rle: RunLength[],
    signal: Signal<T>,

    zero: number,
    one: number,
}

export function find<T>(needle: Signal<unknown>, haystack: Signal<T>): Found<T>[] {
    const needleRL = runLengthEncode(needle);
    const haystackRL = runLengthEncode(haystack);

    const matches = [];

    let offset = 0;

    if (needleRL[0].value !== haystackRL[0].value) {
        offset = 1;
    }

    const needleTS = getTotalLength(needleRL);

    while (offset < haystackRL.length - needleRL.length) {
        const subsetRL = haystackRL.slice(offset, offset + needleRL.length);
        const subsetTS = getTotalLength(subsetRL);

        if (isMatch(needleRL, subsetRL, subsetTS.zero / needleTS.zero, subsetTS.one / needleTS.one)) {
            matches.push({
                bits: {
                    start: offset,
                    end: offset + needleRL.length,
                },
                samples: {
                    start: haystackRL[offset].offset,
                    end: haystackRL[offset + needleRL.length].offset,
                },

                rle: haystackRL,
                signal: haystack,

                zero: subsetTS.zero / needleTS.zero,
                one: subsetTS.zero / needleTS.one,
            });
        }

        offset += 2;
    }

    return matches;
}

function getTotalLength(signal: RunLength[]) {
    let zero = 0;
    let one = 0;

    for (const sample of signal) {
        if (sample.value === 0) {
            zero += sample.length;
        } else {
            one += sample.length;
        }
    }

    return { zero, one };
}

function isMatch(needle: RunLength[], haystack: RunLength[], zero: number, one: number) {
    for (let index = 0; index < needle.length; index++) {
        if (needle[index].value === 0) {
            const length = Math.round(haystack[index].length / zero);

            if (needle[index].length !== length) {
                return false;
            }
        } else {
            const length = Math.round(haystack[index].length / one);

            if (needle[index].length !== length) {
                return false;
            }
        }
    }

    return true;
}