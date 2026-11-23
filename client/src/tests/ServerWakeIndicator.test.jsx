import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServerWakeIndicator } from "../components/ServerWakeIndicator.jsx";

describe("ServerWakeIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render when not waking", () => {
    const { container } = render(<ServerWakeIndicator isWaking={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render immediately when waking starts (waits 1.5s)", () => {
    const { container } = render(<ServerWakeIndicator isWaking={true} />);
    // Before the 1.5s delay, nothing should be visible
    expect(container.querySelector('[class*="fixed"]')).toBeNull();
  });

  it("renders when server is waking after delay", () => {
    render(<ServerWakeIndicator isWaking={true} />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it("renders nothing if server responds before delay", () => {
    const { container, rerender } = render(<ServerWakeIndicator isWaking={true} />);

    // Server responds in 500ms (before the 1.5s threshold)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    rerender(<ServerWakeIndicator isWaking={false} />);

    // Should remain idle — never showed anything
    expect(container.firstChild).toBeNull();
  });

  it("shows elapsed time counter", () => {
    render(<ServerWakeIndicator isWaking={true} />);

    // Wait for delay to show the banner
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/0s \/ ~45s/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/5s \/ ~45s/)).toBeInTheDocument();
  });

  it("displays explanation text", () => {
    render(<ServerWakeIndicator isWaking={true} />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Free-tier servers sleep/i)).toBeInTheDocument();
  });

  it("shows ready state when wake completes after banner was shown", () => {
    const { rerender } = render(<ServerWakeIndicator isWaking={true} />);

    // Let the banner appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    rerender(<ServerWakeIndicator isWaking={false} />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it("calls onDismiss after ready state", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<ServerWakeIndicator isWaking={true} onDismiss={onDismiss} />);

    // Let the banner appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    rerender(<ServerWakeIndicator isWaking={false} onDismiss={onDismiss} />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onDismiss).toHaveBeenCalled();
  });

  it("caps progress at 95%", () => {
    render(<ServerWakeIndicator isWaking={true} />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByText(/60s \/ ~45s/)).toBeInTheDocument();
  });
});
