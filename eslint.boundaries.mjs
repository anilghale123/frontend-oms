// Architecture boundaries for OMS. Spread at the END of eslint.config.mjs.
//
// Each folder appears in exactly one no-restricted-imports block, because in flat config a
// later block would replace (not merge) an earlier block's options for the same file.
// The same holds for no-restricted-syntax: the styling block below is the only one.
//
// Tier 2 is three purpose folders (layout / data-display / feedback) rather than the design
// repo's single `patterns` folder, so it is matched with one brace glob. Sibling tier-2 imports
// are allowed: they share the same constraints, and the split creates real ones
// (`data-display/data-table` renders `feedback`'s empty and error states).

const rule = (message, group) => ({ group, message });

/** The three tier-2 folders, as a brace glob and as import-path patterns. */
const TIER2_FILES = "src/components/{layout,data-display,feedback}/**";
const TIER2_IMPORTS = [
	"@/components/layout",
	"@/components/layout/*",
	"@/components/data-display",
	"@/components/data-display/*",
	"@/components/feedback",
	"@/components/feedback/*",
];

const NO_MOCK = rule("UI goes through @/lib/api, never the mock directly.", [
	"@/lib/mock",
	"@/lib/mock/*",
]);
const NO_DEEP_FEATURE = rule(
	"Import other features only through their index.ts (@/features/<name>).",
	["@/features/*/*"],
);

const restrict = (files, patterns, ignores = []) => ({
	files,
	ignores,
	rules: { "no-restricted-imports": ["error", { patterns }] },
});

// Hex colors anywhere in a string. esquery regexes cannot contain backslashes, so no \b / \s / \[.
const HEX = "#[0-9a-fA-F]{3,8}([^0-9a-zA-Z_-]|$)";
// Tailwind arbitrary values (`w-[240px]`, `text-[13px]`) and arbitrary properties
// (`[grid-template-columns:...]`). State variants like `data-[state=open]:` are allowed.
const ARBITRARY =
	"(^|[ :])(?!data-|aria-|group-|peer-|has-|supports-)[a-z0-9-]*-[[]|(^| )[[][a-z-]+:";

const styling = [
	{ selector: `Literal[value=/${HEX}/]`, message: "No hex colors — use Radian tokens." },
	{
		selector: `TemplateElement[value.raw=/${HEX}/]`,
		message: "No hex colors — use Radian tokens.",
	},
	{
		selector: `Literal[value=/${ARBITRARY}/]`,
		message: "No Tailwind arbitrary values — use Radian tokens and the Tailwind scale.",
	},
	{
		selector: `TemplateElement[value.raw=/${ARBITRARY}/]`,
		message: "No Tailwind arbitrary values — use Radian tokens and the Tailwind scale.",
	},
];

const boundaries = [
	restrict(
		["src/lib/domain/**"],
		[
			rule("lib/domain must stay pure TypeScript and import only from lib/domain.", [
				"react",
				"react/*",
				"next",
				"next/*",
				"@/app/*",
				"@/features/*",
				"@/components/*",
				"@/providers/*",
				"@/config/*",
				"@/lib/api",
				"@/lib/api/*",
				"@/lib/mock",
				"@/lib/mock/*",
				"@/lib/utils",
				"@/lib/utils/*",
				"@/lib/nav",
				"@/lib/nav/*",
			]),
		],
	),

	restrict(
		["src/lib/api/**"],
		[
			rule("lib/api contains no React or UI code.", [
				"react",
				"react/*",
				"@/features/*",
				"@/components/*",
			]),
			NO_MOCK,
		],
	),

	// `lib/auth` holds the session shapes and the in-memory token fallback. Same constraints as
	// lib/api — it is read by the fetch client, by route handlers and by a provider, so React or
	// UI code here would be imported into all three.
	restrict(
		["src/lib/auth/**"],
		[
			rule("lib/auth contains no React or UI code.", [
				"react",
				"react/*",
				"@/features/*",
				"@/components/*",
				"@/providers/*",
			]),
			NO_MOCK,
		],
	),

	restrict(
		["src/components/ui/**"],
		[
			rule("components/ui holds Radian primitives only; they depend on nothing but lib/utils.", [
				...TIER2_IMPORTS,
				"@/features/*",
				"@/config/*",
				"@/providers/*",
				"@/lib/api",
				"@/lib/api/*",
				"@/lib/domain",
				"@/lib/domain/*",
			]),
			NO_MOCK,
		],
	),

	restrict(
		[TIER2_FILES],
		[
			rule("Tier 2 is domain-agnostic: build from components/ui and tokens, pass data via props.", [
				"@/features/*",
				"@/config/*",
				"@/providers/*",
				"@/lib/api",
				"@/lib/api/*",
				"@/lib/domain",
				"@/lib/domain/*",
			]),
			NO_MOCK,
		],
	),

	restrict(["src/features/**"], [NO_MOCK, NO_DEEP_FEATURE]),

	restrict(
		["src/app/**", "src/providers/**", "src/config/**", "src/lib/nav/**"],
		[NO_MOCK, NO_DEEP_FEATURE],
		["src/app/api/mock/**"],
	),

	{
		files: ["src/**/*.{ts,tsx}"],
		ignores: ["src/components/ui/**"],
		rules: { "no-restricted-syntax": ["error", ...styling] },
	},

	// The preserved spike (src/app/backup-orders) is frozen reference code for the later auth
	// phase, not maintained code: it predates this architecture and keeps its original patterns
	// (loose `any`, setState in effects). Linting it would mean either rewriting code whose whole
	// value is being unchanged, or leaving the build permanently red. See omsImplementationPlan.md
	// -> Step 0.
	{
		files: ["src/app/backup-orders/**"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/exhaustive-deps": "off",
		},
	},

	// Radian primitives are generated by the CLI and kept byte-identical to upstream.
	// Their upstream hook patterns trip the React Compiler lint rules; we don't fork them.
	{
		files: ["src/components/ui/**"],
		rules: {
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/purity": "off",
			"react-hooks/refs": "off",
			"react-hooks/exhaustive-deps": "off",
		},
	},
];

export default boundaries;
