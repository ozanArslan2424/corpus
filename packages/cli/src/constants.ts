export const APP_NAME = "Corpus CLI";
export const EXE_NAME = "corpus";
export const CONFIG_FILE_NAME = "corpus.config.ts";

export const GEN_FUNC = `generateApiClient`;

export const NAME_FLAG_HELP = `<name> | [--name, -n] <name>`;

export const LISTEN_PATTERN = /^[ \t]*(?:void|await)?\s*\w+\.listen\(.*?\);.*$/m;
export const MODEL_PATTERN = /\w*Model\w*/;
export const MODEL_TYPE_PATTERN = /^type\s+(\w+)\s*=\s*\w+\.InferModel<[^;]+>;?$/m;
export const INTERFACE_MODEL_PATTERN = /(?:^|\s)interface\s+(\w*Model\w*)\s*\{/;

export const PATTERNS = {
	import: /^import\s.+;$/,
	route: /(?:const\s+\w+\s*=\s*)?new\s+(?:[\w.]+)?Route\(/,
	middleware: /(?:const\s+\w+\s*=\s*)?new\s+(?:[\w.]+)?Middleware\(/,
	controller: /(?:const\s+\w+\s*=\s*)?new\s+(?:[\w.]+)?Controller\(/,
	service: /(?:const\s+\w+\s*=\s*)?new\s+(?:[\w.]+)?Service\(/,
} as const;

export const NEVER_SCHEMAS = new Set([
	'type(\\"never\\")',
	'type("never")',
	"z.never()",
	"y.mixed().oneOf([undefined] as const)",
	"y.mixed().oneOf([undefined])",
	"this.never",
	"never",
	"undefined",
	'type(\\"undefined\\")',
	'type("undefined")',
	"z.undefined()",
]);
