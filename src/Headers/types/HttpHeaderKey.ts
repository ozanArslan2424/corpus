import type { CommonHeaders } from "@/Headers/enums/CommonHeaders";
import type { OrString } from "@/utils/types/OrString";

export type HttpHeaderKey = OrString<CommonHeaders>;
