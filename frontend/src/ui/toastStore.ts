import { ToastKind } from './types';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
  /** ms; errors stay longer by default. */
  duration: number;
}

type Input = Omit<ToastItem, 'id' | 'kind' | 'duration'> & { duration?: number };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const MAX_VISIBLE = 4;

function push(kind: ToastKind, input: Input): number {
  const id = nextId++;
  const duration = input.duration ?? (kind === ToastKind.Error ? 8000 : input.action ? 6000 : 4000);
  items = [...items, { ...input, id, kind, duration }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Imperative toasts, callable from mutation callbacks. */
export const toast = {
  info: (title: string, rest: Omit<Input, 'title'> = {}) =>
    push(ToastKind.Info, { title, ...rest }),
  success: (title: string, rest: Omit<Input, 'title'> = {}) =>
    push(ToastKind.Success, { title, ...rest }),
  error: (title: string, rest: Omit<Input, 'title'> = {}) =>
    push(ToastKind.Error, { title, ...rest }),
  dismiss: dismissToast,
};

export const toastStore = {
  subscribe(this: void, fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot: () => items,
};
