# time-leash

A utility for precise timing control of async operations. This library provides functions to ensure that asynchronous operations adhere to specific timing constraints, such as exact, minimum, or maximum execution durations. It is designed to work in various environments, including browsers, Node.js, Edge runtimes, and Bun.

## Features

- `timing()`: Execute a function with exact timing.
- `timing.min()`: Ensure a function runs for at least a specified duration.
- `timing.max()`: Ensure a function runs for at most a specified duration with abort support.

## Default Detention Period

The default detention period for timing control functions is set to **250 milliseconds**. This value is used as the default for the `duration`, `minDuration`, and `maxDuration` parameters in the respective functions if no specific value is provided.

## Installation

Install the package using your preferred package manager:

```bash
npm install time-leash
# or
yarn add time-leash
# or
pnpm add time-leash
```

## Usage

### `timing(fn, fallbackValue?, duration?)`

Executes a function and ensures it runs for exactly the specified duration. If the function completes early, it waits for the remaining time. If it exceeds the duration, it either returns a fallback value or throws an error.

#### Parameters
- `fn: () => Promise<T>` - The asynchronous function to execute.
- `fallbackValue?: T` - The value to return if the function exceeds the time limit.
- `duration?: number` - The exact execution time in milliseconds (default: 250ms).

#### Example
```typescript
import { timing } from 'time-leash';

const result = await timing(async () => {
  // Your async operation
  return 'success';
}, 'fallback', 300);

console.log(result); // 'success' or 'fallback'
```

### `timing.min(fn, minDuration?)`

Ensures a function runs for at least the specified duration. If the function completes early, it waits for the remaining time.

#### Parameters
- `fn: () => Promise<T>` - The asynchronous function to execute.
- `minDuration?: number` - The minimum execution time in milliseconds (default: 250ms).

#### Example
```typescript
import { timing } from 'time-leash';

const result = await timing.min(async () => {
  // Your async operation
  return 'quick result';
}, 500);

console.log(result); // 'quick result'
```

### `timing.max(fn, fallbackValue?, maxDuration?)`

Ensures a function runs for at most the specified duration. If the function exceeds the time limit, it either returns a fallback value or throws an error. Supports `AbortSignal` for cancellation.

#### Parameters
- `fn: (signal?: AbortSignal) => Promise<T>` - The asynchronous function to execute. Optionally accepts an `AbortSignal` for cancellation.
- `fallbackValue?: T` - The value to return if the function exceeds the time limit.
- `maxDuration?: number` - The maximum execution time in milliseconds (default: 250ms).

### Note on Non-Abortable Functions

If the function provided to `timing.max` is not abortable (i.e., it does not support `AbortSignal`), it will continue executing in the background even after the timeout is reached. The timeout mechanism ensures that the result returned to the caller adheres to the specified maximum duration. However, the unabortable function will not be forcibly stopped and may continue consuming resources.

#### Example
```typescript
import { timing } from 'time-leash';

const result = await timing.max(async (signal) => {
  // Your async operation
  return 'slow result';
}, 'fallback', 300);

console.log(result); // 'slow result' or 'fallback'
```

## Tree-Shaking Support

This library is fully tree-shakable, allowing you to reduce your bundle size by only including the specific functions you use. You can import just what you need:

### Standard API (Recommended for Most Users)

```typescript
import { timing } from 'time-leash';

// Use all functions
const exact = await timing(() => operation(), fallback, duration);
const minimum = await timing.min(() => operation(), minDuration);
const maximum = await timing.max(() => operation(), fallback, maxDuration);
```

### Tree-Shakable Imports (Optimized Bundle Size)

```typescript
// Import only what you need
import { min } from 'time-leash';

// This will exclude the exact and max functions from your bundle
const result = await min(() => operation(), 1000);
```

Or import multiple specific functions:

```typescript
import { exact, max } from 'time-leash';

// Only exact and max will be included in your bundle
const result1 = await exact(() => operation(), fallback, 300);
const result2 = await max(() => operation(), fallback, 200);
```

## Timing Precision and Limitations

While `time-leash` strives to provide precise timing control, it is important to note that JavaScript's `setTimeout` and `performance.now()` are subject to system-level limitations. These include:

- **Timer Clamping**: In some environments, timers may be clamped to a minimum delay (e.g., 4ms in browsers under certain conditions).
- **Event Loop Delays**: Heavy system load or blocking operations can introduce delays.

### Best Practices for Accurate Timing

To achieve the best results:

1. **Minimize System Load**: Avoid running resource-intensive tasks concurrently.
2. **Use Dedicated Environments**: Run timing-critical operations in isolated environments to reduce interference.
3. **Allow Margins of Error**: When using `time-leash` for critical operations, account for small timing inaccuracies (e.g., ±5ms).

