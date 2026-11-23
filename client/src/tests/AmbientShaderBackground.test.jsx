import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmbientShaderBackground } from "../components/AmbientShaderBackground.jsx";

describe("AmbientShaderBackground", () => {
  it("renders the CSS mesh fallback in test mode without WebGL", () => {
    const { container } = render(<AmbientShaderBackground />);

    expect(screen.getByTestId("ambient-fallback")).toBeInTheDocument();
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("z-0");
    expect(container.firstChild).not.toHaveClass("-z-10");
  });
});
