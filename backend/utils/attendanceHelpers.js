import crypto from "crypto";

export const nonceKey = (userId, nonce) => `${String(userId)}:${String(nonce)}`;

// Cleans old challenges from memory
export const purgeExpiredFaceChallenges = () => {
  const now = Date.now();
  for (const [key, value] of faceNonceStore.entries()) {
    if (!value || value.expiresAt <= now || value.used === true) {
      faceNonceStore.delete(key);
    }
  }
};

// Converts the payload to a deterministic string format for signing
export const signablePayloadString = (payload) => {
  return JSON.stringify({
    nonce: String(payload.nonce),
    result: String(payload.result),
    timestamp: Number(payload.timestamp),
    userId: String(payload.userId),
  });
};

// Compares two hex strings in a timing-safe way to prevent against timing attacks
export const safeEqualHex = (a, b) => {
  try {
    const ba = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
};

// Verifies the face proof by checking the signature, timestamp, and matching it to a valid challenge
export const verifyFaceProof = (jwtUserId, faceProof) => {
  if (!FACE_ATTESTATION_SECRET)
    return { ok: false, message: "Face attestation secret is not configured" };
  if (!faceProof || typeof faceProof !== "object")
    return { ok: false, message: "Missing faceProof" };

  const payload = faceProof.payload;
  const signature = faceProof.signature;
  if (!payload || !signature)
    return { ok: false, message: "Invalid faceProof format" };

  if (String(payload.userId) !== String(jwtUserId)) {
    return { ok: false, message: "Face proof user mismatch" };
  }
  if (String(payload.result) !== "success") {
    return { ok: false, message: "Face proof result is not success" };
  }

  const now = Date.now();
  const tsMs = Number(payload.timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > FACE_CLOCK_SKEW_MS) {
    return { ok: false, message: "Face proof is expired or not yet valid" };
  }

  const expectedSig = crypto
    .createHmac("sha256", FACE_ATTESTATION_SECRET)
    .update(signablePayloadString(payload))
    .digest("hex");

  if (!safeEqualHex(expectedSig, signature)) {
    return { ok: false, message: "Invalid face proof signature" };
  }

  purgeExpiredFaceChallenges();
  const key = nonceKey(jwtUserId, payload.nonce);
  const challenge = faceNonceStore.get(key);
  if (!challenge)
    return { ok: false, message: "Face challenge not found or expired" };
  if (challenge.used)
    return { ok: false, message: "Face challenge already used" };
  if (challenge.expiresAt <= now) {
    faceNonceStore.delete(key);
    return { ok: false, message: "Face challenge expired" };
  }

  challenge.used = true;
  challenge.usedAt = now;
  faceNonceStore.set(key, challenge);
  return { ok: true };
};

// Determines if an attendance record indicates that the user has checked in
export const indicatesCheckIn = (record) => {
  return (
    !!record?.checkInTime ||
    record?.status === "present" ||
    record?.status === "late"
  );
};
