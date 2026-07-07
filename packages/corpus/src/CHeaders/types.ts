import type { CHeaders } from "@/CHeaders/CHeaders";
import type { CommonHeaders } from "@/enums/CommonHeaders";
import type { OrString } from "@/utils/strings";

export type HeaderKey = OrString<CommonHeaders>;

export type CHeadersInit = [string, string][] | Record<string, string> | Headers | CHeaders;
