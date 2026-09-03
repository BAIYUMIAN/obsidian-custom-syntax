// jsdom-based verification of the block-level renderer (applyBlock).
// Run after bundling: node test/run-block.cjs
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const { window } = dom;
// Expose the DOM globals the renderer expects (present in Obsidian's browser env).
global.Node = window.Node;
global.NodeFilter = window.NodeFilter;

// Polyfill the Obsidian HTMLElement helpers used by applyBlock.
window.HTMLElement.prototype.setCssStyles = function (rec) {
	if (!rec) return;
	for (const k of Object.keys(rec)) {
		this.style.setProperty(k, rec[k]);
	}
};
window.HTMLElement.prototype.addClasses = function (classes) {
	const list = typeof classes === "string" ? classes.split(/\s+/) : classes;
	for (const c of list) if (c) this.classList.add(c);
};

const { applyRule, parseParams, blockRuleClasses } = require("./block.bundle.cjs");

let failures = 0;
function assert(cond, msg) {
	if (cond) {
		console.log("  PASS:", msg);
	} else {
		failures++;
		console.log("  FAIL:", msg);
	}
}

function makeRule(over) {
	return Object.assign(
		{
			id: "r1",
			name: "t",
			enabled: true,
			kind: "fenced",
			open: ":::",
			close: ":::",
			readType: true,
			captureParams: false,
			css: "",
			className: "",
		},
		over
	);
}

// Case A: separate <p> blocks (blank lines between markers).
console.log("Case A: separate <p> blocks");
{
	const doc = window.document;
	const c = doc.createElement("div");
	c.innerHTML = "<p>:::note</p><p>body text</p><p>:::</p>";
	doc.body.appendChild(c);
	applyRule(c.children[0], makeRule({ kind: "fenced", readType: true }));
	const block = c.querySelector(".cs-block");
	assert(!!block, "a .cs-block wrapper was created");
	assert(block && block.classList.contains("cs-fence-note"), "fenced type class cs-fence-note applied");
	assert(block && (block.textContent || "").includes("body text"), "content moved into the wrapper");
	assert(c.querySelectorAll("p").length === 0, "raw marker <p> elements removed");
}

// Case B: a single <p> joined by <br> (no blank lines).
console.log("Case B: single <p> with <br>");
{
	const doc = window.document;
	const c = doc.createElement("div");
	c.innerHTML = "<p>:::note<br>body line<br>:::</p>";
	doc.body.appendChild(c);
	applyRule(c.children[0], makeRule({ kind: "fenced", readType: true }));
	const block = c.querySelector(".cs-block");
	assert(!!block, "a .cs-block wrapper was created from merged <br> paragraph");
	assert(block && block.classList.contains("cs-fence-note"), "fenced type class applied");
	assert(block && (block.textContent || "").replace(/\s+/g, " ").includes("body line"), "content preserved");
}

// Case C: multiline block (++ ... ++) separate <p>.
console.log("Case C: multiline ++ blocks");
{
	const doc = window.document;
	const c = doc.createElement("div");
	c.innerHTML = "<p>++</p><p>multi<br>line</p><p>++</p>";
	doc.body.appendChild(c);
	applyRule(
		c.children[0],
		makeRule({ kind: "multiline", open: "++", close: "++", readType: false })
	);
	const block = c.querySelector(".cs-block");
	assert(!!block, "multiline .cs-block created");
	assert(block && (block.textContent || "").includes("multi") && (block.textContent || "").includes("line"), "multiline content preserved");
}

// Case D: capture params on a fenced opener line.
console.log("Case D: capture params {.class #id k=v}");
{
	const doc = window.document;
	const c = doc.createElement("div");
	c.innerHTML = '<p>:::note { .box #main color=red }</p><p>body</p><p>:::</p>';
	doc.body.appendChild(c);
	applyRule(
		c.children[0],
		makeRule({ kind: "fenced", readType: true, captureParams: true })
	);
	const block = c.querySelector(".cs-block");
	assert(!!block, "param block created");
	assert(block && block.classList.contains("box"), "param class .box applied");
	assert(block && block.id === "main", "param id #main applied");
	assert(block && block.style.color === "red", "param style color=red applied");
}

// parseParams unit checks.
console.log("parseParams unit");
{
	const p = parseParams("{ .a .b #id color=blue width=10px }");
	assert(p.classes.join(" ") === "a b", "classes parsed");
	assert(p.id === "id", "id parsed");
	assert(p.style.color === "blue" && p.style.width === "10px", "style parsed");
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
