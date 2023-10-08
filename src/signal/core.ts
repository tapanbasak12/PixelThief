import { Signal } from './signal_impl';

export type SignalData = Float64Array;
export const SignalData = Float64Array;

/**
 * Filters are designed to be called as regular function that take two inputs.
 *  @param{options} Any options that need to be provided to the filter.
 *  @param{input} The signal to apply the filter to.
 * 
 * @returns a new signal, the input after the filter has been applied. Additionally, `Signal.operations` will contain a
 *  new entry describing the filter.
 * 
 * Filters can be partially applied. If you specify the options for a filter, but not the input, then the filter is
 *  not executed. Instead, a new function is returned. This new function that takes a single argument (a Signal)
 *  and applies the filter with the previously speicfied options. This allows you to write the following code.
 *      const foo = Signal.clamp({min: 0, max: 10});
 *      const output1 = foo(input1);
 *      const output2 = foo(input2);
 *      const output3 = foo(input3);
 */
export interface Filter<Options> {
    filter_name: string;
    filter_type: FilterType;
    implementation: Function;

    <T>(options: Options, input: Signal<T>): Signal<T>;
    (options: Options): PartiallyApplied;
    <T>(options: Options, input?: Signal<T>): Signal<T> | PartiallyApplied;
}

export type PartiallyApplied = <U>(input: Signal<U>) => Signal<U>;

/**
 * Type of filter. Only used when creating a filter.
 *  In general, you should use the following types for the following situations.
 * 
 *  - RAW_SIGNAL: If you need to apply expensive pre-processing to Options. RAW_SIGNAL requires the implementation to
 *      handle partial application itself (or to pass that responsibility onto another filter) but allows the filter to
 *      pre-process Options when the filter is partially-applied.
 * 
 *  - SIGNAL: If you need to call another filter (remember to use stealthApplyFilter) or if you need to access parts of
 *      the signal beyond Signal.data.
 *  
 *  - DATA: Otherwise, use this where ever possible. It has the simplest interface, that only requires an implementation
 *      that operates on the data directly.
 */
export enum FilterType {
    /**
     * A data filter is the simplest implementation and suitable for most implementations of filters.
     *  @see DataFilter
     */
    DATA,

    /**
     * A signal filter is suitable for any filter implementations that needs to call other filters (remember to use
     *  stealthApplyFilter) or implementations that need to access metadata beyond the Signal.data. @see SignalFilter
     */
    SIGNAL,

    /**
     * A raw signal filter must implement partial-application itself. ie. It must handle undefined passed to input, and
     *  return a partially applied function. @see RawSignalFilter
     * 
     * This is recommended if you need to apply expensive pre-processing to Options. @see bandpass for an example.
     */
    RAW_SIGNAL,
}

export interface Operation {
    name: string;
    options: any;
}

export interface Metadata {
    /**
     * What the type of source originally was.
     */
    type: string;

    /**
     * The time the signal was recorded.
     */
    time: number;

    [field: string]: number | string;
}

//export interface Signal<Source> {
//    readonly source: Source;
//    readonly metadata: Metadata;
//    readonly original: SignalData;
//    readonly data: SignalData;
//    readonly operations: readonly Operation[];
//
//    addOperation<Options>(filter: Filter<Options>, options: Options): Signal<Source>;
//    setData(data: SignalData): Signal<Source>;
//}

export interface Source<T> {
    getData(): Promise<Signal<T>>;
}

export interface SourceSet<T> {
    readonly sources: readonly (Source<T> & T)[];
}
