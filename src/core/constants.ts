/**
 * @fileoverview Centralized constants for the AR Engine
 */

export const AR_CONFIG = {
    // Camera settings
    VIEWPORT_WIDTH: 640,
    VIEWPORT_HEIGHT: 480,
    DEFAULT_FOVY: 60.0,
    DEFAULT_NEAR: 1.0,
    DEFAULT_FAR: 10000.0,

    // Detection settings
    MAX_FEATURES_PER_BUCKET: 24,
    USE_LSH: true,

    // Matching settings
    HAMMING_THRESHOLD: 0.85,
    HDC_RATIO_THRESHOLD: 0.85,
    INLIER_THRESHOLD: 15.0,
    MIN_NUM_INLIERS: 6,
    MAX_MATCH_QUERY_POINTS: 800,
    CLUSTER_MAX_POP: 25,

    // Tracker / NCC settings
    TRACKER_TEMPLATE_SIZE: 6,
    TRACKER_SEARCH_SIZE: 12,
    TRACKER_SIMILARITY_THRESHOLD: 0.65,

    // Image processing / Scale list
    MIN_IMAGE_PIXEL_SIZE: 32,
    SCALE_STEP_EXPONENT: 0.6,
    TRACKING_DOWNSCALE_LEVEL_1: 256.0,
    TRACKING_DOWNSCALE_LEVEL_2: 128.0,

    // Tracker settings
    WARMUP_TOLERANCE: 2,
    MISS_TOLERANCE: 1,
    ONE_EURO_FILTER_CUTOFF: 0.5,
    ONE_EURO_FILTER_BETA: 0.1,
};
