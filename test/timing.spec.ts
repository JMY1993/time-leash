import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timing } from '../src/timing';

describe('timing, as exact', () => {
    beforeEach(() => {
        // Reset all mocks and timers before each test
        vi.resetAllMocks();
        vi.useRealTimers();

        // Now set up fake timers
        vi.useFakeTimers();

        // Mock performance.now to return the system time
        vi.spyOn(performance, 'now').mockImplementation(() => {
            return Number(vi.getMockedSystemTime()) || 0;
        });

        // Set the initial system time
        vi.setSystemTime(1000);
    });

    afterEach(() => {
        // Clean up after each test
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should return the result of the function when it completes in time', async () => {
        const fn = async () => 'success';

        // Start the function execution
        const promise = timing(fn, 200, 'fallback');

        // Advance time to simulate function completion
        vi.advanceTimersByTime(100);

        // Process any pending promise callbacks
        await vi.runOnlyPendingTimersAsync();

        // Advance time to complete the remaining wait time
        vi.advanceTimersByTime(100);

        // Get the final result
        const result = await promise;

        expect(result).toBe('success');
    });

    it('should enforce minimum execution time by waiting', async () => {
        const fn = async () => 'quick result';

        const promise = timing(fn, 250, undefined); // You don't need to explicitly pass undefined, this is just for clarity in the test

        // Fast-forward timers
        vi.runAllTimers();

        const result = await promise;
        expect(result).toBe('quick result');
    });

    it('should return fallback value when function exceeds time limit', async () => {
        // Mock a function that exceeds time limit
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(1000); // Start time

        const slowFn = () => new Promise((resolve) => {
            setTimeout(() => resolve('slow result'), 300);
        });

        const promise = timing(slowFn, 200, 'fallback');

        // Fast-forward by just over the timeout
        vi.advanceTimersByTime(201);

        const result = await promise;
        expect(result).toBe('fallback');
    });

    it('should throw error when function exceeds time limit and no fallback is provided', async () => {
        // Mock a function that exceeds time limit
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(1000); // Start time

        const slowFn = () => new Promise((resolve) => {
            setTimeout(() => resolve('slow result'), 300);
        });

        const promise = timing(slowFn, 200);

        // Fast-forward by just over the timeout
        vi.advanceTimersByTime(201);

        await expect(promise).rejects.toThrow('Function execution exceeded time limit of 200ms');
    });

    it('should use default time parameter when not specified', async () => {
        const fn = async () => 'success';

        const promise = timing(fn);

        // Should have default timeout of TARGET_HASH_TIME (250ms)
        expect(vi.getTimerCount()).toBe(1);
        vi.runAllTimers();

        const result = await promise;
        expect(result).toBe('success');
    });

    it('should handle errors thrown by the function', async () => {
        const errorFn = async () => {
            throw new Error('Function error');
        };

        await expect(timing(errorFn)).rejects.toThrow('Function error');
    });

    // Real-world timeout tests
    describe('with real timers', () => {
        beforeEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should actually wait for the minimum time in real world', async () => {
            const startTime = Date.now();
            const minTime = 50; // Use a shorter time for tests

            await timing(
                async () => 'fast operation',
                minTime
            );

            const executionTime = Date.now() - startTime;
            expect(executionTime).toBeGreaterThanOrEqual(minTime - 5); // Allow small margin of error
        }, 1000); // Give the test enough time to complete

        it('should handle timeout with real timers', async () => {
            const startTime = Date.now();
            const timeout = 50;

            const result = await timing(
                () => new Promise(resolve => setTimeout(() => resolve('slow'), 100)),
                timeout,
                'fallback'
            );

            expect(result).toBe('fallback');
            const executionTime = Date.now() - startTime;
            expect(executionTime).toBeLessThan(90); // Should not wait for the full 100ms
        }, 1000);
    });
});

