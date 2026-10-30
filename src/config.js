// Settings you may want to change before deploying.

// Voter ID card (EPIC) numbers: shown on screen, searchable and included in the
// CSV download. Set to false to hide them everywhere.
export const SHOW_VOTER_ID = true;

// Voter photos on the voter and family pages, looked up by voter ID card number:
// images/AGW1047638.jpg. A missing or slow photo just leaves the initial letter.
export const SHOW_PHOTOS = true;
export const photoUrl = (epic) => `${import.meta.env.BASE_URL}images/${encodeURIComponent(epic)}.jpg`;

export const PAGE_SIZES = [25, 50, 100, 250, 500];
export const DEFAULT_PAGE_SIZE = 50;

// Blocks, polling parts and voter ID series smaller than these are folded into
// "Other" in charts and chips (they stay selectable one by one in the block list).
export const MIN_BLOCK = 15;
export const MIN_BOOTH = 50;
export const MIN_SERIES = 50;

export const SESSION_KEY = "w53-session-v1";
export const THEME_KEY = "w53-theme";
