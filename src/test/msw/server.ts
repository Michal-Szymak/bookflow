import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server for Node.js environment (used in Vitest tests).
 * This server intercepts HTTP requests and returns mocked responses.
 */
export const server = setupServer(...handlers);
