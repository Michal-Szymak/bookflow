import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for Author Search Tab within Add Author Modal
 * Encapsulates all interactions with the OpenLibrary search functionality
 */
export class AuthorSearchTab {
  readonly page: Page;

  // Locators
  readonly searchInput: Locator;
  readonly searchResults: Locator;
  readonly searchResultItems: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly errorState: Locator;
  readonly noResultsState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.searchInput = page.getByTestId("author-search-input");
    this.searchResults = page.getByTestId("author-search-results");
    this.searchResultItems = page.getByTestId("author-search-result");
    this.emptyState = page.locator('text="Wprowadź nazwę autora, aby rozpocząć wyszukiwanie"');
    this.loadingState = page.locator('text="Wyszukiwanie..."');
    this.errorState = page.locator('text="⚠️"').locator("..").locator("..");
    this.noResultsState = page.locator('text="Nie znaleziono autorów pasujących do zapytania"');
  }

  /**
   * Enter search query in the search input
   * @param query - Author name to search for
   */
  async searchAuthor(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce (300ms) and potential API call
    await this.page.waitForTimeout(400);
  }

  /**
   * Get the current search query value
   * @returns Current input value
   */
  async getSearchQuery(): Promise<string | null> {
    return await this.searchInput.inputValue();
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(100);
  }

  /**
   * Wait for search results to appear
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   */
  async waitForSearchResults(timeout = 10000): Promise<void> {
    await this.searchResults.waitFor({ state: "visible", timeout });
  }

  /**
   * Get all search result items
   * @returns Locator for all search result items
   */
  getSearchResultItems(): Locator {
    return this.searchResultItems;
  }

  /**
   * Get search result item by index
   * @param index - Zero-based index of the result
   * @returns Locator for the specific result item
   */
  getSearchResultByIndex(index: number): Locator {
    return this.searchResultItems.nth(index);
  }

  /**
   * Get search result item by author name
   * @param authorName - Name of the author
   * @returns Locator for the specific result item
   */
  getSearchResultByName(authorName: string): Locator {
    return this.searchResultItems.filter({
      has: this.page.getByTestId("author-search-result-name").filter({ hasText: authorName }),
    });
  }

  /**
   * Get author name from search result
   * @param index - Zero-based index of the result
   * @returns Author name text
   */
  async getAuthorNameFromResult(index: number): Promise<string | null> {
    const result = this.getSearchResultByIndex(index);
    const nameElement = result.getByTestId("author-search-result-name");
    return await nameElement.textContent();
  }

  /**
   * Click "Add" button for a specific search result
   * @param index - Zero-based index of the result
   * @returns Promise that resolves when the button click is complete
   */
  async clickAddButton(index: number): Promise<void> {
    const result = this.getSearchResultByIndex(index);
    const addButton = result.getByTestId("author-search-result-add-button");
    await addButton.click();
    // Small delay to ensure click is processed
    await this.page.waitForTimeout(100);
  }

  /**
   * Click "Add" button for a specific author by name
   * @param authorName - Name of the author
   */
  async clickAddButtonByName(authorName: string): Promise<void> {
    const result = this.getSearchResultByName(authorName);
    const addButton = result.getByTestId("author-search-result-add-button");
    await addButton.click();
  }

  /**
   * Get count of search results
   * @returns Number of search result items
   */
  async getSearchResultCount(): Promise<number> {
    return await this.searchResultItems.count();
  }

  /**
   * Verify that search results are visible
   */
  async verifySearchResultsVisible(): Promise<void> {
    await this.searchResults.waitFor({ state: "visible" });
    const count = await this.getSearchResultCount();
    if (count === 0) {
      throw new Error("Search results container is visible but contains no results");
    }
  }

  /**
   * Verify that empty state is visible (no query entered)
   */
  async verifyEmptyStateVisible(): Promise<void> {
    await this.emptyState.waitFor({ state: "visible" });
  }

  /**
   * Verify that loading state is visible
   */
  async verifyLoadingStateVisible(): Promise<void> {
    await this.loadingState.waitFor({ state: "visible" });
  }

  /**
   * Verify that error state is visible
   */
  async verifyErrorStateVisible(): Promise<void> {
    await this.errorState.waitFor({ state: "visible" });
  }

  /**
   * Verify that no results state is visible
   */
  async verifyNoResultsStateVisible(): Promise<void> {
    await this.noResultsState.waitFor({ state: "visible" });
  }

  /**
   * Check if author is already in catalog (has badge "Już w katalogu")
   * @param index - Zero-based index of the result
   * @returns True if author is already in catalog
   */
  async isAuthorInCatalog(index: number): Promise<boolean> {
    const result = this.getSearchResultByIndex(index);
    const inCatalogText = result.locator('text="Już w katalogu"');
    return await inCatalogText.isVisible();
  }

  /**
   * Wait for search to complete (loading state to disappear)
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   */
  async waitForSearchComplete(timeout = 10000): Promise<void> {
    // Wait for loading state to disappear
    await this.loadingState.waitFor({ state: "hidden", timeout }).catch(() => {
      // Loading state might not appear if search is fast
    });
    // Wait a bit more to ensure results are rendered
    await this.page.waitForTimeout(200);
  }
}
