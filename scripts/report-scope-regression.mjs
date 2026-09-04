import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const url = process.env.REPORT_SCOPE_TEST_URL || "http://localhost:3000";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (existsSync(systemChrome) ? systemChrome : undefined);

async function clickButtonMatching(page, labels) {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const label = await button.evaluate((element) => element.textContent?.trim() || "");
    if (labels.some((candidate) => label.includes(candidate))) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function scopeIdentity(page) {
  return page.$eval("[data-current-report-scope]", (element) => ({
    accountId: element.getAttribute("data-account-id"),
    campaignIds: element.getAttribute("data-campaign-ids"),
    since: element.getAttribute("data-since"),
    until: element.getAttribute("data-until"),
    compareMode: element.getAttribute("data-compare-mode"),
    comparisonCampaignIds: element.getAttribute("data-comparison-campaign-ids"),
    comparisonSince: element.getAttribute("data-comparison-since"),
    comparisonUntil: element.getAttribute("data-comparison-until"),
  }));
}

const browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage();
const browserProblems = [];
page.on("console", (message) => {
  if (message.type() === "error") browserProblems.push(message.text());
});
page.on("pageerror", (error) => browserProblems.push(error.message));

try {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

  if (!await page.$("[data-current-report-scope]")) {
    const openedSample = await clickButtonMatching(page, ["View a sample report", "Use sample report", "Xem báo cáo mẫu"]);
    assert.equal(openedSample, true, "Could not open the sample report");
  }

  await page.waitForSelector("[data-current-report-scope]", { timeout: 15_000 });
  const initialScope = await scopeIdentity(page);
  assert.ok(initialScope.accountId, "Current report does not expose its account identity");
  assert.ok(initialScope.campaignIds, "Current report does not expose exact campaign ids");

  await page.click("[data-edit-report-scope]");
  await page.waitForSelector("[data-report-scope-modal]", { timeout: 5_000 });
  const desktopLayout = await page.$eval("[data-report-scope-modal]", (element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
  });
  assert.ok(desktopLayout.left >= 0 && desktopLayout.right <= 1280, "Desktop scope modal overflows horizontally");
  assert.ok(desktopLayout.top >= 0 && desktopLayout.bottom <= 900, "Desktop scope modal overflows vertically");
  assert.ok(await page.$("[data-scope-preview]"), "Scope modal does not preview the exact refresh request");
  assert.ok(await page.$("[data-scope-apply]"), "Scope modal does not expose one clear apply-and-refresh action");

  const selectableCampaign = await page.$("[data-primary-campaign-id]");
  if (selectableCampaign) await selectableCampaign.click();
  assert.deepEqual(await scopeIdentity(page), initialScope, "Editing a draft mutated the visible report before apply");
  await page.click("[data-scope-cancel]");
  await page.waitForSelector("[data-report-scope-modal]", { hidden: true, timeout: 5_000 });
  assert.deepEqual(await scopeIdentity(page), initialScope, "Cancelling scope edits changed the visible report");

  const refreshButtons = await page.$$('[data-report-refresh="true"]');
  assert.ok(refreshButtons.length >= 2, "The report must expose refresh from both workspace and report contexts");
  for (const button of refreshButtons) {
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-report-refresh="true"][data-pending="true"]'), { timeout: 10_000 });
    assert.deepEqual(await scopeIdentity(page), initialScope, "Refresh changed the visible report scope");
  }

  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 });
  await page.click("[data-edit-report-scope]");
  await page.waitForSelector("[data-report-scope-modal]", { timeout: 5_000 });
  const mobileLayout = await page.$eval("[data-report-scope-modal]", (element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  assert.ok(mobileLayout.left >= 0 && mobileLayout.right <= 375, "Mobile scope modal overflows horizontally");
  assert.ok(mobileLayout.top >= 0 && mobileLayout.bottom <= 812, "Mobile scope modal overflows vertically");
  assert.equal(mobileLayout.documentWidth, 375, "Scope modal creates horizontal page overflow");

  assert.deepEqual(browserProblems, []);
  console.log("Report scope refresh and responsive modal regression checks passed.");
} finally {
  await browser.close();
}
