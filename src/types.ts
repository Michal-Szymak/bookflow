import type { Enums, Tables } from "./db/database.types";

// ============================================================================
// BASE ENTITY TYPES
// ============================================================================
// These types are derived directly from Supabase table rows and represent
// the raw database entities.

export type AuthorRow = Tables<"authors">;
export type WorkRow = Tables<"works">;
export type EditionRow = Tables<"editions">;
export type AuthorWorkRow = Tables<"author_works">;
export type UserAuthorRow = Tables<"user_authors">;
export type UserWorkRow = Tables<"user_works">;
export type ProfileRow = Tables<"profiles">;

// Enum for user work status
export type UserWorkStatus = Enums<"user_work_status_enum">;

// ============================================================================
// BASIC DTO TYPES
// ============================================================================
// Simple DTOs that directly map to entity rows without transformation.

export type ProfileDto = ProfileRow;
export type AuthorDto = AuthorRow;
export type WorkDto = WorkRow;
export type EditionDto = EditionRow;

// ============================================================================
// AUTHOR SEARCH DTOs
// ============================================================================
// DTOs for OpenLibrary author search functionality.

/**
 * Single author search result from OpenLibrary.
 * May include an existing database ID if the author is already cached.
 */
export interface AuthorSearchResultDto {
  id?: AuthorRow["id"];
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>;
  name: AuthorRow["name"];
  ol_fetched_at: AuthorRow["ol_fetched_at"];
  ol_expires_at: AuthorRow["ol_expires_at"];
}

/**
 * Response for GET /api/authors/search
 * Contains a list of author search results from OpenLibrary.
 */
export interface AuthorSearchResponseDto {
  authors: AuthorSearchResultDto[];
}

// ============================================================================
// WORK & EDITION COMPOSITE DTOs
// ============================================================================
// DTOs that combine multiple entities to provide enriched data.

/**
 * Summary of a work's primary edition.
 * Used to provide essential edition information alongside work data.
 */
export type PrimaryEditionSummaryDto = Pick<
  EditionRow,
  | "id"
  | "title"
  | "openlibrary_id"
  | "publish_year"
  | "publish_date"
  | "publish_date_raw"
  | "isbn13"
  | "cover_url"
  | "language"
>;

/**
 * Work with its primary edition details.
 * Used when returning full work information with related edition data.
 */
export type WorkWithPrimaryEditionDto = WorkDto & {
  primary_edition: PrimaryEditionSummaryDto | null;
};

/**
 * Work list item with computed publish year.
 * The publish_year is computed as COALESCE(work.first_publish_year, edition.publish_year)
 * to provide fallback from primary edition when work's year is not available.
 */
export type WorkListItemDto = WorkWithPrimaryEditionDto & {
  publish_year: number | null;
};

// ============================================================================
// PAGINATION & LIST RESPONSE DTOs
// ============================================================================
// Generic pagination wrapper and specific list response types.

/**
 * Generic paginated response structure.
 * Used for all endpoints that return paginated lists.
 */
export interface PaginatedResponseDto<TItem> {
  items: TItem[];
  page: number;
  total: number;
}

/**
 * Response for GET /api/authors/{authorId}/works
 * Paginated list of works for a specific author.
 */
export type AuthorWorksListResponseDto = PaginatedResponseDto<WorkListItemDto>;

/**
 * Response for GET /api/works/{workId}/editions
 * Non-paginated list of editions for a work (sorted by publish year).
 */
export interface EditionsListResponseDto {
  items: EditionDto[];
}

// ============================================================================
// USER AUTHOR DTOs
// ============================================================================
// DTOs for user's followed/owned authors.

/**
 * User's attached author with metadata.
 * Combines author details with the attachment timestamp.
 */
export interface UserAuthorDto {
  author: AuthorDto;
  created_at: UserAuthorRow["created_at"];
}

/**
 * Response for GET /api/user/authors
 * List of user's attached authors with total count.
 */
export interface UserAuthorsListResponseDto {
  items: UserAuthorDto[];
  total: number;
}

// ============================================================================
// USER WORK DTOs
// ============================================================================
// DTOs for user's bookshelf items with status and availability.

/**
 * User's work item with full details.
 * Combines work/edition data with user-specific status and availability.
 */
export interface UserWorkItemDto {
  work: WorkWithPrimaryEditionDto;
  status: UserWorkRow["status"];
  available_in_legimi: UserWorkRow["available_in_legimi"];
  status_updated_at: UserWorkRow["status_updated_at"];
  created_at: UserWorkRow["created_at"];
  updated_at: UserWorkRow["updated_at"];
}

/**
 * Response for GET /api/user/works
 * Paginated list of user's works with filters.
 */
export type UserWorksListResponseDto = PaginatedResponseDto<UserWorkItemDto>;

/**
 * Response for POST /api/user/works/bulk
 * Reports which work IDs were successfully added vs. skipped (already existed).
 */
export interface BulkAttachUserWorksResponseDto {
  added: WorkRow["id"][];
  skipped: WorkRow["id"][];
}

// ============================================================================
// SINGLE ITEM RESPONSE DTOs
// ============================================================================
// Wrapper DTOs for single-item responses (following API convention).

/**
 * Response for single user work operations.
 * Used by PATCH /api/user/works/{workId}
 */
export interface UserWorkResponseDto {
  work: UserWorkItemDto;
}

