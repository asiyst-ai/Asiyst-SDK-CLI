export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const wrapped = ((...args: Args) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, waitMs);
  }) as ((...args: Args) => void) & { cancel: () => void };

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return wrapped;
}

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Args | undefined;

  const invoke = (args: Args) => {
    last = Date.now();
    fn(...args);
  };

  const wrapped = ((...args: Args) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    pending = args;
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      invoke(args);
      return;
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = undefined;
        if (pending) {
          invoke(pending);
        }
      }, remaining);
    }
  }) as ((...args: Args) => void) & { cancel: () => void };

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = undefined;
  };

  return wrapped;
}
