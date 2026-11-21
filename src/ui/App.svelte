<script lang="ts">
  let state = $state({ count: 0, response: '', pending: false });

  async function callWorker() {
    state.count += 1;
    state.pending = true;
    try {
      const response = await fetch('/api/message', { cache: 'no-store' });
      state.response = await response.text();
    } catch {
      state.response = 'Could not reach the Worker.';
    } finally {
      state.pending = false;
    }
  }
</script>

<main>
  <h1>Worker calls</h1>
  <p>Count: {state.count}</p>
  <button onclick={callWorker} disabled={state.pending}>Call worker</button>
  <h2>Response</h2>
  <pre aria-live="polite">{state.response}</pre>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f7f7f3;
    color: #193831;
    font-family: 'Inter', system-ui, sans-serif;
  }
  main {
    max-width: 32rem;
    margin: 12vh auto;
    padding: 2rem;
  }
  button {
    font: inherit;
    border: 0;
    border-radius: 0.4rem;
    padding: 0.7rem 1.2rem;
    background: #215747;
    color: white;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.65;
  }
  h2 {
    margin-top: 2rem;
    font-size: 1rem;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
