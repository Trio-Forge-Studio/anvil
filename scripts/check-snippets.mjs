// Compiles the TypeScript examples in Markdown and MDX files against this package with rbxtsc. UI examples need the
// engine to run, so compiling them is the check. A block whose info string contains "nocheck" is skipped. A block
// with group=<name> in its info string compiles after the earlier blocks of that group in the same file, so a
// tutorial's steps can build on each other.
//
//   node scripts/check-snippets.mjs README.md ../../apps/docs/src/content/docs/anvil/*.mdx ../../apps/docs/src/content/docs/anvil/*/*.mdx

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2);
if (files.length === 0) {
	console.error("Usage: node scripts/check-snippets.mjs <markdown files...>");
	process.exit(2);
}

const FENCE = /^([ \t]*)```(\w+)([^\n]*)\n([\s\S]*?)\n\1```/gm;
const LANGUAGES = { ts: "ts", typescript: "ts", tsx: "tsx" };

function blocks(file) {
	const text = readFileSync(file, "utf8");
	const found = [];
	const groups = new Map();
	for (const match of text.matchAll(FENCE)) {
		const [, indent, lang, info, body] = match;
		const extension = LANGUAGES[lang];
		if (info.includes("nocheck") || !extension) continue;
		const line = text.slice(0, match.index).split("\n").length + 1;
		const code = body
			.split("\n")
			.map((row) => (row.startsWith(indent) ? row.slice(indent.length) : row))
			.join("\n");
		const group = /\bgroup=(\S+)/.exec(info)?.[1];
		const prefix = group ? (groups.get(group) ?? "") : "";
		if (group) groups.set(group, prefix + code + "\n");
		found.push({ file, line, code, prefix, extension: group ? "tsx" : extension });
	}
	return found;
}

const examples = files.flatMap(blocks);

// rbxtsc copies its whole root folder into the output, so the examples compile in a project of their own, beside a
// copy of the package's source.
const work = join(root, ".snippets");
const project = join(work, "project");
rmSync(work, { recursive: true, force: true });
mkdirSync(join(project, "examples"), { recursive: true });
cpSync(join(root, "src"), join(project, "src"), { recursive: true });
const byName = new Map();
examples.forEach((example, index) => {
	example.name = `${basename(example.file).replace(/\W/g, "-")}-${index}.${example.extension}`;
	byName.set(example.name, example);
	writeFileSync(join(project, "examples", example.name), example.prefix + example.code + "\n");
});
writeFileSync(
	join(project, "tsconfig.json"),
	JSON.stringify({
		extends: "../../tsconfig.json",
		compilerOptions: {
			rootDir: ".",
			outDir: "../out",
			declaration: false,
			tsBuildInfoFile: "../tsbuildinfo",
			baseUrl: ".",
			typeRoots: ["node_modules/@rbxts", "../../node_modules/@rbxts"],
			paths: { "@trioforge/anvil": ["./src/index.ts"] },
		},
		include: ["examples", "src"],
	}),
);

const where = (example, row = 1) => `${relative(process.cwd(), example.file)}:${example.line + row - 1}`;
const rbxtsc = join(root, "node_modules", "roblox-ts", "out", "CLI", "cli.js");
const compiled = spawnSync(process.execPath, [rbxtsc, "--type", "package", "-p", project], {
	cwd: root,
	encoding: "utf8",
});
const text = (compiled.stdout + compiled.stderr).replace(/\u001b\[[0-9;]*m/g, "");
for (const row of text.split(/\r?\n/).filter(Boolean)) {
	const match = /(?:^|[\/])([^\/:]+\.tsx?):(\d+):(\d+) - (.*)$/.exec(row);
	const example = match && byName.get(match[1]);
	if (example) {
		// A group's earlier blocks come first. Errors there are reported for those blocks.
		const offset = Number(match[2]) - (example.prefix.split("\n").length - 1);
		if (offset >= 1) console.log(`${where(example, offset)}:${match[3]} ${match[4]}`);
	} else if (match || /error/i.test(row)) {
		console.log(row);
	}
}

const passed = compiled.status === 0;
console.log(passed ? `${examples.length} examples compiled` : `${examples.length} examples, compile failed`);
process.exit(passed ? 0 : 1);
