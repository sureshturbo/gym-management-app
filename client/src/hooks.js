import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** GET `path` (with optional query params); refetches when they change. Returns { data, loading, error, reload }. */
export function useApi(path, params) {
  const key = path ? `${path}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { params })
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animates a number from its previous value to `target` (ease-out). */
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const to = Number(target) || 0;
    if (prefersReducedMotion()) {
      setValue(to);
      fromRef.current = to;
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Simple form state with server-side field errors. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((s) => ({ ...s, [name]: v }));
  };

  /** Runs fn(values); maps API field errors onto inputs. Returns fn's result, or undefined on failure. */
  const submit = async (fn) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      return await fn(values);
    } catch (err) {
      setErrors(err.details ?? {});
      setError(err.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  return { values, setValues, set, errors, error, setError, busy, submit };
}
