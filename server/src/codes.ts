import { ROOM_CODE_RETRIES, randomCode } from "@mindshare/shared";

/** Try fresh codes until a room claims one (the DO refuses codes with a live room). */
export async function claimCode(tryInit: (code: string) => Promise<boolean>, gen: () => string = () => randomCode()): Promise<string | null> {
  for (let i = 0; i < ROOM_CODE_RETRIES; i++) {
    const code = gen();
    if (await tryInit(code)) return code;
  }
  return null;
}
