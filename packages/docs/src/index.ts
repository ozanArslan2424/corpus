import fs from "fs";
import os from "os";
import path from "path";

import { X } from "@ozanarslan/corpus";

import { compile } from "@/compile";
import { serve } from "@/serve";

const outdir = X.Config.isProd
	? path.join(import.meta.dir, "public")
	: fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));

await compile(outdir);

await serve(outdir);
