#!/usr/bin/env node

import { ConfigManager } from "./ConfigManager/ConfigManager";
import { generateApiClient } from "./generateApiClient";

const action = ConfigManager.getAction();
const config = await ConfigManager.getResolvedConfig();
await ConfigManager.writeConfigFile(config);

switch (action) {
	case "api":
		generateApiClient(config);
		break;
	// case "init":
	// 	await initialize(config);
	// 	break;
}

process.exit(0);
