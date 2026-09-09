document.addEventListener("DOMContentLoaded", () => {
	const currentPath = window.location.pathname;
	const navLinks = document.querySelectorAll("aside nav a");
	navLinks.forEach((link) => {
		const href = link.getAttribute("href");
		if (!href || href === "#" || link.hasAttribute("aria-disabled")) return;
		const clean = href.replace("index.html", "");

		// 1. Exact Match for the current page
		if (href === currentPath) {
			link.setAttribute("aria-current", "page");
			// useful for collapse/expand logic
			const parentList = link.closest<HTMLUListElement>("ul ul");
			if (parentList) {
				parentList.style.display = "block";
			}
		} else if (clean !== "/" && currentPath.startsWith(clean)) {
			// 2. Structural Match (Active Parent)
			link.setAttribute("aria-current", "parent");
		} else {
			link.removeAttribute("aria-current");
		}
	});
});
