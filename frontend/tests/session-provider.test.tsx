import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { SessionProvider, useSession } from "../app/auth/session-provider";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), onChange: vi.fn(), unsubscribe: vi.fn(),
  profile: vi.fn(), replace: vi.fn(), pathname: "/generate",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }), usePathname: () => mocks.pathname,
}));
vi.mock("../app/lib/supabase", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onChange },
  }),
}));
vi.mock("../app/lib/basic-profile-client", () => ({ getBasicProfile: mocks.profile, saveBasicProfile: vi.fn() }));

let notify: (event: AuthChangeEvent, session: Session | null) => void;

function session(provider: string): Session {
  return {
    access_token: "test-access-token", refresh_token: "test-refresh-token",
    expires_in: 3600, token_type: "bearer",
    user: {
      id: `user-${provider}`, aud: "authenticated", created_at: "2026-10-14T00:00:00Z",
      app_metadata: { provider }, user_metadata: {}, email: `${provider}@example.com`,
    },
  };
}

function Probe() {
  const value = useSession();
  return <div data-testid="session-state">{value.isLoading ? "loading" : value.session?.user.id ?? "signed-out"}:{value.profileStatus}</div>;
}

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.pathname = "/generate";
  mocks.profile.mockResolvedValue(null);
  mocks.onChange.mockImplementation((listener) => {
    notify = listener;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
});

describe("Sesiones de proveedores externos", () => {
  it.each(["google"])("restaura %s y conserva onboarding al recargar", async (provider) => {
    mocks.getSession.mockResolvedValue({ data: { session: session(provider) } });
    const first = render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe(`user-${provider}:missing`));
    expect(mocks.replace).not.toHaveBeenCalled();
    first.unmount();
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe(`user-${provider}:missing`));
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(["google"])("limpia la sesión %s al salir y bloquea el flujo privado", async (provider) => {
    mocks.getSession.mockResolvedValue({ data: { session: session(provider) } });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe(`user-${provider}:missing`));
    act(() => notify("SIGNED_OUT", null));
    await waitFor(() => expect(screen.getByTestId("session-state").textContent).toBe("signed-out:idle"));
    expect(mocks.replace).toHaveBeenCalledWith("/auth?reason=session-expired");
  });

  it("sin sesión nunca habilita acceso al generador", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/auth?reason=session-expired"));
  });
});
