import { useSyncExternalStore } from 'react';
import type { Screen } from '../types/screen';

/**
 * Screen plan — the Discover page's shortlist basket.
 *
 * Lives outside React so the selection survives view-mode switches, filter
 * changes and route hops (Discover → screen detail → back). Mirrored to
 * sessionStorage so an accidental refresh doesn't wipe a half-built plan,
 * but deliberately NOT localStorage: a plan is a working document for this
 * sitting, not a durable preference.
 */
export interface PlanScreen {
    id: string;
    name: string;
    city?: string;
    pricePerSlot?: number;
    currency?: string;
    /** Owner-declared daily audience estimate (not a measured count). */
    dailyFootfall?: number;
}

const STORAGE_KEY = 'ps-screen-plan';

function load(): PlanScreen[] {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string') : [];
    } catch {
        return [];
    }
}

let plan: PlanScreen[] = load();
const listeners = new Set<() => void>();

function commit(next: PlanScreen[]) {
    plan = next;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {
        // Storage full / private mode — in-memory copy still works for this session.
    }
    listeners.forEach((l) => l());
}

function toPlanScreen(screen: Screen): PlanScreen {
    return {
        id: screen.id,
        name: screen.name,
        city: screen.location?.city,
        pricePerSlot: screen.pricePerSlot,
        currency: screen.currency,
        dailyFootfall: screen.dailyTotalImpressions,
    };
}

export function addToPlan(screen: Screen) {
    if (plan.some((p) => p.id === screen.id)) return;
    if (plan.length >= 20) return; // proposal endpoint caps at 20 screens
    commit([...plan, toPlanScreen(screen)]);
}

export function removeFromPlan(screenId: string) {
    if (!plan.some((p) => p.id === screenId)) return;
    commit(plan.filter((p) => p.id !== screenId));
}

export function togglePlan(screen: Screen) {
    if (plan.some((p) => p.id === screen.id)) removeFromPlan(screen.id);
    else addToPlan(screen);
}

export function clearPlan() {
    if (plan.length === 0) return;
    commit([]);
}

export function isInPlan(screenId: string): boolean {
    return plan.some((p) => p.id === screenId);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Reactive view of the current plan (stable reference between commits). */
export function usePlan(): PlanScreen[] {
    return useSyncExternalStore(subscribe, () => plan);
}
