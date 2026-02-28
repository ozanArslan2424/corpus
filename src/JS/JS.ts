import { Config } from "@/Config/Config";
import { FileWalker } from "@/FileWalker/FileWalker";
import ts from "typescript";
// import esbuild from "esbuild";

export class JS {
	// TODO: File Caching
	static async transpile(fileName: string, content: string): Promise<string> {
		// Check for web config first
		const webConfigPath = Config.resolvePath(Config.cwd(), "tsconfig.web.json");
		const defaultConfigPath = Config.resolvePath(Config.cwd(), "tsconfig.json");
		const webConfigExists = await FileWalker.exists(webConfigPath);
		const configPath = webConfigExists ? webConfigPath : defaultConfigPath;
		const configFile = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
		const parsedConfig = ts.parseJsonConfigFileContent(
			configFile.config,
			ts.sys,
			Config.cwd(),
		);
		const result = ts.transpileModule(content, {
			compilerOptions: parsedConfig.options,
			fileName,
		});
		return result.outputText;
	}

	// TODO: File Caching
	// static async minify(content: string): Promise<string> {
	// 	const result = await esbuild.transform(content, {
	// 		minify: true,
	// 		loader: "js",
	// 	});
	// 	return result.code;
	// }
}
