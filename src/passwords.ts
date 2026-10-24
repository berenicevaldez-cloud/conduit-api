import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

// Version the format so future parameter changes do not invalidate existing hashes.
const PREFIX = "scrypt-v1";
const KEY_BYTES = 64;
const OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${PREFIX}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  // Compatibility with users created before the scrypt change. Never allow
  // bcrypt to silently truncate input beyond its 72-byte limit.
  if (/^\$2[aby]\$/.test(stored)) {
    return (
      Buffer.byteLength(password, "utf8") <= 72 &&
      bcrypt.compare(password, stored)
    );
  }

  const parts = stored.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== PREFIX ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  ) {
    return false;
  }
  const expected = Buffer.from(parts[2], "hex");
  const actual = await derive(password, Buffer.from(parts[1], "hex"));
  return timingSafeEqual(actual, expected);
}
