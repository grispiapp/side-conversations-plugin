import { GrispiEnvironment } from "@/grispi/client/environment";
import { resolveGrispiEnvironment } from "@/lib/grispi-environment";
import { GrispiBundle, Settings } from "@/types/grispi.type";

/**
 * Pure, injectable plugin-mode bootstrap wiring (CORE-03 gap closure,
 * 01-VERIFICATION.md CR-01).
 *
 * This function is BOTH of the two fixes for the production (Grispi
 * iframe) bootstrap path:
 *
 * 1. It is the missing `.catch` on `plugin._init()` — an SDK handshake
 *    rejection now clears `loading` instead of hanging the rocket
 *    `LoadingScreen` forever, and never produces an unhandled promise
 *    rejection (the returned promise always resolves).
 * 2. On success it routes the initial ticket through `switchTicket` — the
 *    SAME resilient path standalone mode and the SDK's `currentTicketUpdated`
 *    event already use. `switchTicket` sets a provisional `{ key }` ticket
 *    synchronously, which makes the list screen's `ticket?.key` effect fire
 *    `store.load()` regardless of hydration outcome. Any subsequent
 *    advanced-search/getTicket failure then surfaces through the store's own
 *    `status="error"` + `ErrorCard` + "Yeniden dene" — instead of leaving
 *    `ticket` at `null` forever (the old bug: three skeleton rows, no error,
 *    no retry).
 *
 * Deliberately does NOT call `getTicket` itself — `switchTicket` owns ticket
 * hydration (including its own Network/Http/unexpected error branching for
 * the detail fetch).
 */
export interface BootstrapPluginInitDeps {
  plugin: { _init(): Promise<GrispiBundle> };
  authentication: {
    setTenantId(tenantId: string): void;
    setToken(token: string): void;
  };
  setSettings(settings: Settings): void;
  setLoading(loading: boolean): void;
  /**
   * agentEmail source (D-13, RESEARCH.md Pitfall #3) — `createTicket`'s
   * `creator` field cannot resolve without it.
   */
  setAgentEmail(email: string | null): void;
  /** React Query's explicit cache-isolation tenant source. */
  setTenantId(tenantId: string | null): void;
  /**
   * CORE-04 — MUST be called before `switchTicket` (the first real fetch).
   * Required (not optional): an omitted call site would silently leave the
   * plugin talking to the class-default host instead of the resolved one.
   */
  setEnvironment(environment: GrispiEnvironment): void;
  /**
   * WR-01 (04.1-REVIEW.md) / CORE-04 — opens the SDK ticket-update gate in
   * `GrispiProvider`'s `currentTicketUpdated` handler. Called immediately
   * after `setEnvironment`, in the same uninterrupted synchronous block as
   * the auth-header writes below, so it becomes true only once every
   * request the plugin can issue is bound to the resolved host AND the
   * resolved tenant credentials. Deliberately NOT called on the reject
   * path (see the `catch` block) — a failed handshake has no resolved
   * environment, which is exactly why a caller-side `.finally()` flip
   * would reopen the same race on the failure path. Required (not
   * optional): an omitted call site would silently leave the gate shut
   * forever, dropping every ticket switch.
   */
  onEnvironmentReady(): void;
  switchTicket(ticketKey: string): void;
}

export async function bootstrapPluginInit(
  deps: BootstrapPluginInitDeps
): Promise<void> {
  try {
    const bundle = await deps.plugin._init();

    // CORE-04: resolve and apply the base URL FIRST, in the same synchronous
    // block as _init()'s resolution — no `await` between here and
    // `switchTicket` may be introduced, or the first fetch could race ahead
    // of the environment switch.
    deps.setEnvironment(
      resolveGrispiEnvironment(bundle.settings, bundle.context.token)
    );
    deps.onEnvironmentReady();

    deps.authentication.setTenantId(bundle.context.tenantId);
    deps.authentication.setToken(bundle.context.token);
    deps.setTenantId(bundle.context.tenantId);
    deps.setSettings(bundle.settings);
    deps.setAgentEmail(bundle.context.agent?.email ?? null);
    deps.setLoading(false);
    deps.switchTicket(bundle.context.ticketKey);
  } catch (err) {
    console.error("grispi-context", "_init failed", err);
    deps.setTenantId(null);
    deps.setLoading(false);
  }
}
