import type { CommonHeaders } from "@/modules/HttpHeaders/enums/CommonHeaders";
import type { OrString } from "@/utils/OrString";

export type HttpHeaderKey = OrString<CommonHeaders>;