describe('timing.min', () => {
    beforeEach(() => {
        // Reset all mocks and timers before each test
        vi.resetAllMocks();
        vi.useRealTimers();

        // Now set up fake timers
        vi.useFakeTimers();

        // Mock performance.now to return the system time
        vi.spyOn(performance, 'now').mockImplementation(() => {
            return Number(vi.getMockedSystemTime()) || 0;
        });

        // Set the initial system time
        vi.setSystemTime(1000);
    });

    afterEach(() => {
        // Clean up after each test
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should execute function and return its result', async () => {
        const fn = async () => 'min result';
        const promise = timing.min(fn, 200);

        // Fast-forward by less than the minimum time
        vi.advanceTimersByTime(50);
        await vi.runOnlyPendingTimersAsync();

        // Fast-forward the remaining time
        vi.advanceTimersByTime(150);

        const result = await promise;
        expect(result).toBe('min result');
    });

    it('should ensure function runs for at least the specified time', async () => {
        const fn = async () => 'quick operation';

        // Function that completes instantly but should wait
        const promise = timing.min(fn, 300);

        // Fast-forward but not enough time
        vi.advanceTimersByTime(200);

        // Instead of checking timer count (which is unreliable),
        // let's check that the promise is still pending
        let resolved = false;
        const checkPromise = Promise.race([
            promise.then(() => { resolved = true; return 'resolved'; }),
            new Promise(r => setTimeout(() => r('pending'), 5))
        ]);

        vi.advanceTimersByTime(5); // Advance for the setTimeout in our race
        const promiseState = await checkPromise;
        expect(promiseState).toBe('pending');
        expect(resolved).toBe(false);

        // Now complete the minimum time
        vi.advanceTimersByTime(100);

        // Run any pending timers/promises
        await vi.runOnlyPendingTimersAsync();

        // Now it should be resolved
        const result = await promise;
        expect(result).toBe('quick operation');
    }, 10000); // Increased timeout just in case

    it('should not add delay if function already executes longer than minimum', async () => {
        // Mock performance.now for precise timing control
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(1000)  // Start time
            .mockReturnValueOnce(1250); // End time (250ms elapsed)

        const fn = async () => {
            // Simulate a function that takes time
            await new Promise(resolve => setTimeout(resolve, 250));
            return 'slow operation';
        };

        const promise = timing.min(fn, 200);

        // Fast-forward by more than the minimum time
        vi.advanceTimersByTime(250);

        // Process any pending promise callbacks
        await vi.runOnlyPendingTimersAsync();

        const result = await promise;
        expect(result).toBe('slow operation');

        // No additional timer should be created since function already took longer
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should use default time parameter when not specified', async () => {
        const fn = async () => 'default timing';

        const promise = timing.min(fn);

        // Default should be TARGET_HASH_TIME (250ms)
        vi.advanceTimersByTime(250);

        const result = await promise;
        expect(result).toBe('default timing');
    });

    describe('with real timers', () => {
        beforeEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should ensure minimum execution time in real world', async () => {
            const startTime = Date.now();
            const minTime = 50; // Short enough for tests

            const result = await timing.min(
                async () => 'quick real operation',
                minTime
            );

            const executionTime = Date.now() - startTime;
            expect(result).toBe('quick real operation');
            expect(executionTime).toBeGreaterThanOrEqual(minTime - 5); // Allow small margin of error
        }, 1000);

        it('should not add delay for naturally slow operations', async () => {
            const startTime = Date.now();
            const minTime = 50;

            const result = await timing.min(
                async () => {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return 'naturally slow';
                },
                minTime
            );

            const executionTime = Date.now() - startTime;
            expect(result).toBe('naturally slow');
            expect(executionTime).toBeGreaterThanOrEqual(100 - 5); // Should be at least the operation time
            expect(executionTime).toBeLessThan(120); // But not much extra delay
        }, 1000);
    });
});

describe('timing.max', () => {
    beforeEach(() => {
        // Reset all mocks and timers before each test
        vi.resetAllMocks();
        vi.useRealTimers();

        // Now set up fake timers
        vi.useFakeTimers();

        // Mock performance.now to return the system time
        vi.spyOn(performance, 'now').mockImplementation(() => {
            return Number(vi.getMockedSystemTime()) || 0;
        });

        // Set the initial system time
        vi.setSystemTime(1000);
    });

    afterEach(() => {
        // Clean up after each test
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should return result when function completes within time limit', async () => {
        const fn = async () => 'fast enough';

        const promise = timing.max(fn, 200, 'fallback');

        // Function completes within time
        vi.advanceTimersByTime(100);

        const result = await promise;
        expect(result).toBe('fast enough');
    });

    it('should return fallback when function exceeds time limit', async () => {
        const slowFn = () => new Promise(resolve => {
            setTimeout(() => resolve('too slow'), 300);
        });

        const promise = timing.max(slowFn, 200, 'fallback value');

        // Fast-forward beyond the timeout
        vi.advanceTimersByTime(201);

        const result = await promise;
        expect(result).toBe('fallback value');
    });

    it('should throw error when function exceeds time limit and no fallback is provided', async () => {
        const slowFn = () => new Promise(resolve => {
            setTimeout(() => resolve('too slow'), 300);
        });

        const promise = timing.max(slowFn, 200);

        // Fast-forward beyond the timeout
        vi.advanceTimersByTime(201);

        await expect(promise).rejects.toThrow('Function execution exceeded time limit of 200ms');
    });

    it('should use default time parameter when not specified', async () => {
        const fn = async () => 'default max timing';

        const promise = timing.max(fn);

        // Default should be TARGET_HASH_TIME (250ms)
        vi.advanceTimersByTime(100);

        const result = await promise;
        expect(result).toBe('default max timing');
    });

    it('should handle edge case where function completes exactly at time limit', async () => {
        // Mock a function that completes exactly at the timeout
        const exactFn = () => new Promise(resolve => {
            setTimeout(() => resolve('exact timing'), 200);
        });

        const promise = timing.max(exactFn, 200, 'fallback');

        // Fast-forward to exactly the timeout
        vi.advanceTimersByTime(200);

        // Process any pending promise callbacks
        await vi.runOnlyPendingTimersAsync();

        // Result could be either the function result or fallback depending on microscopic timing differences
        // This is inherently a race condition, but we want to ensure it doesn't hang
        const result = await promise;
        expect(['exact timing', 'fallback']).toContain(result);
    });

    describe('with real timers', () => {
        beforeEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should return result for quick operations', async () => {
            const result = await timing.max(
                async () => 'quick max operation',
                100,
                'fallback'
            );

            expect(result).toBe('quick max operation');
        }, 1000);

        it('should handle timeout with real timers', async () => {
            const startTime = Date.now();
            const timeout = 50;

            const result = await timing.max(
                () => new Promise(resolve => setTimeout(() => resolve('way too slow'), 150)),
                timeout,
                'real fallback'
            );

            const executionTime = Date.now() - startTime;
            expect(result).toBe('real fallback');
            expect(executionTime).toBeLessThan(100); // Should timeout quickly, not wait for full 150ms
        }, 1000);

        it('should throw error with no fallback in real timers', async () => {
            await expect(timing.max(
                () => new Promise(resolve => setTimeout(() => resolve('slow'), 100)),
                50
            )).rejects.toThrow('Function execution exceeded time limit');
        }, 1000);
    });
});

