import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function waitForLine(child, matcher, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for dev server output matching: ${matcher}`));
    }, timeoutMs);

    const onData = (data) => {
      const text = data.toString();
      if (matcher.test(text)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

async function main() {
  const url = process.env.URL || "http://localhost:5173/";
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const frontendDir = resolve(scriptDir, "..");

  const dev = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: frontendDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  dev.stdout.pipe(process.stdout);
  dev.stderr.pipe(process.stderr);

  try {
    await waitForLine(dev, /Local:\s+http:\/\/127\.0\.0\.1:5173\//);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    const consoleMessages = [];
    const pageErrors = [];
    page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const response = await page.goto(url, { waitUntil: "networkidle" });
    const title = await page.title();
    const content = await page.content();

    const root = await page.$("#root");
    const rootText = root ? await root.innerText() : "";

    console.log("\n=== CHECK UI RESULTS ===");
    console.log("URL:", url);
    console.log("HTTP:", response?.status(), response?.statusText());
    console.log("Title:", title);
    console.log("Root text (first 200 chars):", rootText.slice(0, 200));
    console.log("HTML length:", content.length);
    console.log("\n--- Console ---");
    console.log(consoleMessages.join("\n") || "(none)");
    console.log("\n--- Page Errors ---");
    console.log(pageErrors.join("\n") || "(none)");

    await browser.close();

    if (pageErrors.length) {
      process.exitCode = 1;
    }
  } finally {
    dev.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
