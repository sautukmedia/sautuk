import type { Cache } from 'cache-manager';

// Late responses may fill an old generation; new requests never read it.
let generation = 0;
export function contentCacheGeneration() {
  return generation;
}
export async function invalidateContentCache(cache?: Cache) {
  generation++;
  if (typeof cache?.clear === 'function') await cache.clear();
}
