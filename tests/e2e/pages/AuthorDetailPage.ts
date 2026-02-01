import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for Author Detail Page (/app/authors/:authorId)
 * Encapsulates all interactions with the author detail view and works list
 */
export class AuthorDetailPage {
  readonly page: Page;

  // Locators
  readonly authorWorksView: Locator;
  readonly authorWorksTable: Locator;
  readonly workRows: Locator;
  readonly selectAllCheckbox: Locator;
  readonly authorName: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.authorWorksView = page.getByTestId("author-works-view");
    this.authorWorksTable = page.getByTestId("author-works-table");
    this.workRows = page.getByTestId("author-work-row");
    this.selectAllCheckbox = page.getByTestId("author-works-select-all");
    this.authorName = page.locator("h1, h2").first(); // Author name in header
  }

  /**
   * Navigate to author detail page
   * @param authorId - UUID of the author
   */
  async goto(authorId: string): Promise<void> {
    await this.page.goto(`/app/authors/${authorId}`);
    await this.page.waitForLoadState("networkidle");
    await this.authorWorksView.waitFor({ state: "visible" });
  }

  /**
   * Wait for author works view to be visible
   */
  async waitForWorksView(): Promise<void> {
    await this.authorWorksView.waitFor({ state: "visible" });
  }

  /**
   * Verify that author works view is visible
   */
  async verifyWorksViewVisible(): Promise<void> {
    await this.authorWorksView.waitFor({ state: "visible" });
  }

  /**
   * Verify that author works table is visible
   * Waits for work rows to appear, which is more reliable than waiting for the table container
   */
  async verifyWorksTableVisible(): Promise<void> {
    // Wait for at least one work row to be visible (more reliable indicator)
    await this.workRows.first().waitFor({ state: "visible", timeout: 45000 });
  }

  /**
   * Get all work rows
   * @returns Locator for all work rows
   */
  getWorkRows(): Locator {
    return this.workRows;
  }

  /**
   * Get work row by work ID
   * @param workId - UUID of the work
   * @returns Locator for the specific work row
   */
  getWorkRowById(workId: string): Locator {
    return this.workRows.filter({ has: this.page.locator(`[data-work-id="${workId}"]`) });
  }

  /**
   * Get work row by title
   * @param title - Title of the work
   * @returns Locator for the specific work row
   */
  getWorkRowByTitle(title: string): Locator {
    return this.workRows.filter({
      has: this.page.getByTestId("author-work-title").filter({ hasText: title }),
    });
  }

  /**
   * Get work title from a work row
   * @param index - Zero-based index of the work row
   * @returns Work title text
   */
  async getWorkTitle(index: number): Promise<string | null> {
    const workRow = this.workRows.nth(index);
    const titleElement = workRow.getByTestId("author-work-title");
    return await titleElement.textContent();
  }

  /**
   * Toggle checkbox for a specific work
   * @param index - Zero-based index of the work row
   */
  async toggleWorkCheckbox(index: number): Promise<void> {
    const workRow = this.workRows.nth(index);
    const checkbox = workRow.getByTestId("author-work-checkbox");
    await checkbox.click();
  }

  /**
   * Toggle checkbox for a specific work by title
   * @param title - Title of the work
   */
  async toggleWorkCheckboxByTitle(title: string): Promise<void> {
    const workRow = this.getWorkRowByTitle(title);
    const checkbox = workRow.getByTestId("author-work-checkbox");
    await checkbox.click();
  }

  /**
   * Toggle "Select All" checkbox
   */
  async toggleSelectAll(): Promise<void> {
    await this.selectAllCheckbox.click();
  }

  /**
   * Get count of work rows
   * @returns Number of work rows
   */
  async getWorkCount(): Promise<number> {
    return await this.workRows.count();
  }

  /**
   * Verify that work exists in the list
   * @param title - Title of the work to verify
   */
  async verifyWorkExists(title: string): Promise<void> {
    const workRow = this.getWorkRowByTitle(title);
    await workRow.waitFor({ state: "visible" });
  }

  /**
   * Check if work is already in user's profile
   * @param index - Zero-based index of the work row
   * @returns True if work has "Dodane" badge
   */
  async isWorkInProfile(index: number): Promise<boolean> {
    const workRow = this.workRows.nth(index);
    const badge = workRow.locator('text="Dodane"');
    return await badge.isVisible();
  }

  /**
   * Get author name from the page header
   * @returns Author name text
   */
  async getAuthorName(): Promise<string | null> {
    return await this.authorName.textContent();
  }

  /**
   * Verify that works list is not empty
   */
  async verifyWorksListNotEmpty(): Promise<void> {
    const count = await this.getWorkCount();
    if (count === 0) {
      throw new Error("Works list is empty");
    }
  }

  /**
   * Wait for works to load
   * Waits for work rows to appear, which is more reliable than waiting for the table container
   * @param timeout - Maximum time to wait in milliseconds (default: 15000)
   */
  async waitForWorksLoad(timeout = 15000): Promise<void> {
    // Wait for at least one work row to be visible (more reliable indicator)
    await this.workRows.first().waitFor({ state: "visible", timeout });
    // Wait a bit more to ensure all rows are rendered
    await this.page.waitForTimeout(300);
  }
}
