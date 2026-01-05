/**
 * Usage Limits Configuration
 * 
 * These limits protect against abuse when deployed publicly.
 * 
 * To bypass ALL limits for personal use, set the environment variable:
 *   ADMIN_MODE=true
 * 
 * Example in .env.local:
 *   ADMIN_MODE=true
 */

// Check if admin mode is enabled (bypasses all limits)
export const ADMIN_MODE = process.env.ADMIN_MODE === 'true';

// ═══════════════════════════════════════════════════════════════
// USAGE LIMITS - Easily adjustable values
// ═══════════════════════════════════════════════════════════════

export const LIMITS = {
    // Chat limits
    MAX_MESSAGES_PER_SESSION: 20,       // Max chat messages before reset
    MAX_MESSAGE_LENGTH: 1000,           // Max characters per user message

    // File limits
    MAX_FILE_SIZE_MB: 2,                // Max Excel file size in MB
    MAX_ROWS: 100,                      // Max rows to process from Excel

    // Rate limiting
    RATE_LIMIT_MESSAGES: 10,            // Max messages per time window
    RATE_LIMIT_WINDOW_MS: 60 * 1000,    // Time window (1 minute)
};

// Computed values
export const MAX_FILE_SIZE_BYTES = LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a limit should be enforced (false if admin mode is on)
 */
export function shouldEnforceLimit(): boolean {
    return !ADMIN_MODE;
}

/**
 * Get the effective limit value (Infinity if admin mode)
 */
export function getEffectiveLimit(limit: number): number {
    return ADMIN_MODE ? Infinity : limit;
}
