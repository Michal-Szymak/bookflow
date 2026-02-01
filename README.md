## 1. Project name

**BookFlow**

![Node](https://img.shields.io/badge/node-22.14.0-339933?logo=node.js&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=0B1F2A)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)

### Table of contents

- [1. Project name](#1-project-name)
- [2. Project description](#2-project-description)
- [3. Tech stack](#3-tech-stack)
- [4. Getting started locally](#4-getting-started-locally)
- [5. Available scripts](#5-available-scripts)
- [6. Project scope](#6-project-scope)
- [7. Project status](#7-project-status)
- [8. License](#8-license)

## 2. Project description

BookFlow is a responsive web application (Polish-first) designed for **advanced Legimi users** who manage large personal reading lists. It helps you:

- **Organize authors and books** at scale
- **Track reading status** (To read / In progress / Read / Hidden)
- **Track availability in Legimi** (manual flag in MVP)
- **Use OpenLibrary data** as the canonical source for author discovery and works import

**Non-goals** (MVP): no mobile app, no PWA, no social features, and no direct Legimi account integration.

### Documentation

- **PRD**: `./.ai/prd.md`
- **Tech stack overview**: `./.ai/tech-stack.md`

### Disclaimer

BookFlow is not affiliated with Legimi. “Legimi” is a trademark of its respective owner. OpenLibrary is used as an external data source.

## 3. Tech stack

- **Frontend**:
  - **Astro 5** + **React 19** (interactive components)
  - **TypeScript 5**
  - **Tailwind CSS 4**
  - **shadcn/ui** components (Radix primitives)
- **Backend (planned per PRD)**:
  - **Supabase** (PostgreSQL, Auth, Row Level Security)
- **External services (planned per PRD)**:
  - **OpenLibrary** for author search + works import (with 7-day cache/TTL)
  - **OpenRouter** for AI model access (if/when AI features are introduced)
- **Testing**:
  - **Vitest** for unit and integration tests
  - **@testing-library/react** and **@testing-library/user-event** for React component testing
  - **Playwright** for end-to-end (E2E) tests
  - **MSW (Mock Service Worker)** for mocking HTTP requests
- **CI/CD & Hosting (planned)**:
  - **GitHub Actions**
  - **DigitalOcean** (Docker-based deployment)

## 4. Getting started locally

### Prerequisites

- **Node.js**: `22.14.0` (from `.nvmrc`)
- **npm**: comes with Node.js

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the app (Astro will print the local URL in the terminal).

### Build & preview (production-like)

```bash
npm run build
npm run preview
```

### Notes for Node version management

- If you use `nvm`, run `nvm use` in the project root.
- On Windows, you may use **nvm-windows**; ensure it matches `.nvmrc` (`22.14.0`).

## 5. Available scripts

Scripts are defined in `package.json`:

- **`npm run dev`**: start the Astro development server
- **`npm run build`**: build the production bundle
- **`npm run preview`**: preview the production build locally
- **`npm run astro`**: run the Astro CLI
- **`npm run lint`**: run ESLint
- **`npm run lint:fix`**: run ESLint with auto-fixes enabled
- **`npm run format`**: format the repository using Prettier

## 6. Project scope

### MVP goals (from PRD)

- **Authentication**: email + password sign up / sign in / sign out; account deletion (and user data removal)
- **Core entities**: User, Author, Work, Edition
- **OpenLibrary integration**:
  - Search author by name and select a canonical OpenLibrary author ID
  - Import the author’s full list of works (with a **7-day cache/TTL**)
  - Default sorting: newest first using `first_publish_date` with fallback to edition `publish_date` (display year only)
- **Library management**:
  - Add/remove authors
  - Bulk add books to your profile
  - Pagination: **30 items per page**
  - Limits: **500 authors** and **5000 books** per user
- **Reading workflow**:
  - Book statuses: **To read**, **In progress**, **Read**, **Hidden**
  - Bulk status updates via selection
  - “Hidden” removes the title from the default view
- **Legimi availability**:
  - Manual `availableInLegimi` flag (no auto-refresh in MVP)
  - Optional experimental Legimi checker behind a global feature flag (OFF by default), cached with **7-day TTL**
- **Filters & sorting**:
  - Filter by reading status and Legimi availability
  - Sort A–Z by title or by newest publication year
- **UX & quality**:
  - User-friendly API error messages + technical logs for developers
  - Basic analytics events (e.g. sign_up, add_author, add_books_bulk, mark_read, check_legimi)
  - Testing: unit tests for critical logic + an E2E test for the core “add author → import → mark as read” flow

### Explicitly out of scope (MVP)

- **PWA** and native mobile apps
- Social/sharing features
- Automatic syncing with Legimi, or adding books to Legimi shelves
- Full accessibility compliance (basic a11y only)
- List virtualization
- Advanced rate limiting
- Editing/merging OpenLibrary-derived records
- Notifications (push/email)

## 7. Project status

- **Status**: in development (pre-MVP)
- **Version**: `0.0.1` (from `package.json`)

## 8. License

**No license is specified yet** in this repository (there is no `LICENSE` file). If you intend this project to be open source, add a `LICENSE` file (e.g. MIT) and update this section accordingly.
