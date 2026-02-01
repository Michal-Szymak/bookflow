import type { Page, Locator } from "@playwright/test";
import { AuthorSearchTab } from "./AuthorSearchTab";

/**
 * Page Object Model for Add Author Modal
 * Encapsulates all interactions with the add author modal
 */
export class AddAuthorModal {
  readonly page: Page;

  // Locators
  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly searchTab: Locator;
  readonly manualTab: Locator;
  readonly modalTitle: Locator;

  // Sub-components
  readonly searchTabComponent: AuthorSearchTab;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.modal = page.getByTestId("add-author-modal");
    this.closeButton = page.getByTestId("add-author-modal-close");
    this.searchTab = page.getByTestId("author-search-tab");
    this.manualTab = page.locator('button[role="tab"]').filter({ hasText: "Dodaj ręcznie" });
    this.modalTitle = page.locator('h2[id="modal-title"]');

    // Initialize sub-components
    this.searchTabComponent = new AuthorSearchTab(page);
  }

  /**
   * Wait for modal to be visible
   */
  async waitForModal(): Promise<void> {
    await this.modal.waitFor({ state: "visible" });
  }

  /**
   * Verify that modal is visible
   */
  async verifyModalVisible(): Promise<void> {
    await this.modal.waitFor({ state: "visible" });
  }

  /**
   * Close the modal by clicking the close button
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await this.modal.waitFor({ state: "hidden" });
  }

  /**
   * Close the modal by clicking the backdrop
   */
  async closeByBackdrop(): Promise<void> {
    const backdrop = this.page.locator('div[role="presentation"]').first();
    await backdrop.click({ position: { x: 0, y: 0 } });
    await this.modal.waitFor({ state: "hidden" });
  }

  /**
   * Close the modal by pressing Escape key
   */
  async closeByEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.modal.waitFor({ state: "hidden" });
  }

  /**
   * Select the "Search in OpenLibrary" tab
   */
  async selectSearchTab(): Promise<void> {
    await this.searchTab.click();
    await this.page.waitForTimeout(100); // Wait for tab switch animation
  }

  /**
   * Select the "Add manually" tab
   */
  async selectManualTab(): Promise<void> {
    await this.manualTab.click();
    await this.page.waitForTimeout(100); // Wait for tab switch animation
  }

  /**
   * Get the modal title text
   * @returns Modal title text
   */
  async getTitle(): Promise<string | null> {
    return await this.modalTitle.textContent();
  }

  /**
   * Verify that search tab is active
   */
  async verifySearchTabActive(): Promise<void> {
    const isSelected = await this.searchTab.getAttribute("aria-selected");
    if (isSelected !== "true") {
      throw new Error("Search tab is not active");
    }
  }

  /**
   * Get access to the search tab component
   * @returns AuthorSearchTab instance
   */
  getSearchTab(): AuthorSearchTab {
    return this.searchTabComponent;
  }
}
