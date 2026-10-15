import { action, makeObservable, observable, observableShallow } from 'mobx';
import type { ResponseSeverity } from '../errors/types.ts';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  title: string;
  subtitle?: string;
  severity: ResponseSeverity;
  action?: ToastAction;
}

const MAX_VISIBLE = 5;

/** xRocket `ToastsStore` without the "title → subtitle" layout hack and without DI. */
export class ToastsStore {
  toasts: Toast[] = [];
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    makeObservable<ToastsStore, 'remove'>(this, {
      toasts: observableShallow,
      push: action,
      dismiss: action,
      remove: action,
    });
  }

  push(toast: Omit<Toast, 'id'>, autoDismissMs = 5000): number {
    const id = this.nextId++;

    this.toasts.push({ ...toast, id });

    while (this.toasts.length > MAX_VISIBLE) {
      const oldest = this.toasts[0];

      if (oldest) {
        this.dismiss(oldest.id);
      }
    }

    if (autoDismissMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), autoDismissMs),
      );
    }

    return id;
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.remove(id);
  }

  private remove(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
