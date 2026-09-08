vim.lsp.config("vtsls", {
	settings = {
		typescript = {
			preferences = {
				autoImportFileExcludePatterns = { "src/C.namespace.ts", "src/index.ts", "src/utils.ts" },
			},
		},
	},
})
