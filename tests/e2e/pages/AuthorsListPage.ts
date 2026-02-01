import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for Authors List Page (/app/authors)
 * Encapsulates all interactions with the authors list view
 */
export class AuthorsListPage {
  readonly page: Page;

  // Locators
  readonly addAuthorButton: Locator;
  readonly authorsTable: Locator;
  readonly authorRows: Locator;
  readonly limitIndicator: Locator;
  readonly limitCount: Locator;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.addAuthorButton = page.getByTestId("add-author-button");
    this.authorsTable = page.getByTestId("authors-table");
    this.authorRows = page.getByTestId("author-row");
    this.limitIndicator = page.getByTestId("author-limit-indicator");
    this.limitCount = page.getByTestId("author-limit-count");
    this.searchInput = page.locator('input[type="text"]').first(); // Search input in toolbar
    this.sortSelect = page.locator("select").first(); // Sort select in toolbar
  }

  /**
   * Navigate to authors list page
   */
  async goto(): Promise<void> {
    await this.page.goto("/app/authors");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Click the "Add Author" button to open the modal
   */
  async clickAddAuthorButton(): Promise<void> {
    await this.addAuthorButton.click();
  }

  /**
   * Get the current author count from limit indicator
   * @returns Object with current and max values
   */
  async getAuthorLimit(): Promise<{ current: number; max: number }> {
    const countText = await this.limitCount.textContent();
    if (!countText) {
      throw new Error("Author limit count not found");
    }

    const match = countText.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) {
      throw new Error(`Invalid limit count format: ${countText}`);
    }

    return {
      current: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
    };
  }

  /**
   * Get all author rows
   * @returns Array of author row locators
   */
  getAuthorRows(): Locator {
    return this.authorRows;
  }

  /**
   * Get author row by author ID
   * @param authorId - UUID of the author
   * @returns Locator for the specific author row
   */
  getAuthorRowById(authorId: string): Locator {
    return this.authorRows.filter({ has: this.page.locator(`[data-author-id="${authorId}"]`) });
  }

  /**
   * Get author row by author name
   * @param authorName - Name of the author
   * @returns Locator for the specific author row
   */
  getAuthorRowByName(authorName: string): Locator {
    return this.authorRows.filter({
      has: this.page.getByTestId("author-name-link").filter({ hasText: authorName }),
    });
  }

  /**
   * Click on author name link to navigate to author detail page
   * @param authorName - Name of the author
   */
  async clickAuthorName(authorName: string): Promise<void> {
    const authorLink = this.page.getByTestId("author-name-link").filter({ hasText: authorName });
    await authorLink.click();

    // Wait for navigation to author detail page
    await this.page.waitForURL(/\/app\/authors\/[^/]+$/, { timeout: 10000 });

    // Wait for the author works view to be visible (more reliable than networkidle)
    const authorWorksView = this.page.getByTestId("author-works-view");
    await authorWorksView.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Get count of authors displayed in the table
   * @returns Number of author rows
   */
  async getAuthorCount(): Promise<number> {
    return await this.authorRows.count();
  }

  /**
   * Verify that authors table is visible
   */
  async verifyAuthorsTableVisible(): Promise<void> {
    await this.authorsTable.waitFor({ state: "visible" });
  }

  /**
   * Verify that author exists in the list
   * @param authorName - Name of the author to verify
   */
  async verifyAuthorExists(authorName: string): Promise<void> {
    const authorRow = this.getAuthorRowByName(authorName);
    await authorRow.waitFor({ state: "visible" });
  }

  /**
   * Search for authors using the search input
   * @param query - Search query
   */
  async searchAuthors(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // Wait for debounce
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get the text content of author limit indicator
   * @returns Text content of limit indicator
   */
  async getLimitIndicatorText(): Promise<string | null> {
    return await this.limitIndicator.textContent();
  }

  /**
   * Wait for author to be added and list to refresh
   * Uses UI-based waiting instead of request-based to avoid race conditions.
   * Waits for:
   * 1. Author count to increase (if expectedNewCount provided)
   * 2. Network to be idle
   * 3. Author to appear in the list (if authorName provided)
   * @param expectedNewCount - Expected new author count (optional, for verification)
   * @param timeout - Maximum time to wait in milliseconds (default: 15000)
   */
  async waitForAuthorAdded(expectedNewCount?: number, timeout = 15000): Promise<void> {
    // If expected count is provided, wait for it - this is the most reliable indicator
    if (expectedNewCount !== undefined) {
      await this.waitForAuthorCount(expectedNewCount, timeout);
    }

    // Wait for network to be idle to ensure all requests completed
    await this.page.waitForLoadState("networkidle");

    // Additional wait to ensure UI is fully updated
    await this.page.waitForTimeout(200);
  }

  /**
   * Setup response listeners BEFORE an action that triggers requests
   * Returns promises that can be awaited after the action
   * @returns Object with promises for POST and GET requests
   */
  setupAuthorAddedListeners() {
    // Set up listeners BEFORE the action
    const addResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/user/authors") &&
        response.request().method() === "POST" &&
        response.status() === 200,
      { timeout: 15000 }
    );

    const refreshResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/user/authors") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 15000 }
    );

    return {
      addResponse: addResponsePromise,
      refreshResponse: refreshResponsePromise,
    };
  }

  /**
   * Wait for author count to reach specific value
   * @param expectedCount - Expected author count
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   */
  async waitForAuthorCount(expectedCount: number, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      (expected) => {
        const countElement = document.querySelector('[data-testid="author-limit-count"]');
        if (!countElement) return false;
        const text = countElement.textContent || "";
        const match = text.match(/(\d+)\s*\/\s*\d+/);
        if (!match) return false;
        const current = parseInt(match[1], 10);
        return current === expected;
      },
      expectedCount,
      { timeout }
    );
  }
}
