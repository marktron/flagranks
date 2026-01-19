import { createHmac } from "crypto";

const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.MATCHUP_TOKEN_SECRET;
  if (!secret) {
    throw new Error("MATCHUP_TOKEN_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Generate a signed token for a matchup.
 * Token format: base64(timestamp:signature)
 * Signature = HMAC-SHA256(matchupId:timestamp, secret)
 */
export function generateMatchupToken(matchupId: string): string {
  const timestamp = Date.now();
  const secret = getSecret();

  const signature = createHmac("sha256", secret)
    .update(`${matchupId}:${timestamp}`)
    .digest("hex");

  const tokenData = `${timestamp}:${signature}`;
  return Buffer.from(tokenData).toString("base64");
}

/**
 * Validate a matchup token for a vote.
 * Returns true if the token is valid for the given winner/loser pair.
 */
export function validateMatchupToken(
  token: string,
  winnerId: number,
  loserId: number
): { valid: boolean; error?: string } {
  try {
    const secret = getSecret();

    // Decode token
    const tokenData = Buffer.from(token, "base64").toString("utf-8");
    const [timestampStr, signature] = tokenData.split(":");

    if (!timestampStr || !signature) {
      return { valid: false, error: "Invalid token format" };
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return { valid: false, error: "Invalid timestamp" };
    }

    // Check expiry
    const age = Date.now() - timestamp;
    if (age > TOKEN_EXPIRY_MS) {
      return { valid: false, error: "Token expired" };
    }

    // Reconstruct matchupId (always min-max order)
    const matchupId = `${Math.min(winnerId, loserId)}-${Math.max(winnerId, loserId)}`;

    // Verify signature
    const expectedSignature = createHmac("sha256", secret)
      .update(`${matchupId}:${timestamp}`)
      .digest("hex");

    if (signature !== expectedSignature) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Token validation failed" };
  }
}
