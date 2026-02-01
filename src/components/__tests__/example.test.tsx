import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Example unit test file demonstrating Vitest and Testing Library usage.
 *
 * This file serves as a template for writing component tests.
 * You can delete this file once you start writing your own tests.
 */
describe("Example Component Test", () => {
  it("should render correctly", () => {
    // Arrange
    const TestComponent = () => <div>Test Component</div>;

    // Act
    render(<TestComponent />);

    // Assert
    expect(screen.getByText("Test Component")).toBeInTheDocument();
  });

  it("should handle user interactions", async () => {
    // Arrange
    const user = userEvent.setup();
    const TestButton = () => <button onClick={() => alert("Clicked")}>Click me</button>;

    // Act
    render(<TestButton />);
    const button = screen.getByRole("button", { name: /click me/i });
    await user.click(button);

    // Assert
    expect(button).toBeInTheDocument();
  });
});
