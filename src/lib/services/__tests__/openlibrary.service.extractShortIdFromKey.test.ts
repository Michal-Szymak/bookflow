import { describe, it, expect, beforeEach } from "vitest";
import { OpenLibraryService } from "../openlibrary.service";

/**
 * Unit tests for OpenLibraryService.extractShortIdFromKey
 *
 * Tests the critical ID normalization function that converts OpenLibrary API
 * key formats (e.g., "/authors/OL23919A") to short format IDs (e.g., "OL23919A").
 *
 * This method is used throughout the service for normalizing IDs from various
 * OpenLibrary API responses, making it a critical business logic function.
 */
describe("OpenLibraryService.extractShortIdFromKey", () => {
  let service: OpenLibraryService;

  beforeEach(() => {
    service = new OpenLibraryService();
  });

  /**
   * Helper function to access private method for testing.
   * Uses TypeScript type assertion to bypass access modifiers.
   */
  const extractShortId = (key: string): string => {
    return (service as unknown as { extractShortIdFromKey: (key: string) => string }).extractShortIdFromKey(key);
  };

  describe("Known prefixes - standard OpenLibrary key formats", () => {
    it("should extract ID from /authors/ prefix", () => {
      // Arrange
      const key = "/authors/OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A");
    });

    it("should extract ID from /works/ prefix", () => {
      // Arrange
      const key = "/works/OL123W";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL123W");
    });

    it("should extract ID from /books/ prefix", () => {
      // Arrange
      const key = "/books/OL123M";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL123M");
    });

    it("should extract ID from /languages/ prefix", () => {
      // Arrange
      const key = "/languages/eng";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("eng");
    });

    it("should handle numeric IDs after /authors/ prefix", () => {
      // Arrange
      const key = "/authors/12345";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("12345");
    });

    it("should handle IDs with special characters after /works/ prefix", () => {
      // Arrange
      const key = "/works/OL123W-ABC";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL123W-ABC");
    });
  });

  describe("Already short format - no transformation needed", () => {
    it("should return short ID as-is when already in short format", () => {
      // Arrange
      const key = "OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A");
    });

    it("should return numeric ID as-is when already in short format", () => {
      // Arrange
      const key = "12345";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("12345");
    });

    it("should return language code as-is when already in short format", () => {
      // Arrange
      const key = "eng";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("eng");
    });

    it("should return ID with special characters as-is when already in short format", () => {
      // Arrange
      const key = "OL123W-ABC";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL123W-ABC");
    });
  });

  describe("Unknown prefix - fallback behavior", () => {
    it("should remove leading slash for unknown prefix starting with /", () => {
      // Arrange
      const key = "/unknown/OL123";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("unknown/OL123");
    });

    it("should handle single slash as prefix", () => {
      // Arrange
      const key = "/OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A");
    });

    it("should handle multiple slashes in unknown prefix", () => {
      // Arrange
      const key = "/some/nested/path/OL123";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("some/nested/path/OL123");
    });

    it("should handle custom prefix format", () => {
      // Arrange
      const key = "/custom_prefix/OL123";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("custom_prefix/OL123");
    });
  });

  describe("Edge cases - boundary conditions", () => {
    it("should handle empty string", () => {
      // Arrange
      const key = "";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("");
    });

    it("should handle string with only slash", () => {
      // Arrange
      const key = "/";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("");
    });

    it("should handle prefix with no ID after it", () => {
      // Arrange
      const key = "/authors/";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("");
    });

    it("should handle prefix with whitespace after it", () => {
      // Arrange
      const key = "/authors/ OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe(" OL23919A");
    });

    it("should handle ID with leading whitespace", () => {
      // Arrange
      const key = "/authors/ OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe(" OL23919A");
    });

    it("should handle ID with trailing whitespace", () => {
      // Arrange
      const key = "/authors/OL23919A ";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A ");
    });

    it("should handle very long ID", () => {
      // Arrange
      const longId = "OL" + "A".repeat(100);
      const key = `/authors/${longId}`;

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe(longId);
    });

    it("should handle ID with unicode characters", () => {
      // Arrange
      const key = "/authors/OL23919A-测试";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A-测试");
    });
  });

  describe("Case sensitivity", () => {
    it("should preserve case in ID", () => {
      // Arrange
      const key = "/authors/OL23919a";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919a");
    });

    it("should handle mixed case in ID", () => {
      // Arrange
      const key = "/authors/OL23919A-MixedCase";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A-MixedCase");
    });

    it("should handle uppercase prefix correctly", () => {
      // Arrange
      const key = "/AUTHORS/OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      // Prefix matching is case-sensitive, so this should fall back to unknown prefix behavior
      expect(result).toBe("AUTHORS/OL23919A");
    });
  });

  describe("Real-world OpenLibrary examples", () => {
    it("should handle J.K. Rowling author ID", () => {
      // Arrange
      const key = "/authors/OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL23919A");
    });

    it("should handle work ID format", () => {
      // Arrange
      const key = "/works/OL82563W";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL82563W");
    });

    it("should handle edition ID format", () => {
      // Arrange
      const key = "/books/OL82564M";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL82564M");
    });

    it("should handle language code format", () => {
      // Arrange
      const key = "/languages/eng";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("eng");
    });

    it("should handle Polish language code", () => {
      // Arrange
      const key = "/languages/pol";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("pol");
    });
  });

  describe("Multiple prefix matches - first match wins", () => {
    it("should match first prefix in order when key contains multiple prefix patterns", () => {
      // Arrange
      // This tests that the method matches the first prefix in the array
      // "/authors/" comes before "/works/" in the prefixes array
      const key = "/authors/OL123W";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL123W");
      // Note: This doesn't actually test multiple matches since the method
      // returns on first match, but documents the behavior
    });
  });

  describe("ID format variations", () => {
    it("should handle ID with underscores", () => {
      // Arrange
      const key = "/authors/OL_23919_A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL_23919_A");
    });

    it("should handle ID with dots", () => {
      // Arrange
      const key = "/authors/OL.23919.A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL.23919.A");
    });

    it("should handle ID with hyphens", () => {
      // Arrange
      const key = "/authors/OL-23919-A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("OL-23919-A");
    });

    it("should handle ID with numbers only", () => {
      // Arrange
      const key = "/authors/1234567890";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe("1234567890");
    });
  });

  describe("Business rules validation", () => {
    it("should always return short format ID (no leading slash)", () => {
      // Arrange
      const testCases = [
        "/authors/OL23919A",
        "/works/OL123W",
        "/books/OL123M",
        "/languages/eng",
        "/unknown/OL123",
        "OL23919A",
      ];

      // Act & Assert
      testCases.forEach((key) => {
        const result = extractShortId(key);
        expect(result).not.toMatch(/^\//);
      });
    });

    it("should preserve ID content exactly (no trimming or modification)", () => {
      // Arrange
      const key = "/authors/OL23919A";
      const expectedId = "OL23919A";

      // Act
      const result = extractShortId(key);

      // Assert
      expect(result).toBe(expectedId);
      expect(result.length).toBe(expectedId.length);
    });

    it("should handle all known OpenLibrary entity types", () => {
      // Arrange & Act & Assert
      // Authors
      expect(extractShortId("/authors/OL23919A")).toBe("OL23919A");
      // Works
      expect(extractShortId("/works/OL123W")).toBe("OL123W");
      // Books (Editions)
      expect(extractShortId("/books/OL123M")).toBe("OL123M");
      // Languages
      expect(extractShortId("/languages/eng")).toBe("eng");
    });
  });
});
