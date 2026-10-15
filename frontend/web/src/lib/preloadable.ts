import {
  createElement, useEffect, useState, useSyncExternalStore,
  type ComponentProps, type ComponentType, type ReactNode,
} from "react";

type Module<T> = { default: T };

/** An on-demand panel with `preload()` for intent (a menu opening, a hover, a focus).
 *
 * Unlike route-level lazy, a panel owns its loading placeholder instead of suspending. Both a
 * preloaded panel and a cold touch/shortcut open render as soon as the module is ready, without
 * Suspense's reveal throttle. Prefetching loads code only; effects and subscriptions start on mount.
 * Rejected promises are not retained here; the loader/browser controls whether a retry can succeed.
 * A load that fails while mounted reaches the error boundary.
 * (`ComponentType<any>` is the constraint React.lazy itself places on T.) */
export function preloadable<T extends ComponentType<any>>(load: () => Promise<Module<T>>, fallback: ReactNode = null) {
  let loaded: Module<T> | undefined;
  let pending: Promise<Module<T>> | undefined;
  const listeners = new Set<() => void>();
  const read = () => loaded;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const preload = () => pending ??= load().then(
    (module) => {
      loaded = module;
      for (const notify of listeners) notify();
      return module;
    },
    (error: unknown) => { pending = undefined; throw error; });
  function Preloaded(props: ComponentProps<T>) {
    const module = useSyncExternalStore(subscribe, read, read);
    const [failure, setFailure] = useState<{ error: unknown } | null>(null);
    useEffect(() => {
      let active = true;
      preload().catch(error => { if (active) setFailure({ error }); });
      return () => { active = false; };
    }, []);
    if (failure) throw failure.error;
    return module ? createElement(module.default, props) : fallback;
  }
  return Object.assign(Preloaded, { preload });
}
