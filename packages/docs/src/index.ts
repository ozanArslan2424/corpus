import fs from "fs";
import os from "os";
import path from "path";

import { C } from "@ozanarslan/corpus";

import { compile } from "@/compile";
import { serve } from "@/serve";

function getOutDir() {
	return C.Config.isProd
		? path.join(import.meta.dir, "public")
		: fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
}

const outdir = getOutDir();
await compile(outdir);
await serve(outdir);