By following these practices, you can maximize the utility of `time-leash` for your applications.

## Use Cases

Here are some common use cases for `time-leash`:

### 1. Enforcing Consistent Timing in Security-Critical Operations

When performing operations like password hashing or cryptographic key generation, consistent timing can help prevent timing attacks. Use `timing()` to ensure the operation always takes the same amount of time, regardless of input size or complexity.

#### Example
```typescript
import { timing } from 'time-leash';

const hashPassword = async (password: string) => {
  // Simulate password hashing
  return `hashed_${password}`;
};

const result = await timing(() => hashPassword('my_password'), undefined, 500);
console.log(result); // Always takes 500ms
```

### 2. Adding a Minimum Delay to API Calls

When calling APIs, you might want to ensure a minimum delay between requests to avoid rate-limiting issues or to provide a consistent user experience.

#### Example
```typescript
import { timing } from 'time-leash';

const fetchData = async () => {
  // Simulate an API call
  return { data: 'response' };
};

const result = await timing.min(() => fetchData(), 1000);
console.log(result); // Always takes at least 1000ms
```

### 3. Limiting Execution Time for Long-Running Tasks

When dealing with tasks that could potentially run indefinitely, use `timing.max` to enforce a maximum execution time and optionally provide a fallback value.

#### Example
```typescript
import { timing } from 'time-leash';

const longRunningTask = async (signal?: AbortSignal) => {
  // Simulate a long-running task
  return new Promise((resolve) => setTimeout(() => resolve('done'), 5000));
};

const result = await timing.max(longRunningTask, 'timeout', 2000);
console.log(result); // Returns 'timeout' after 2000ms
```

### 4. Throttling User Input in Real-Time Applications

In real-time applications, such as games or live data visualizations, you may want to throttle user input to ensure consistent processing intervals.

#### Example
```typescript
import { timing } from 'time-leash';

const processInput = async (input: string) => {
  // Simulate input processing
  return `processed_${input}`;
};

const throttledInput = await timing(() => processInput('user_input'), undefined, 100);
console.log(throttledInput); // Ensures processing takes exactly 100ms
```

### 5. Simulating Network Latency for Testing

When testing applications, you might want to simulate network latency to observe how your app behaves under different conditions.

#### Example
```typescript
import { timing } from 'time-leash';

const fetchMockData = async () => {
  // Simulate fetching data
  return { data: 'mock_data' };
};

const simulatedLatency = await timing(() => fetchMockData(), undefined, 1000);
console.log(simulatedLatency); // Simulates a 1000ms network delay
```

### 6. Enforcing Timeouts for Database Queries

When querying a database, you may want to enforce a maximum execution time to prevent long-running queries from blocking your application.

#### Example
```typescript
import { timing } from 'time-leash';

const queryDatabase = async (signal?: AbortSignal) => {
  // Simulate a database query
  return new Promise((resolve) => setTimeout(() => resolve('query_result'), 5000));
};

const result = await timing.max(queryDatabase, 'timeout', 2000);
console.log(result); // Returns 'timeout' if the query exceeds 2000ms
```

### 7. Adding Delays Between Batch Processing

When processing items in batches, you might want to add a delay between each batch to avoid overwhelming the system.

#### Example
```typescript
import { timing } from 'time-leash';

const processBatch = async (batch: number[]) => {
  // Simulate batch processing
  return batch.map((item) => item * 2);
};

const batch = [1, 2, 3];
const result = await timing.min(() => processBatch(batch), 500);
console.log(result); // Ensures at least 500ms delay for batch processing
```

### 8. Ensuring Consistent Animation Timing

When creating animations, you may want to ensure that each frame or step of the animation takes a consistent amount of time.

#### Example
```typescript
import { timing } from 'time-leash';

const animateFrame = async (frame: number) => {
  // Simulate rendering a frame
  console.log(`Rendering frame ${frame}`);
};

for (let i = 0; i < 10; i++) {
  await timing(() => animateFrame(i), undefined, 100);
}
```

## Environment Compatibility

`time-leash` is designed to work in the following environments:
- **Browsers**: Fully compatible with modern browsers.
- **Node.js**: Works seamlessly in Node.js environments.
- **Edge Runtimes**: Compatible with Edge runtimes like Cloudflare Worker / Vercel.
- **Bun**: Tested and works with Bun.

## Testing

This package includes a comprehensive test suite using [Vitest](https://vitest.dev/). To run the tests:

```bash
npm test
# or
yarn test
# or
pnpm test
```

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Write tests for your changes.
4. Submit a pull request.

## License

This project is licensed under the ISC License. See the LICENSE file for details.