/**
 * The single place every parsing decision in the framework is resolved from —
 * and the single place to replace them.
 *
 * Nothing in corpus constructs a parser inline. {@link App} resolves the
 * registry while compiling routes, and {@link BodyParser} reaches back into it
 * for {@link FormDataParser} and {@link SearchParamsParser} rather than owning
 * instances of its own. Replacing an entry therefore changes how the whole
 * framework parses that surface, across every {@link RouteBase} on every
 * {@link App}, without touching a single route definition.
 *
 * Every slot is plug and play. Each is typed as an interface
 * ({@link ParserBaseInterface}, {@link BodyParserInterface},
 * {@link SchemaParserInterface}), never as a concrete class, so a replacement
 * only has to satisfy the contract — subclassing the default is optional.
 *
 * ```ts
 * // Replace one parser; the rest keep their defaults.
 * setParsersRegistry({ bodyParser: new MyBodyParser() });
 *
 * await app.listen();
 * ```
 *
 * Overrides must be in place before {@link App.listen}: routes read the registry
 * as they are compiled, so anything swapped in afterwards is never reached.
 *
 * The registry lives on {@link Globals}, so it is created once per process and
 * shared by every {@link App}.
 *
 * @module ParsersRegistry
 */

import { type BodyParserInterface, BodyParser } from "@/BodyParser";
import { FormDataParser } from "@/FormDataParser";
import { Globals } from "@/Globals";
import type { ParserBaseInterface } from "@/ParserBase";
import { type SchemaParserInterface, SchemaParser } from "@/SchemaParser";
import { SearchParamsParser } from "@/SearchParamsParser";
import { URLParamsParser } from "@/URLParamsParser";

/**
 * The set of parsers the framework resolves at request time. Every field is an
 * interface, so each one can be replaced independently through
 * {@link setParsersRegistry}.
 */
interface ParsersRegistry {
	/**
	 * Turns the raw path parameters matched by a {@link RouteBase} into
	 * {@link Context.params}. Defaults to {@link URLParamsParser}.
	 */
	urlParamsParser: ParserBaseInterface<Record<string, string>>;
	/**
	 * Turns a query string into {@link Context.search}. Defaults to
	 * {@link SearchParamsParser}, which {@link BodyParser} also reuses for
	 * `application/x-www-form-urlencoded` bodies.
	 */
	searchParamsParser: ParserBaseInterface<URLSearchParams>;
	/**
	 * Turns `multipart/form-data` into an object. Defaults to
	 * {@link FormDataParser} and is reached through {@link BodyParser} rather than
	 * called directly.
	 */
	formDataParser: ParserBaseInterface<FormData>;
	/**
	 * Reads and decodes request and response bodies by content type. Defaults to
	 * {@link BodyParser}.
	 */
	bodyParser: BodyParserInterface;
	/**
	 * Validates already-parsed params, search and body against the schemas
	 * declared in a route's {@link Config}. Defaults to {@link SchemaParser},
	 * which supports Zod and ArkType.
	 */
	schemaParser: SchemaParserInterface;
}

/**
 * Reads the registry from {@link Globals}, constructing the defaults on first
 * access.
 *
 * Called by {@link App} during route compilation and by {@link BodyParser} when
 * it needs a sibling parser.
 *
 * @returns The shared {@link ParsersRegistry}.
 */
function getOrInitParsersRegistry(): ParsersRegistry {
	try {
		return Globals.get("parsers");
	} catch {
		return Globals.create("parsers", () => {
			const urlParamsParser = new URLParamsParser();
			const searchParamsParser = new SearchParamsParser();
			const formDataParser = new FormDataParser();
			const bodyParser = new BodyParser();
			const schemaParser = new SchemaParser();
			return { urlParamsParser, searchParamsParser, formDataParser, bodyParser, schemaParser };
		});
	}
}

/**
 * Overrides one or more parsers. Only the provided keys are replaced;
 * unspecified parsers keep their current implementation.
 *
 * Must be called before {@link App.listen} — routes resolve their parsers as
 * they are compiled, so a later override has no effect on an already-listening
 * app.
 *
 * @param overrides - The {@link ParsersRegistry} entries to swap in. Each value
 * need only satisfy its interface; it does not have to extend the default class.
 */
function setParsersRegistry(overrides: Partial<ParsersRegistry>): void {
	Object.assign(getOrInitParsersRegistry(), overrides);
}

export { type ParsersRegistry, getOrInitParsersRegistry, setParsersRegistry };
