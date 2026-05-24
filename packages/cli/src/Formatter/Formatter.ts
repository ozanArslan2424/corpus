import prettier from "prettier";

export type FormatterParser = prettier.BuiltInParserName;

export class Formatter {
	async format(content: string, parser: FormatterParser): Promise<string> {
		const res = await prettier.format(content, {
			parser,
			useTabs: true,
			printWidth: 100,
		});
		return res;
	}
}
