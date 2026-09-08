document.addEventListener("DOMContentLoaded", () => {
	const links = document.querySelectorAll('a[href^="#"]');

	links.forEach((link) => {
		link.addEventListener("click", (e) => {
			const targetId = link.getAttribute("href");
			if (!targetId) return;
			if (targetId === "#") return;

			const targetElement = document.querySelector(targetId);
			if (targetElement) {
				e.preventDefault();
				targetElement.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			}
		});
	});
});
