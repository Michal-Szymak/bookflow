import { describe, it, expect, vi } from "vitest";

/**
 * Example unit test file for utility functions and services.
 *
 * This file demonstrates:
 * - Testing pure functions
 * - Using vi.fn() for mocks
 * - Using vi.spyOn() for spying on existing functions
 *
 * You can delete this file once you start writing your own tests.
 */
describe("Example Utility Test", () => {
  it("should test a pure function", () => {
    // Arrange
    const add = (a: number, b: number) => a + b;

    // Act
    const result = add(2, 3);

    // Assert
    expect(result).toBe(5);
  });

  it("should use mocks", () => {
    // Arrange
    const mockFn = vi.fn();
    mockFn.mockReturnValue(42);

    // Act
    const result = mockFn();

    // Assert
    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe(42);
  });

  it("should use spies", () => {
    // Arrange
    const obj = {
      method: () => "original",
    };
    const spy = vi.spyOn(obj, "method");

    // Act
    const result = obj.method();

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    expect(result).toBe("original");
  });
});
