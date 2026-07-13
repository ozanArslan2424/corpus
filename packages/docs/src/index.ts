import fs from "fs";
import os from "os";
import path from "path";

import { X } from "@ozanarslan/corpus";

import { compile } from "@/compile";
import { serve } from "@/serve";

const outdir = X.Config.isDev
	? fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"))
	: path.join(import.meta.dir, "public");

await compile(outdir);

await serve(outdir);
