import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

const updateServiceWorker = vi.fn(async () => {});
let initialNeedRefresh = true;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: useState(initialNeedRefresh),
    offlineReady: useState(false),
    updateServiceWorker,
  }),
}));

const { UpdateBanner } = await import("../src/components/UpdateBanner.tsx");

describe("UpdateBanner", () => {
  afterEach(cleanup);

  it("stays hidden while no update is waiting", () => {
    initialNeedRefresh = false;
    render(<UpdateBanner />);
    expect(screen.queryByTestId("update-banner")).toBeNull();
    initialNeedRefresh = true;
  });

  it("reloads into the new version only when the brewer asks", () => {
    render(<UpdateBanner />);
    expect(screen.getByText("A new version of Werb is ready.")).toBeTruthy();
    expect(updateServiceWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("Later hides the banner without updating", () => {
    updateServiceWorker.mockClear();
    render(<UpdateBanner />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Later" }));
    });
    expect(screen.queryByTestId("update-banner")).toBeNull();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("is not rendered inside the Tauri app", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    try {
      render(<UpdateBanner />);
      expect(screen.queryByTestId("update-banner")).toBeNull();
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });
});
