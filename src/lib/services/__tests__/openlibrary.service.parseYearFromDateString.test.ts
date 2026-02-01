import { describe, it, expect, beforeEach } from "vitest";
import { OpenLibraryService } from "../openlibrary.service";

/**
 * Unit tests for OpenLibraryService.parseYearFromDateString
 *
 * Tests the year extraction function that parses year values from various
 * date string formats returned by OpenLibrary API.
 *
 * Business Rules:
 * - Extracts years in range 1000-2099
 * - Returns null for invalid input or no match
 * - Uses word boundaries to match complete years
 * - Returns first matching year if multiple years present
 */
describe("OpenLibraryService.parseYearFromDateString", () => {
  let service: OpenLibraryService;

  beforeEach(() => {
    service = new OpenLibraryService();
  });

  /**
   * Helper function to access private method for testing.
   * Uses TypeScript type assertion to bypass access modifiers.
   */
  const parseYear = (value: string | null): number | null => {
    return (
      service as unknown as { parseYearFromDateString: (value: string | null) => number | null }
    ).parseYearFromDateString(value);
  };

  describe("Null and empty input - edge cases", () => {
    it("should return null for null input", () => {
      // Arrange
      const value = null;

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      // Arrange
      const value = "";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      // Arrange
      const value = "   ";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("Valid year formats - simple year strings", () => {
    it("should extract year from simple 4-digit year string", () => {
      // Arrange
      const value = "2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
      expect(typeof result).toBe("number");
    });

    it("should extract year from year with leading whitespace", () => {
      // Arrange
      const value = " 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from year with trailing whitespace", () => {
      // Arrange
      const value = "2023 ";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from year with surrounding whitespace", () => {
      // Arrange
      const value = "  2023  ";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Valid year formats - dates with years", () => {
    it("should extract year from ISO date format (YYYY-MM-DD)", () => {
      // Arrange
      const value = "2023-01-15";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from date format with time (YYYY-MM-DD HH:MM:SS)", () => {
      // Arrange
      const value = "2023-01-15 12:30:45";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from US date format (MM/DD/YYYY)", () => {
      // Arrange
      const value = "01/15/2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from European date format (DD.MM.YYYY)", () => {
      // Arrange
      const value = "15.01.2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from written date format (Month DD, YYYY)", () => {
      // Arrange
      const value = "January 15, 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from abbreviated date format (Mon DD, YYYY)", () => {
      // Arrange
      const value = "Jan 15, 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from date with day name (Day, Month DD, YYYY)", () => {
      // Arrange
      const value = "Sunday, January 15, 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Valid year formats - text with years", () => {
    it("should extract year from text containing year at start", () => {
      // Arrange
      const value = "2023 was a great year";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from text containing year in middle", () => {
      // Arrange
      const value = "Published in 2023 by publisher";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from text containing year at end", () => {
      // Arrange
      const value = "This book was published in 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from text with parentheses", () => {
      // Arrange
      const value = "First published (2023)";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from text with brackets", () => {
      // Arrange
      const value = "Published [2023]";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from text with multiple words", () => {
      // Arrange
      const value = "The book was first published in the year 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Year range boundaries - valid range (1000-2099)", () => {
    it("should extract minimum valid year (1000)", () => {
      // Arrange
      const value = "1000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(1000);
    });

    it("should extract year just above minimum (1001)", () => {
      // Arrange
      const value = "1001";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(1001);
    });

    it("should extract maximum valid year (2099)", () => {
      // Arrange
      const value = "2099";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2099);
    });

    it("should extract year just below maximum (2098)", () => {
      // Arrange
      const value = "2098";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2098);
    });

    it("should extract year in middle of range (1500)", () => {
      // Arrange
      const value = "1500";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(1500);
    });

    it("should extract year in middle of range (2000)", () => {
      // Arrange
      const value = "2000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2000);
    });
  });

  describe("Year range boundaries - invalid range (outside 1000-2099)", () => {
    it("should return null for year below minimum (999)", () => {
      // Arrange
      const value = "999";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for year just below minimum (0999)", () => {
      // Arrange
      const value = "0999";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for year above maximum (2100)", () => {
      // Arrange
      const value = "2100";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for year just above maximum (2101)", () => {
      // Arrange
      const value = "2101";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for very large year (3000)", () => {
      // Arrange
      const value = "3000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for year 0000", () => {
      // Arrange
      const value = "0000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("Multiple years in string - first match behavior", () => {
    it("should return first year when multiple years present", () => {
      // Arrange
      const value = "First published in 2020, reprinted in 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2020);
    });

    it("should return first year when years are in different formats", () => {
      // Arrange
      const value = "2020-01-01 to 2023-12-31";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2020);
    });

    it("should return first valid year when invalid year precedes valid", () => {
      // Arrange
      const value = "999 and 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should return first valid year when invalid year follows valid", () => {
      // Arrange
      const value = "2023 and 3000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Invalid input - no year match", () => {
    it("should return null for text without any year", () => {
      // Arrange
      const value = "no year here";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for text with only letters", () => {
      // Arrange
      const value = "abcdefgh";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for text with only numbers but no valid year", () => {
      // Arrange
      const value = "12345";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for partial year digits", () => {
      // Arrange
      const value = "23";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for 3-digit number", () => {
      // Arrange
      const value = "999";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null for 5-digit number", () => {
      // Arrange
      const value = "21000";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("Word boundary behavior - regex edge cases", () => {
    it("should match year at word boundary with period", () => {
      // Arrange
      const value = "Published 2023.";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should match year at word boundary with comma", () => {
      // Arrange
      const value = "Published 2023, by publisher";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should match year at word boundary with exclamation", () => {
      // Arrange
      const value = "Published 2023!";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should match year at word boundary with question mark", () => {
      // Arrange
      const value = "Published 2023?";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should not match year embedded in longer number", () => {
      // Arrange
      const value = "1234567890";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
    });

    it("should not match year as part of ISBN", () => {
      // Arrange
      const value = "ISBN9782023123456";

      // Act
      const result = parseYear(value);

      // Assert
      // Should match 2023 if it's a word boundary, but in this case it might
      // Actually, let's check: "ISBN9782023123456" - 2023 is embedded, so word boundary should work
      // But regex uses \b which should match at boundary between word and non-word
      // 978 is digits, 2023 is digits, so there's no word boundary between them
      expect(result).toBeNull();
    });

    it("should match year separated by non-word characters", () => {
      // Arrange
      const value = "ISBN-978-2023-123456";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Real-world OpenLibrary date examples", () => {
    it("should extract year from OpenLibrary first_publish_date format", () => {
      // Arrange
      const value = "1997-06-26";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(1997);
    });

    it("should extract year from OpenLibrary publish_date with year only", () => {
      // Arrange
      const value = "2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from OpenLibrary publish_date with full date", () => {
      // Arrange
      const value = "2023-01-15";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from OpenLibrary publish_date with month and year", () => {
      // Arrange
      const value = "January 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from OpenLibrary publish_date with approximate date", () => {
      // Arrange
      const value = "circa 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });

  describe("Type safety and return value validation", () => {
    it("should return number type for valid year", () => {
      // Arrange
      const value = "2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(typeof result).toBe("number");
      expect(Number.isInteger(result)).toBe(true);
    });

    it("should return null type for invalid input", () => {
      // Arrange
      const value = "invalid";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
      expect(result).toBe(null);
    });

    it("should return number that can be used in arithmetic operations", () => {
      // Arrange
      const value = "2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
      expect((result as number) + 1).toBe(2024);
      expect((result as number) - 1).toBe(2022);
    });
  });

  describe("Business rules validation", () => {
    it("should only accept years in range 1000-2099", () => {
      // Arrange
      const validYears = ["1000", "1500", "2000", "2099"];
      const invalidYears = ["999", "2100", "0000", "3000"];

      // Act & Assert - Valid years
      validYears.forEach((year) => {
        const result = parseYear(year);
        expect(result).not.toBeNull();
        expect(typeof result).toBe("number");
      });

      // Act & Assert - Invalid years
      invalidYears.forEach((year) => {
        const result = parseYear(year);
        expect(result).toBeNull();
      });
    });

    it("should handle null input gracefully", () => {
      // Arrange
      const value = null;

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBeNull();
      // Should not throw error
    });

    it("should return first matching year when multiple years present", () => {
      // Arrange
      const value = "2020-2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2020);
    });

    it("should use word boundaries to match complete years only", () => {
      // Arrange
      const value = "ISBN9782023123456";

      // Act
      const result = parseYear(value);

      // Assert
      // 2023 is embedded in longer number, word boundary should prevent match
      expect(result).toBeNull();
    });
  });

  describe("Edge cases with special characters", () => {
    it("should extract year from string with newlines", () => {
      // Arrange
      const value = "Published\n2023\nEdition";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from string with tabs", () => {
      // Arrange
      const value = "Published\t2023\tEdition";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from string with unicode characters", () => {
      // Arrange
      const value = "Wydane w 2023 roku";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });

    it("should extract year from string with emoji", () => {
      // Arrange
      const value = "Published 📚 2023";

      // Act
      const result = parseYear(value);

      // Assert
      expect(result).toBe(2023);
    });
  });
});
