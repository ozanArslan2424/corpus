export type HtmlSkeleton = {
	title: string;
	lang: string;
	contents: string;

	charset?: string;
	viewport?: string;
	description?: string;
	keywords?: string[];
	author?: string;
	robots?: string;
	canonical?: string;

	// Links (stylesheet, icon, preconnect, etc.)
	links?: Array<{
		rel: string;
		href: string;
		type?: string;
		sizes?: string;
		media?: string;
		integrity?: string;
		crossorigin?: "anonymous" | "use-credentials" | "";
		referrerpolicy?: ReferrerPolicy;
		as?: string;
		hreflang?: string;
		title?: string;
	}>;

	// Meta tags
	metas?: Array<{
		name?: string;
		property?: string;
		content: string;
		httpEquiv?: string;
		charset?: string;
		media?: string;
		scheme?: string;
	}>;

	// Base tag
	base?: {
		href: string;
		target?: "_blank" | "_self" | "_parent" | "_top";
	};

	// Open Graph / Social Media
	og?: {
		title?: string;
		description?: string;
		image?: string;
		url?: string;
		type?: string;
		siteName?: string;
		locale?: string;
	};

	// Twitter Cards
	twitter?: {
		card?: "summary" | "summary_large_image" | "app" | "player";
		site?: string;
		creator?: string;
		title?: string;
		description?: string;
		image?: string;
		imageAlt?: string;
		player?: string;
		playerWidth?: number;
		playerHeight?: number;
		appId?: {
			iphone?: string;
			ipad?: string;
			googleplay?: string;
		};
	};

	// Favicons (various sizes)
	favicons?: Array<{
		rel: string;
		href: string;
		sizes?: string;
		type?: string;
		color?: string;
	}>;

	// Custom scripts to be placed in head
	scripts?: Array<{
		src?: string;
		content?: string;
		type?: string;
		async?: boolean;
		defer?: boolean;
		integrity?: string;
		crossorigin?: "anonymous" | "use-credentials" | "";
		referrerpolicy?: ReferrerPolicy;
		nomodule?: boolean;
	}>;

	// JSON-LD structured data
	jsonLd?: Array<Record<string, any>>;
};
