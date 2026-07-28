import { $registryTesting, type TC } from "../_modules";

export async function parseBody<T>(r: Request | TC.Res | Response): Promise<T> {
	const bodyParser = $registryTesting.bodyParser;
	const schemaParser = $registryTesting.schemaParser;
	const body = await bodyParser.parse(r);
	return await schemaParser.parse<T>("body", body);
}
