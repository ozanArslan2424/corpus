import { HttpError } from "@/Error/HttpError";
import type { HttpRequest } from "@/Request/HttpRequest";
import type { AnyRoute } from "@/Route/types/AnyRoute";
import type { RouteRegistryData } from "@/Route/types/RouteRegistryData";
import { isRegexMatch } from "@/utils/isRegexMatch";
import { strIsEqual } from "@/utils/strIsEqual";

export class RouteRegistry {
	// endpoint -> RouteRegistryData
	private store = new Map<string, RouteRegistryData>();

	list(): Array<[string, string]> {
		return Array.from(this.store.values()).map((r) => [r.method, r.endpoint]);
	}

	add(r: AnyRoute): void {
		this.checkPossibleCollision(r);
		this.store.set(r.endpoint, {
			id: r.id,
			endpoint: r.endpoint,
			method: r.method,
			handler: r.handler,
			pattern: r.pattern,
		});
	}

	find(req: HttpRequest): RouteRegistryData {
		const reqPath = req.urlObject.pathname;
		const reqMethod = req.method;

		let route: RouteRegistryData | null = null;

		for (const [endpoint, data] of this.store.entries()) {
			// Check for pattern match for parameterized routes
			if (endpoint.includes(":")) {
				// Pattern match first
				if (isRegexMatch(reqPath, data.pattern)) {
					route = data;
					break;
				}

				// If pattern doesn't match check for missing last part param
				if (
					this.hasLastPartParam(endpoint) &&
					strIsEqual(
						endpoint.split("/").slice(0, -1).join("/"),
						reqPath,
						"lower",
					)
				) {
					route = data;
					break;
				}

				// Check for simple pathname match for static routes
			} else if (strIsEqual(endpoint, reqPath)) {
				// Found exact match
				route = data;
				break;
			}
		}

		if (route === null) {
			throw HttpError.notFound();
		}

		// The endpoint exists but the method is not allowed
		if (!strIsEqual(reqMethod, route.method, "upper")) {
			throw HttpError.methodNotAllowed();
		}

		return route;
	}

	private checkPossibleCollision(r: AnyRoute) {
		const existingById = this.store.get(r.id);
		if (existingById) {
			console.error(
				`⚠️  Collision: ${r.method} ${r.endpoint} clashes with ${existingById.method} ${existingById.endpoint}`,
			);
		}

		for (const existing of this.store.values()) {
			// Different methods can't clash
			if (existing.method !== r.method) continue;

			if (this.hasAnyParam(r.endpoint)) {
				// Has params, pattern shouldn't match existing
				if (isRegexMatch(r.endpoint, existing.pattern)) {
					console.error(
						`⚠️  Collision: ${r.method} ${r.endpoint} clashes with ${existing.method} ${existing.endpoint}`,
					);
				}

				// Param route vs static route with same base
				if (!this.hasAnyParam(existing.endpoint)) {
					if (
						strIsEqual(
							this.removeLastParam(r.endpoint),
							existing.endpoint,
							"lower",
						)
					) {
						console.error(
							`⚠️  Param route ${r.method} ${r.endpoint} may conflict with static ${existing.method} ${existing.endpoint}`,
						);
					}
				}
			} else {
				// No params, endpoint string shouldn't already exist
				if (strIsEqual(r.endpoint, existing.endpoint, "lower")) {
					console.error(
						`⚠️  Collision: ${r.method} ${r.endpoint} already exists`,
					);
				}

				// No params but existing has last part param
				if (this.hasLastPartParam(existing.endpoint)) {
					if (
						strIsEqual(
							this.removeLastParam(r.endpoint),
							this.removeLastParam(existing.endpoint),
							"lower",
						)
					) {
						console.error(
							`⚠️  Static route ${r.method} ${r.endpoint} may be shadowed by param route ${existing.method} ${existing.endpoint}`,
						);
					}
				}
			}
		}
	}

	private hasLastPartParam(endpoint: string): boolean {
		if (!this.hasAnyParam(endpoint)) return false;
		const parts = endpoint.split("/");
		return parts[parts.length - 1]?.startsWith(":") ?? false;
	}

	private removeLastParam(endpoint: string): string {
		return endpoint.split("/").slice(0, -1).join("/");
	}

	private hasAnyParam(endpoint: string): boolean {
		return endpoint.includes(":");
	}
}
