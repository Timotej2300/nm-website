import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";

/** GET `path` (null = skip). Returns { data, error, loading, reload }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    api
      .get(path, { signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({ data: null, error: errorMessage(e), loading: false });
      });
    return () => ctrl.abort();
  }, [path, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}
