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

export {
    Signal
} from './signal_impl';

export {
    Metadata,
    Source,
    SourceSet,
    FilterType,
    Filter,
    Operation,
    SignalData,
    PartiallyApplied,
} from './core';

export {
    createFilter,
    stealthApplyFilter,

    // Types of filters
    DataFilter,
    RawSignalFilter,
    SignalFilter,
} from './filters_core';