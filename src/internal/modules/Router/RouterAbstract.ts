import { makeLogger } from "@/internal/global/LoggerClass";
import { CoreumError } from "@/internal/modules/CoreumError/CoreumError";
import type { CoreumErrorInterface } from "@/internal/modules/CoreumError/CoreumErrorInterface";
import { Route } from "@/internal/modules/Route/Route";
import type { RouterInterface } from "@/internal/modules/Router/RouterInterface";
import type { AnyRoute } from "@/internal/types/AnyRoute";
import { joinPathSegments } from "@/internal/utils/joinPathSegments";
import { patternIsEqual } from "@/internal/utils/patternIsEqual";
import { textIsDefined } from "@/internal/utils/textIsDefined";
import { textIsEqual } from "@/internal/utils/textIsEqual";
import { textSplit } from "@/internal/utils/textSplit";

export abstract class RouterAbstract implements RouterInterface {
	private readonly possibles: string[] = [];
	protected readonly logger = makeLogger("Router");
	abstract addRoute(route: AnyRoute): void;
	abstract getRoutes(): Array<AnyRoute>;
	abstract updateRoute(route: AnyRoute): void;

	getPossibleCollisions() {
		return this.possibles;
	}

	getControllerRoutes(controllerId: string): Array<AnyRoute> {
		return this.getRoutes().filter((r) => r.controllerId === controllerId);
	}

	protected addPossibleCollision(routePath: string) {
		const parts = textSplit("/", routePath);
		if (!this.possibles.includes(routePath)) {
			this.possibles.push(routePath);
			// console.log("adding", routePath);
		}

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!textIsDefined(part)) continue;
			const variation = [...parts];
			variation[i] = part.startsWith(":") ? part : `:${part}`;
			const possiblePath = joinPathSegments(...variation);
			if (this.possibles.includes(possiblePath)) continue;
			this.possibles.push(possiblePath);
			// console.log("adding", possiblePath);
		}
	}

	protected checkPossibleCollision(routePath: string, method: string) {
		for (const possible of this.possibles) {
			if (possible === routePath) continue;

			const similar = this.findRouteByPathname(possible, method);
			if (!(similar instanceof Route)) continue;
			if (similar.path === routePath) continue;
			if (!this.pathsCollide(routePath, similar.path)) continue;
			this.logger.warn(
				`${similar.path} has params that clash with ${routePath}. Initialize ${routePath} before ${similar.path} or consider using a different endpoint.`,
			);
		}

		// Also check if this route would cause collisions with existing routes
		const existingRoute = this.findRouteByPathname(routePath, method);
		if (existingRoute instanceof Route && existingRoute.path !== routePath) {
			this.logger.warn(
				`${routePath} clashes with existing route ${existingRoute.path}. Consider using a different endpoint.`,
			);
		}
	}

	protected pathsCollide(path1: string, path2: string): boolean {
		const parts1 = textSplit("/", path1);
		const parts2 = textSplit("/", path2);

		if (parts1.length !== parts2.length) return false;

		for (let i = 0; i < parts1.length; i++) {
			const part1 = parts1[i];
			const part2 = parts2[i];
			if (!textIsDefined(part1) || !textIsDefined(part2)) continue;

			if (!part1.startsWith(":") && !part2.startsWith(":") && part1 !== part2) {
				return false;
			}
		}

		return true;
	}

	protected isPatternMatch(route: AnyRoute, pathname: string): boolean {
		return patternIsEqual(pathname, route.pattern);
	}

	protected isMethodMatch(route: AnyRoute, method: string): boolean {
		return textIsEqual(method, route.method, "upper");
	}

	protected isPathMatch(route: AnyRoute, pathname: string): boolean {
		return textIsEqual(pathname, route.path, "lower");
	}

	protected findRouteByPathname(
		pathname: string,
		method: string,
	): AnyRoute | CoreumErrorInterface {
		const route = this.getRoutes().find((route) => {
			if (route.path.includes(":")) {
				return this.isPatternMatch(route, pathname);
			} else {
				return this.isPathMatch(route, pathname);
			}
		});

		if (route == undefined) {
			return CoreumError.notFound();
		}

		const methodMatch = this.isMethodMatch(route, method);

		if (!methodMatch) {
			return CoreumError.methodNotAllowed();
		}

		return route;
	}

	findRoute(url: string, method: string): AnyRoute {
		const pathname = new URL(url).pathname;
		const result = this.findRouteByPathname(pathname, method);
		if (result instanceof Error) {
			throw result;
		}
		return result;
	}
}
