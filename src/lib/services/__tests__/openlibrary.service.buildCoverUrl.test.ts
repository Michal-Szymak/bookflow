import { describe, it, expect, beforeEach } from "vitest";
import { OpenLibraryService } from "../openlibrary.service";

/**
 * Unit tests for OpenLibraryService.buildCoverUrl
 *
 * Tests the cover URL building function that constructs OpenLibrary cover image URLs
 * from numeric cover IDs.
 *
 * Business Rules:
 * - Constructs URL in format: https://covers.openlibrary.org/b/id/{coverId}-M.jpg
 * - Accepts numeric cover IDs (number type)
 * - Always returns a valid URL string
 * - Uses medium size image format (-M.jpg suffix)
 * - Base URL is https://covers.openlibrary.org
 */
describe("OpenLibraryService.buildCoverUrl", () => {
  let service: OpenLibraryService;

  beforeEach(() => {
    service = new OpenLibraryService();
  });

  /**
   * Helper function to access private method for testing.
   * Uses TypeScript type assertion to bypass access modifiers.
   */
  const buildCoverUrl = (coverId: number): string => {
    return (service as unknown as { buildCoverUrl: (coverId: number) => string }).buildCoverUrl(coverId);
  };

  describe("Standard cover IDs - typical use cases", () => {
    it("should build correct cover URL for positive integer", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/123456-M.jpg");
    });

    it("should build correct cover URL for single digit ID", () => {
      // Arrange
      const coverId = 1;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/1-M.jpg");
    });

    it("should build correct cover URL for two digit ID", () => {
      // Arrange
      const coverId = 42;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/42-M.jpg");
    });

    it("should build correct cover URL for three digit ID", () => {
      // Arrange
      const coverId = 999;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/999-M.jpg");
    });

    it("should build correct cover URL for large ID", () => {
      // Arrange
      const coverId = 1234567890;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/1234567890-M.jpg");
    });

    it("should build correct cover URL for very large ID", () => {
      // Arrange
      const coverId = Number.MAX_SAFE_INTEGER;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe(`https://covers.openlibrary.org/b/id/${Number.MAX_SAFE_INTEGER}-M.jpg`);
    });
  });

  describe("Zero and negative numbers - edge cases", () => {
    it("should build correct cover URL for zero", () => {
      // Arrange
      const coverId = 0;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/0-M.jpg");
    });

    it("should build cover URL for negative number", () => {
      // Arrange
      const coverId = -123;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // Note: OpenLibrary API may not accept negative IDs, but the function
      // should still construct a valid URL format
      expect(result).toBe("https://covers.openlibrary.org/b/id/-123-M.jpg");
    });

    it("should build cover URL for large negative number", () => {
      // Arrange
      const coverId = -123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/-123456-M.jpg");
    });
  });

  describe("URL format validation - business rules", () => {
    it("should always use correct base URL", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\//);
    });

    it("should always use medium size format (-M.jpg)", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toMatch(/-M\.jpg$/);
    });

    it("should have correct URL structure", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      const urlPattern = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/;
      expect(result).toMatch(urlPattern);
    });

    it("should return valid URL format for any numeric input", () => {
      // Arrange
      const testCases = [0, 1, 42, 999, 123456, 1234567890, Number.MAX_SAFE_INTEGER];

      // Act & Assert
      testCases.forEach((coverId) => {
        const result = buildCoverUrl(coverId);
        expect(result).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\/.+-M\.jpg$/);
      });
    });
  });

  describe("Real-world OpenLibrary cover ID examples", () => {
    it("should build URL for typical cover ID from OpenLibrary", () => {
      // Arrange
      // Example cover ID from a real OpenLibrary edition
      const coverId = 8739161;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/8739161-M.jpg");
    });

    it("should build URL for another typical cover ID", () => {
      // Arrange
      const coverId = 1234567;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/1234567-M.jpg");
    });

    it("should build URL for small cover ID", () => {
      // Arrange
      const coverId = 5;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe("https://covers.openlibrary.org/b/id/5-M.jpg");
    });
  });

  describe("Type safety and consistency", () => {
    it("should always return a string", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(typeof result).toBe("string");
    });

    it("should return consistent format for same input", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result1 = buildCoverUrl(coverId);
      const result2 = buildCoverUrl(coverId);

      // Assert
      expect(result1).toBe(result2);
      expect(result1).toBe("https://covers.openlibrary.org/b/id/123456-M.jpg");
    });

    it("should return different URLs for different IDs", () => {
      // Arrange
      const coverId1 = 123456;
      const coverId2 = 789012;

      // Act
      const result1 = buildCoverUrl(coverId1);
      const result2 = buildCoverUrl(coverId2);

      // Assert
      expect(result1).not.toBe(result2);
      expect(result1).toBe("https://covers.openlibrary.org/b/id/123456-M.jpg");
      expect(result2).toBe("https://covers.openlibrary.org/b/id/789012-M.jpg");
    });
  });

  describe("Boundary conditions - number limits", () => {
    it("should handle Number.MAX_SAFE_INTEGER", () => {
      // Arrange
      const coverId = Number.MAX_SAFE_INTEGER;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe(`https://covers.openlibrary.org/b/id/${Number.MAX_SAFE_INTEGER}-M.jpg`);
    });

    it("should handle Number.MIN_SAFE_INTEGER", () => {
      // Arrange
      const coverId = Number.MIN_SAFE_INTEGER;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      expect(result).toBe(`https://covers.openlibrary.org/b/id/${Number.MIN_SAFE_INTEGER}-M.jpg`);
    });

    it("should handle Number.MAX_VALUE", () => {
      // Arrange
      const coverId = Number.MAX_VALUE;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // Note: This is a very large number, but the function should still construct a URL
      expect(result).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\/.+e\+\d+-M\.jpg$/);
    });

    it("should handle Number.MIN_VALUE", () => {
      // Arrange
      const coverId = Number.MIN_VALUE;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // Note: MIN_VALUE is the smallest positive number, not negative
      expect(result).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\/.+e-\d+-M\.jpg$/);
    });
  });

  describe("Integration with OpenLibrary API format", () => {
    it("should produce URL compatible with OpenLibrary covers API", () => {
      // Arrange
      // OpenLibrary covers API format: https://covers.openlibrary.org/b/id/{coverId}-M.jpg
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // Verify the URL matches OpenLibrary's expected format
      expect(result).toBe("https://covers.openlibrary.org/b/id/123456-M.jpg");
    });

    it("should use medium size format as expected by OpenLibrary", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // OpenLibrary uses size suffixes: -S (small), -M (medium), -L (large)
      // This function should use -M (medium) as per business requirement
      expect(result).toContain("-M.jpg");
      expect(result).not.toContain("-S.jpg");
      expect(result).not.toContain("-L.jpg");
    });
  });

  describe("Business rules validation", () => {
    it("should always return a valid URL format", () => {
      // Arrange
      const testCases = [0, 1, 42, 999, 123456, 1234567890];

      // Act & Assert
      testCases.forEach((coverId) => {
        const result = buildCoverUrl(coverId);
        // Valid URL should start with https://
        expect(result).toMatch(/^https:\/\//);
        // Should contain the cover ID
        expect(result).toContain(coverId.toString());
        // Should end with -M.jpg
        expect(result).toMatch(/-M\.jpg$/);
      });
    });

    it("should not modify the cover ID in the URL", () => {
      // Arrange
      const coverId = 123456;

      // Act
      const result = buildCoverUrl(coverId);

      // Assert
      // The cover ID should appear exactly as provided in the URL
      expect(result).toContain("123456");
      expect(result).not.toContain("123457");
      expect(result).not.toContain("123455");
    });

    it("should use consistent base URL across all calls", () => {
      // Arrange
      const coverIds = [1, 42, 999, 123456];

      // Act
      const results = coverIds.map((id) => buildCoverUrl(id));

      // Assert
      results.forEach((result) => {
        expect(result).toMatch(/^https:\/\/covers\.openlibrary\.org\/b\/id\//);
      });
    });
  });
});
