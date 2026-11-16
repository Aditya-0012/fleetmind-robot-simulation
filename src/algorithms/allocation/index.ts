import { greedyAllocate } from './greedy';
import { hungarianAllocate } from './hungarian';
import type { AllocationAlgorithm, AllocationInput, AllocationResult } from './types';

export * from './types';
export { greedyAllocate, greedyMatrix } from './greedy';
export { hungarian, hungarianAllocate } from './hungarian';
export { computeCost, DistanceOracle, taskOrder, clampPriority, MAX_PRIORITY, MIN_PRIORITY } from './costFunction';

export function allocate(algorithm: AllocationAlgorithm, input: AllocationInput): AllocationResult {
  return algorithm === 'greedy' ? greedyAllocate(input) : hungarianAllocate(input);
}
