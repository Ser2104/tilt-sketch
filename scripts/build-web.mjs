import { cpSync, rmSync, mkdirSync } from "node:fs";

const out = "www";
const files = ["index.html", "manifest.webmanifest", "css", "js", "models", "icons", "vendor"];
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of files) cpSync(f, `${out}/${f}`, { recursive: true });
console.log(`Copied ${files.length} items to ${out}/`);
