export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const wrapped = ((...args: never[]) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, waitMs);
  }) as T & { cancel: () => void };

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return wrapped;
}

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: never[] | undefined;

  const invoke = (args: never[]) => {
    last = Date.now();
    fn(...args);
  };

  const wrapped = ((...args: never[]) => {
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
  }) as T & { cancel: () => void };

  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending = undefined;
  };

  return wrapped;
}
