import { CoreumCookies as _Cookies } from "@/internal/Cookies/CoreumCookies";

/**
 * TODO: Only available in Bun runtime at the moment.
 * Simple cookie map/jar to collect and manipulate cookies. The conversion to
 * Set-Cookie header is handled by {@link Response}
 * */

export const Cookies = _Cookies;
export type Cookies = _Cookies;
