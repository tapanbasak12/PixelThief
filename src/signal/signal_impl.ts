import { PartiallyApplied } from '.';
import { Filter, Metadata, Operation, SignalData } from './core';
import * as Filters from './filters';

// SignalImpl exists just to remove cyclic importing.
//  core's Signal<Source> is an interface that a signal must implement.
//  signal_impl's Signal<Source> is a general purpose implementation of that interface.

/**
 * A functional digital signal processing library.
 * 
 * The core component of Signal.ts is the Signal class. It is an immutable class that encapsulates an array of data
 *  along with metadata describing the signal and the operations that have been performed on it. To perform operations
 *  on signals we use a `Filter` which acts like an ordinary function that takes two inputs. The first input is the
 *  a set of options for the filter and the second is the signal to apply the filter to. Filters return a new copy of
 *  the signal (after applying the filter) without modifying the original signal.
 * 
 * For exmaple, the following code clamps all samples in `input` to a value between 0 and 10.
 *      const output = Signal.clamp({min: 0, max: 10}, input);
 * 
 * Whenever a filter is applied to a signal, the signal's `operations` member is updated with a new entry that contains
 *  the name of the filter along with its options. This automatically tracks the operations performed on a signal in the
 *  event previous signals need to be reanalyzed. This metadata is serialized with the rest of the signal.
 *      console.log(output.operations); // [{name: "clamp", options: {min: 0, max: 10}}]
 * 
 * Filters can be partially applied. If you specify the options for a filter, but not the input, then the filter is
 *  not executed. Instead, a new function is returned. This new function that takes a single argument (a Signal)
 *  and applies the filter with the previously speicfied options. This allows you to write the following code.
 *      const foo = Signal.clamp({min: 0, max: 10});
 *      const output1 = foo(input1);
 *      const output2 = foo(input2);
 *      const output3 = foo(input3);
 * 
 * To create a new filter use `createFilter`.
 *  It accepts three parameters. The name of the filter (which must be unique across the entire application), the type
 *  of the filter, and the function that implements the filter's behaviour. @see Type for details about which type of
 *  filter to use for your task. If you need to call another filter within your filter, always use stealthApplyFilter.
 *  It applies a filter without adding metadata to the signal.
 *      const add = createFilter<number>('add', Type.DATA, (options, input) => input.map(value => value + options))
 *      add(100, input);
 * 
 * Serializing signals is done through Signal.serialize and Signal.deserialize which converts a Signal to/from a String.
 *      The format is a JSON encoding of the Signal object.
 *
 * Thanks to Robert Bristow-Johnson's <robert@audioheads.com> fantastic audio EQ cookbook which can be found here.
 *      http://music.columbia.edu/pipermail/music-dsp/2001-March/041752.html
 * Many of the filters (lowpass/highpass/bandpass/biquad) are based on equations from the book.
 */
export class Signal<Source = unknown> {
    private constructor(
        public readonly source: Source,
        public readonly metadata: Metadata,
        public readonly original: SignalData,
        public readonly data: SignalData,
        public readonly operations: readonly Operation[],
    ) { }

    /**
     * Add an operation to `signal.operations`.
     */
    public addOperation<Options>(filter: Filter<Options>, options: Options) {
        return new Signal(this.source, this.metadata, this.original, this.data, this.operations.concat({
            name: filter.filter_name,
            options: options,
        }));
    }

    /**
     * Returns a copy of the current signal where `Signal.data` has been set to `data`.
     */
    public setData(data: SignalData) {
        return new Signal(this.source, this.metadata, this.original, data, this.operations);
    }

    public toJSON() {
        return {
            metadata: this.metadata,
            originalData: Array.from(this.original),
            data: Array.from(this.data),
            operations: this.operations,
        };
    }

    // From functions
    public static fromArray(data: number[]) {
        const array = new SignalData(data);
        return new Signal(undefined, { type: 'defined', time: Date.now() }, array, array, []);
    }

    public static fromIterable(data: Iterable<number>) {
        const array = new SignalData(data);
        return new Signal(undefined, { type: 'defined', time: Date.now() }, array, array, []);
    }

    public static fromString(data: string) {
        return this.fromArray(data.split('').map(x => x === '0' ? 0 : 1));
    }

    public static fromSource<Source>(source: Source, signal: SignalData, metadata: Metadata) {
        return new Signal(source, metadata, signal, signal, []);
    }

    // Signal.serialize / Signal.deserialize
    public static deserialize(json: string) {
        const obj = JSON.parse(json);

        return new Signal(
            undefined,
            obj.metadata,
            new SignalData(obj.originalData),
            new SignalData(obj.data),
            obj.operations,
        );
    }

    public static serialize<T>(signal: Signal<T>) {
        return JSON.stringify(signal);
    }

    // Filters
    public static add = Filters.addValue;
    public static average = Filters.average;
    public static bandpass = Filters.bandpass;
    public static biquad = Filters.biquad;
    public static clamp = Filters.clamp;
    public static divValue = Filters.divValue;
    public static exclude = Filters.exclude;
    public static highpass = Filters.highpass;
    public static lowpass = Filters.lowpass;
    public static max = Filters.max;
    public static mulValue = Filters.mulValue;
    public static min = Filters.min;
    public static repeat = Filters.repeat;
    public static stretch = Filters.stretch;
    public static subValue = Filters.subValue;
    public static threshold = Filters.threshold;
    public static slice = Filters.slice;

    public static filters = Filters.filters;

    public static applyOperation(operation: Operation): PartiallyApplied
    public static applyOperation(operation: Operation, signal: Signal<unknown>): Signal<unknown>
    public static applyOperation(operation: Operation, signal?: Signal<unknown>): Signal<unknown> | PartiallyApplied
    public static applyOperation(operation: Operation, signal?: Signal<unknown>): Signal<unknown> | PartiallyApplied {
        const filter = (Signal.filters as any)[operation.name];
        if (filter === undefined) {
            throw new Error(`Filter '${operation.name}' does not exist.`)
        }

        if (signal === undefined) {
            return ((input: Signal<any>) => filter(operation.options, input)) as any;
        } else {
            return filter(operation.options, signal) as Signal<unknown>;
        }
    }

    public static applyOperations(operations: Operation[]): PartiallyApplied
    public static applyOperations(operations: Operation[], signal: Signal<unknown>): Signal<unknown>
    public static applyOperations(operations: Operation[], signal?: Signal<unknown>): Signal<unknown> | PartiallyApplied
    public static applyOperations(operations: Operation[], signal?: Signal<unknown>): Signal<unknown> | PartiallyApplied {
        // TODO: Inline Signal.applyOperation to avoid multiple lookups of Signal.filters
        if (signal === undefined) {
            return Signal.applyOperations.bind(operations) as any;
        }

        for (const operation of operations) {
            signal = Signal.applyOperation(operation, signal);
        }
        return signal;
    }

    public slice(start?: number, end?: number) {
        return Signal.slice({ start, end }, this);
    }
}