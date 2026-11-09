import { useEffect, useState } from "react";

/** The value, but only after it has stopped changing for `ms`. Keeps live calculators from firing on every keystroke. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
