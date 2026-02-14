import { type } from "arktype";
import z from "zod";

const ark = type({
	hello: "string",
});

const zod = z.object({
	hello: z.string(),
});

console.log("ark", ark["~standard"].validate.toString());
console.log("zod", zod["~standard"].validate.toString());
