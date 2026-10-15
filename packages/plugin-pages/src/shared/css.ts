import { Stringer, tag } from "@/shared/Stringer";

export class Css extends Stringer {}

// keep interpolated values from closing a <style> element if the stylesheet is ever inlined
export const css = tag(Css, (value) => value.replace(/<\//g, "<\\/"));
