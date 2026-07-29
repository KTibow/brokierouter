import { safeParse, summarize } from "valibot";
import { JatevoKeyFileSchema, JatevoSecretSchema } from "../types.ts";
import { fetchValidated } from "./fetch.ts";

const KEY_URL = "https://jatevo.kendell.dev/key.json";

// Jatevo's API key is published AES-GCM encrypted; JATEVO_ENCRYPTION_KEY is
// the base64 32-byte secret that unwraps it.
const loadKey = async (): Promise<string> => {
  const secret = process.env.JATEVO_ENCRYPTION_KEY;
  if (!secret) throw new Error("JATEVO_ENCRYPTION_KEY is not set");

  const { iv, ct } = await fetchValidated(KEY_URL, JatevoKeyFileSchema);
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(secret, "base64"),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
    key,
    Buffer.from(ct, "base64"),
  );

  const parsed = safeParse(
    JatevoSecretSchema,
    JSON.parse(new TextDecoder().decode(plaintext)),
  );
  if (!parsed.success)
    throw new Error(
      `Decrypted Jatevo key has unexpected shape:\n${JSON.stringify(summarize(parsed.issues), null, 2)}`,
    );
  return parsed.output.key;
};

let cached: Promise<string> | undefined;

export const jatevoKey = (): Promise<string> => (cached ??= loadKey());
