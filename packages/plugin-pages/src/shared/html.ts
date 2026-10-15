import { Stringer, tag, type Tag } from "@/shared/Stringer";

export class Html extends Stringer {}

export type HtmlStringer = Tag<Html>;

export const html = tag(Html, (value) =>
	value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`),
);
