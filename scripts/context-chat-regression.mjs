import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const url = process.env.CHAT_TEST_URL || "http://localhost:3000";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (existsSync(systemChrome) ? systemChrome : undefined);
const expectedAvailable = process.env.CHAT_EXPECT_AVAILABLE;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function longestDurationMs(value) {
  return Math.max(...value.split(",").map((duration) => {
    const trimmed = duration.trim();
    return Number.parseFloat(trimmed) * (trimmed.endsWith("ms") ? 1 : 1_000);
  }));
}

async function clickButtonWithText(page, text) {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const label = await button.evaluate((element) => element.textContent?.trim() || "");
    if (label === text) {
      await button.click();
      return;
    }
  }
  throw new Error(`Button not found: ${text}`);
}

async function openAssistant(page) {
  await page.waitForSelector('[data-context-chat-trigger="true"]', { timeout: 15_000 });
  await page.click('[data-context-chat-trigger="true"]');
  await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 5_000 });
  await delay(90);
  const openingLayers = await page.evaluate(() => {
    const shell = document.querySelector(".context-chat-morph-shell");
    const surface = document.querySelector(".context-chat-panel-surface");
    const panel = document.querySelector(".context-chat-panel");
    const trigger = document.querySelector('[data-context-chat-trigger="true"]');
    const shellRect = shell.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    return {
      shellOpacity: Number.parseFloat(getComputedStyle(shell).opacity),
      surfaceOpacity: Number.parseFloat(getComputedStyle(surface).opacity),
      panelOpacity: Number.parseFloat(getComputedStyle(panel).opacity),
      shellWidth: shellRect.width,
      triggerWidth: triggerRect.width,
    };
  });
  if (openingLayers.shellWidth > openingLayers.triggerWidth * 1.5) {
    assert.ok(openingLayers.shellOpacity < 0.15, "Opening morph exposes a distorted capsule shell");
  }
  assert.ok(
    Math.max(openingLayers.surfaceOpacity, openingLayers.panelOpacity) >= 0.25,
    "Opening morph has a transparent dead zone between the pill and panel",
  );
  await delay(270);
}

async function closeAssistant(page) {
  await page.click('[data-slot="context-chat"] button[aria-label="Close"]');
  await page.waitForSelector('[data-slot="dialog-content"]', { hidden: true, timeout: 5_000 });
}

async function sendQuestion(page, question) {
  await page.focus('[data-slot="context-chat"] textarea');
  await page.keyboard.type(question, { delay: 8 });
  await page.waitForSelector('[data-slot="context-chat"] button[aria-label="Send"]:not([disabled])');
  await page.click('[data-slot="context-chat"] button[aria-label="Send"]:not([disabled])');
}

async function clearConversation(page) {
  await page.click('[data-slot="context-chat"] button[aria-label="Clear conversation"]');
  await page.waitForFunction(() => {
    const textarea = document.querySelector('[data-slot="context-chat"] textarea');
    const cancel = document.querySelector('[data-slot="context-chat"] button[aria-label="Cancel"]');
    return textarea?.value === "" && !cancel;
  });
  await delay(30);
}

async function measureDialogLayout(page) {
  return page.evaluate(() => {
    const rect = document.querySelector('[data-slot="dialog-content"]')?.getBoundingClientRect();
    const controls = [...document.querySelectorAll('[data-slot="context-chat"] button, [data-slot="context-chat"] textarea')]
      .map((element) => element.getBoundingClientRect())
      .map((bounds) => ({ width: bounds.width, height: bounds.height }));
    return {
      rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
      controls,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

function assertDialogLayout(state, width, height, label) {
  assert.ok(state.rect && state.rect.left >= 0 && state.rect.right <= width, `${label} dialog overflows horizontally`);
  assert.ok(state.rect.top >= 0 && state.rect.bottom <= height, `${label} dialog overflows vertically`);
  assert.equal(state.scrollWidth, state.clientWidth, `${label} page has horizontal overflow`);
  for (const control of state.controls) {
    assert.ok(control.height >= 43.5 && control.width >= 43.5, `${label} control is ${control.width}x${control.height}`);
  }
}

const browser = await puppeteer.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage();
const browserProblems = [];

page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warn") {
    browserProblems.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));

await page.setRequestInterception(true);
page.on("request", (request) => {
  if (request.url().endsWith("/api/ai/chat") && request.method() === "POST") {
    const body = JSON.parse(request.postData() || "{}");
    const question = body.messages?.at(-1)?.content || "unknown";
    const responseDelay = /slow|clear|cancel|delayed/.test(question) ? 650 : 80;
    setTimeout(() => {
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: body.requestId,
          contextFingerprint: body.contextFingerprint,
          reply: `Reply: ${question}`,
        }),
      }).catch(() => {});
    }, responseDelay);
    return;
  }
  void request.continue().catch(() => {});
});

