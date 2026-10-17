import { LOADING_MARKER } from "@/shared/constants";

interface State {
	executed: Set<string>;
	controller: AbortController | undefined;
}

function runScripts(root: Element, state: State) {
	for (const inert of root.querySelectorAll<HTMLScriptElement>("script[data-script]")) {
		const id = inert.dataset.script;
		if (id === undefined) continue;
		if (state.executed.has(id)) continue;
		state.executed.add(id);
		const script = document.createElement("script");
		script.type = "module";
		script.src = inert.src;
		document.body.append(script);
	}
}

/**
 * Moves the fragment's stylesheets into `<head>` (once per href) and resolves when they've loaded,
 * so swapped-in content is never shown unstyled.
 */
async function adoptStylesheets(fragment: DocumentFragment): Promise<void> {
	const loading: Array<Promise<unknown>> = [];

	for (const link of fragment.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
		link.remove();
		const href = link.getAttribute("href") ?? "";
		if (document.head.querySelector(`link[rel="stylesheet"][href="${CSS.escape(href)}"]`)) continue;

		loading.push(
			new Promise((resolve) => {
				link.addEventListener("load", resolve, { once: true });
				link.addEventListener("error", resolve, { once: true });
			}),
		);
		document.head.append(link);
	}

	await Promise.all(loading);
}

async function renderSlot(slot: Element, markup: string, state: State, signal: AbortSignal) {
	// template to get the document fragment
	const template = document.createElement("template");
	template.innerHTML = markup;
	// wait for slot-specific styles to load before rendering
	await adoptStylesheets(template.content);
	// A newer navigation started while the styles were loading; let it win.
	if (signal.aborted) return;
	// mount
	slot.replaceChildren(template.content);
	runScripts(slot, state);
}

function mountedLayouts() {
	return Array.from(document.querySelectorAll<HTMLElement>("[data-slot]"))
		.map((el) => el.dataset.slot)
		.join(",");
}

function executedScripts() {
	return new Set<string>(
		Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-script]"))
			.map((s) => s.dataset.script)
			.filter((s): s is string => s !== undefined),
	);
}

function markActive() {
	const path = location.pathname;
	for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-nav]")) {
		const href = a.getAttribute("href") ?? "";
		const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
		if (active) a.setAttribute("aria-current", "page");
		else a.removeAttribute("aria-current");
	}
}

async function navigate(url: string, push: boolean, state: State) {
	state.controller?.abort();
	const ctrl = new AbortController();
	state.controller = ctrl;
	document.documentElement.setAttribute("aria-busy", "true");

	try {
		const res = await fetch(url, {
			headers: { "X-Layouts": mountedLayouts() },
			signal: ctrl.signal,
		});
		const slotId = res.headers.get("X-Slot");
		const slot = slotId ? document.querySelector(`[data-slot="${slotId}"]`) : null;
		if (!slot) return location.assign(url);

		if (push) history.pushState(null, "", res.url);
		document.title = decodeURIComponent(res.headers.get("X-Title") ?? "");
		markActive();

		let scrolled = false;
		const swap = async (markup: string) => {
			await renderSlot(slot, markup, state, ctrl.signal);
			// Scroll once the new content is in place, not while the old content is still showing.
			if (push && !scrolled) {
				scrollTo(0, 0);
				scrolled = true;
			}
		};

		if (res.headers.has("X-Loading") && res.body) {
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let text = "";
			let loadingShown = false;
			// breaks in body
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				text += chunk.value;
				if (!loadingShown) {
					const i = text.indexOf(LOADING_MARKER);
					if (i === -1) continue;
					await swap(text.slice(0, i));
					text = text.slice(i + LOADING_MARKER.length);
					loadingShown = true;
				}
			}
			await swap(text);
		} else {
			await swap(await res.text());
		}
	} catch (err) {
		if (!(err instanceof DOMException && err.name === "AbortError")) location.assign(url);
	} finally {
		if (state.controller === ctrl) document.documentElement.removeAttribute("aria-busy");
	}
}

let initialized: boolean = false;

export function initializeClientRouter() {
	if (initialized) return;
	initialized = true;

	const state: State = {
		controller: undefined,
		/** Ids of `data-script` scripts that have already run in this document. */
		executed: executedScripts(),
	};

	document.addEventListener("click", (e) => {
		if (
			e.defaultPrevented ||
			e.button !== 0 ||
			e.metaKey ||
			e.ctrlKey ||
			e.shiftKey ||
			e.altKey ||
			!(e.target instanceof Element)
		) {
			return;
		}
		const a = e.target.closest<HTMLAnchorElement>("a[href]");
		if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
		if (a.hash && a.pathname === location.pathname && a.search === location.search) return;
		e.preventDefault();
		navigate(a.href, true, state);
	});

	addEventListener("popstate", () => navigate(location.href, false, state));
}
