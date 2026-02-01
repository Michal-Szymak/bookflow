import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "@/test/msw/server";
import { http, HttpResponse } from "msw";

/**
 * Example test demonstrating MSW (Mock Service Worker) usage.
 *
 * This shows how to mock HTTP requests in your tests.
 * You can delete this file once you start writing your own tests.
 */
describe("Example Test with MSW", () => {
  beforeAll(() => {
    // Start MSW server
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    // Reset handlers after each test
    server.resetHandlers();
  });

  afterAll(() => {
    // Clean up
    server.close();
  });

  it("should mock API requests", async () => {
    // Arrange - Set up a mock handler for this test
    server.use(
      http.get("/api/books", () => {
        return HttpResponse.json([
          { id: 1, title: "Mocked Book 1" },
          { id: 2, title: "Mocked Book 2" },
        ]);
      })
    );

    // Act - Make a request (this will be intercepted by MSW)
    const response = await fetch("/api/books");
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe("Mocked Book 1");
  });

  it("should handle error responses", async () => {
    // Arrange - Mock an error response
    server.use(
      http.get("/api/books", () => {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      })
    );

    // Act
    const response = await fetch("/api/books");

    // Assert
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Not found");
  });
});
