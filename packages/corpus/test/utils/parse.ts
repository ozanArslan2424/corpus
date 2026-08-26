import { $registry, type C } from "#corpus";

export async function parseBody<T>(r: Request | C.Res | Response): Promise<T> {
	const body = await $registry.bodyParser.parse(r);
	return await $registry.schemaParser.parse<T>("body", body);
}
