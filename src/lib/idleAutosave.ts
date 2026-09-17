// Lets a page (e.g. campaign compose) register a "save my unsaved work"
// callback that the idle-logout warning/timeout will call before signing
// the user out, so a 30-minute idle logout doesn't silently drop a draft.
type AutosaveFn = () => Promise<void> | void;

const callbacks = new Set<AutosaveFn>();

export function registerIdleAutosave(fn: AutosaveFn): () => void {
  callbacks.add(fn);
  return () => callbacks.delete(fn);
}

const PER_CALLBACK_TIMEOUT_MS = 5000;

export async function flushIdleAutosave(): Promise<void> {
  await Promise.all(
    Array.from(callbacks).map((fn) =>
      Promise.race([
        Promise.resolve().then(fn),
        new Promise<void>((resolve) => setTimeout(resolve, PER_CALLBACK_TIMEOUT_MS)),
      ]).catch(() => undefined),
    ),
  );
}
