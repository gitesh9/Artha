import { describe, expect, it, vi, afterEach } from "vitest";
import { publicSession } from "@/core/auth/public-session";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { InstallApp, type InstallPrompt } from "@/core/offline/InstallApp";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("public startup", () => {
  it("leaves public pages available during an authentication service outage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await publicSession(async () => { throw new Error("database unavailable"); })).toBeNull();
  });
  it("preserves a verified user instead of losing the dashboard redirect", async () => {
    const user = { id: "artha-owner", name: "Owner", email: "owner@example.com" };
    expect(await publicSession(async () => user)).toEqual(user);
  });
});

describe("browser installation", () => {
  it("opens the browser prompt only after a user gesture and consumes a dismissed prompt", async () => {
    render(<InstallApp />);
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt, userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    }) satisfies InstallPrompt;
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Install Artha" }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Install Artha" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Install Artha" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("removes installation controls after the browser confirms installation", () => {
    render(<InstallApp />);
    fireEvent(window, new Event("appinstalled"));
    expect(screen.queryByRole("button", { name: "Install Artha" })).not.toBeInTheDocument();
  });
});