import { timing } from '../src/timing';

// Example 1: Enforcing consistent timing
const hashPassword = async (password: string) => {
  return `hashed_${password}`;
};
(async () => {
  const result = await timing(() => hashPassword('my_password'), undefined, 500);
  console.log('Consistent Timing Example:', result); // Always takes 500ms
})();

// Example 2: Adding a minimum delay to API calls
const fetchData = async () => {
  return { data: 'response' };
};
(async () => {
  const result = await timing.min(() => fetchData(), 1000);
  console.log('Minimum Delay Example:', result); // Always takes at least 1000ms
})();

// Example 3: Limiting execution time for long-running tasks
const longRunningTask = async (signal?: AbortSignal) => {
  return new Promise((resolve) => setTimeout(() => resolve('done'), 5000));
};
(async () => {
  const result = await timing.max(longRunningTask, 'timeout', 2000);
  console.log('Maximum Execution Time Example:', result); // Returns 'timeout' after 2000ms
})();