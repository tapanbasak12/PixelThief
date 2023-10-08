import { Filter, PartiallyApplied, SignalData, FilterType } from './core';
import { Signal } from './signal_impl';

export type DataFilter<Options> = (options: Options, input: SignalData) => SignalData;
export type SignalFilter<Options> = <T>(options: Options, input: Signal<T>) => Signal<T>;
export type RawSignalFilter<Options> = <T>(options: Options, input?: Signal<T> ) => Signal<T> | PartiallyApplied;

export function createFilter<Options>(name: string, type: FilterType.SIGNAL    , fn: SignalFilter<Options>   ): Filter<Options>
export function createFilter<Options>(name: string, type: FilterType.RAW_SIGNAL, fn: RawSignalFilter<Options>): Filter<Options>
export function createFilter<Options>(name: string, type: FilterType.DATA      , fn: DataFilter<Options>     ): Filter<Options>
export function createFilter<Options>(name: string, type: FilterType           , fn: Function                ): Filter<Options>
{
    const filter: any = <T>(options: Options, input?: Signal<T>) => {
        return applyFilter(filter, options, input);
    };

    filter.filter_name    = name;
    filter.filter_type    = type;
    filter.implementation = fn;

    return filter;
}

/**
 * Apply a filter to a signal, but do not record any metadata into Signal.operations.
 *  This is the recommended way of applying a filter from within another filter.
 * 
 * This is needed because Filters automatically keep track of when they are applied to a Signal. This prevents nested
 *  filters from adding themselves to `Signal.operations`.
 */
export function stealthApplyFilter<Options>  (filter: Filter<Options>, options: Options): PartiallyApplied
export function stealthApplyFilter<Options,T>(filter: Filter<Options>, options: Options, input:  Signal<T>): Signal<T>
export function stealthApplyFilter<Options,T>(filter: Filter<Options>, options: Options, input?: Signal<T>): Signal<T> | PartiallyApplied
export function stealthApplyFilter<Options,T>(filter: Filter<Options>, options: Options, input?: Signal<T>): Signal<T> | PartiallyApplied
{
    if (input === undefined) {
        switch (filter.filter_type) {
            case FilterType.DATA:
            case FilterType.SIGNAL: {
                return (input) => stealthApplyFilter(filter, options, input);
            }

            case FilterType.RAW_SIGNAL: {
                return filter.implementation(options, input);
            }
        }
    }

    switch (filter.filter_type) {
        case FilterType.DATA: {
            const output = filter.implementation(options, input.data) as SignalData;
            return input.setData(output);
        }

        case FilterType.SIGNAL:
        case FilterType.RAW_SIGNAL: {
            return filter.implementation(options, input) as Signal<T>;
        }
    }
}

/**
 * Do not use this function directly. Instead, call the filter like a regular function.
 * 
 * For exmaple. If you are trying to use the Signal.clamp filter, you would write the following code. Where `input` is
 *  an instance of type Signal.
 *      Signal.clamp({min: 0, max: 10}, input);
 *
 * This function implements the behaviour of calling a filter.
 */
function applyFilter<Options>  (filter: Filter<Options>, options: Options): PartiallyApplied
function applyFilter<Options,T>(filter: Filter<Options>, options: Options, input:  Signal<T>): Signal<T>
function applyFilter<Options,T>(filter: Filter<Options>, options: Options, input?: Signal<T>): Signal<T> | PartiallyApplied
function applyFilter<Options,T>(filter: Filter<Options>, options: Options, input?: Signal<T>): Signal<T> | PartiallyApplied
{
    if (input === undefined) {
        switch (filter.filter_type) {
            case FilterType.DATA:
            case FilterType.SIGNAL: {
                return (input) => applyFilter(filter, options, input);
            }

            case FilterType.RAW_SIGNAL: {
                const partially_applied = filter.implementation(options, undefined) as PartiallyApplied;
                return (input) => partially_applied(input).addOperation(filter, options);
            }
        }
    } else {
        switch (filter.filter_type) {
            case FilterType.DATA: {
                const output = filter.implementation(options, input.data) as SignalData;
                return input.addOperation(filter, options).setData(output);
            }

            case FilterType.SIGNAL:
            case FilterType.RAW_SIGNAL: {
                const output = filter.implementation(options, input) as Signal<T>;
                return output.addOperation(filter, options);
            }
        }
    }
}