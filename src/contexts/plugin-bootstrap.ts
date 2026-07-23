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
  switchTicket(ticketKey: string): void;
}

export async function bootstrapPluginInit(
  deps: BootstrapPluginInitDeps
): Promise<void> {
  try {
    const bundle = await deps.plugin._init();

    deps.authentication.setTenantId(bundle.context.tenantId);
    deps.authentication.setToken(bundle.context.token);
    deps.setSettings(bundle.settings);
    deps.setLoading(false);
    deps.switchTicket(bundle.context.ticketKey);
  } catch (err) {
    console.error("grispi-context", "_init failed", err);
    deps.setLoading(false);
  }
}
