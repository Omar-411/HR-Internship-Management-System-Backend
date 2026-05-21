import dotenv from "dotenv";
dotenv.config();

// Face challenge is valid for only 30 seconds (Time to live)
export const FACE_NONCE_TTL_MS = 30 * 1000;

// Allow face proof to be valid if timestamp is within 30 seconds of server time (Clock skew)
export const FACE_CLOCK_SKEW_MS = 30 * 1000;

// Secret key for signing face proof payloads
export const FACE_ATTESTATION_SECRET = process.env.FACE_ATTESTATION_SECRET || "";

// Secret key used to generate and verify HMAC signatures
export const faceNonceStore = new Map();
