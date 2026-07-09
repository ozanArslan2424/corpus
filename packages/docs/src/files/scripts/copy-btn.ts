document.addEventListener("DOMContentLoaded", () => {
	document.querySelectorAll(".code-copy .copy-btn:not([onclick])").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const code = btn.previousElementSibling?.textContent;
			if (!code) return;

			try {
				await navigator.clipboard.writeText(code);
				btn.classList.add("copied");
				setTimeout(() => btn.classList.remove("copied"), 2000);
			} catch (err) {
				console.error("Failed to copy:", err);
			}
		});
	});

	document.querySelector(".install-hint")?.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText("bun add @ozanarslan/corpus");
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	});
});
