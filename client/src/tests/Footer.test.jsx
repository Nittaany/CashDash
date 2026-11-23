import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Footer } from "../components/Footer.jsx";

describe("Footer", () => {
  it("renders copyright with correct year", () => {
    render(<Footer />);
    expect(screen.getByText(/© 2025/)).toBeInTheDocument();
  });

  it("renders author name with link", () => {
    render(<Footer />);
    const authorLink = screen.getByText("Satyam Chaudhary");
    expect(authorLink).toBeInTheDocument();
    expect(authorLink.closest("a")).toHaveAttribute("href", "https://github.com/Nittaany");
  });

  it("renders GitHub source link", () => {
    render(<Footer />);
    const sourceLink = screen.getByText("Source");
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink.closest("a")).toHaveAttribute("href", "https://github.com/Nittaany/CashDash");
  });

  it("renders API status link", () => {
    render(<Footer />);
    const statusLink = screen.getByText("API Status");
    expect(statusLink).toBeInTheDocument();
    expect(statusLink.closest("a")).toHaveAttribute("href", "https://cashdash-api.onrender.com/api/health");
  });

  it("external links open in new tab", () => {
    render(<Footer />);
    const links = screen.getAllByRole("link");
    links.forEach(link => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});
