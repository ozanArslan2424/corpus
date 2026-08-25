import { logFatal, logger } from "@ozanarslan/utils";

import { RouterBenchmark } from "../utils/RouterBenchmark";
import { BranchRouter } from "./BranchRouter";
import { MemoiristAdapter } from "./MemoiristAdapter";

function main() {
	const adapters = [new MemoiristAdapter(), new BranchRouter()];
	const results: string[] = [];
	for (const adapter of adapters) {
		const bench = new RouterBenchmark(adapter);
		bench.setup();
		results.push(bench.run());
	}

	logger.success(["Finished", ...results].join("\n\n"));
}

// Run the benchmark
try {
	main();
} catch (err) {
	logFatal("Benchmark failed:", err);
}
