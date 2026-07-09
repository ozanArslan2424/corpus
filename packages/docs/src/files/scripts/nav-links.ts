document.addEventListener("DOMContentLoaded", () => {
	const currentPath = window.location.pathname;
	const navLinks = document.querySelectorAll("aside nav a");

	navLinks.forEach((link) => {
		const href = link.getAttribute("href");
		if (!href || href === "#" || link.hasAttribute("aria-disabled")) return;

		// 1. Exact Match for the current page
		if (href === currentPath) {
			link.setAttribute("aria-current", "page");

			// If it's a nested link, ensure parent list is visible
			// (useful if you later add collapse/expand logic)
			const parentList = link.closest<HTMLUListElement>("ul ul");
			if (parentList) {
				parentList.style.display = "block";
			}
		}

		// 2. Structural Match (Active Parent)
		// Check if the current URL starts with the link's base path
		// e.g., if href is "/router", matches "/router/diy/item.html"
		const basePath = href.replace(".html", "");
		if (currentPath.startsWith(basePath) && href !== "/") {
			link.classList.add("active-parent");
		}
	});
});
