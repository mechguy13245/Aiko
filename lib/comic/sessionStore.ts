import { ComicOrchestrator } from "./orchestrator";

// In-memory session store. Sessions are ephemeral — resets on server restart.
// Sufficient for preview/hackathon use; replace with Redis for production.
export const comicSessions = new Map<string, ComicOrchestrator>();
