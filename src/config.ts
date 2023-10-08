// Cache timing thresholds, used in determining if memory resides in the cache or not.
export const CACHE_L3_MISS_THRESHOLD = 60;

// Cache architecture parameters
//  These parameters match many Intel CPUs (Known good for Intel i7 6700k)
//  You may need to modify them to match your system.
export const CACHE_LINE_BITS = 6;           // log_2(cache line size)
export const CACHE_PAGE_BITS = 12;          // log_2(page size)
export const CACHE_SET_BITS = 10;           // log_2(cache sets)
export const CACHE_SLICE_BITS = 3;          // log_2(number of physical cores)
export const CACHE_L3_ASSOCIATIVITY = 16;   // Number of ways in L3 cache

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// END OF CONFIGURATION
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CACHE_LINE_SIZE = 1 << CACHE_LINE_BITS;
export const CACHE_PAGE_SIZE = 1 << CACHE_PAGE_BITS;
export const CACHE_SET_COUNT = 1 << CACHE_SET_BITS;
export const CACHE_SLICE_COUNT = 1 << CACHE_SLICE_BITS;

export const CACHE_LINE_MASK = CACHE_LINE_SIZE - 1;
export const CACHE_PAGE_MASK = CACHE_PAGE_SIZE - 1;
export const CACHE_SET_MASK = CACHE_SET_COUNT - 1;

