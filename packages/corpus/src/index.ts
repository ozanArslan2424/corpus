import * as C from "./C";
import * as X from "./X";

export interface ContextDataInterface {}
export interface Env {}

export * from "./Registry";
export * from "./C";
export * from "./X";
export { C, C as Corpus, X, X as Extra };

// import * as CModule from "./C";
// import * as XModule from "./X";
//
// // 1. Export runtime values
// export const C = CModule;
// export const Corpus = CModule;
//
// export const X = XModule;
// export const Extra = XModule;
//
// // 2. Export type space via namespace interface merging
// export type C = typeof CModule;
// export type Corpus = typeof CModule;
//
// export type X = typeof XModule;
// export type Extra = typeof XModule;