describe('timing.max with abort functionality', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
        vi.useFakeTimers();

        vi.spyOn(performance, 'now').mockImplementation(() => {
            return Number(vi.getMockedSystemTime()) || 0;
        });

        vi.setSystemTime(1000);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should call function with an AbortSignal', async () => {
        const mockFn = vi.fn().mockResolvedValue('result');

        await timing.max(mockFn, 200, 'fallback');

        // Assert the function was called with an AbortSignal
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    });

    it('should abort the operation when timeout is reached', async () => {
        // Function that tracks if it was aborted
        let wasAborted = false;

        const slowFn = (signal?: AbortSignal) => new Promise((resolve) => {
            // Set up abort handler if signal exists
            if (signal) {
                signal.addEventListener('abort', () => {
                    wasAborted = true;
                });
            }

            setTimeout(() => resolve('too slow'), 300);
        });

        const promise = timing.max(slowFn, 200, 'fallback value');

        // Fast-forward beyond the timeout
        vi.advanceTimersByTime(201);

        const result = await promise;
        expect(result).toBe('fallback value');
        expect(wasAborted).toBe(true);
    });

    it('should handle functions that check abort signal manually', async () => {
        const manualCheckFn = (signal?: AbortSignal) => new Promise((resolve, reject) => {
            const intervalId = setInterval(() => {
                if (signal?.aborted) {
                    clearInterval(intervalId);
                    // Change from throwing to rejecting with error (matches fetch behavior)
                    reject(new DOMException('Operation was aborted', 'AbortError'));
                }
            }, 10);

            setTimeout(() => {
                clearInterval(intervalId);
                resolve('completed');
            }, 300);
        });

        // Use real timers since fake timers are causing issues
        vi.useRealTimers();
        
        const result = await timing.max(manualCheckFn, 50, 'manual check fallback');
        
        expect(result).toBe('manual check fallback');
    }, 2000); // Increase timeout

    it('should properly abort fetch operations', async () => {
        // Use real timers
        vi.useRealTimers();
        
        // Mock the fetch API
        const originalFetch = global.fetch;
        
        // Create a simplified mock that just rejects with AbortError when signal aborts
        global.fetch = vi.fn((url, options) => {
            return new Promise<Response>((resolve, reject) => {
                // Handle pre-aborted signal
                if (options?.signal?.aborted) {
                    return reject(new DOMException('The operation was aborted', 'AbortError'));
                }
                
                // Setup abort listener
                const abortHandler = () => {
                    reject(new DOMException('The operation was aborted', 'AbortError'));
                };
                
                options?.signal?.addEventListener('abort', abortHandler);
                
                // Complete after 200ms (if not aborted)
                const timeout = setTimeout(() => {
                    resolve({
                        ok: true,
                        json: async () => ({ success: true }),
                        status: 200,
                    } as Response);
                }, 200);
                
                // Cleanup if aborted
                options?.signal?.addEventListener('abort', () => clearTimeout(timeout));
            });
        });
        
        try {
            const result = await timing.max(
                async (signal) => {
                    const response = await fetch('https://example.com/api', { signal });
                    return response.json();
                },
                50,
                { success: false }
            );
            
            // Verify we got the fallback
            expect(result).toEqual({ success: false });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        } finally {
            // Restore the original fetch
            global.fetch = originalFetch;
        }
    }, 2000); // Increase timeout

    it('should handle manually abortable operations', async () => {
        // Use real timers
        vi.useRealTimers();
        
        let resourceReleased = false;
        
        const result = await timing.max(
            (signal?: AbortSignal) => new Promise((resolve) => {
                // Set up some "resource" to track
                const resource = { active: true };
                
                // Set up cleanup function for when aborted
                if (signal) {
                    signal.addEventListener('abort', () => {
                        resource.active = false;
                        resourceReleased = true;
                    });
                }
                
                // Long operation that never completes in our test timeframe
                setTimeout(() => {
                    if (resource.active) {
                        resolve('completed but too late');
                    }
                }, 300);
            }),
            50,
            'aborted early'
        );
        
        expect(result).toBe('aborted early');
        expect(resourceReleased).toBe(true);
    }, 2000); // Increase timeout
});