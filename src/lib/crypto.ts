import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Шифрование секретов интеграций (ТЗ, раздел 3, пункт 6).
 * AES-256-GCM: помимо шифрования даёт тег целостности — подменённый шифротекст не расшифруется.
 * Ключ живёт только в переменной окружения на сервере.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
/** Сколько последних символов ключа показываем человеку, чтобы он узнал свой токен. */
const HINT_LENGTH = 4;

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function secretKey(): Buffer {
  const raw = process.env.LIDERA_SECRETS_KEY;
  if (!raw) {
    throw new Error(
      "Не задан LIDERA_SECRETS_KEY. Добавьте его в .env.local — без него секреты интеграций не сохранить.",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `LIDERA_SECRETS_KEY должен быть ${KEY_LENGTH} байта в base64, получено ${key.length}.`,
    );
  }
  return key;
}

/** Есть ли на сервере ключ шифрования — экран интеграций честно говорит, если нет. */
export function hasSecretsKey(): boolean {
  const raw = process.env.LIDERA_SECRETS_KEY;
  return Boolean(raw) && Buffer.from(raw as string, "base64").length === KEY_LENGTH;
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(ALGORITHM, secretKey(), Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** «…yZ4k» — подсказка вместо самого ключа. Короткие значения не подсказываем вовсе. */
export function secretHint(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length <= HINT_LENGTH * 2) return null;
  return `…${trimmed.slice(-HINT_LENGTH)}`;
}
