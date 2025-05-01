// Target execution time in milliseconds
const DEFAULT_DETENTION_PERIOD = 250;

/**
 * Timing control functions for security-critical operations
 */
export const timing = Object.assign(
  /**
   * Ensures a function executes for EXACTLY the specified duration
   * @param fn Function to execute with precise timing
   * @param fallbackValue Value to return if execution exceeds time limit
   * @param duration Exact execution time in milliseconds
   */
  async function timing<T>(
    fn: () => Promise<T>, 
    fallbackValue?: T, 
    duration: number = DEFAULT_DETENTION_PERIOD
  ): Promise<T> {
    const startTime = performance.now();
    
    // Create a promise that will resolve after the target time
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), duration);
    });
    
    // Race between the function execution and the timeout
    const raceResult = await Promise.race([
      fn().then(result => ({ status: "completed", value: result })),
      timeoutPromise.then(() => ({ status: "timeout" as const }))
    ]);
    
    // If the function completed before timeout
    if (raceResult.status === "completed") {
      // Calculate remaining time and wait if needed
      const executionTime = performance.now() - startTime;
      const delayNeeded = duration - executionTime;
      
      if (delayNeeded > 0) {
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }
      
      return raceResult.value;
    } 
    // If the function exceeded the time limit
    else {
      // Return fallback or throw error
      if (fallbackValue !== undefined) {
        return fallbackValue;
      } else {
        throw new Error(`Function execution exceeded time limit of ${duration}ms`);
      }
    }
  },
  {
    /**
     * Ensures a function executes for AT LEAST the specified duration
     * @param fn Function to execute with minimum timing
     * @param minDuration Minimum execution time in milliseconds
     */
    async min<T>(
      fn: () => Promise<T>,
      minDuration: number = DEFAULT_DETENTION_PERIOD
    ): Promise<T> {
      const startTime = performance.now();
      
      // Execute the function
      const result = await fn();
      
      // Calculate time spent and wait if needed
      const executionTime = performance.now() - startTime;
      const delayNeeded = minDuration - executionTime;
      
      if (delayNeeded > 0) {
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }
      
      return result;
    },

    /**
     * Ensures a function executes for AT MOST the specified duration
     * Intelligently aborts if function supports AbortSignal
     * @param fn Function to execute with maximum timing
     * @param fallbackValue Value to return if execution exceeds time limit
     * @param maxDuration Maximum execution time in milliseconds
     */
    async max<T>(
      fn: ((signal?: AbortSignal) => Promise<T>),
      fallbackValue?: T,
      maxDuration: number = DEFAULT_DETENTION_PERIOD
    ): Promise<T> {
      // Create AbortController to allow cancellation
      const controller = new AbortController();
      const { signal } = controller;
      
      // Create a promise that will resolve after the target time
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        setTimeout(() => {
          controller.abort();
          resolve("timeout");
        }, maxDuration);
      });
      
      // If the function is not abortable (does not support AbortSignal), it will continue executing in the background even after the timeout is reached. The timeout mechanism only ensures that the result returned to the caller adheres to the specified maximum duration. However, the unabortable function will not be forcibly stopped and may continue consuming resources.

      // Race between the function execution and the timeout
      try {
        const raceResult = await Promise.race([
          fn(signal).then(result => ({ status: "completed", value: result })),
          timeoutPromise.then(() => ({ status: "timeout" as const }))
        ]);
        
        // Return the result or handle timeout
        if (raceResult.status === "completed") {
          return raceResult.value;
        } else {
          if (fallbackValue !== undefined) {
            return fallbackValue;
          } else {
            throw new Error(`Function execution exceeded time limit of ${maxDuration}ms and was aborted`);
          }
        }
      } catch (error) {
        // Check if the error is from our abort operation
        if (signal.aborted && error instanceof DOMException && error.name === 'AbortError') {
          if (fallbackValue !== undefined) {
            return fallbackValue;
          } else {
            throw new Error(`Function execution exceeded time limit of ${maxDuration}ms and was aborted`);
          }
        }
        
        // Otherwise, propagate the original error
        throw error;
      }
    }
  }
);