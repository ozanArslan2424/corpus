import type { CssValue } from "@/CSS/types/CssValue";
import type { NestedCssProperties } from "@/CSS/types/NestedCssProperties";

export interface CssProperties {
	// Layout
	display?: string;
	position?: string;
	top?: CssValue;
	right?: CssValue;
	bottom?: CssValue;
	left?: CssValue;
	zIndex?: number;

	// Box Model
	width?: CssValue;
	height?: CssValue;
	minWidth?: CssValue;
	maxWidth?: CssValue;
	minHeight?: CssValue;
	maxHeight?: CssValue;
	margin?: CssValue;
	marginTop?: CssValue;
	marginRight?: CssValue;
	marginBottom?: CssValue;
	marginLeft?: CssValue;
	padding?: CssValue;
	paddingTop?: CssValue;
	paddingRight?: CssValue;
	paddingBottom?: CssValue;
	paddingLeft?: CssValue;

	// Typography
	color?: string;
	fontFamily?: string;
	fontSize?: CssValue;
	fontWeight?: string | number;
	lineHeight?: CssValue;
	textAlign?: string;
	textDecoration?: string;
	textTransform?: string;
	letterSpacing?: CssValue;
	wordSpacing?: CssValue;
	whiteSpace?: string;

	// Background & Borders
	background?: string;
	backgroundColor?: string;
	backgroundImage?: string;
	backgroundSize?: string;
	backgroundPosition?: string;
	backgroundRepeat?: string;
	border?: string;
	borderTop?: string;
	borderRight?: string;
	borderBottom?: string;
	borderLeft?: string;
	borderColor?: string;
	borderWidth?: CssValue;
	borderStyle?: string;
	borderRadius?: CssValue;

	// Flexbox
	flex?: CssValue;
	flexDirection?: string;
	flexWrap?: string;
	flexFlow?: string;
	justifyContent?: string;
	alignItems?: string;
	alignContent?: string;
	alignSelf?: string;
	flexGrow?: number;
	flexShrink?: number;
	flexBasis?: CssValue;
	gap?: CssValue;
	rowGap?: CssValue;
	columnGap?: CssValue;

	// Grid
	grid?: string;
	gridTemplate?: string;
	gridTemplateColumns?: string;
	gridTemplateRows?: string;
	gridTemplateAreas?: string;
	gridColumn?: string;
	gridRow?: string;
	gridArea?: string;
	gridAutoColumns?: string;
	gridAutoRows?: string;
	gridAutoFlow?: string;

	// Effects
	opacity?: number;
	transform?: string;
	transformOrigin?: string;
	transition?: string;
	transitionProperty?: string;
	transitionDuration?: string;
	transitionTimingFunction?: string;
	transitionDelay?: string;
	animation?: string;
	animationName?: string;
	animationDuration?: string;
	animationTimingFunction?: string;
	animationDelay?: string;
	animationIterationCount?: string | number;
	animationDirection?: string;
	animationFillMode?: string;
	animationPlayState?: string;
	boxShadow?: string;
	textShadow?: string;

	// Position
	float?: string;
	clear?: string;
	overflow?: string;
	overflowX?: string;
	overflowY?: string;
	clip?: string;
	visibility?: string;

	// Other common properties
	cursor?: string;
	userSelect?: string;
	pointerEvents?: string;
	boxSizing?: string;
	listStyle?: string;
	outline?: string;
	outlineColor?: string;
	outlineStyle?: string;
	outlineWidth?: CssValue;

	// Allow any other CSS property
	[key: string]: CssValue | NestedCssProperties | undefined;
}
