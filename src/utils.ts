export function sleep(timeout: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

export function inParallel<Ps extends any[], R>(fn: (...ps: Ps) => R, ...ps: Ps): Worker {
    const code = fn.toString();
    const body = `const f = ${code}; self.onmessage=function(e){postMessage(f(...e.data));}`

    const blob = new Blob([body], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    const worker = new Worker(url);
    worker.postMessage(ps);

    return worker;
}

export function runWasm(module: WebAssembly.Module, memory: WebAssembly.Memory) {
    new WebAssembly.Instance(module, { env: { mem: memory } });
}

export async function loadModule(url: string) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return new WebAssembly.Module(buffer);
}

// Credit: Jeff (via Stack Overflow) https://stackoverflow.com/a/6274381
export function shuffle<T>(a: T[]) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

export function union<T>(a: Set<T>, b: Set<T>) {
    const result = [];
    for (const value of a) {
        if (b.has(value)) {
            result.push(value);
        }
    }
    return new Set(result);
}

export function sumBy<T>(seq: Iterable<T>, by: (value: T) => number) {
    let sum = 0;
    for (const value of seq) {
        sum += by(value);
    }
    return sum;
}

export function meanBy<T>(seq: Iterable<T>, by: (value: T) => number) {
    return sumBy(seq, by) / length(seq);
}

export function varianceBy<T>(seq: Iterable<T>, by: (value: T) => number) {
    const m = meanBy(seq, by);
    return sumBy(seq, value => (by(value) - m) ** 2) / (length(seq) - 1);
}

export function countBy<T>(seq: Iterable<T>, predicate: (value: T) => boolean) {
    let count = 0;
    for (const value of seq) {
        if (predicate(value)) {
            count++;
        }
    }
    return count;
}

export function minBy<T>(seq: Iterable<T>, by: (value: T) => number | string) {
    let minV: T | undefined = undefined;
    let minK: number | string | undefined = undefined;

    for (const newV of seq) {
        const newK = by(newV);

        if (minK === undefined || newK < minK) {
            minV = newV;
            minK = newK;
        }
    }

    return minV;
}

export function sum(seq: Iterable<number>) {
    return sumBy(seq, x => x);
}

export function mean(seq: Iterable<number>) {
    return meanBy(seq, x => x);
}

export function variance(seq: Iterable<number>) {
    return varianceBy(seq, x => x);
}

export function length(seq: Iterable<unknown>) {
    switch (seq.constructor) {
        case Array: return (seq as Array<unknown>).length;
        case Set: return (seq as Set<unknown>).size;
        case Map: return (seq as Map<unknown, unknown>).size;

        default: {
            let length = 0;
            for (const value of seq) length++;
            return length;
        }
    }
}

export async function apply(value: any, ...fns: Function[]) {
    for (const fn of fns) {
        value = fn(value);

        if (value instanceof Promise) {
            value = await value;
        }
    }

    return value;
}

export function groupBy<T, K>(array: T[], fn: (value: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();

    for (const value of array) {
        const key = fn(value);

        if (!map.has(key)) {
            map.set(key, []);
        }

        map.get(key)!.push(value);
    }

    return map;
}

export function tee(...fns: Function[]) {
    return (value: any) => {
        const original = value;

        for (const fn of fns) {
            value = fn(value);
        }

        return original;
    }
}