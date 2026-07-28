import { $registryTesting, TC, type RouterAdapterInterface } from "../_modules";

export class RouterBenchmark {
	private readonly router: TC.Router;
	private readonly routes: TC.Route<any, any, any, any, any>[] = [];
	private requests: Array<{ request: Request; expectedId: string }> = [];

	private readonly usedStaticPaths = new Set<string>();
	private readonly usedDynamicShapes = new Set<string>(); // "GET:/static/*/static" - no param names, includes method

	constructor(private readonly adapter: RouterAdapterInterface) {
		this.router = new TC.Router(adapter);
		$registryTesting.router = this.router;
	}

	private rand(len = 6): string {
		return Math.random()
			.toString(36)
			.slice(2, 2 + len);
	}

	private buildStaticRoute() {
		const methods = [
			TC.Method.GET,
			TC.Method.POST,
			TC.Method.PUT,
			TC.Method.DELETE,
			TC.Method.PATCH,
		];
		let key: string;
		let path: string;
		let method: TC.Method;
		let methodIndex: number;
		do {
			method = methods[Math.floor(Math.random() * methods.length)] as TC.Method;
			methodIndex = methods.findIndex((m) => m === method);
			const depth = 2 + Math.floor(Math.random() * 3);
			path = "/" + Array.from({ length: depth }, () => this.rand()).join("/");
			key = `${method}:${path}`;
		} while (this.usedStaticPaths.has(key));
		this.usedStaticPaths.add(key);
		return [
			new TC.Route({ method, path }, () => ({ ok: true })),
			new TC.Route(
				{
					method: methods[methodIndex + 1] ?? methods[methodIndex - 1] ?? TC.Method.GET,
					path,
				},
				() => ({ ok: true }),
			),
		];
	}

	private buildDynamicRoute() {
		const methods = [
			TC.Method.GET,
			TC.Method.POST,
			TC.Method.PUT,
			TC.Method.DELETE,
			TC.Method.PATCH,
		];
		let shape: string;
		let path: string;
		let method: TC.Method;
		let methodIndex: number;
		do {
			method = methods[Math.floor(Math.random() * methods.length)] as TC.Method;
			methodIndex = methods.findIndex((m) => m === method);
			const depth = 2 + Math.floor(Math.random() * 3);
			const segments: string[] = [];
			const shapeSegs: string[] = [];
			let hasParam = false;
			for (let i = 0; i < depth; i++) {
				const isParam = Math.random() < 0.5 || (!hasParam && i === depth - 1);
				if (isParam) {
					segments.push(`:param${i}`); // deterministic name based on position
					shapeSegs.push("*");
					hasParam = true;
				} else {
					const seg = this.rand();
					segments.push(seg);
					shapeSegs.push(seg);
				}
			}
			path = "/" + segments.join("/");
			shape = `/${shapeSegs.join("/")}`;
		} while (this.usedDynamicShapes.has(shape));
		this.usedDynamicShapes.add(shape);
		return [
			new TC.Route({ method, path }, () => ({ ok: true })),
			new TC.Route(
				{
					method: methods[methodIndex + 1] ?? methods[methodIndex - 1] ?? TC.Method.GET,
					path,
				},
				() => ({ ok: true }),
			),
		];
	}

	setupTime = "";

	setup(staticCount = 150, dynamicCount = 150) {
		for (let i = 0; i < staticCount; i++) this.routes.push(...this.buildStaticRoute());
		for (let i = 0; i < dynamicCount; i++) this.routes.push(...this.buildDynamicRoute());

		const t0 = performance.now();
		for (const route of this.routes) this.router.add(route);
		this.setupTime = (performance.now() - t0).toFixed(2);

		for (const route of this.routes) {
			let url = route.endpoint.replace(/:([^/]+)/g, () => this.rand(8));
			this.requests.push({
				request: new Request(`http://localhost:4000${url}`, {
					method: route.method,
				}),
				expectedId: route.id,
			});
		}

		// shuffle
		for (let i = this.requests.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.requests[i], this.requests[j]] = [this.requests[j]!, this.requests[i]!];
		}
	}

	run(iterations = 100) {
		const times: number[] = [];
		let hits = 0;
		let correct = 0;

		for (let iter = 0; iter < iterations; iter++) {
			for (const { request, expectedId } of this.requests) {
				const t0 = performance.now();
				const result = this.router.find(request);
				times.push(performance.now() - t0);
				if (result) {
					hits++;
					if (result.route.id === expectedId) correct++;
				}
			}
		}

		const total = times.length;
		const sum = times.reduce((a, b) => a + b, 0);
		const avg = sum / total;
		const sorted = [...times].sort((a, b) => a - b);
		const p95 = sorted[Math.ceil(0.95 * total) - 1]!;
		const p99 = sorted[Math.ceil(0.99 * total) - 1]!;
		const rps = (total / (sum / 1000)).toFixed(0);

		return `-------------------------------------------------
${this.adapter.__brand} results: (${this.router.list().length} routes)
Setup Time: ${this.setupTime}
Lookups:    ${total.toLocaleString()}
Hit rate:   ${((hits / total) * 100).toFixed(2)}%
Accuracy:   ${((correct / hits) * 100).toFixed(2)}%
Avg:        ${avg.toFixed(4)}ms
Min:        ${sorted[0]!.toFixed(4)}ms
Max:        ${sorted[total - 1]!.toFixed(4)}ms
P95:        ${p95.toFixed(4)}ms
P99:        ${p99.toFixed(4)}ms
RPS:        ${rps}`;
	}
}
