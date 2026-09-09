function initSmoothScroll() {
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
}

function initCopyButtons() {
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
}

function initNavLinks() {
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
}

function initSearch() {
	interface SearchLink {
		label: string;
		href: string | null;
		group: string;
	}

	const trigger = document.querySelector<HTMLInputElement>("#header-search");
	const input = document.querySelector<HTMLInputElement>("#search-dialog-input");
	const dialog = document.querySelector<HTMLDialogElement>("#search-dialog");
	const results = document.querySelector<HTMLUListElement>("#search-results");
	if (!dialog || !input || !trigger || !results) return;

	const searchLinks: Array<SearchLink> = Array.from(document.querySelectorAll("aside nav a"))
		.filter((a) => a.getAttribute("href") !== "#" && !a.hasAttribute("aria-disabled"))
		.map((a) => {
			const li = a.closest("li");
			const parentLi = li?.parentElement?.closest("li");
			const parentLink = parentLi?.querySelector(":scope > a");
			return {
				label: a.textContent.trim(),
				href: a.getAttribute("href"),
				group: parentLink ? parentLink.textContent.trim() : "",
			};
		});

	function renderResults(links: Array<SearchLink>) {
		if (!results) return;

		results.innerHTML = links
			.map((l) => {
				const group = l.group ? `<span class="search-result-group">${l.group}</span>` : "";
				return `<li><a href="${l.href}"><span>${l.label}</span>${group}</a></li>`;
			})
			.join("");
	}

	function filterSearchResults(query: string | undefined) {
		const q = query?.toLowerCase();
		renderResults(
			q
				? searchLinks.filter(
						(l) => l.label.toLowerCase().includes(q) || l.group.toLowerCase().includes(q),
					)
				: searchLinks,
		);
	}

	function openSearchDialog() {
		renderResults(searchLinks);
		if (!dialog) return;
		dialog.showModal();
		dialog.querySelector("input")?.focus();
	}

	dialog.addEventListener("click", (e) => {
		if (e.target === dialog) dialog.close();
	});

	document.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "k") {
			e.preventDefault();
			openSearchDialog();
		}
		if (e.key === "Escape") dialog.close();
	});

	trigger.addEventListener("click", () => {
		openSearchDialog();
	});

	input.addEventListener("input", (e) => {
		filterSearchResults((e.target as HTMLInputElement | null)?.value);
	});
}

function initMobileMenu() {
	const menuToggle = document.querySelector<HTMLButtonElement>("#header-menu-toggle");
	const sidebar = document.querySelector("aside");
	if (!menuToggle || !sidebar) return;

	menuToggle.addEventListener("click", () => {
		const isOpen = document.body.classList.toggle("drawer-open");
		menuToggle.setAttribute("aria-expanded", String(isOpen));
	});

	// close drawer when a nav link is tapped
	sidebar.addEventListener("click", (e) => {
		const target = e.target as Element | null;
		if (target?.closest("a") && document.body.classList.contains("drawer-open")) {
			document.body.classList.remove("drawer-open");
			menuToggle.setAttribute("aria-expanded", "false");
		}
	});

	// close on backdrop tap
	document.addEventListener("click", (e) => {
		const target = e.target as Element | null;
		if (
			document.body.classList.contains("drawer-open") &&
			!target?.closest("aside") &&
			!target?.closest("#header-menu-toggle")
		) {
			document.body.classList.remove("drawer-open");
			menuToggle.setAttribute("aria-expanded", "false");
		}
	});
}

document.addEventListener("DOMContentLoaded", () => {
	initNavLinks();
	initSearch();
	initMobileMenu();
	initSmoothScroll();
	initCopyButtons();
});