/**
 * Response for bulk user work status updates.
 * Used by POST /api/user/works/status-bulk
 */
export interface UserWorksBulkUpdateResponseDto {
  works: UserWorkItemDto[];
}

/**
 * Response for single author operations.
 * Used by POST /api/authors, POST /api/openlibrary/import/author, GET /api/authors/{authorId}
 */
export interface AuthorResponseDto {
  author: AuthorDto;
}

/**
 * Response for single work operations.
 * Used by POST /api/works, POST /api/openlibrary/import/work,
 * GET /api/works/{workId}, POST /api/works/{workId}/primary-edition
 */
export interface WorkResponseDto {
  work: WorkWithPrimaryEditionDto;
}

/**
 * Response for single edition operations.
 * Used by POST /api/editions, POST /api/openlibrary/import/edition
 */
export interface EditionResponseDto {
  edition: EditionDto;
}

// ============================================================================
// QUERY PARAMETER DTOs (Command Models for GET requests)
// ============================================================================
// These represent query parameters for list/search endpoints.

/**
 * Query parameters for GET /api/authors/search
 * Searches OpenLibrary authors with optional result limit.
 */
export interface AuthorSearchQueryDto {
  q: string;
  limit?: number;
}

/**
 * Query parameters for GET /api/authors/{authorId}/works
 * Lists works for an author with pagination and sorting.
 */
export interface AuthorWorksListQueryDto {
  page?: number;
  sort?: "published_desc" | "title_asc";
  forceRefresh?: boolean;
}

/**
 * Query parameters for GET /api/user/authors
 * Lists user's authors with search, pagination, and sorting.
 */
export interface UserAuthorsListQueryDto {
  page?: number;
  search?: string;
  sort?: "name_asc" | "created_desc";
}

/**
 * Query parameters for GET /api/user/works
 * Lists user's works with comprehensive filtering and sorting.
 */
export interface UserWorksListQueryDto {
  page?: number;
  status?: UserWorkStatus[];
  available?: UserWorkRow["available_in_legimi"];
  sort?: "published_desc" | "title_asc";
  author_id?: AuthorRow["id"];
  search?: string;
}

// ============================================================================
// COMMAND MODELS (for POST/PATCH/PUT requests)
// ============================================================================
// These represent request bodies for mutation operations.

/**
 * Command to create a manual author.
 * POST /api/authors
 * Manual authors must have manual=true and no openlibrary_id.
 */
export type CreateAuthorCommand = Pick<AuthorRow, "name"> & {
  manual: true;
  openlibrary_id?: null;
};

/**
 * Command to import an author from OpenLibrary.
 * POST /api/openlibrary/import/author
 * Imports or refreshes an OL author into the shared catalog.
 */
export interface ImportAuthorCommand {
  openlibrary_id: NonNullable<AuthorRow["openlibrary_id"]>;
}

/**
 * Command to create a manual work.
 * POST /api/works
 * Manual works require author linkage and allow optional edition/year.
 */
export type CreateWorkCommand = Pick<WorkRow, "title" | "first_publish_year" | "primary_edition_id"> & {
  manual: true;
  author_ids: AuthorRow["id"][];
};

/**
 * Command to import a work from OpenLibrary.
 * POST /api/openlibrary/import/work
 * Links the imported work to an existing author.
 */
export interface ImportWorkCommand {
  openlibrary_id: NonNullable<WorkRow["openlibrary_id"]>;
  author_id: AuthorRow["id"];
}

/**
 * Command to set or update a work's primary edition.
 * POST /api/works/{workId}/primary-edition
 * Validates that the edition belongs to the work.
 */
export interface SetPrimaryEditionCommand {
  edition_id: EditionRow["id"];
}

/**
 * Command to create a manual edition.
 * POST /api/editions
 * Manual editions require work linkage and allow optional publication details.
 */
export type CreateEditionCommand = Pick<
  EditionRow,
  "work_id" | "title" | "publish_year" | "publish_date" | "publish_date_raw" | "isbn13" | "cover_url" | "language"
> & {
  manual: true;
};

/**
 * Command to import an edition from OpenLibrary.
 * POST /api/openlibrary/import/edition
 * Links the imported edition to an existing work.
 */
export interface ImportEditionCommand {
  openlibrary_id: NonNullable<EditionRow["openlibrary_id"]>;
  work_id: WorkRow["id"];
}

/**
 * Command to attach an author to user's profile.
 * POST /api/user/authors
 * Subject to rate limits (10/min) and user limits (500 max authors).
 */
export interface AttachUserAuthorCommand {
  author_id: AuthorRow["id"];
}

/**
 * Command to bulk attach works to user's profile.
 * POST /api/user/works/bulk
 * Subject to user limits (5000 max works) with deduplication.
 */
export interface BulkAttachUserWorksCommand {
  work_ids: WorkRow["id"][];
  status?: UserWorkStatus;
}

/**
 * Command to update a user work's status or availability.
 * PATCH /api/user/works/{workId}
 * Updates trigger status_updated_at when status changes.
 */
export interface UpdateUserWorkCommand {
  status?: UserWorkStatus;
  available_in_legimi?: UserWorkRow["available_in_legimi"];
}

/**
 * Command to bulk update user works' status or availability.
 * POST /api/user/works/status-bulk
 * Applies the same updates to multiple works at once.
 */
export type UpdateUserWorksBulkCommand = UpdateUserWorkCommand & {
  work_ids: WorkRow["id"][];
};
