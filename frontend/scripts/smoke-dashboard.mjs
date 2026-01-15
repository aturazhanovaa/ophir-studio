import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function waitForLine(child, matcher, timeoutMs = 30000) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for dev server output matching: ${matcher}`));
    }, timeoutMs);

    const onData = (data) => {
      const text = data.toString();
      if (matcher.test(text)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolvePromise();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

function json(body, status = 200) {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function main() {
  const url = process.env.URL || "http://localhost:5173/en/dashboard";
  const apiBase = process.env.API_BASE || "http://localhost:8000";

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
    const badResponses = [];

    page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) badResponses.push(`${status} ${res.url()}`);
    });

    await page.addInitScript(() => {
      localStorage.setItem("skh_token", "dev-token");
      localStorage.setItem("app_locale", "en");
      document.cookie = "APP_LOCALE=en; Path=/; Max-Age=31536000; SameSite=Lax";
    });

    await page.route(`${apiBase}/**`, async (route) => {
      const reqUrl = new URL(route.request().url());
      const path = reqUrl.pathname;

      if (path === "/auth/me") {
        return route.fulfill(
          json({ id: 1, email: "dev@example.com", full_name: "Dev User", is_admin: true, role: "SUPER_ADMIN" })
        );
      }
      if (path === "/areas") return route.fulfill(json([]));
      if (path === "/areas/me") return route.fulfill(json([]));
      if (path === "/areas/catalog") return route.fulfill(json([]));
      if (path.startsWith("/documents")) return route.fulfill(json([]));
      if (path.startsWith("/analytics")) return route.fulfill(json({}));
      if (path === "/kb/areas") return route.fulfill(json([]));
      if (path === "/kb/collections") return route.fulfill(json([]));
      if (path === "/kb/content") return route.fulfill(json([]));
      if (path.startsWith("/kb/content/")) return route.fulfill(json({ id: 1, area_id: 1, title: "", body: "", status: "DRAFT", language: "en", created_at: "", updated_at: "", tags: [] }));
      if (path === "/tags/categories") return route.fulfill(json([]));
      if (path === "/tags") return route.fulfill(json([]));
      if (path.startsWith("/admin")) return route.fulfill(json([]));
      if (path.startsWith("/access-requests")) return route.fulfill(json([]));
      if (path.startsWith("/copilot/ask")) return route.fulfill(json({ answer: "", matches: [], sources: [], accuracy_level: "LOW", answer_tone: "TECHNICAL" }));
      if (path.startsWith("/playground")) return route.fulfill(json({}));

      return route.fulfill(json({}));
    });

    await page.goto(url, { waitUntil: "networkidle" });
    const rootText = (await page.$("#root")) ? await (await page.$("#root")).innerText() : "";
    const pageContainer = await page.$(".pageContainer");
    const pageText = pageContainer ? await pageContainer.innerText() : "";

    console.log("\n=== SMOKE DASHBOARD RESULTS ===");
    console.log("URL:", url);
    console.log("Root text (first 200 chars):", rootText.slice(0, 200));
    console.log("Page text (first 200 chars):", pageText.slice(0, 200));
    console.log("\n--- Bad Responses (>=400) ---");
    console.log(badResponses.join("\n") || "(none)");
    console.log("\n--- Console ---");
    console.log(consoleMessages.join("\n") || "(none)");
    console.log("\n--- Page Errors ---");
    console.log(pageErrors.join("\n") || "(none)");

    await browser.close();

    if (pageErrors.length) process.exitCode = 1;
  } finally {
    dev.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
