import { test, expect } from "@playwright/test";
import { AuthorsListPage, AddAuthorModal, AuthorDetailPage } from "./pages";

/**
 * Example E2E test demonstrating Page Object Model usage
 * Test scenario: Add author from OpenLibrary and verify
 */
test.describe("Add Author - OpenLibrary Search", () => {
  test("should add author from OpenLibrary search and verify", async ({ page }) => {
    // Initialize Page Objects
    const authorsPage = new AuthorsListPage(page);
    const addAuthorModal = new AddAuthorModal(page);
    const authorDetailPage = new AuthorDetailPage(page);

    // Step 1: Navigate to authors list page
    await authorsPage.goto();

    // Step 2: Get initial author count
    const initialLimit = await authorsPage.getAuthorLimit();
    const initialCount = initialLimit.current;

    // Step 3: Click "Add Author" button
    await authorsPage.clickAddAuthorButton();

    // Step 4: Wait for modal and verify it's visible
    await addAuthorModal.waitForModal();
    await addAuthorModal.verifyModalVisible();

    // Step 5: Select "Search in OpenLibrary" tab (should be selected by default)
    await addAuthorModal.selectSearchTab();
    await addAuthorModal.verifySearchTabActive();

    // Step 6: Get search tab component and search for author
    const searchTab = addAuthorModal.getSearchTab();
    await searchTab.searchAuthor("Zychowicz");

    // Step 7: Wait for search to complete
    await searchTab.waitForSearchComplete();

    // Step 8: Verify search results are displayed
    await searchTab.verifySearchResultsVisible();
    const resultCount = await searchTab.getSearchResultCount();
    expect(resultCount).toBeGreaterThan(0);

    // Step 9: Get first author name from results
    const firstAuthorName = await searchTab.getAuthorNameFromResult(0);
    expect(firstAuthorName).toBeTruthy();

    // Step 10: Click "Add" button for the first result
    await searchTab.clickAddButton(0);

    // Step 11: Wait for author to be added and list to refresh
    // Uses UI-based waiting (author count change) which is more reliable than request-based
    await authorsPage.waitForAuthorAdded(initialCount + 1);

    // Step 12: Wait for modal to close (author added successfully)
    await addAuthorModal.modal.waitFor({ state: "hidden" });

    // Step 13: Verify author count increased
    const newLimit = await authorsPage.getAuthorLimit();
    expect(newLimit.current).toBe(initialCount + 1);

    // Step 14: Verify author appears in the list
    if (firstAuthorName) {
      await authorsPage.verifyAuthorExists(firstAuthorName);
    }

    // Step 15: Click on author name to navigate to detail page
    if (firstAuthorName) {
      await authorsPage.clickAuthorName(firstAuthorName);
    }

    // Step 16: Verify author detail page with works list
    await authorDetailPage.waitForWorksView();
    await authorDetailPage.verifyWorksViewVisible();
    await authorDetailPage.verifyWorksTableVisible();

    // Step 17: Verify works list is not empty
    await authorDetailPage.verifyWorksListNotEmpty();
    const worksCount = await authorDetailPage.getWorkCount();
    expect(worksCount).toBeGreaterThan(0);
  });

  test("should handle empty search results", async ({ page }) => {
    const authorsPage = new AuthorsListPage(page);
    const addAuthorModal = new AddAuthorModal(page);

    await authorsPage.goto();
    await authorsPage.clickAddAuthorButton();
    await addAuthorModal.waitForModal();

    const searchTab = addAuthorModal.getSearchTab();
    await searchTab.searchAuthor("NonExistentAuthorName12345");

    await searchTab.waitForSearchComplete();

    // Verify no results state
    await searchTab.verifyNoResultsStateVisible();
  });

  test("should close modal using different methods", async ({ page }) => {
    const authorsPage = new AuthorsListPage(page);
    const addAuthorModal = new AddAuthorModal(page);

    await authorsPage.goto();
    await authorsPage.clickAddAuthorButton();
    await addAuthorModal.waitForModal();

    // Test closing by button
    await addAuthorModal.close();
    await addAuthorModal.modal.waitFor({ state: "hidden" });

    // Reopen modal
    await authorsPage.clickAddAuthorButton();
    await addAuthorModal.waitForModal();

    // Test closing by Escape key
    await addAuthorModal.closeByEscape();
    await addAuthorModal.modal.waitFor({ state: "hidden" });
  });
});
