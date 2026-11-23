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

  it("renders when server is waking", () => {
    render(<ServerWakeIndicator isWaking={true} />);
    expect(screen.getByText("Waking server...")).toBeInTheDocument();
  });

  it("shows elapsed time counter", () => {
    render(<ServerWakeIndicator isWaking={true} />);
    expect(screen.getByText(/0s \/ ~45s/)).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText(/5s \/ ~45s/)).toBeInTheDocument();
  });

  it("displays explanation text", () => {
    render(<ServerWakeIndicator isWaking={true} />);
    expect(screen.getByText(/Free-tier servers sleep/)).toBeInTheDocument();
  });

  it("shows ready state when wake completes", () => {
    const { rerender } = render(<ServerWakeIndicator isWaking={true} />);
    
    // Advance time while waking
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    // Server finishes waking
    rerender(<ServerWakeIndicator isWaking={false} />);
    
    expect(screen.getByText("Server ready!")).toBeInTheDocument();
  });

  it("calls onDismiss after ready state", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<ServerWakeIndicator isWaking={true} onDismiss={onDismiss} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Transition to not waking
    rerender(<ServerWakeIndicator isWaking={false} onDismiss={onDismiss} />);
    
    // Should show ready, not yet dismissed
    expect(screen.getByText("Server ready!")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    
    // After 2 second delay, should dismiss
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    
    expect(onDismiss).toHaveBeenCalled();
  });

  it("caps progress at 95%", () => {
    render(<ServerWakeIndicator isWaking={true} />);
    
    // Advance past estimated time
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    
    // Should show 60s elapsed but progress capped
    expect(screen.getByText(/60s \/ ~45s/)).toBeInTheDocument();
  });
});
