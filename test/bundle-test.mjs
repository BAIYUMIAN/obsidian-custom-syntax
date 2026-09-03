import { build } from "esbuild";
import path from "path";

const stubObsidian = path.resolve("test/shim.ts");
const stubCss = path.resolve("test/cssEditor-stub.ts");

await build({
	entryPoints: ["test/block.entry.ts"],
	bundle: true,
	format: "cjs",
	platform: "node",
	outfile: "test/block.bundle.cjs",
	plugins: [
		{
			name: "stub-obsidian",
			setup(b) {
				b.onResolve({ filter: /^obsidian$/ }, () => ({ path: stubObsidian }));
				b.onResolve({ filter: /^\.\/cssEditor$/ }, () => ({ path: stubCss }));
			},
		},
	],
});
console.log("bundled test/block.bundle.cjs");