try {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector('[data-context-chat-trigger="true"]', { timeout: 15_000 });

  const triggerSize = await page.$eval('[data-context-chat-trigger="true"]', (element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert.ok(triggerSize.height >= 44, `Assistant trigger is ${triggerSize.height}px tall`);

  await openAssistant(page);
  const initialState = await page.evaluate(() => {
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    const rect = dialog?.getBoundingClientRect();
    const controls = [...document.querySelectorAll('[data-slot="context-chat"] button, [data-slot="context-chat"] textarea')]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
    return {
      rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
      controls,
      activeTag: document.activeElement?.tagName,
      activePlaceholder: document.activeElement?.getAttribute("placeholder"),
      hasTextarea: Boolean(document.querySelector('[data-slot="context-chat"] textarea')),
      shellTransition: getComputedStyle(document.querySelector(".context-chat-morph-shell")).transitionProperty,
      originY: getComputedStyle(document.querySelector(".context-chat-morph-shell")).getPropertyValue("--chat-origin-y"),
    };
  });

  assert.ok(initialState.rect, "Dialog did not render");
  assert.ok(initialState.rect.left >= 0 && initialState.rect.top >= 0, "Dialog starts outside the viewport");
  assert.ok(initialState.rect.right <= 1280 && initialState.rect.bottom <= 900, "Dialog ends outside the viewport");
  assert.ok(!initialState.shellTransition.includes("width") && !initialState.shellTransition.includes("height"), "Morph animates layout dimensions");
  assert.ok(initialState.originY.trim(), "Morph origin was not captured from the trigger");
  if (expectedAvailable !== undefined) {
    assert.equal(initialState.hasTextarea, expectedAvailable === "true", "Server availability did not match the requested test mode");
  }
  for (const control of initialState.controls) {
    assert.ok(control.height >= 43.5 && control.width >= 43.5, `Control is ${control.width}x${control.height}`);
  }

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab");
    await delay(20);
    const focusInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      return Boolean(dialog?.contains(document.activeElement));
    });
    assert.equal(focusInsideDialog, true, "Tab focus escaped the dialog");
  }

  if (!initialState.hasTextarea) {
    await closeAssistant(page);
    assert.deepEqual(browserProblems, []);
    console.log("Context chat unavailable-state regression checks passed.");
    process.exitCode = 0;
  } else {
    assert.equal(initialState.activeTag, "TEXTAREA");
    assert.ok(initialState.activePlaceholder, "Composer did not receive initial focus");

    await page.click('[data-slot="context-chat"] button[aria-label="Close"]');
    await delay(60);
    const exitState = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      return { exists: Boolean(dialog), ending: dialog?.hasAttribute("data-ending-style") };
    });
    assert.deepEqual(exitState, { exists: true, ending: true }, "Dialog did not retain its exit morph frame");
    await page.waitForSelector('[data-slot="dialog-content"]', { hidden: true, timeout: 5_000 });
    const restoredToTrigger = await page.evaluate(() => document.activeElement?.matches('[data-context-chat-trigger="true"]'));
    assert.equal(restoredToTrigger, true, "Focus did not return to the assistant trigger");

    const openingBackdropOpacity = await page.evaluate(async () => {
      document.querySelector('[data-context-chat-trigger="true"]').click();
      await new Promise(requestAnimationFrame);
      const overlay = document.querySelector('[data-slot="dialog-overlay"]');
      return Number.parseFloat(getComputedStyle(overlay).opacity);
    });
    assert.ok(openingBackdropOpacity < 1, "Backdrop appears at full opacity on the first frame");
    await delay(360);

    await page.click('[data-slot="context-chat"] button[aria-label="Close"]');
    await delay(60);
    await page.evaluate(() => document.querySelector('[data-context-chat-trigger="true"]').click());
    await delay(80);
    const interruptedState = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      return { exists: Boolean(dialog), ending: dialog?.hasAttribute("data-ending-style"), open: dialog?.hasAttribute("data-open") };
    });
    assert.deepEqual(interruptedState, { exists: true, ending: false, open: true }, "Rapid close/reopen left the dialog in an ending state");

    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-slot="dialog-content"]', { hidden: true, timeout: 5_000 });
    await openAssistant(page);

    await sendQuestion(page, "cancel-request");
    await page.waitForSelector('[data-slot="context-chat"] button[aria-label="Cancel"]');
    await page.click('[data-slot="context-chat"] button[aria-label="Cancel"]');
    await page.waitForFunction(() => document.querySelector('[data-slot="context-chat"]')?.textContent?.includes("Request stopped."));
    const cancelIsNeutral = await page.evaluate(() => {
      const message = [...document.querySelectorAll(".context-chat-message")]
        .find((element) => element.textContent?.includes("Request stopped."));
      return Boolean(message && !message.querySelector(".text-destructive"));
    });
    assert.equal(cancelIsNeutral, true, "Cancelled request is styled as an error");

    await clearConversation(page);
    await sendQuestion(page, "clear-request");
    await page.waitForSelector('[data-slot="context-chat"] button[aria-label="Clear conversation"]');
    await clearConversation(page);
    await delay(800);
    const afterClear = await page.$eval('[data-slot="context-chat"]', (element) => element.textContent || "");
    assert.ok(!afterClear.includes("clear-request"), "Clear left the pending user message visible");
    assert.ok(!afterClear.includes("Request stopped."), "Clear produced a cancellation notice");
    assert.ok(!afterClear.includes("Reply: clear-request"), "Late cleared response was appended");

    await sendQuestion(page, "slow-old-request");
    await page.waitForSelector('[data-slot="context-chat"] button[aria-label="Clear conversation"]');
    await clearConversation(page);
    await sendQuestion(page, "fast-new-request");
    await page.waitForFunction(() => document.querySelector('[data-slot="context-chat"]')?.textContent?.includes("Reply: fast-new-request"));
    await delay(700);
    const afterRace = await page.$eval('[data-slot="context-chat"]', (element) => element.textContent || "");
    assert.ok(afterRace.includes("Reply: fast-new-request"), "Newest response was not preserved");
    assert.ok(!afterRace.includes("Reply: slow-old-request"), "Older response overwrote the new request state");

    await clearConversation(page);
    await sendQuestion(page, "overview-delayed-request");
    await closeAssistant(page);
    await clickButtonWithText(page, "Competitor evidence");
    await page.waitForSelector('[data-context-chat-trigger="true"]', { timeout: 15_000 });
    await delay(750);
    await openAssistant(page);
    const competitorText = await page.$eval('[data-slot="context-chat"]', (element) => element.textContent || "");
    assert.ok(!competitorText.includes("overview-delayed-request"), "Overview thread leaked into competitor context");
    assert.ok(!competitorText.includes("Reply: overview-delayed-request"), "Overview response leaked into competitor context");
    assert.ok(!competitorText.includes("Assistant response ready."), "Overview completion announcement leaked into competitor context");

    await closeAssistant(page);
    await clickButtonWithText(page, "Overview");
    await page.waitForSelector('[data-context-chat-trigger="true"]', { timeout: 15_000 });
    await openAssistant(page);
    const overviewText = await page.$eval('[data-slot="context-chat"]', (element) => element.textContent || "");
    assert.ok(overviewText.includes("Reply: overview-delayed-request"), "Originating thread lost its valid response");

    await closeAssistant(page);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const reducedMotionState = await page.evaluate(async () => {
      document.querySelector('[data-context-chat-trigger="true"]').click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const shell = document.querySelector(".context-chat-morph-shell");
      const panel = document.querySelector(".context-chat-panel");
      return {
        shellDuration: getComputedStyle(shell).transitionDuration,
        panelDuration: getComputedStyle(panel).transitionDuration,
        panelOpacity: getComputedStyle(panel).opacity,
      };
    });
    assert.ok(longestDurationMs(reducedMotionState.shellDuration) <= 1, "Reduced motion keeps a long shell transition");
    assert.ok(longestDurationMs(reducedMotionState.panelDuration) <= 1, "Reduced motion keeps a long content transition");
    assert.equal(reducedMotionState.panelOpacity, "1", "Reduced motion leaves content hidden");
    await closeAssistant(page);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);

    await clickButtonWithText(page, "Competitor evidence");
    await page.waitForSelector(".context-chat-dock-trigger", { timeout: 15_000 });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await delay(120);
    const integratedTrigger = await page.$eval(".context-chat-dock-trigger", (element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    assert.ok(integratedTrigger.width >= 43.5 && integratedTrigger.height >= 43.5, `Integrated mobile trigger is ${integratedTrigger.width}x${integratedTrigger.height}`);
    await openAssistant(page);
    const mobileState = await measureDialogLayout(page);
    assertDialogLayout(mobileState, 390, 844, "Mobile");

    const responsiveViewports = [
      { width: 375, height: 667, label: "Small mobile" },
      { width: 768, height: 1024, label: "Tablet portrait" },
      { width: 1024, height: 768, label: "Tablet landscape" },
    ];
    for (const viewport of responsiveViewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await delay(120);
      assertDialogLayout(await measureDialogLayout(page), viewport.width, viewport.height, viewport.label);
    }

    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await delay(120);
    const landscapeState = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      const scroller = document.querySelector(".context-chat-scroll");
      const emptyState = document.querySelector(".context-chat-empty-state");
      const rect = dialog.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const emptyRect = emptyState.getBoundingClientRect();
      return {
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        scrollerRect: { top: scrollerRect.top, bottom: scrollerRect.bottom },
        emptyRect: { top: emptyRect.top, bottom: emptyRect.bottom },
      };
    });
    assert.ok(landscapeState.rect.left >= 0 && landscapeState.rect.right <= 844, "Landscape dialog overflows horizontally");
    assert.ok(landscapeState.rect.top >= 0 && landscapeState.rect.bottom <= 390, "Landscape dialog overflows vertically");
    assert.ok(
      landscapeState.emptyRect.top >= landscapeState.scrollerRect.top
        && landscapeState.emptyRect.bottom <= landscapeState.scrollerRect.bottom,
      "Landscape empty state is clipped behind the composer",
    );

    const expectedCloseOrigin = await page.evaluate(() => {
      const popup = document.querySelector('[data-slot="dialog-content"]');
      const trigger = document.querySelector('[data-context-chat-trigger="true"]');
      const popupRect = popup.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      return {
        x: triggerRect.left + triggerRect.width / 2 - (popupRect.left + popupRect.width / 2),
        y: triggerRect.top + triggerRect.height / 2 - (popupRect.top + popupRect.height / 2),
        scaleX: Math.max(0.04, triggerRect.width / popupRect.width),
        scaleY: Math.max(0.04, triggerRect.height / popupRect.height),
      };
    });
    await page.click('[data-slot="context-chat"] button[aria-label="Close"]');
    await page.waitForSelector('[data-slot="dialog-content"][data-ending-style]', { timeout: 2_000 });
    await delay(180);
    const closingLayers = await page.evaluate(() => {
      const shell = document.querySelector(".context-chat-morph-shell");
      const surface = document.querySelector(".context-chat-panel-surface");
      const overlay = document.querySelector('[data-slot="dialog-overlay"]');
      const trigger = document.querySelector('[data-context-chat-trigger="true"]');
      const shellRect = shell.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      return {
        shellOpacity: Number.parseFloat(getComputedStyle(shell).opacity),
        surfaceOpacity: Number.parseFloat(getComputedStyle(surface).opacity),
        overlayOpacity: Number.parseFloat(getComputedStyle(overlay).opacity),
        shellWidth: shellRect.width,
        triggerWidth: triggerRect.width,
      };
    });
    if (closingLayers.shellWidth > closingLayers.triggerWidth * 1.5) {
      assert.ok(closingLayers.shellOpacity < 0.1, "Closing morph exposes a distorted capsule shell");
    }
    assert.ok(closingLayers.surfaceOpacity > 0.4, "Closing panel surface disappears before the pill shell is ready");
    assert.ok(closingLayers.overlayOpacity > 0.1, "Closing backdrop disappears before the reverse morph completes");
    const endingMotion = await page.evaluate(() => {
      const popup = document.querySelector('[data-slot="dialog-content"]');
      const shell = document.querySelector(".context-chat-morph-shell");
      const popupRect = popup.getBoundingClientRect();
      const styles = getComputedStyle(shell);
      return {
        x: Number.parseFloat(styles.getPropertyValue("--chat-origin-x")),
        y: Number.parseFloat(styles.getPropertyValue("--chat-origin-y")),
        scaleX: Number.parseFloat(styles.getPropertyValue("--chat-origin-scale-x")),
        scaleY: Number.parseFloat(styles.getPropertyValue("--chat-origin-scale-y")),
        radius: Number.parseFloat(styles.borderTopLeftRadius),
        minimumCapsuleRadius: Math.min(popupRect.width, popupRect.height) / 2,
      };
    });
    assert.ok(Math.abs(endingMotion.x - expectedCloseOrigin.x) <= 1, "Closing morph uses a stale horizontal pill origin");
    assert.ok(Math.abs(endingMotion.y - expectedCloseOrigin.y) <= 1, "Closing morph uses a stale vertical pill origin");
    assert.ok(Math.abs(endingMotion.scaleX - expectedCloseOrigin.scaleX) <= 0.005, "Closing morph uses a stale pill width");
    assert.ok(Math.abs(endingMotion.scaleY - expectedCloseOrigin.scaleY) <= 0.005, "Closing morph uses a stale pill height");
    assert.ok(endingMotion.radius >= endingMotion.minimumCapsuleRadius, "Collapsed morph shell is not capsule-shaped");
    await page.waitForSelector('[data-slot="dialog-content"]', { hidden: true, timeout: 5_000 });

    assert.deepEqual(browserProblems, []);
    console.log("Context chat full regression checks passed.");
  }
} finally {
  await browser.close();
}
