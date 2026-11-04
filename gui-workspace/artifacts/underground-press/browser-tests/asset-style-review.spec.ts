import 
{

 chromium, expect, test, type Locator, type Page 
}

 from '@playwright/test'
;


import 
{

 mkdtemp, rm 
}

 from 'node:fs/promises'
;


import 
{

 createServer 
}

 from 'node:http'
;


import os from 'node:os'
;


import path from 'node:path'
;

import { DatabaseSync } from 'node:sqlite';

import { firefox } from '@playwright/test';


const sourceUrl = 'https://images.example.test/archive/cover.webp?edition=4'
;


const historicalSourceUrl = 'https://images.example.test/archive/historical-cover.webp?edition=3'
;

const historicalSvgSourceUrl =
  'https://images.example.test/archive/historical-cover.svg?edition=3#svgView(viewBox(0,0,1,1))';
const historicalSvgRequestUrl = historicalSvgSourceUrl.slice(0, historicalSvgSourceUrl.indexOf('#'));


const frontPageSourceUrl = 'https://images.example.test/archive/front-page.webp?edition=6'
;


const savedArtworkUrl = '/api/storage/private/saved-cover.png'
;

const historicalPageOneArtworkUrl = '/api/storage/private/historical-page-one.png';


const historicalArtworkUrl = '/api/storage/private/historical-reference.png'
;

const historicalGoldenArtworkUrl = '/api/storage/private/historical-golden.png'
;
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK5kAAAAASUVORK5CYII=',
  'base64',
)
;


const tabStopSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'
;

function seedFirefox400PercentPageZoom(profileDirectory: string) {
  const database = new DatabaseSync(path.join(profileDirectory, 'content-prefs.sqlite'));
  try {
    database.exec(`
      CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE settings (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE prefs (
        id INTEGER PRIMARY KEY,
        groupID INTEGER REFERENCES groups(id),
        settingID INTEGER NOT NULL REFERENCES settings(id),
        value BLOB,
        timestamp INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX groups_idx ON groups(name);
      CREATE INDEX settings_idx ON settings(name);
      CREATE INDEX prefs_idx ON prefs(timestamp, groupID, settingID);
      PRAGMA user_version = 6;
    `);
    database.prepare('INSERT INTO groups (id, name) VALUES (1, ?)').run('127.0.0.1');
    database.prepare('INSERT INTO settings (id, name) VALUES (1, ?)').run('browser.content.full-zoom');
    database.prepare('INSERT INTO prefs (id, groupID, settingID, value) VALUES (1, 1, 1, ?)').run(4);
  } finally {
    database.close();
  }
}


async function routeNormalImages(page: Page) 
{


  await page.route('**/*', async (route) => 
{


    const url = new URL(route.request().url())
;


    if (url.pathname === savedArtworkUrl || url.pathname === historicalArtworkUrl) 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


      await route.continue()
;


}

 else if (url.hostname === 'images.example.test') 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else 
{


      await route.abort()
;


}


}

)
;


}


async function expectLoadedImage(image: Locator) 
{


  await expect.poll(() => image.evaluate(
    (element: HTMLImageElement) => element.complete && element.naturalWidth === 1,
  )).toBe(true)
;


}


async function expectHideAnnouncementDoesNotRepeatWhenGoldenImageChanges(page: Page) 
{


  const announcement = page.getByRole('status').filter(
{

 hasText: 'Page 1 preview hidden.' 
}

)
;


  await expect(announcement).toHaveCount(1)
;


  await expect(announcement).toHaveAttribute('aria-live', 'polite')
;


  await expect(announcement).toHaveAttribute('aria-atomic', 'true')
;


  const originalAnnouncement = await announcement.elementHandle()
;


  if (!originalAnnouncement) throw new Error('Page 1 hide announcement was not rendered')
;


  await announcement.evaluate((element) => 
{


    const observable = element as HTMLElement & 
{


      __announcementMutationCount?: number
;


      __announcementObserver?: MutationObserver
;


}

;


    observable.__announcementMutationCount = 0
;


    observable.__announcementObserver = new MutationObserver((mutations) => 
{


      observable.__announcementMutationCount =
        (observable.__announcementMutationCount ?? 0) + mutations.length
;


}

)
;


    observable.__announcementObserver.observe(element, 
{


      childList: true,
      characterData: true,
      subtree: true,
    
}

)
;


}

)
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  await expectLoadedImage(page.getByTestId('img-comparison-reference-golden_image'))
;


  await expect(announcement).toHaveText('Page 1 preview hidden.')
;


  const sameAnnouncementNode = await announcement.evaluate(
    (element, original) => element === original,
    originalAnnouncement,
  )
;


  expect(sameAnnouncementNode).toBe(true)
;


  const mutationCount = await announcement.evaluate(async (element) => 
{


    await new Promise<void>((resolve) => 
{


      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
;


}

)
;


    const observable = element as HTMLElement & 
{


      __announcementMutationCount?: number
;


      __announcementObserver?: MutationObserver
;


}

;


    observable.__announcementObserver?.disconnect()
;


    return observable.__announcementMutationCount ?? 0
;


}

)
;


  await originalAnnouncement.dispose()
;


  expect(mutationCount).toBe(0)
;


}


async function focusByTab(page: Page, testId: string, direction: 'Tab' | 'Shift+Tab' = 'Tab') 
{


  const stops = page.getByRole('dialog').locator(tabStopSelector)
;


  const target = page.getByTestId(testId)
;


  const index = await target.evaluate((element, selector) => 
{


    const all = Array.from(element.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>(selector) ?? [])
;


    return all.indexOf(element as HTMLElement)
;


}

, tabStopSelector)
;


  expect(index).toBeGreaterThanOrEqual(0)
;


  await stops.nth(direction === 'Tab' ? index - 1 : index + 1).focus()
;


  await page.keyboard.press(direction)
;


  await expect(target).toBeFocused()
;


  return target
;


}


async function expectTabAdvancesFrom(page: Page, active: Locator) 
{


  const index = await active.evaluate((element, selector) => 
{


    const all = Array.from(element.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>(selector) ?? [])
;


    return all.indexOf(element as HTMLElement)
;


}

, tabStopSelector)
;


  expect(index).toBeGreaterThanOrEqual(0)
;


  const nextStop = page.getByRole('dialog').locator(tabStopSelector).nth(index + 1)
;


  await expect(nextStop).toHaveCount(1)
;


  await page.keyboard.press('Tab')
;


  await expect(nextStop).toBeFocused()
;


}


async function expectVisibleKeyboardFocus(button: Locator) 
{


  const outline = await button.evaluate((element) => 
{


    const style = getComputedStyle(element)
;


    return {
      color: style.outlineColor,
      offset: Number.parseFloat(style.outlineOffset),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    
}

;


}

)
;


  expect(outline).toEqual(
{


    color: 'rgb(214, 160, 33)',
    offset: 2,
    style: 'solid',
    width: 3,
  
}

)
;


}


async function expectKeyboardFocusWithinViewport(button: Locator) 
{


  const bounds = await button.evaluate((element) => 
{


    const rect = element.getBoundingClientRect()
;


    const outline = getComputedStyle(element)
;


    const focusRingExtent = Number.parseFloat(outline.outlineWidth) + Number.parseFloat(outline.outlineOffset)
;


    const viewport = window.visualViewport
;


    return {


      bottom: rect.bottom + focusRingExtent,
      left: rect.left - focusRingExtent,
      right: rect.right + focusRingExtent,
      top: rect.top - focusRingExtent,
      viewportBottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
      viewportLeft: viewport?.offsetLeft ?? 0,
      viewportRight: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
      viewportTop: viewport?.offsetTop ?? 0,
    
}

;


}

)
;


  expect(bounds.left).toBeGreaterThanOrEqual(bounds.viewportLeft)
;


  expect(bounds.top).toBeGreaterThanOrEqual(bounds.viewportTop)
;


  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportRight)
;


  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportBottom)
;


}


async function expectVisibleForcedColorsFocus(button: Locator) 
{


  const focusIndicator = await button.evaluate((element) => 
{


    const style = getComputedStyle(element)
;


    let surface = element as HTMLElement
;


    let backgroundColor = style.backgroundColor
;


    while (
      surface.parentElement &&
      (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)')
    ) 
{


      surface = surface.parentElement
;


      backgroundColor = getComputedStyle(surface).backgroundColor
;


}


    const colorProbe = document.createElement('span')
;


    colorProbe.style.color = 'Highlight'
;


    document.body.append(colorProbe)
;


    const systemHighlight = getComputedStyle(colorProbe).color
;


    colorProbe.remove()
;


    return {


      backgroundColor,
      color: style.outlineColor,
      offset: Number.parseFloat(style.outlineOffset),
      style: style.outlineStyle,
      systemHighlight,
      width: Number.parseFloat(style.outlineWidth),
    
}

;


}

)
;


  expect(focusIndicator.style).toBe('solid')
;


  expect(focusIndicator.width).toBeGreaterThanOrEqual(3)
;


  expect(focusIndicator.offset).toBeGreaterThanOrEqual(2)
;


  expect(focusIndicator.color).toBe(focusIndicator.systemHighlight)
;


  expect(focusIndicator.color).not.toBe(focusIndicator.backgroundColor)
;


}


async function expectForcedColorsFocusPainted(button: Locator, screenshotScale?: number)
{


  const box = await button.boundingBox()
;


  expect(box).not.toBeNull()
;


  if (!box) return
;


  const page = button.page()
;


  const testId = await button.getAttribute('data-testid')
;


  expect(testId).not.toBeNull()
;


  if (!testId) return
;


  const style = await button.evaluate((element) => 
{


    const computed = getComputedStyle(element)
;


    return {


      offset: Number.parseFloat(computed.outlineOffset),
      width: Number.parseFloat(computed.outlineWidth),
    
}

;


}

)
;


  const hiddenOutline = await page.addStyleTag(
{


    content: `[data-testid="${testId}"]:focus-visible { outline: none !important; }`,
  
}

)
;


  let withoutOutline: Buffer
;


  try 
{


    withoutOutline = await page.screenshot(
{

 scale: 'css', animations: 'disabled' 
}

)
;


}

 finally 
{


    await hiddenOutline.evaluate((element) => element.remove())
;


}


  const withOutline = await page.screenshot(
{

 scale: 'css', animations: 'disabled' 
}

)
;

  const paintedEdges = await page.evaluate(async (
{

 baselineData, focusedData, box, style, screenshotScale
}

) => 
{


    const readPixels = async (imageData: string) => 
{


      const image = new Image()
;


      image.src = imageData
;


      await image.decode()
;


      const canvas = document.createElement('canvas')
;


      canvas.width = image.naturalWidth
;


      canvas.height = image.naturalHeight
;


      const context = canvas.getContext('2d')
;


      if (!context) throw new Error('Unable to inspect the preview focus screenshot')
;


      context.drawImage(image, 0, 0)
;


      return {

 pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width 
}

;


}

;


    const [baseline, focused] = await Promise.all([readPixels(baselineData), readPixels(focusedData)])
;


    if (baseline.width !== focused.width || baseline.pixels.length !== focused.pixels.length) 
{


      throw new Error('Preview focus screenshots have different dimensions')
;


}


    const screenshotHeight = baseline.pixels.length / baseline.width / 4
;


    // Chromium screenshots remain in device pixels at browser zoom; DOM boxes are CSS pixels.
    const scaleX = screenshotScale ?? baseline.width / window.innerWidth
;


    const scaleY = screenshotScale ?? screenshotHeight / window.innerHeight
;


    const x = box.x * scaleX
;


    const y = box.y * scaleY
;


    const width = box.width * scaleX
;


    const height = box.height * scaleY
;


    const changed = (pixelX: number, pixelY: number) => 
{


      const index = (pixelY * baseline.width + pixelX) * 4
;


      return [0, 1, 2].some((channel) => Math.abs(
        baseline.pixels[index + channel] - focused.pixels[index + channel],
      ) > 16)
;


}

;


    const countBand = (xStart: number, xEnd: number, yStart: number, yEnd: number) => 
{


      let matches = 0
;


      for (let pixelY = Math.max(0, Math.floor(yStart))
;

 pixelY < Math.min(
        Math.ceil(yEnd),
        baseline.pixels.length / baseline.width / 4,
      )
;

 pixelY += 1) 
{


        for (let pixelX = Math.max(0, Math.floor(xStart))
;

 pixelX < Math.min(
          Math.ceil(xEnd),
          baseline.width,
        )
;

 pixelX += 1) 
{


          if (changed(pixelX, pixelY)) matches += 1
;


}


}


      return matches
;


}

;


    const insetX = Math.min(8, box.width / 4, box.height / 4) * scaleX
;


    const insetY = Math.min(8, box.width / 4, box.height / 4) * scaleY
;


    const ringInnerX = style.offset * scaleX
;


    const ringInnerY = style.offset * scaleY
;


    const ringOuterX = (style.offset + style.width) * scaleX
;


    const ringOuterY = (style.offset + style.width) * scaleY
;


    return {
      bottom: countBand(x + insetX, x + width - insetX, y + height + ringInnerY, y + height + ringOuterY),
      left: countBand(x - ringOuterX, x - ringInnerX, y + insetY, y + height - insetY),
      right: countBand(x + width + ringInnerX, x + width + ringOuterX, y + insetY, y + height - insetY),
      top: countBand(x + insetX, x + width - insetX, y - ringOuterY, y - ringInnerY),
    
}

;


}

, 
{


    baselineData: `data:image/png;base64,${withoutOutline!.toString('base64')}`,
    focusedData: `data:image/png;base64,${withOutline.toString('base64')}`,
    box,
    style,
    screenshotScale,
  
}

)
;

  for (const [edge, pixels] of Object.entries(paintedEdges)) 
{

    expect(pixels, `${testId} focus outline should paint its ${edge} edge`).toBeGreaterThan(0)
;


}


}


test('keeps keyboard focus inside the open style checklist in both tab directions', async (
{

 page 
}

) => 
{


  await page.goto('/browser-tests/fixture.html?focusTest=1')
;


  const opener = page.getByTestId('button-open-style-checklist')
;


  await opener.click()
;


  const dialog = page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)
;


  const closeButton = page.getByTestId('button-close-dialog')
;


  await expect(dialog).toBeVisible()
;


  await expect(closeButton).toBeFocused()
;


  const lastStopIsFocused = () => dialog.evaluate((element, selector) => 
{


    const stops = Array.from(element.querySelectorAll<HTMLElement>(selector))
;


    return document.activeElement === stops[stops.length - 1]
;


}

, tabStopSelector)
;


  await page.keyboard.press('Shift+Tab')
;


  await expect.poll(lastStopIsFocused).toBe(true)
;


  await page.keyboard.press('Tab')
;


  await expect(closeButton).toBeFocused()
;


}

)
;


test('Escape returns focus to the style checklist opener', async (
{

 page 
}

) => 
{


  await page.goto('/browser-tests/fixture.html?focusTest=1')
;


  const opener = page.getByTestId('button-open-style-checklist')
;


  await opener.click()
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  await page.keyboard.press('Escape')
;


  await expect(page.getByRole('dialog')).toHaveCount(0)
;


  await expect(opener).toBeFocused()
;


}

)
;

test('keeps the open style checklist within the viewport around its narrow-screen cutoff', async ({ page }) => {
  await page.setViewportSize({ width: 101, height: 240 });
  await page.goto('/browser-tests/fixture.html?focusTest=1');
  await page.getByTestId('button-open-style-checklist').click();
  const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
  await expect(dialog).toBeVisible();

  for (const width of [99, 100, 101]) {
    await page.setViewportSize({ width, height: 240 });
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      if (!dialog) throw new Error('The style checklist dialog is missing');
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, textarea'));
      return {
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        dialogLeft: dialog.getBoundingClientRect().left,
        dialogRight: dialog.getBoundingClientRect().right,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
        overflowingElements: Array.from(dialog.querySelectorAll<HTMLElement>('*'))
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: element.className,
              text: element.textContent?.trim().slice(0, 80),
              left: bounds.left,
              right: bounds.right,
              width: element.clientWidth,
              scrollWidth: element.scrollWidth,
            };
          })
          .filter((element) => element.right > window.innerWidth || element.scrollWidth > element.width),
        controlsWithinViewport: controls.every((control) => {
          const bounds = control.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= window.innerWidth;
        }),
      };
    });

    expect(layout.viewportWidth).toBe(width);
    expect(layout.pageWidth, JSON.stringify(layout.overflowingElements)).toBeLessThanOrEqual(width);
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(0);
    expect(layout.dialogRight).toBeLessThanOrEqual(width);
    expect(layout.dialogScrollWidth).toBeLessThanOrEqual(layout.dialogClientWidth);
    expect(layout.controlsWithinViewport).toBe(true);
  }

  await page.getByLabel('Reviewer name').fill('Browser tester');
  await page.getByLabel('Notes').fill('Checked at narrow viewport widths.');
  await page.getByTestId('check-style-ack').check();
  await expect(page.getByTestId('button-style-fail')).toBeEnabled();
  await expect(page.getByTestId('button-style-pass')).toBeVisible();
  await focusByTab(page, 'button-style-fail');
});


test('Cancel and backdrop dismissal return focus to the style checklist opener', async (
{

 page 
}

) => 
{


  await page.goto('/browser-tests/fixture.html?focusTest=1')
;


  const opener = page.getByTestId('button-open-style-checklist')
;


  await opener.click()
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  await page.getByRole('button', 
{

 name: 'Cancel' 
}

).dispatchEvent('click')
;


  await expect(page.getByRole('dialog')).toHaveCount(0)
;


  await expect(opener).toBeFocused()
;


  await opener.click()
;


  await page.getByTestId('dialog-backdrop').dispatchEvent('mousedown')
;


  await expect(page.getByRole('dialog')).toHaveCount(0)
;


  await expect(opener).toBeFocused()
;


}

)
;


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} loads only the selected current external reference`, async (
{

 page 
}

) => 
{


    await routeNormalImages(page)
;


    await page.goto('/browser-tests/fixture.html')
;


    const load = page.getByTestId('button-load-reference-preview-golden_image')
;


    const request = page.waitForRequest((candidate) => candidate.url() === sourceUrl)
;


    await load.focus()
;


    await page.keyboard.press(key)
;


    await request
;


    const current = page.getByTestId('img-comparison-reference-golden_image')
;


    await expect(current).toHaveAttribute('src', sourceUrl)
;


    await expectLoadedImage(current)
;


    await expect(page.getByTestId('img-comparison-historical-reference-golden_image')).toHaveCount(0)
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} loads only the selected historical external reference`, async (
{

 page 
}

) => 
{


    await routeNormalImages(page)
;


    await page.goto('/browser-tests/fixture.html')
;


    const load = page.getByTestId('button-load-historical-reference-preview-golden_image')
;


    const request = page.waitForRequest((candidate) => candidate.url() === historicalSourceUrl)
;


    await load.focus()
;


    await page.keyboard.press(key)
;


    await request
;


    const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    await expect(historical).toHaveAttribute('src', historicalSourceUrl)
;


    await expectLoadedImage(historical)
;


    await expect(page.getByTestId('comparison-historical-reference-golden_image'))
      .toContainText('Previous golden_image · v1 · saved predecessor')
;


    await expect(page.getByTestId('img-comparison-reference-golden_image')).toHaveCount(0)
;


}

)
;


}


test('a failed external historical preview focuses Retry and recovers without changing current artwork', async (
{

 page 
}

) => 
{


  let historicalRequests = 0
;
  let releaseFailedRetry: (() => void) | undefined;
  let releaseSuccessfulRetry: (() => void) | undefined;
  let notifyFailedRetryStarted: (() => void) | undefined;
  let notifySuccessfulRetryStarted: (() => void) | undefined;
  const failedRetryResponse = new Promise<void>((resolve) => {
    releaseFailedRetry = resolve;
  });
  const successfulRetryResponse = new Promise<void>((resolve) => {
    releaseSuccessfulRetry = resolve;
  });
  const failedRetryStarted = new Promise<void>((resolve) => {
    notifyFailedRetryStarted = resolve;
  });
  const successfulRetryStarted = new Promise<void>((resolve) => {
    notifySuccessfulRetryStarted = resolve;
  });


  await page.route('**/*', async (route) => 
{


    const url = new URL(route.request().url())
;


    if (url.href === historicalSourceUrl) 
{


      historicalRequests += 1
;

      if (historicalRequests === 1)
{


        await route.abort()
;


        return
;


}

      if (historicalRequests === 2) {
        notifyFailedRetryStarted?.();
        await failedRetryResponse;
        await route.abort();
        return;
      }

      if (historicalRequests === 3) {
        notifySuccessfulRetryStarted?.();
        await successfulRetryResponse;
      }

      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


      return
;


}


    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


      await route.continue()
;


      return
;


}


    if (url.hostname === 'images.example.test') 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


      return
;


}


    await route.abort()
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const currentRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  await currentRequest
;


  const current = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(current)
;


  const historicalLoad = page.getByTestId('button-load-historical-reference-preview-golden_image')
;


  const failedRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl)
;


  await historicalLoad.click()
;


  await failedRequest
;


  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image')).toBeVisible()
;


  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image')
;

  const retryAnnouncement = page.getByTestId(
    'img-comparison-historical-reference-golden_image-retry-failed',
  )
;


  await focusByTab(page, 'button-retry-historical-reference-preview-golden_image')
;


  await expectVisibleKeyboardFocus(retry)
;

  const failedRetryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl)
;


  await page.keyboard.press('Enter')
;

  await failedRetryStarted
;

  await failedRetryRequest
;

  await expect(page.getByTestId('img-comparison-historical-reference-golden_image-loading')).toBeVisible()
;

  await expect(retryAnnouncement).toHaveText('')
;

  const failedRetry = page.waitForEvent('requestfailed', (request) => request.url() === historicalSourceUrl)
;

  releaseFailedRetry?.();

  await failedRetry
;


  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image')).toBeVisible()
;

  await expect(retryAnnouncement)
    .toHaveText('Historical Golden Image preview retry failed. The preview is still unavailable.')
;

  await expect(retryAnnouncement).toHaveAttribute('role', 'status')
;

  await expect(retryAnnouncement).toHaveAttribute('aria-live', 'polite')
;


  const retryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl)
;


  await page.keyboard.press('Enter')
;


  await retryRequest
;

  await successfulRetryStarted
;

  await expect(page.getByTestId('img-comparison-historical-reference-golden_image-loading')).toBeVisible()
;

  await expect(retryAnnouncement).toHaveText('')
;

  releaseSuccessfulRetry?.();

  const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image')
;


  await expectLoadedImage(historicalImage)
;

  await expect(retryAnnouncement)
    .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.')
;

  await expect(retryAnnouncement).toHaveAttribute('role', 'status')
;

  await expect(retryAnnouncement).toHaveAttribute('aria-live', 'polite')
;


  await expectLoadedImage(current)
;


  expect(historicalRequests).toBe(3)
;


  await expect(retry).toHaveCount(0)
;


}

)
;

test('historical SVG preview with a fragment recovers on keyboard retry without changing current artwork', async ({ page }) => {
  let historicalRequests = 0;

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.href === sourceUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    if (url.href === historicalSvgRequestUrl) {
      historicalRequests += 1;
      if (historicalRequests < 3) {
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#34503f"/></svg>',
      });
      return;
    }

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    await route.abort();
  });

  await page.goto('/browser-tests/fixture.html?historicalSvg=1');

  const currentRequest = page.waitForRequest((request) => request.url() === sourceUrl);
  await page.getByTestId('button-load-reference-preview-golden_image').click();
  await currentRequest;

  const current = page.getByTestId('img-comparison-reference-golden_image');
  await expectLoadedImage(current);
  const currentArtworkUrl = await current.getAttribute('src');
  expect(currentArtworkUrl).toBe(sourceUrl);

  const historical = page.getByTestId('button-load-historical-reference-preview-golden_image');
  const initialFailure = page.waitForRequest((request) => request.url() === historicalSvgRequestUrl);
  await historical.click();
  await initialFailure;
  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image')).toBeVisible();

  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
  const firstRetry = page.waitForRequest((request) => request.url() === historicalSvgRequestUrl);
  const firstRetryFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === historicalSvgRequestUrl,
  );
  await retry.click();
  await firstRetry;
  await firstRetryFailure;
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();

  await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
  await expectVisibleKeyboardFocus(retry);
  const keyboardRetry = page.waitForRequest((request) => request.url() === historicalSvgRequestUrl);
  await page.keyboard.press('Enter');
  await keyboardRetry;

  const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
  await expect.poll(() => historicalImage.evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
  await expect(historicalImage).toHaveAttribute('src', historicalSvgSourceUrl);
  await expectLoadedImage(current);
  await expect(current).toHaveAttribute('src', currentArtworkUrl!);
  expect(historicalRequests).toBe(3);
});


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} retries a failed saved historical preview`, async (
{

 page 
}

) => 
{


    let attempts = 0
;


    let releaseSuccessfulRetry: (() => void) | undefined
;


    let notifySuccessfulRetryStarted: (() => void) | undefined
;


    const successfulRetryResponse = new Promise<void>((resolve) => 
{


      releaseSuccessfulRetry = resolve
;


}

)
;


    const successfulRetryStarted = new Promise<void>((resolve) => 
{


      notifySuccessfulRetryStarted = resolve
;


}

)
;


    await page.route('**/*', async (route) => 
{


      const url = new URL(route.request().url())
;


      if (url.pathname === savedArtworkUrl) 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else if (url.pathname === historicalArtworkUrl && ++attempts < 3) 
{


        await route.fulfill(
{

 status: 503, contentType: 'text/plain', body: 'Temporary storage error' 
}

)
;


}

 else if (url.pathname === historicalArtworkUrl) 
{


        notifySuccessfulRetryStarted?.()
;


        await successfulRetryResponse
;


        await route.fulfill(
{


          status: 200,
          contentType: 'image/png',
          headers: 
{

 'cache-control': 'no-store' 
}

,
          body: onePixelPng,
        
}

)
;


}

 else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


        await route.continue()
;


}

 else if (url.hostname === 'images.example.test') 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else 
{


        await route.abort()
;


}


}

)
;


    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1')
;


    const saved = page.getByTestId('img-comparison-saved-artwork-browser-test-asset')
;


    await expectLoadedImage(saved)
;


    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage')
;


    await expect(page.getByTestId('comparison-historical-reference-golden_image'))
      .toContainText('Previous golden_image · v1 · saved predecessor')
;


    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image')
;


    const retrySuccessAnnouncement = page.getByTestId(
      'notice-historical-reference-retry-success-golden_image',
    )
;


    await expect(retry).toBeVisible()
;


    const retryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    )
;


    await retry.focus()
;


    await page.keyboard.press(key)
;


    await retryRequest
;


    await expect(retry).toBeEnabled()
;


    await expect(retrySuccessAnnouncement).toHaveText('')
;


    expect(attempts).toBe(2)
;


    const successfulRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    )
;


    await retry.click()
;


    await Promise.all([successfulRetryStarted, successfulRequest])
;


    await expect(retrySuccessAnnouncement).toHaveText('')
;


    const retryLoadingAnnouncement = page.getByTestId(
      'img-comparison-historical-reference-golden_image-loading',
    )
;


    await expect(retryLoadingAnnouncement).toHaveAttribute('role', 'status')
;


    await expect(retryLoadingAnnouncement).toHaveAttribute('aria-live', 'polite')
;


    await expect(retryLoadingAnnouncement)
      .toHaveText('Loading historical Golden Image preview: Previous golden_image, version 1.')
;


    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0)
;


    releaseSuccessfulRetry?.()
;


    await expectLoadedImage(historicalImage)
;


    await expect(retryLoadingAnnouncement).toHaveText('')
;


    await expect(retrySuccessAnnouncement)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.')
;


    await expect(saved).toHaveAttribute('src', savedArtworkUrl)
;


    await expect(retry).toHaveCount(0)
;


    expect(attempts).toBe(3)
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} retries a failed Page 1 preview without disturbing Golden Image`, async (
{

 page 
}

) => 
{


    let pageOneAttempts = 0
;


    let beginRecovery!: () => void
;


    let finishRecovery!: () => void
;


    const recoveryStarted = new Promise<void>((resolve) => 
{

 beginRecovery = resolve
;

 
}

)
;


    const recoveryResponse = new Promise<void>((resolve) => 
{

 finishRecovery = resolve
;

 
}

)
;


    await page.route('**/*', async (route) => 
{


      const url = new URL(route.request().url())
;


      if (url.href === sourceUrl) 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else if (url.href === frontPageSourceUrl) 
{


        pageOneAttempts += 1
;


        if (pageOneAttempts === 1) 
{


          await route.abort()
;


}

 else 
{


          beginRecovery()
;


          await recoveryResponse
;


          await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}


}

 else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


        await route.continue()
;


}

 else 
{


        await route.abort()
;


}


}

)
;


    await page.goto('/browser-tests/fixture.html')
;


    const goldenLoad = page.getByTestId('button-load-reference-preview-golden_image')
;


    const goldenRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


    await goldenLoad.click()
;


    await goldenRequest
;


    const goldenImage = page.getByTestId('img-comparison-reference-golden_image')
;


    await expectLoadedImage(goldenImage)
;


    const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


    const firstPageOneRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await pageOneLoad.focus()
;


    await page.keyboard.press('Enter')
;


    await firstPageOneRequest
;


    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible()
;


    await expect(goldenImage).toBeVisible()
;


    const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


    await focusByTab(page, 'button-retry-reference-preview-front_page')
;


    await expect(retry).toBeFocused()
;


    await expectVisibleKeyboardFocus(retry)
;


    const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await page.keyboard.press(key)
;


    await retryRequest
;


    await recoveryStarted
;


    try 
{


      await expect(goldenImage).toBeVisible()
;


      const goldenHide = page.getByTestId('button-hide-reference-preview-golden_image')
;


      await goldenHide.focus()
;


      await expect(goldenHide).toBeFocused()
;


}

 finally 
{


      finishRecovery()
;


}


    await expectLoadedImage(page.getByTestId('img-comparison-reference-front_page'))
;


    await expectLoadedImage(goldenImage)
;


    await expect(goldenImage).toBeVisible()
;


    await expect(retry).toHaveCount(0)
;


    await expect(page.getByTestId('button-hide-reference-preview-golden_image')).toBeFocused()
;


    expect(pageOneAttempts).toBe(2)
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} can hide a slow current preview and retain artwork details`, async (
{

 page 
}

) => 
{


    let release!: () => void
;


    let notifyStarted!: () => void
;


    const started = new Promise<void>((resolve) => 
{

 notifyStarted = resolve
;

 
}

)
;


    const pending = new Promise<void>((resolve) => 
{

 release = resolve
;

 
}

)
;


    await page.clock.install()
;


    await page.route(sourceUrl, async (route) => 
{


      notifyStarted()
;


      await pending
;


      try 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 catch 
{


        // Hiding the preview removes the pending image element.
      
}


}

)
;


    await page.route(`**${savedArtworkUrl}`, async (route) => 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

)
;


    try 
{


      await page.goto('/browser-tests/fixture.html')
;


      await page.getByTestId('button-load-reference-preview-golden_image').click()
;


      await started
;


      await page.clock.fastForward(8_000)
;


      await expect(page.getByTestId('img-comparison-reference-golden_image-slow')).toBeVisible()
;


      await page.getByTestId('button-hide-reference-preview-golden_image').focus()
;


      await page.keyboard.press(key)
;


      await expect(page.getByTestId('img-comparison-reference-golden_image')).toHaveCount(0)
;


      await expect(page.getByTestId('img-comparison-saved-artwork-browser-test-asset')).toBeVisible()
;


      await expect(page.getByTestId('comparison-current-reference-golden_image'))
        .toContainText('Current golden_image · v2')
;


}

 finally 
{


      release()
;


}


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} hides only Page 1 and keeps the Golden Image preview visible`, async (
{

 page 
}

) => 
{


    await page.setViewportSize(
{

 width: 320, height: 568 
}

)
;


    await routeNormalImages(page)
;


    await page.goto('/browser-tests/fixture.html')
;


    await page.getByTestId('button-load-reference-preview-golden_image').click()
;


    const golden = page.getByTestId('img-comparison-reference-golden_image')
;


    await expectLoadedImage(golden)
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


    await pageOneLoad.click()
;


    const pageOne = page.getByTestId('img-comparison-reference-front_page')
;


    await expect(pageOne).toHaveAttribute('src', frontPageSourceUrl)
;


    await expectLoadedImage(pageOne)
;


    await focusByTab(page, 'button-hide-reference-preview-front_page')
;


    await page.keyboard.press(key)
;


    await expect(pageOne).toHaveCount(0)
;


    await expect(golden).toBeVisible()
;


    await expect(pageOneLoad).toBeFocused()
;


    await expect(pageOneLoad).toBeVisible()
;


    await expectVisibleKeyboardFocus(pageOneLoad)
;


    await expectKeyboardFocusWithinViewport(pageOneLoad)
;


    await expectTabAdvancesFrom(page, pageOneLoad)
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} hides a failed Page 1 preview and keeps focus useful`, async (
{

 page 
}

) => 
{


    await page.setViewportSize(
{

 width: 320, height: 568 
}

)
;


    await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


    await page.goto('/browser-tests/fixture.html')
;


    const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


    const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


    const failedRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await pageOneLoad.click()
;


    await failedRequest
;


    await expect(unavailable).toBeVisible()
;


    const hide = page.getByTestId('button-hide-reference-preview-front_page')
;


    await focusByTab(page, 'button-hide-reference-preview-front_page')
;


    await expectVisibleKeyboardFocus(hide)
;


    await page.keyboard.press(key)
;


    await expect(unavailable).toHaveCount(0)
;


    await expect(hide).toHaveCount(0)
;


    await expect(pageOneLoad).toBeVisible()
;


    await expect(pageOneLoad).toBeFocused()
;


    await expectVisibleKeyboardFocus(pageOneLoad)
;


    await expectKeyboardFocusWithinViewport(pageOneLoad)
;


    await expectTabAdvancesFrom(page, pageOneLoad)
;


}

)
;


}


test('Page 1 loaded preview hide announcement stays polite and does not repeat', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  const pageOne = page.getByTestId('img-comparison-reference-front_page')
;


  await expectLoadedImage(pageOne)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(pageOne).toHaveCount(0)
;


  await expect(page.getByTestId('notice-page-one-preview-hidden'))
    .toHaveText('Page 1 preview hidden.')
;


  await expectHideAnnouncementDoesNotRepeatWhenGoldenImageChanges(page)
;


}

)
;


test('Page 1 initial preview loading announcement clears after success', async (
{

 page 
}

) => 
{


  let notifyStarted!: () => void
;


  let releaseResponse!: () => void
;


  const requestStarted = new Promise<void>((resolve) => 
{

 notifyStarted = resolve
;

 
}

)
;


  const responsePending = new Promise<void>((resolve) => 
{

 releaseResponse = resolve
;

 
}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    notifyStarted()
;


    await responsePending
;


    await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const loading = page.getByTestId('img-comparison-reference-front_page-loading')
;


  const request = page.waitForRequest((candidate) => candidate.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await Promise.all([request, requestStarted])
;


  try 
{


    await expect(loading).toHaveText('Loading Page 1 preview.')
;


    await expect(loading).toHaveAttribute('role', 'status')
;


    await expect(loading).toHaveAttribute('aria-live', 'polite')
;


    await expect(loading).toHaveAttribute('aria-atomic', 'true')
;


    releaseResponse()
;


    await expectLoadedImage(page.getByTestId('img-comparison-reference-front_page'))
;


    await expect(loading).toHaveCount(0)
;


}

 finally 
{


    releaseResponse()
;


}


}

)
;


test('Page 1 initial preview loading announcement clears after failure', async (
{

 page 
}

) => 
{


  let notifyStarted!: () => void
;


  let releaseResponse!: () => void
;


  const requestStarted = new Promise<void>((resolve) => 
{

 notifyStarted = resolve
;

 
}

)
;


  const responsePending = new Promise<void>((resolve) => 
{

 releaseResponse = resolve
;

 
}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    notifyStarted()
;


    await responsePending
;


    await route.fulfill(
{

 status: 503, contentType: 'text/plain', body: 'Temporary image host failure' 
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const loading = page.getByTestId('img-comparison-reference-front_page-loading')
;


  const request = page.waitForRequest((candidate) => candidate.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await Promise.all([request, requestStarted])
;


  await expect(loading).toHaveText('Loading Page 1 preview.')
;


  const failedResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 503,
  )
;


  releaseResponse()
;


  await failedResponse
;


  await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible()
;


  await expect(loading).toHaveCount(0)
;


}

)
;


test('Page 1 failed preview hide announcement stays polite and does not repeat', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible()
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(page.getByTestId('notice-reference-unavailable-front_page')).toHaveCount(0)
;


  await expect(page.getByTestId('notice-page-one-preview-hidden'))
    .toHaveText('Page 1 preview hidden.')
;


  await expectHideAnnouncementDoesNotRepeatWhenGoldenImageChanges(page)
;


}

)
;

test('Page 1 failed reload announces its status and Retry action without repeating the status on refocus', async ({ page }) => {
  let pageOneRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.href === frontPageSourceUrl) {
      pageOneRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: 'Temporary image host failure',
      });
      return;
    }

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: onePixelPng,
      });
      return;
    }

    await route.abort();
  });

  await page.goto('/browser-tests/fixture.html');
  const load = page.getByTestId('button-load-reference-preview-front_page');
  const firstFailure = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 503,
  );
  await load.click();
  await firstFailure;
  await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();
  await page.getByTestId('button-hide-reference-preview-front_page').click();
  await expect(load).toBeVisible();

  const failedReload = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 503,
  );
  await load.click();
  await failedReload;

  const unavailableNotice = page.getByTestId('notice-reference-unavailable-front_page');
  await expect(unavailableNotice).toBeVisible();
  await expect(unavailableNotice).toContainText('Page 1 preview is unavailable.');

  const announcement = page.getByTestId('notice-reference-unavailable-front_page-announcement');
  await expect(announcement).toHaveText('Page 1 preview is unavailable.');
  await expect(announcement).toHaveAttribute('role', 'status');
  await expect(announcement).toHaveAttribute('aria-live', 'polite');
  await expect(announcement).toHaveAttribute('aria-atomic', 'true');

  const retry = page.getByRole('button', { name: 'Retry Page 1 preview' });
  await expect(retry).toHaveText('Retry preview');
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();

  const originalAnnouncement = await announcement.elementHandle();
  if (!originalAnnouncement) throw new Error('Page 1 unavailable announcement was not rendered');
  await announcement.evaluate((element) => {
    const observable = element as HTMLElement & {
      __announcementMutationCount?: number;
      __announcementObserver?: MutationObserver;
    };
    observable.__announcementMutationCount = 0;
    observable.__announcementObserver = new MutationObserver((mutations) => {
      observable.__announcementMutationCount =
        (observable.__announcementMutationCount ?? 0) + mutations.length;
    });
    observable.__announcementObserver.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

  await page.keyboard.press('Tab');
  await expect(retry).not.toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(retry).toBeFocused();
  await expect(announcement).toHaveText('Page 1 preview is unavailable.');
  expect(await announcement.evaluate((element, original) => element === original, originalAnnouncement)).toBe(true);
  const mutationCount = await announcement.evaluate(async (element) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const observable = element as HTMLElement & {
      __announcementMutationCount?: number;
      __announcementObserver?: MutationObserver;
    };
    observable.__announcementObserver?.disconnect();
    return observable.__announcementMutationCount ?? 0;
  });
  await originalAnnouncement.dispose();
  expect(mutationCount).toBe(0);
  expect(pageOneRequests).toBe(2);
});


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} hides a failed Page 1 preview without disturbing the open Golden Image`, async (
{

 page 
}

) => 
{


    await routeNormalImages(page)
;


    await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


    await page.goto('/browser-tests/fixture.html')
;


    await page.getByTestId('button-load-reference-preview-golden_image').click()
;


    const golden = page.getByTestId('img-comparison-reference-golden_image')
;


    await expectLoadedImage(golden)
;


    const goldenSource = await golden.getAttribute('src')
;


    const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


    const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


    const failedRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await pageOneLoad.click()
;


    await failedRequest
;


    await expect(unavailable).toBeVisible()
;


    const hide = page.getByTestId('button-hide-reference-preview-front_page')
;


    await focusByTab(page, 'button-hide-reference-preview-front_page')
;


    await expectVisibleKeyboardFocus(hide)
;


    await page.keyboard.press(key)
;


    await expect(unavailable).toHaveCount(0)
;


    await expect(hide).toHaveCount(0)
;


    await expect(pageOneLoad).toBeVisible()
;


    await expect(pageOneLoad).toBeFocused()
;


    await expectVisibleKeyboardFocus(pageOneLoad)
;


    await expectTabAdvancesFrom(page, pageOneLoad)
;


    await expect(golden).toBeVisible()
;


    await expect(golden).toHaveAttribute('src', goldenSource!)
;


    await expectLoadedImage(golden)
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} hides a failed Page 1 preview and reloads it without changing the Golden Image`, async (
{

 page 
}

) => 
{


    await routeNormalImages(page)
;


    let pageOneRequests = 0
;


    let releaseSuccessfulReload!: () => void
;


    let notifySuccessfulReloadStarted!: () => void
;


    const successfulReloadResponse = new Promise<void>((resolve) => 
{


      releaseSuccessfulReload = resolve
;


}

)
;


    const successfulReloadStarted = new Promise<void>((resolve) => 
{


      notifySuccessfulReloadStarted = resolve
;


}

)
;


    await page.route(frontPageSourceUrl, async (route) => 
{


      pageOneRequests += 1
;


      if (pageOneRequests === 1) 
{


        await route.fulfill(
{


          status: 503,
          contentType: 'image/png',
          headers: 
{

 'cache-control': 'no-store' 
}

,
          body: 'Temporary image host failure',
        
}

)
;


        return
;


}


      notifySuccessfulReloadStarted()
;


      await successfulReloadResponse
;


      await route.fulfill(
{


        status: 200,
        contentType: 'image/png',
        headers: 
{

 'cache-control': 'no-store' 
}

,
        body: onePixelPng,
      
}

)
;


}

)
;


    await page.goto('/browser-tests/fixture.html')
;


    try 
{


      await page.getByTestId('button-load-reference-preview-golden_image').click()
;


      const golden = page.getByTestId('img-comparison-reference-golden_image')
;


      await expectLoadedImage(golden)
;


      const goldenState = await golden.evaluate((image: HTMLImageElement) => (
{


        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}

))
;


      const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


      const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


      const firstFailure = page.waitForResponse(
        (response) => response.url() === frontPageSourceUrl && response.status() === 503,
      )
;


      await focusByTab(page, 'button-load-reference-preview-front_page')
;


      await page.keyboard.press(key)
;


      await firstFailure
;


      await expect(unavailable).toBeVisible()
;


      expect(pageOneRequests).toBe(1)
;


      await expect(golden).toBeVisible()
;


      await expectLoadedImage(golden)
;


      expect(await golden.evaluate((image: HTMLImageElement) => (
{


        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}

))).toEqual(goldenState)
;


      const hide = page.getByTestId('button-hide-reference-preview-front_page')
;


      await focusByTab(page, 'button-hide-reference-preview-front_page')
;


      await expectVisibleKeyboardFocus(hide)
;


      await page.keyboard.press(key)
;


      await expect(unavailable).toHaveCount(0)
;


      await expect(hide).toHaveCount(0)
;


      await expect(pageOneLoad).toBeVisible()
;


      await expect(pageOneLoad).toBeFocused()
;


      await expectVisibleKeyboardFocus(pageOneLoad)
;


      await expect(golden).toBeVisible()
;


      expect(await golden.evaluate((image: HTMLImageElement) => (
{


        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}

))).toEqual(goldenState)
;


      const successfulReloadRequest = page.waitForRequest(
        (request) => request.url() === frontPageSourceUrl,
      )
;


      await page.keyboard.press(key)
;


      await Promise.all([successfulReloadStarted, successfulReloadRequest])
;


      const loading = page.getByTestId('img-comparison-reference-front_page-loading')
;


      const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


      await expect(loading).toBeVisible()
;


      await expect(pageOneLoad).toHaveCount(0)
;


      await expect(hide).toBeVisible()
;


      await expect(hide).toBeFocused()
;


      await expectVisibleKeyboardFocus(hide)
;


      await expectKeyboardFocusWithinViewport(hide)
;


      await expectTabAdvancesFrom(page, hide)
;


      await page.keyboard.press('Shift+Tab')
;


      await expect(hide).toBeFocused()
;


      await expectVisibleKeyboardFocus(hide)
;


      expect(pageOneRequests).toBe(2)
;


      const successfulReload = page.waitForResponse(
        (response) => response.url() === frontPageSourceUrl && response.status() === 200,
      )
;


      releaseSuccessfulReload()
;


      await successfulReload
;


      await expectLoadedImage(pageOneImage)
;


      await expect(loading).toHaveCount(0)
;


      await expect(unavailable).toHaveCount(0)
;


      await expect(hide).toBeVisible()
;


      await expect(hide).toBeFocused()
;


      expect(pageOneRequests).toBe(2)
;


      await expect(golden).toBeVisible()
;


      await expectLoadedImage(golden)
;


      expect(await golden.evaluate((image: HTMLImageElement) => (
{


        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}

))).toEqual(goldenState)
;


}

 finally 
{


      releaseSuccessfulReload()
;


}


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} hides a failed Page 1 preview and keeps the historical Golden Image visible`, async (
{

 page 
}

) => 
{


    await page.setViewportSize(
{

 width: 320, height: 568 
}

)
;


    await routeNormalImages(page)
;


    await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


    await page.goto('/browser-tests/fixture.html')
;


    const historicalLoad = page.getByTestId('button-load-historical-reference-preview-golden_image')
;


    await historicalLoad.click()
;


    const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    await expectLoadedImage(historical)
;


    const historicalSource = await historical.getAttribute('src')
;


    const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


    const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


    const failedRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await pageOneLoad.click()
;


    await failedRequest
;


    await expect(unavailable).toBeVisible()
;


    const hide = page.getByTestId('button-hide-reference-preview-front_page')
;


    await focusByTab(page, 'button-hide-reference-preview-front_page')
;


    await expectVisibleKeyboardFocus(hide)
;


    await page.keyboard.press(key)
;


    await expect(unavailable).toHaveCount(0)
;


    await expect(hide).toHaveCount(0)
;


    await expect(pageOneLoad).toBeVisible()
;


    await expect(pageOneLoad).toBeFocused()
;


    await expectVisibleKeyboardFocus(pageOneLoad)
;


    await expectKeyboardFocusWithinViewport(pageOneLoad)
;


    await expectTabAdvancesFrom(page, pageOneLoad)
;


    await expect(historical).toBeVisible()
;


    await expect(historical).toHaveAttribute('src', historicalSource!)
;


    await expectLoadedImage(historical)
;


}

)
;


}


test('Page 1 can load again after hiding a failed preview without changing the Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    await route.fulfill(
{


      status: pageOneRequests === 1 ? 503 : 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: pageOneRequests === 1 ? 'Temporary image host failure' : onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  const golden = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(golden)
;


  const goldenState = await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const firstFailure = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 503,
  )
;


  await pageOneLoad.click()
;


  await firstFailure
;


  await expect(unavailable).toBeVisible()
;


  expect(pageOneRequests).toBe(1)
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  const successfulReload = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 200,
  )
;


  await pageOneLoad.click()
;


  await successfulReload
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


}

)
;


test('Page 1 can load again after hiding a preview with invalid image bytes without changing the Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: pageOneRequests === 1 ? 'Not a valid PNG image' : onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  const golden = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(golden)
;


  const goldenState = await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const invalidImageResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  expect((await invalidImageResponse).status()).toBe(200)
;


  await expect(unavailable).toBeVisible()
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  const validImageResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  expect((await validImageResponse).status()).toBe(200)
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


}

)
;


for (const key of ['Enter', 'Space'] as const) 
{

  test(`keyboard ${key} hides a failed Page 1 preview after invalid image bytes and reloads it without changing the Golden Image`, async (
{
 page 
}
) => 
{

    await routeNormalImages(page)
;

    let pageOneRequests = 0
;

    let releaseSuccessfulReload!: () => void
;

    let notifySuccessfulReloadStarted!: () => void
;

    const successfulReloadResponse = new Promise<void>((resolve) => 
{

      releaseSuccessfulReload = resolve
;

    
}
)
;

    const successfulReloadStarted = new Promise<void>((resolve) => 
{

      notifySuccessfulReloadStarted = resolve
;

    
}
)
;

    await page.route(frontPageSourceUrl, async (route) => 
{

      pageOneRequests += 1
;

      if (pageOneRequests > 1) 
{

        notifySuccessfulReloadStarted()
;

        await successfulReloadResponse
;

      
}

      await route.fulfill(
{

        status: 200,
        contentType: 'image/png',
        headers: 
{
 'cache-control': 'no-store' 
}
,
        body: pageOneRequests === 1 ? 'Not a valid PNG image' : onePixelPng,
      
}
)
;

    
}
)
;

    try 
{

      await page.goto('/browser-tests/fixture.html')
;


      await page.getByTestId('button-load-reference-preview-golden_image').click()
;

      const golden = page.getByTestId('img-comparison-reference-golden_image')
;

      await expectLoadedImage(golden)
;

      const goldenState = await golden.evaluate((image: HTMLImageElement) => (
{

        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}
))
;


      const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;

      const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;

      const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;

      const invalidImageResponse = page.waitForResponse(
        (response) => response.url() === frontPageSourceUrl,
      )
;

      await focusByTab(page, 'button-load-reference-preview-front_page')
;

      await page.keyboard.press(key)
;

      expect((await invalidImageResponse).status()).toBe(200)
;

      await expect(unavailable).toBeVisible()
;

      await expect(pageOneImage).toHaveCount(0)
;

      expect(pageOneRequests).toBe(1)
;

      expect(await golden.evaluate((image: HTMLImageElement) => (
{

        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}
))).toEqual(goldenState)
;


      const hide = page.getByTestId('button-hide-reference-preview-front_page')
;

      await focusByTab(page, 'button-hide-reference-preview-front_page')
;

      await expectVisibleKeyboardFocus(hide)
;

      await page.keyboard.press(key)
;

      await expect(unavailable).toHaveCount(0)
;

      await expect(pageOneImage).toHaveCount(0)
;

      await expect(hide).toHaveCount(0)
;

      await expect(pageOneLoad).toBeFocused()
;

      await expectVisibleKeyboardFocus(pageOneLoad)
;

      await expect(golden).toBeVisible()
;

      expect(await golden.evaluate((image: HTMLImageElement) => (
{

        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}
))).toEqual(goldenState)
;


      const successfulReloadRequest = page.waitForRequest(
        (request) => request.url() === frontPageSourceUrl,
      )
;

      const loading = page.getByTestId('img-comparison-reference-front_page-loading')
;

      await page.keyboard.press(key)
;

      await expect(loading).toBeVisible()
;

      await Promise.all([successfulReloadStarted, successfulReloadRequest])
;


      await expect(loading).toBeVisible()
;

      await expect(pageOneLoad).toHaveCount(0)
;

      await expect(hide).toBeVisible()
;

      await expect(hide).toBeFocused()
;

      await expectVisibleKeyboardFocus(hide)
;

      expect(pageOneRequests).toBe(2)
;


      const validImageResponse = page.waitForResponse(
        (response) => response.url() === frontPageSourceUrl && response.status() === 200,
      )
;

      releaseSuccessfulReload()
;

      expect((await validImageResponse).status()).toBe(200)
;

      await expectLoadedImage(pageOneImage)
;

      await expect(loading).toHaveCount(0)
;

      await expect(unavailable).toHaveCount(0)
;

      await expect(hide).toBeVisible()
;

      await expect(hide).toBeFocused()
;

      await expect(golden).toBeVisible()
;

      await expectLoadedImage(golden)
;

      expect(await golden.evaluate((image: HTMLImageElement) => (
{

        currentSrc: image.currentSrc,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        src: image.src,
      
}
))).toEqual(goldenState)
;

    
}
 finally 
{

      releaseSuccessfulReload()
;

    
}

  
}
)
;

}


test('Page 1 can load again after hiding a preview with invalid image bytes without changing the historical Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: pageOneRequests === 1 ? 'Not a valid PNG image' : onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-historical-reference-preview-golden_image').click()
;


  const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


  await expectLoadedImage(historical)
;


  const historicalState = await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const invalidImageResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  expect((await invalidImageResponse).status()).toBe(200)
;


  await expect(unavailable).toBeVisible()
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  const validImageResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  expect((await validImageResponse).status()).toBe(200)
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


}

)
;


test('Page 1 can load again after hiding an HTTP-error preview without changing the historical Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    await route.fulfill(
{


      status: pageOneRequests === 1 ? 503 : 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: pageOneRequests === 1 ? 'Temporary image host failure' : onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-historical-reference-preview-golden_image').click()
;


  const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


  await expectLoadedImage(historical)
;


  const historicalState = await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const firstFailure = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 503,
  )
;


  await pageOneLoad.click()
;


  await firstFailure
;


  await expect(unavailable).toBeVisible()
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  const successfulRetry = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 200,
  )
;


  await pageOneLoad.click()
;


  await successfulRetry
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


}

)
;


test('Page 1 can load again after hiding an aborted preview without changing the historical Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  let historicalRequests = 0
;


  let releaseSuccessfulReload!: () => void
;


  let notifySuccessfulReloadStarted!: () => void
;


  const successfulReloadPending = new Promise<void>((resolve) => 
{


    releaseSuccessfulReload = resolve
;


}

)
;


  const successfulReloadStarted = new Promise<void>((resolve) => 
{


    notifySuccessfulReloadStarted = resolve
;


}

)
;


  await page.route(historicalSourceUrl, async (route) => 
{


    historicalRequests += 1
;


    await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests === 1) 
{


      await route.abort('connectionreset')
;


      return
;


}


    notifySuccessfulReloadStarted()
;


    await successfulReloadPending
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-historical-reference-preview-golden_image').click()
;


  const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


  await expectLoadedImage(historical)
;


  const historicalState = await historical.evaluate((image: HTMLImageElement) => (
{


    complete: image.complete,
    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  await firstFailure
;


  await expect(unavailable).toBeVisible()
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    complete: image.complete,
    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  expect(historicalRequests).toBe(1)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await expect(historical).toBeVisible()
;


  await expectLoadedImage(historical)
;


  expect(await historical.evaluate((image: HTMLImageElement) => (
{


    complete: image.complete,
    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(historicalState)
;


  expect(historicalRequests).toBe(1)
;


  const successfulReload = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 200,
  )
;


  try 
{


    const successfulRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await pageOneLoad.click()
;


    await Promise.all([successfulRequest, successfulReloadStarted])
;


    await expect(pageOneImage).toHaveCount(1)
;


    await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0)
;


    await expect(historical).toBeVisible()
;


    await expectLoadedImage(historical)
;


    expect(await historical.evaluate((image: HTMLImageElement) => (
{


      complete: image.complete,
      currentSrc: image.currentSrc,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      src: image.src,
    
}

))).toEqual(historicalState)
;


    expect(historicalRequests).toBe(1)
;


    releaseSuccessfulReload()
;


    await successfulReload
;


    await expectLoadedImage(pageOneImage)
;


    await expect(unavailable).toHaveCount(0)
;


    expect(pageOneRequests).toBe(2)
;


    await expect(historical).toBeVisible()
;


    await expectLoadedImage(historical)
;


    expect(await historical.evaluate((image: HTMLImageElement) => (
{


      complete: image.complete,
      currentSrc: image.currentSrc,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      src: image.src,
    
}

))).toEqual(historicalState)
;


    expect(historicalRequests).toBe(1)
;


}

 finally 
{


    releaseSuccessfulReload()
;


}


}

)
;


test('Page 1 can reload after an aborted image request is hidden without changing the Golden Image', async (
{

 page 
}

) => 
{


  await routeNormalImages(page)
;


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests === 1) 
{


      await route.abort('failed')
;


      return
;


}


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  const golden = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(golden)
;


  const goldenState = await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const failedRequest = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  await failedRequest
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  await page.getByTestId('button-hide-reference-preview-front_page').click()
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(pageOneLoad).toBeVisible()
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


  const successfulReload = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl && response.status() === 200,
  )
;


  await pageOneLoad.click()
;


  await successfulReload
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


  await expect(golden).toBeVisible()
;


  await expectLoadedImage(golden)
;


  expect(await golden.evaluate((image: HTMLImageElement) => (
{


    currentSrc: image.currentSrc,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    src: image.src,
  
}

))).toEqual(goldenState)
;


}

)
;


for (const key of ['Enter', 'Space'] as const) 
{


  test(`Tab and Shift+Tab keep focus visible on both preview hide controls (${key})`, async (
{

 page 
}

) => 
{


    await routeNormalImages(page)
;


    await page.goto('/browser-tests/fixture.html')
;


    await page.getByTestId('button-load-reference-preview-golden_image').click()
;


    const current = page.getByTestId('img-comparison-reference-golden_image')
;


    await expectLoadedImage(current)
;


    await page.getByTestId('button-load-historical-reference-preview-golden_image').click()
;


    const historical = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    await expectLoadedImage(historical)
;


    const currentHide = await focusByTab(page, 'button-hide-reference-preview-golden_image')
;


    await expectVisibleKeyboardFocus(currentHide)
;


    const historicalHide = await focusByTab(page, 'button-hide-historical-reference-preview-golden_image')
;


    await expectVisibleKeyboardFocus(historicalHide)
;


    await currentHide.focus()
;


    await page.keyboard.press(key)
;


    await expect(current).toHaveCount(0)
;


    await expect(historical).toBeVisible()
;


    await expect(page.getByTestId('button-load-reference-preview-golden_image')).toBeFocused()
;


}

)
;


}


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} retries a failed Golden Image preview without disturbing Page 1`, async (
{

 page 
}

) => 
{


    let attempts = 0
;


    await page.route('**/*', async (route) => 
{


      const url = new URL(route.request().url())
;


      if (url.href === frontPageSourceUrl) 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


        await route.continue()
;


}

 else if (url.href === sourceUrl && ++attempts === 1) 
{


        await route.abort()
;


}

 else if (url.href === sourceUrl) 
{


        await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

 else 
{


        await route.abort()
;


}


}

)
;


    await page.goto('/browser-tests/fixture.html')
;


    await page.getByTestId('button-load-reference-preview-front_page').click()
;


    const pageOne = page.getByTestId('img-comparison-reference-front_page')
;


    await expectLoadedImage(pageOne)
;


    const failedRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


    await page.getByTestId('button-load-reference-preview-golden_image').focus()
;


    await page.keyboard.press('Enter')
;


    await failedRequest
;


    await expect(page.getByTestId('notice-reference-unavailable-golden_image')).toBeVisible()
;


    const retry = page.getByTestId('button-retry-reference-preview-golden_image')
;


    await focusByTab(page, 'button-retry-reference-preview-golden_image')
;


    await expect(retry).toBeFocused()
;


    await expectVisibleKeyboardFocus(retry)
;


    const retryRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


    await page.keyboard.press(key)
;


    await retryRequest
;


    await expectLoadedImage(page.getByTestId('img-comparison-reference-golden_image'))
;


    await expect(pageOne).toHaveAttribute('src', frontPageSourceUrl)
;


    expect(attempts).toBe(2)
;


}

)
;


}


test('Retry restores a failed Page 1 preview after its image host recovers', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    await route.fulfill(
{


      status: pageOneRequests === 1 ? 503 : 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: pageOneRequests === 1 ? 'Temporary image host failure' : onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const firstRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await firstRequest
;


  await expect(unavailable).toBeVisible()
;


  await expect(pageOneImage).toHaveCount(0)
;


  expect(pageOneRequests).toBe(1)
;


  const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-retry-reference-preview-front_page').click()
;


  await retryRequest
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


}

)
;


test('Page 1 retry recovers after its image request is aborted at the network level', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests === 1) 
{


      await route.abort('failed')
;


      return
;


}


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  const firstFailedRequest = page.waitForEvent('requestfailed', (request) => request.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await firstFailedRequest
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(retry).toBeEnabled()
;


  expect(pageOneRequests).toBe(1)
;


  const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


  await retry.click()
;


  await retryRequest
;


  await expectLoadedImage(pageOneImage)
;


  await expect(pageOneImage).toHaveAttribute('src', frontPageSourceUrl)
;


  await expect(unavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


}

)
;


test('Page 1 keeps manual retry available offline, then auto-retries on reconnect without overlap', async (
{

 page, context 
}

) => 
{


  await page.goto('/browser-tests/fixture.html')
;


  await context.setOffline(true)
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  const retryFailureAnnouncement = page.getByTestId('img-comparison-reference-front_page-retry-failed')
;


  const requestFailed = page.waitForEvent('requestfailed', (request) => request.url() === frontPageSourceUrl)
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await requestFailed
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(retry).toBeEnabled()
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  const manualRetryFailed = page.waitForEvent('requestfailed', (request) => request.url() === frontPageSourceUrl)
;


  await retry.click()
;


  await manualRetryFailed
;


  await expect(unavailable).toBeVisible()
;


  await expect(retry).toBeEnabled()
;


  await expect(retryFailureAnnouncement)
    .toHaveText('Page 1 preview retry failed. The preview is still unavailable.')
;


  let releaseRetry!: () => void
;


  let notifyRetryStarted!: () => void
;


  const retryPending = new Promise<void>((resolve) => 
{

 releaseRetry = resolve
;

 
}

)
;


  const retryStarted = new Promise<void>((resolve) => 
{

 notifyRetryStarted = resolve
;

 
}

)
;


  let retryRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    retryRequests += 1
;


    notifyRetryStarted()
;


    await retryPending
;


    await route.fulfill(
{

 status: 200, contentType: 'image/png', headers: 
{

 'cache-control': 'no-store' 
}

, body: onePixelPng 
}

)
;


}

)
;


  const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


  await context.setOffline(false)
;


  await retryRequest
;


  await retryStarted
;


  await expect(unavailable).toBeVisible()
;


  await expect(retry).toBeDisabled()
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  await expect(pageOneImage).toHaveCount(1)
;


  expect(retryRequests).toBe(1)
;


  await context.setOffline(true)
;


  await context.setOffline(false)
;


  await context.setOffline(true)
;


  await context.setOffline(false)
;


  await expect(unavailable).toBeVisible()
;


  await expect(retry).toBeDisabled()
;


  expect(retryRequests).toBe(1)
;


  releaseRetry()
;


  await expectLoadedImage(pageOneImage)
;


  await expect(pageOneImage).toHaveAttribute('src', frontPageSourceUrl)
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(retryFailureAnnouncement).toHaveText('Page 1 preview loaded successfully.')
;


  expect(retryRequests).toBe(1)
;


}

)
;


test('Page 1 stays unavailable and retryable when reconnect returns invalid image bytes', async (
{

 page, context 
}

) => 
{


  await page.goto('/browser-tests/fixture.html')
;


  await context.setOffline(true)
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  const retryFailureAnnouncement = page.getByTestId('img-comparison-reference-front_page-retry-failed')
;


  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await initialFailure
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(retry).toBeEnabled()
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  const manualRetryFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await retry.click()
;


  await manualRetryFailure
;


  await expect(retryFailureAnnouncement)
    .toHaveText('Page 1 preview retry failed. The preview is still unavailable.')
;


  let reconnectRequests = 0
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    reconnectRequests += 1
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: reconnectRequests === 1 ? 'Not a valid PNG image' : onePixelPng,
    
}

)
;


}

)
;


  const reconnectResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await context.setOffline(false)
;


  expect((await reconnectResponse).status()).toBe(200)
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(pageOneImage).toHaveCount(0)
;


  await expect(retryFailureAnnouncement)
    .toHaveText('Page 1 preview retry failed. The preview is still unavailable.')
;


  await expect(retry).toBeEnabled()
;


  expect(reconnectRequests).toBe(1)
;


  const manualRetryResponse = page.waitForResponse(
    (response) => response.url() === frontPageSourceUrl,
  )
;


  await retry.click()
;


  expect((await manualRetryResponse).status()).toBe(200)
;


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(retryFailureAnnouncement).toHaveText('Page 1 preview loaded successfully.')
;


  expect(reconnectRequests).toBe(2)
;


}

)
;


test('Page 1 auto-retries when connectivity returns before its initial image failure is registered', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  let releaseRetry!: () => void
;


  let notifyRetryStarted!: () => void
;


  const retryPending = new Promise<void>((resolve) => 
{

 releaseRetry = resolve
;

 
}

)
;


  const retryStarted = new Promise<void>((resolve) => 
{

 notifyRetryStarted = resolve
;

 
}

)
;


  await page.addInitScript(() => 
{


    let online = false
;


    Object.defineProperty(navigator, 'onLine', 
{


      configurable: true,
      get: () => online,
    
}

)
;


    Object.defineProperty(window, '__setTestOnline', 
{


      configurable: true,
      value: (nextOnline: boolean) => 
{


        online = nextOnline
;


        window.dispatchEvent(new Event(nextOnline ? 'online' : 'offline'))
;


}

,
    
}

)
;


}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests === 1) 
{


      await page.evaluate(() => 
{


        (window as Window & 
{

 __setTestOnline: (online: boolean) => void 
}

).__setTestOnline(true)
;


}

)
;


      await route.abort('failed')
;


      return
;


}


    notifyRetryStarted()
;


    await retryPending
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await firstFailure
;


  await retryStarted
;


  try 
{


    await expect(unavailable).toBeVisible()
;


    await expect(retry).toBeDisabled()
;


    await expect(pageOneImage).toHaveCount(1)
;


    expect(pageOneRequests).toBe(2)
;


    await page.evaluate(() => 
{


      const setTestOnline = (window as Window & 
{

 __setTestOnline: (online: boolean) => void 
}

).__setTestOnline
;


      setTestOnline(false)
;


      setTestOnline(true)
;


      setTestOnline(false)
;


      setTestOnline(true)
;


}

)
;


    await expect(retry).toBeDisabled()
;


    expect(pageOneRequests).toBe(2)
;


}

 finally 
{


    releaseRetry()
;


}


  await expectLoadedImage(pageOneImage)
;


  await expect(unavailable).toHaveCount(0)
;


  await expect(retry).toHaveCount(0)
;


  expect(pageOneRequests).toBe(2)
;


}

)
;


test('Page 1 focuses Retry when its automatic reconnect retry fails', async (
{

 page, context 
}

) => 
{


  let pageOneRequests = 0
;


  page.on('request', (request) => 
{


    if (request.url() === frontPageSourceUrl) pageOneRequests += 1
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await context.setOffline(true)
;


  const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await page.getByTestId('button-load-reference-preview-front_page').click()
;


  await firstFailure
;


  await expect(unavailable).toBeVisible()
;


  await expect(retry).toBeEnabled()
;


  await expect(retry).toBeFocused()
;


  expect(pageOneRequests).toBe(1)
;


  await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


  const reconnectRequest = page.waitForRequest(
    (request) => request.url() === frontPageSourceUrl,
  )
;


  const reconnectFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await context.setOffline(false)
;


  await reconnectRequest
;


  await reconnectFailure
;


  await expect(unavailable).toBeVisible()
;


  await expect(retry).toBeEnabled()
;


  await expect(retry).toBeFocused()
;


  expect(pageOneRequests).toBe(2)
;


}

)
;


for (const key of ['Enter', 'Space'] as const) 
{


  test(`keyboard ${key} retries Page 1 after its image request is aborted at the network level`, async (
{

 page 
}

) => 
{


    let pageOneRequests = 0
;


    await page.route(frontPageSourceUrl, async (route) => 
{


      pageOneRequests += 1
;


      if (pageOneRequests === 1) 
{


        await route.abort('failed')
;


        return
;


}


      await route.fulfill(
{


        status: 200,
        contentType: 'image/png',
        headers: 
{

 'cache-control': 'no-store' 
}

,
        body: onePixelPng,
      
}

)
;


}

)
;


    await page.goto('/browser-tests/fixture.html')
;


    const unavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


    const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


    const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


    const hidePreview = page.getByTestId('button-hide-reference-preview-front_page')
;


    const failedRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await page.getByTestId('button-load-reference-preview-front_page').click()
;


    await failedRequest
;


    await expect(unavailable).toContainText('This external image preview is unavailable.')
;


    await expect(pageOneImage).toHaveCount(0)
;


    await expect(retry).toBeEnabled()
;


    expect(pageOneRequests).toBe(1)
;


    await focusByTab(page, 'button-retry-reference-preview-front_page')
;


    await expect(retry).toBeFocused()
;


    const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


    await page.keyboard.press(key)
;


    await retryRequest
;


    await expectLoadedImage(pageOneImage)
;


    await expect(pageOneImage).toHaveAttribute('src', frontPageSourceUrl)
;


    await expect(unavailable).toHaveCount(0)
;


    await expect(retry).toHaveCount(0)
;


    await expect(hidePreview).toBeVisible()
;


    await expect(hidePreview).toBeFocused()
;


    await expectVisibleKeyboardFocus(hidePreview)
;


    expect(pageOneRequests).toBe(2)
;


}

)
;


}


test('Golden Image retry recovers after the browser reconnects', async (
{

 page, context 
}

) => 
{


  await page.goto('/browser-tests/fixture.html')
;


  await context.setOffline(true)
;


  const unavailable = page.getByTestId('notice-reference-unavailable-golden_image')
;


  const goldenImage = page.getByTestId('img-comparison-reference-golden_image')
;


  const requestFailed = page.waitForEvent('requestfailed', (request) => request.url() === sourceUrl)
;


  await page.getByTestId('button-load-reference-preview-golden_image').click()
;


  await requestFailed
;


  await expect(unavailable).toContainText('This external image preview is unavailable.')
;


  await expect(goldenImage).toHaveCount(0)
;


  await context.setOffline(false)
;


  await page.route(sourceUrl, async (route) => 
{


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  const retryRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


  await page.getByTestId('button-retry-reference-preview-golden_image').click()
;


  await retryRequest
;


  await expectLoadedImage(goldenImage)
;


  await expect(goldenImage).toHaveAttribute('src', sourceUrl)
;


  await expect(unavailable).toHaveCount(0)
;


}

)
;


test('Page 1 retry stays available until its image succeeds after two temporary failures', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  await page.route(sourceUrl, async (route) => 
{


    await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests < 3) 
{


      await route.abort('failed')
;


      return
;


}


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  const goldenLoad = page.getByTestId('button-load-reference-preview-golden_image')
;


  await goldenLoad.click()
;


  const goldenImage = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(goldenImage)
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneUnavailable = page.getByTestId('notice-reference-unavailable-front_page')
;


  const retryPageOne = page.getByTestId('button-retry-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  let failedRequest = page.waitForEvent('requestfailed', (request) => request.url() === frontPageSourceUrl)
;


  await pageOneLoad.click()
;


  await failedRequest
;


  for (let failure = 1
;

 failure <= 2
;

 failure += 1) 
{


    await expect(pageOneUnavailable).toBeVisible()
;


    await expect(retryPageOne).toBeEnabled()
;


    expect(pageOneRequests).toBe(failure)
;


    if (failure < 2) 
{


      failedRequest = page.waitForEvent('requestfailed', (request) => request.url() === frontPageSourceUrl)
;


      await retryPageOne.click()
;


      await failedRequest
;


}


}


  const successfulRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl)
;


  await retryPageOne.click()
;


  await successfulRequest
;


  await expectLoadedImage(pageOneImage)
;


  await expect(pageOneImage).toHaveAttribute('src', frontPageSourceUrl)
;


  await expect(pageOneUnavailable).toHaveCount(0)
;


  expect(pageOneRequests).toBe(3)
;


}

)
;


test('Page 1 failure announcement changes to success after a failed retry later succeeds', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  let releaseSuccessfulRetry: (() => void) | undefined
;


  let notifySuccessfulRetryStarted: (() => void) | undefined
;


  const successfulRetryResponse = new Promise<void>((resolve) => 
{


    releaseSuccessfulRetry = resolve
;


}

)
;


  const successfulRetryStarted = new Promise<void>((resolve) => 
{


    notifySuccessfulRetryStarted = resolve
;


}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests < 3) 
{


      await route.abort('failed')
;


      return
;


}


    notifySuccessfulRetryStarted?.()
;


    await successfulRetryResponse
;


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const unavailableNotice = page.getByTestId('notice-reference-unavailable-front_page')
;


  const retryButton = page.getByTestId('button-retry-reference-preview-front_page')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  const retryFailureAnnouncement = page.getByTestId('img-comparison-reference-front_page-retry-failed')
;


  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  await initialFailure
;


  await expect(unavailableNotice).toBeVisible()
;


  await expect(retryButton).toBeEnabled()
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  const failedRetry = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await retryButton.click()
;


  await failedRetry
;


  await expect(unavailableNotice).toBeVisible()
;


  await expect(retryButton).toBeEnabled()
;


  await expect(retryFailureAnnouncement)
    .toHaveText('Page 1 preview retry failed. The preview is still unavailable.')
;


  const successfulRetryRequest = page.waitForRequest(
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await retryButton.click()
;


  await Promise.all([successfulRetryStarted, successfulRetryRequest])
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  await expect(unavailableNotice).toBeVisible()
;


  await expect(retryButton).toBeVisible()
;


  await expect(retryButton).toBeDisabled()
;


  await expect(retryButton).toHaveText('Retrying preview…')
;


  await expect(page.getByTestId('img-comparison-reference-front_page-loading')).toBeVisible()
;


  try 
{


    releaseSuccessfulRetry?.()
;


    await expectLoadedImage(pageOneImage)
;


    await expect(pageOneImage).toHaveAttribute('src', frontPageSourceUrl)
;


    await expect(unavailableNotice).toHaveCount(0)
;


    await expect(retryFailureAnnouncement).toHaveText('Page 1 preview loaded successfully.')
;


    expect(pageOneRequests).toBe(3)
;


}

 finally 
{


    releaseSuccessfulRetry?.()
;


}


}

)
;


test('Page 1 retry announces failure and recovery success while preserving keyboard focus', async (
{

 page 
}

) => 
{


  let pageOneRequests = 0
;


  let retryWillSucceed = false
;


  let releaseRetryResponse: (() => void) | undefined
;


  let notifyRetryStarted: (() => void) | undefined
;


  let retryResponse = Promise.resolve()
;


  let retryStarted = Promise.resolve()
;


  await page.route(sourceUrl, async (route) => 
{


    await route.fulfill(
{


      status: 200,
      contentType: 'image/png',
      headers: 
{

 'cache-control': 'no-store' 
}

,
      body: onePixelPng,
    
}

)
;


}

)
;


  await page.route(frontPageSourceUrl, async (route) => 
{


    pageOneRequests += 1
;


    if (pageOneRequests === 1) 
{


      await route.abort('failed')
;


      return
;


}


    notifyRetryStarted?.()
;


    await retryResponse
;


    if (retryWillSucceed) 
{


      await route.fulfill(
{


        status: 200,
        contentType: 'image/png',
        headers: 
{

 'cache-control': 'no-store' 
}

,
        body: onePixelPng,
      
}

)
;


}

 else 
{


      await route.abort('failed')
;


}


}

)
;


  await page.goto('/browser-tests/fixture.html')
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  const goldenLoad = page.getByTestId('button-load-reference-preview-golden_image')
;


  const goldenRequest = page.waitForRequest((request) => request.url() === sourceUrl)
;


  await goldenLoad.click()
;


  await goldenRequest
;


  const goldenImage = page.getByTestId('img-comparison-reference-golden_image')
;


  await expectLoadedImage(goldenImage)
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  const pageOneRequestFailed = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await pageOneLoad.click()
;


  await pageOneRequestFailed
;


  const retryButton = page.getByTestId('button-retry-reference-preview-front_page')
;


  const hideButton = page.getByTestId('button-hide-reference-preview-front_page')
;


  const retryFailureAnnouncement = page.getByTestId('img-comparison-reference-front_page-retry-failed')
;


  const pageOneImage = page.getByTestId('img-comparison-reference-front_page')
;


  await expect(retryButton).toBeEnabled()
;


  await expect(retryButton).toBeFocused()
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  await expect(retryFailureAnnouncement).toHaveAttribute('role', 'status')
;


  await expect(retryFailureAnnouncement).toHaveAttribute('aria-live', 'polite')
;


  await expect(retryFailureAnnouncement).toHaveAttribute('aria-atomic', 'true')
;


  for (const key of ['Enter', 'Space'] as const) 
{


    retryStarted = new Promise<void>((resolve) => 
{


      notifyRetryStarted = resolve
;


}

)
;


    retryResponse = new Promise<void>((resolve) => 
{


      releaseRetryResponse = resolve
;


}

)
;


    const retryFailed = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === frontPageSourceUrl,
    )
;


    await page.keyboard.press(key)
;


    await retryStarted
;


    await expect(retryFailureAnnouncement).toHaveText('')
;


    await expect(hideButton).toBeFocused()
;


    expect(pageOneRequests).toBeGreaterThan(1)
;


    releaseRetryResponse?.()
;


    await retryFailed
;


    await expect(retryFailureAnnouncement)
      .toHaveText('Page 1 preview retry failed. The preview is still unavailable.')
;


    await expect(retryButton).toBeEnabled()
;


    await expect(retryButton).toBeFocused()
;


    await expectVisibleKeyboardFocus(retryButton)
;


    await expect(goldenImage).toBeVisible()
;


    await expectLoadedImage(goldenImage)
;


}


  retryWillSucceed = true
;


  retryStarted = new Promise<void>((resolve) => 
{


    notifyRetryStarted = resolve
;


}

)
;


  retryResponse = new Promise<void>((resolve) => 
{


    releaseRetryResponse = resolve
;


}

)
;


  await retryButton.click()
;


  await retryStarted
;


  await expect(retryFailureAnnouncement).toHaveText('')
;


  await expect(pageOneImage).toHaveCount(1)
;


  await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0)
;


  releaseRetryResponse?.()
;


  await expectLoadedImage(pageOneImage)
;


  await expect(retryFailureAnnouncement).toHaveText('Page 1 preview loaded successfully.')
;


  expect(pageOneRequests).toBe(4)
;


}

)
;


test('Page 1 preview controls keep visible keyboard focus at compact scroll boundaries in forced-colors mode', async (
{

 page 
}

) => 
{


  await page.setViewportSize(
{

 width: 390, height: 320 
}

)
;


  await page.emulateMedia(
{

 forcedColors: 'active', reducedMotion: 'reduce' 
}

)
;


  await page.route(frontPageSourceUrl, (route) => route.abort('failed'))
;


  await page.goto('/browser-tests/fixture.html')
;


  const dialog = page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)
;


  await expect(dialog).toBeVisible()
;


  await dialog.evaluate((element) => 
{


    element.style.maxHeight = '92dvh'
;


    element.style.overflowY = 'auto'
;


}

)
;


  await expect.poll(() => dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
;


  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
;


  const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page')
;


  await focusByTab(page, 'button-load-reference-preview-front_page')
;


  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
;


  await expectVisibleForcedColorsFocus(pageOneLoad)
;


  await expectForcedColorsFocusPainted(pageOneLoad)
;


  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === frontPageSourceUrl,
  )
;


  await page.keyboard.press('Enter')
;


  await initialFailure
;


  const retry = page.getByTestId('button-retry-reference-preview-front_page')
;


  await expect(retry).toBeEnabled()
;


  await expect(retry).toBeFocused()
;


  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
;


  await expectVisibleForcedColorsFocus(retry)
;


  await expectForcedColorsFocusPainted(retry)
;


  const hide = page.getByTestId('button-hide-reference-preview-front_page')
;


  await focusByTab(page, 'button-hide-reference-preview-front_page')
;


  await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
;


  await expectVisibleForcedColorsFocus(hide)
;


  await expectForcedColorsFocusPainted(hide)
;


}

)
;


test('historical preview load, hide, and retry controls keep visible keyboard focus in forced-colors mode', async (
{

 page 
}

) => 
{


  await page.emulateMedia(
{

 forcedColors: 'active' 
}

)
;


  await page.route(historicalSourceUrl, (route) => route.abort('failed'))
;


  await page.goto('/browser-tests/fixture.html')
;


  await expect(page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)).toBeVisible()
;


  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
;


  const load = page.getByTestId('button-load-historical-reference-preview-golden_image')
;


  await focusByTab(page, 'button-load-historical-reference-preview-golden_image')
;


  await expectVisibleForcedColorsFocus(load)
;


  await expectForcedColorsFocusPainted(load)
;


  const sourceLink = page.getByTestId('link-historical-reference-source-golden_image')
;


  await focusByTab(page, 'link-historical-reference-source-golden_image')
;


  await expectVisibleForcedColorsFocus(sourceLink)
;


  await focusByTab(page, 'button-load-historical-reference-preview-golden_image')
;


  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === historicalSourceUrl,
  )
;


  await page.keyboard.press('Enter')
;


  await initialFailure
;


  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image')
;


  await expect(retry).toBeFocused()
;


  const retryFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === historicalSourceUrl,
  )
;


  await page.keyboard.press('Enter')
;


  await retryFailure
;


  await expect(retry).toBeEnabled()
;


  await expect(retry).toBeFocused()
;


  await expectVisibleForcedColorsFocus(retry)
;


  await expectForcedColorsFocusPainted(retry)
;


  const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image')
;


  await focusByTab(page, 'button-hide-historical-reference-preview-golden_image')
;


  await expectVisibleForcedColorsFocus(hide)
;


  await expectForcedColorsFocusPainted(hide)
;


}

)
;


test('historical preview keeps Hide focused and visibly outlined at 400% zoom in forced-colors mode while loading', async (
{

 page 
}

) => 
{


  await page.setViewportSize(
{

 width: 390, height: 360 
}

)
;


  await page.emulateMedia(
{

 forcedColors: 'active', reducedMotion: 'reduce' 
}

)
;


  let releaseHistoricalResponse: (() => void) | undefined
;


  let notifyHistoricalRequestStarted: (() => void) | undefined
;


  const historicalResponse = new Promise<void>((resolve) => 
{


    releaseHistoricalResponse = resolve
;


}

)
;


  const historicalRequestStarted = new Promise<void>((resolve) => 
{


    notifyHistoricalRequestStarted = resolve
;


}

)
;


  await page.route('**/*', async (route) => 
{


    const url = new URL(route.request().url())
;


    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


      await route.continue()
;


      return
;


}


    if (url.href === historicalSourceUrl) 
{


      notifyHistoricalRequestStarted?.()
;


      await historicalResponse
;


      await route.fulfill(
{


        status: 200,
        contentType: 'image/png',
        headers: 
{

 'cache-control': 'no-store' 
}

,
        body: onePixelPng,
      
}

)
;


      return
;


}


    if (url.hostname === 'images.example.test') 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


      return
;


}


    await route.abort()
;


}

)
;


  try 
{


    await page.goto('/browser-tests/fixture.html')
;


    const dialog = page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)
;


    await expect(dialog).toBeVisible()
;


    await dialog.evaluate((element) => 
{


      element.style.maxHeight = '92dvh'
;


      element.style.overflowY = 'auto'
;


}

)
;


    // Model 400% browser zoom with a reflowed CSS viewport one quarter the
    // original dimensions. Page-scale emulation only simulates pinch zoom.
    await page.setViewportSize(
{

 width: 96, height: 90 
}

)
;


    const zoomViewport = await page.evaluate(() => (
{


      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
    
}

))
;


    expect(zoomViewport.forcedColors).toBe(true)
;


    expect(zoomViewport.scale).toBe(1)
;


    expect(zoomViewport.visibleWidth).toBeLessThanOrEqual(390 / 4)
;


    expect(zoomViewport.visibleHeight).toBeLessThanOrEqual(360 / 4)
;


    await focusByTab(page, 'button-load-historical-reference-preview-golden_image')
;


    const loadRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl)
;


    await page.keyboard.press('Enter')
;


    await Promise.all([historicalRequestStarted, loadRequest])
;


    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading')
;


    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image')
;

    const load = page.getByTestId('button-load-historical-reference-preview-golden_image')
;

    await expect(historicalLoading).toBeVisible()
;


    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0)
;

    await expect(hide).toBeFocused()
;

    await expectVisibleForcedColorsFocus(hide)
;

    await expectKeyboardFocusWithinViewport(hide)
;

    await expectForcedColorsFocusPainted(hide)
;


    releaseHistoricalResponse?.()
;

    await expectLoadedImage(historicalImage)
;

    await expect(historicalLoading).toHaveCount(0)
;


    await expect(hide).toBeFocused()
;


    await expectVisibleForcedColorsFocus(hide)
;


    await expectKeyboardFocusWithinViewport(hide)
;


    await expectForcedColorsFocusPainted(hide)
;

    await page.keyboard.press('Enter')
;

    await expect(hide).toHaveCount(0)
;

    await expect(load).toBeFocused()
;

    await expectVisibleForcedColorsFocus(load)
;

    await expectKeyboardFocusWithinViewport(load)
;

    await expectForcedColorsFocusPainted(load)
;

    await page.keyboard.press('Enter')
;


    await expectLoadedImage(historicalImage)
;


    await expect(historicalLoading).toHaveCount(0)
;


    await expect(hide).toBeFocused()
;


    await expectVisibleForcedColorsFocus(hide)
;


    await expectKeyboardFocusWithinViewport(hide)
;


    await expectForcedColorsFocusPainted(hide)
;


}

 finally 
{


    releaseHistoricalResponse?.()
;


}


}

)
;


test('historical preview Retry keeps Hide focused and visibly outlined at 400% zoom in forced-colors mode through recovery', async (
{

 page 
}

) => 
{


  await page.setViewportSize(
{

 width: 420, height: 960
}

)
;


  await page.emulateMedia(
{

 forcedColors: 'active', reducedMotion: 'reduce' 
}

)
;


  let historicalRequests = 0
;


  let releaseRetryResponse: (() => void) | undefined
;


  let notifyRetryStarted: (() => void) | undefined
;


  const retryResponse = new Promise<void>((resolve) => 
{


    releaseRetryResponse = resolve
;


}

)
;


  const retryStarted = new Promise<void>((resolve) => 
{


    notifyRetryStarted = resolve
;


}

)
;


  await page.route('**/*', async (route) => 
{


    const url = new URL(route.request().url())
;


    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') 
{


      await route.continue()
;


      return
;


}


    if (url.href === historicalSourceUrl) 
{


      historicalRequests += 1
;


      if (historicalRequests === 1) 
{


        await route.abort('failed')
;


        return
;


}


      notifyRetryStarted?.()
;


      await retryResponse
;


      await route.fulfill(
{


        status: 200,
        contentType: 'image/png',
        headers: 
{

 'cache-control': 'no-store' 
}

,
        body: onePixelPng,
      
}

)
;


      return
;


}


    if (url.hostname === 'images.example.test') 
{


      await route.fulfill(
{

 status: 200, contentType: 'image/png', body: onePixelPng 
}

)
;


      return
;


}


    await route.abort()
;


}

)
;


  try 
{


    await page.goto('/browser-tests/fixture.html')
;


    const dialog = page.getByRole('dialog', 
{

 name: 'Style checklist: Saved cover' 
}

)
;


    await expect(dialog).toBeVisible()
;


    await dialog.evaluate((element) => 
{


      element.style.maxHeight = '92dvh'
;


      element.style.overflowY = 'auto'
;


}

)
;


    // Model 400% browser zoom with a reflowed CSS viewport one quarter the
    // original dimensions. Page-scale emulation only simulates pinch zoom.
    await page.setViewportSize(
{

 width: 105, height: 240
}

)
;


    const zoomViewport = await page.evaluate(() => (
{


      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
    
}

))
;


    expect(zoomViewport.forcedColors).toBe(true)
;


    expect(zoomViewport.scale).toBe(1)
;


    expect(zoomViewport.visibleWidth).toBeLessThanOrEqual(420 / 4)
;


    expect(zoomViewport.visibleHeight).toBeLessThanOrEqual(960 / 4)
;


    await focusByTab(page, 'button-load-historical-reference-preview-golden_image')
;


    const initialFailure = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalSourceUrl,
    )
;


    await page.keyboard.press('Enter')
;


    await initialFailure
;


    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image')
;


    await focusByTab(page, 'button-retry-historical-reference-preview-golden_image')
;


    await expect(retry).toBeFocused()
;


    await expectVisibleForcedColorsFocus(retry)
;


    await expectKeyboardFocusWithinViewport(retry)
;


    const retryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl)
;


    await page.keyboard.press('Enter')
;


    await Promise.all([retryStarted, retryRequest])
;


    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image')
;


    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading')
;


    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image')
;


    await expect(historicalLoading).toBeVisible()
;


    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0)
;


    await expect(hide).toBeFocused()
;


    await expectVisibleForcedColorsFocus(hide)
;


    await expectKeyboardFocusWithinViewport(hide)
;


    releaseRetryResponse?.()
;


    await expectLoadedImage(historicalImage)
;


    await expect(historicalLoading).toHaveCount(0)
;


    await expect(hide).toBeFocused()
;


    await expectVisibleForcedColorsFocus(hide)
;


    await expectKeyboardFocusWithinViewport(hide)
;


    await expectForcedColorsFocusPainted(hide)
;


    expect(historicalRequests).toBe(2)
;


}

 finally 
{


    releaseRetryResponse?.()
;


}


}

)
;


test('historical preview Retry keeps Hide focused and visibly outlined at actual Firefox 400% page zoom through recovery', async ({}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('The Firefox browser-zoom test requires the configured base URL');
  }

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'historical-firefox-browser-zoom-'));
  let context: Awaited<ReturnType<typeof firefox.launchPersistentContext>> | undefined;
  let historicalRequests = 0;
  let pageOneRequests = 0;
  let releasePageOneReloadResponse: (() => void) | undefined;
  let notifyPageOneReloadStarted: (() => void) | undefined;
  const pageOneReloadResponse = new Promise<void>((resolve) => {
    releasePageOneReloadResponse = resolve;
  });
  const pageOneReloadStarted = new Promise<void>((resolve) => {
    notifyPageOneReloadStarted = resolve;
  });
  let releaseRetryResponse: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  const retryStarted = new Promise<void>((resolve) => {
    notifyRetryStarted = resolve;
  });

  try {
    seedFirefox400PercentPageZoom(userDataDir);
    context = await firefox.launchPersistentContext(userDataDir, {
      baseURL,
      headless: true,
      viewport: { width: 420, height: 960 },
      firefoxUserPrefs: { 'browser.zoom.siteSpecific': true },
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }

      if (url.pathname === new URL(frontPageSourceUrl).pathname) {
        pageOneRequests += 1;
        if (pageOneRequests === 1) {
          await route.fulfill({
            status: 503,
            contentType: 'image/png',
            headers: { 'cache-control': 'no-store' },
            body: 'Temporary image host failure',
          });
          return;
        }

        notifyPageOneReloadStarted?.();
        await pageOneReloadResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
        return;
      }

      if (url.href === historicalSourceUrl) {
        historicalRequests += 1;
        if (historicalRequests === 1) {
          await route.abort('failed');
          return;
        }

        notifyRetryStarted?.();
        await retryResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
        return;
      }

      if (url.hostname === 'images.example.test') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
        return;
      }

      await route.abort();
    });

    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });

    const zoomViewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.viewportWidth).toBe(105);
    expect(zoomViewport.viewportHeight).toBe(240);
    expect(zoomViewport.visibleWidth).toBe(105);
    expect(zoomViewport.visibleHeight).toBe(240);

    const pageOneLoad = page.getByTestId('button-load-reference-preview-front_page');
    const pageOneHide = page.getByTestId('button-hide-reference-preview-front_page');
    const pageOneImage = page.getByTestId('img-comparison-reference-front_page');
    const initialPageOneFailure = page.waitForResponse(
      (response) => new URL(response.url()).pathname === new URL(frontPageSourceUrl).pathname &&
        response.status() === 503,
    );
    await focusByTab(page, 'button-load-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await initialPageOneFailure;
    await expect(page.getByTestId('button-retry-reference-preview-front_page')).toBeVisible();

    await focusByTab(page, 'button-hide-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await expect(pageOneLoad).toBeVisible();
    await expect(pageOneLoad).toBeFocused();
    await expectVisibleForcedColorsFocus(pageOneLoad);
    await expectKeyboardFocusWithinViewport(pageOneLoad);
    await expectForcedColorsFocusPainted(pageOneLoad, 1);

    const pageOneReloadRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === new URL(frontPageSourceUrl).pathname,
    );
    await page.keyboard.press('Enter');
    await Promise.all([pageOneReloadStarted, pageOneReloadRequest]);
    await expect(page.getByTestId('img-comparison-reference-front_page-loading')).toBeVisible();
    await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0);
    await expect(pageOneHide).toBeFocused();
    await expectVisibleForcedColorsFocus(pageOneHide);
    await expectKeyboardFocusWithinViewport(pageOneHide);
    await expectForcedColorsFocusPainted(pageOneHide, 1);
    expect(pageOneRequests).toBe(2);

    releasePageOneReloadResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(pageOneHide).toBeFocused();
    await expectVisibleForcedColorsFocus(pageOneHide);
    await expectKeyboardFocusWithinViewport(pageOneHide);
    await expectForcedColorsFocusPainted(pageOneHide, 1);

    const load = page.getByTestId('button-load-historical-reference-preview-golden_image');
    await expect(load).toBeVisible();
    await focusByTab(page, 'button-load-historical-reference-preview-golden_image');
    const initialFailure = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalSourceUrl,
    );
    await page.keyboard.press('Enter');
    await initialFailure;

    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeVisible();
    await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);

    const retryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([retryStarted, retryRequest]);

    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image');
    await expect(historicalLoading).toBeVisible();
    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    // Firefox keeps the original screenshot bitmap size but maps page content in CSS pixels.
    await expectForcedColorsFocusPainted(hide, 1);
    expect(historicalRequests).toBe(2);

    releaseRetryResponse?.();
    await expectLoadedImage(historicalImage);
    await expect(historicalLoading).toHaveCount(0);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide, 1);
    await page.keyboard.press('Enter');
    await expect(load).toBeVisible();
    await expect(load).toBeFocused();
    await expectVisibleForcedColorsFocus(load);
    await expectKeyboardFocusWithinViewport(load);
    await expectForcedColorsFocusPainted(load, 1);
  } finally {
    releasePageOneReloadResponse?.();
    releaseRetryResponse?.();
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test('historical preview Retry recovers after a second failure at actual Firefox 400% page zoom in forced-colors mode', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'firefox', 'This check requires native Firefox page zoom');
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('The Firefox browser-zoom test requires the configured base URL');
  }

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'historical-firefox-retry-failure-zoom-'));
  let context: Awaited<ReturnType<typeof firefox.launchPersistentContext>> | undefined;

  let historicalRequests = 0;
  let releaseRetryResponse: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  let releaseSuccessfulRetryResponse: (() => void) | undefined;
  let notifySuccessfulRetryStarted: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  const retryStarted = new Promise<void>((resolve) => {
    notifyRetryStarted = resolve;
  });
  const successfulRetryResponse = new Promise<void>((resolve) => {
    releaseSuccessfulRetryResponse = resolve;
  });
  const successfulRetryStarted = new Promise<void>((resolve) => {
    notifySuccessfulRetryStarted = resolve;
  });

  try {
    seedFirefox400PercentPageZoom(userDataDir);
    context = await firefox.launchPersistentContext(userDataDir, {
      baseURL,
      headless: true,
      viewport: { width: 420, height: 640 },
      firefoxUserPrefs: { 'browser.zoom.siteSpecific': true },
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }

      if (url.href === historicalSourceUrl) {
        historicalRequests += 1;
        if (historicalRequests === 1) {
          await route.abort('failed');
          return;
        }

        if (historicalRequests === 2) {
          notifyRetryStarted?.();
          await retryResponse;
          await route.fulfill({
            status: 503,
            contentType: 'image/png',
            headers: { 'cache-control': 'no-store' },
            body: 'Temporary image host failure',
          });
          return;
        }

        notifySuccessfulRetryStarted?.();
        await successfulRetryResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
        return;
      }

      if (url.hostname === 'images.example.test') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
        return;
      }

      await route.abort();
    });

    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const zoomViewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.viewportWidth).toBe(420 / 4);
    expect(zoomViewport.viewportHeight).toBe(640 / 4);
    expect(zoomViewport.visibleWidth).toBe(420 / 4);
    expect(zoomViewport.visibleHeight).toBe(640 / 4);

    await focusByTab(page, 'button-load-historical-reference-preview-golden_image');
    const initialFailure = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalSourceUrl,
    );
    await page.keyboard.press('Enter');
    await initialFailure;
    expect(historicalRequests).toBe(1);

    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);

    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image');
    const secondFailure = page.waitForResponse(
      (response) => response.url() === historicalSourceUrl && response.status() === 503,
    );
    const secondRetryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([retryStarted, secondRetryRequest]);
    await expect(hide).toBeVisible();
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);

    releaseRetryResponse?.();
    await secondFailure;
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image')).toBeVisible();
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);
    // Firefox keeps the original screenshot bitmap size but maps page content in CSS pixels.
    await expectForcedColorsFocusPainted(retry, 1);
    expect(historicalRequests).toBe(2);

    const thirdRetryRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([successfulRetryStarted, thirdRetryRequest]);
    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    await expect(historicalLoading).toBeVisible();
    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide, 1);
    expect(historicalRequests).toBe(3);

    releaseSuccessfulRetryResponse?.();
    await expectLoadedImage(historicalImage);
    await expect(historicalLoading).toHaveCount(0);
    await expect(historicalImage).toBeVisible();
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide, 1);
  } finally {
    releaseRetryResponse?.();
    releaseSuccessfulRetryResponse?.();
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test('protected historical image Retry recovers after three failures at actual Firefox 400% page zoom in forced-colors mode', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'firefox', 'This check requires native Firefox page zoom');
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error('The Firefox browser-zoom test requires the configured base URL');
  }

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'protected-historical-firefox-retry-failure-zoom-'));
  let context: Awaited<ReturnType<typeof firefox.launchPersistentContext>> | undefined;
  let historicalRequests = 0;
  const retryGates = Array.from({ length: 3 }, () => {
    let release!: () => void;
    let notifyStarted!: () => void;
    return {
      response: new Promise<void>((resolve) => {
        release = resolve;
      }),
      started: new Promise<void>((resolve) => {
        notifyStarted = resolve;
      }),
      release: () => release(),
      notifyStarted: () => notifyStarted(),
    };
  });

  try {
    seedFirefox400PercentPageZoom(userDataDir);
    context = await firefox.launchPersistentContext(userDataDir, {
      baseURL,
      headless: true,
      viewport: { width: 420, height: 640 },
      firefoxUserPrefs: { 'browser.zoom.siteSpecific': true },
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === savedArtworkUrl) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
        return;
      }

      if (url.pathname === historicalArtworkUrl) {
        historicalRequests += 1;
        if (historicalRequests > 1) {
          const retryGate = retryGates[historicalRequests - 2];
          if (!retryGate) {
            throw new Error(`Unexpected protected historical image request #${historicalRequests}`);
          }
          retryGate.notifyStarted();
          await retryGate.response;
        }
        await route.fulfill(historicalRequests === 4
          ? {
            status: 200,
            contentType: 'image/png',
            headers: { 'cache-control': 'no-store' },
            body: onePixelPng,
          }
          : {
            status: 503,
            contentType: 'text/plain',
            headers: { 'cache-control': 'no-store' },
            body: 'Temporary protected storage failure',
          });
        return;
      }

      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }

      if (url.hostname === 'images.example.test') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
        return;
      }

      await route.abort();
    });

    const firstFailure = page.waitForResponse(
      (response) => new URL(response.url()).pathname === historicalArtworkUrl && response.status() === 503,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const zoomViewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.viewportWidth).toBe(420 / 4);
    expect(zoomViewport.viewportHeight).toBe(640 / 4);
    expect(zoomViewport.visibleWidth).toBe(420 / 4);
    expect(zoomViewport.visibleHeight).toBe(640 / 4);

    await firstFailure;
    expect(historicalRequests).toBe(1);
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage');

    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);

    const secondFailure = page.waitForResponse(
      (response) => new URL(response.url()).pathname === historicalArtworkUrl && response.status() === 503,
    );
    const secondRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    );
    await page.keyboard.press('Enter');
    await Promise.all([retryGates[0].started, secondRetryRequest]);

    retryGates[0].release();
    await secondFailure;
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);
    expect(historicalRequests).toBe(2);

    const thirdFailure = page.waitForResponse(
      (response) => new URL(response.url()).pathname === historicalArtworkUrl && response.status() === 503,
    );
    const thirdRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    );
    await page.keyboard.press('Enter');
    await Promise.all([retryGates[1].started, thirdRetryRequest]);

    retryGates[1].release();
    await thirdFailure;
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);
    // Firefox keeps the original screenshot bitmap size but maps page content in CSS pixels.
    await expectForcedColorsFocusPainted(retry, 1);
    expect(historicalRequests).toBe(3);

    const successfulRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    );
    await page.keyboard.press('Enter');
    await Promise.all([retryGates[2].started, successfulRetryRequest]);

    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    const originalLink = page.getByRole('link', { name: 'Inspect historical reference original' });
    await expect(historicalImage).toHaveAttribute('src', /\/api\/storage\/private\/historical-reference\.png$/);
    await expect(originalLink).toHaveAttribute('href', /\/api\/storage\/private\/historical-reference\.png$/);
    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0);
    await expect(originalLink).toBeFocused();
    await expectVisibleForcedColorsFocus(originalLink);
    await expectKeyboardFocusWithinViewport(originalLink);
    await expectForcedColorsFocusPainted(originalLink, 1);
    expect(historicalRequests).toBe(4);

    retryGates[2].release();
    await expectLoadedImage(historicalImage);
    await expect(historicalImage).toBeVisible();
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image')).toHaveCount(0);
    await expect(retry).toHaveCount(0);
    await expect(originalLink).toBeFocused();
    await expectVisibleForcedColorsFocus(originalLink);
    await expectKeyboardFocusWithinViewport(originalLink);
    await expectForcedColorsFocusPainted(originalLink, 1);
  } finally {
    retryGates.forEach((retryGate) => retryGate.release());
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test('historical preview Retry remains focused and visibly outlined when its second image transfer is interrupted at 400% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 640 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let historicalRequests = 0;
  let notifyPartialResponseStarted!: () => void;
  let interruptPartialResponse: (() => void) | undefined;
  const partialResponseStarted = new Promise<void>((resolve) => {
    notifyPartialResponseStarted = resolve;
  });
  const partialImageBytes = onePixelPng.subarray(0, onePixelPng.length - 8);
  const imageHost = createServer((request, response) => {
    if (new URL(request.url ?? '/', 'http://127.0.0.1').pathname !== '/historical.png') {
      response.writeHead(404).end();
      return;
    }

    historicalRequests += 1;
    response.writeHead(historicalRequests === 1 ? 503 : 200, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      ...(historicalRequests === 2 ? { 'content-length': onePixelPng.length + 128 } : {}),
    });
    if (historicalRequests === 1) {
      response.end('Temporary image host failure');
      return;
    }

    if (historicalRequests === 3) {
      response.end(onePixelPng);
      return;
    }

    response.write(partialImageBytes, () => notifyPartialResponseStarted());
    interruptPartialResponse = () => response.socket?.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const imageOrigin = `http://127.0.0.1:${address.port}`;
    const historicalUrl = new URL('/historical.png', imageOrigin).href;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }
      await route.abort();
    });

    await page.goto(`/browser-tests/fixture.html?imageHost=${encodeURIComponent(imageOrigin)}`);
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    // Model 400% browser zoom with a reflowed CSS viewport one quarter the
    // original dimensions. Page-scale emulation only simulates pinch zoom.
    await page.setViewportSize({ width: 105, height: 160 });
    const zoomViewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.visibleWidth).toBe(420 / 4);
    expect(zoomViewport.visibleHeight).toBe(640 / 4);

    await focusByTab(page, 'button-load-historical-reference-preview-golden_image');
    const firstFailure = page.waitForResponse(
      (response) => response.url() === historicalUrl && response.status() === 503,
    );
    await page.keyboard.press('Enter');
    await firstFailure;

    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);

    const partialResponse = page.waitForResponse(
      (response) => response.url() === historicalUrl && response.status() === 200,
    );
    await page.keyboard.press('Enter');
    await Promise.all([partialResponse, partialResponseStarted]);
    expect(partialImageBytes.byteLength).toBeGreaterThan(0);

    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image');
    await expect(historicalLoading).toBeVisible();
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);

    const interruptedTransfer = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalUrl,
    );
    interruptPartialResponse?.();
    const failedRequest = await interruptedTransfer;
    expect(failedRequest.failure()).not.toBeNull();

    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);
    expect(historicalRequests).toBe(2);

    const recoveredResponse = page.waitForResponse(
      (response) => response.url() === historicalUrl && response.status() === 200,
    );
    await page.keyboard.press('Enter');
    await recoveredResponse;

    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    await expect(historicalImage).toHaveAttribute('src', historicalUrl);
    await expectLoadedImage(historicalImage);
    expect(historicalRequests).toBe(3);
  } finally {
    interruptPartialResponse?.();
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('historical preview Retry remains focused and visibly outlined when its second request is interrupted at 400% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 960 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let historicalRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.href === historicalSourceUrl) {
      historicalRequests += 1;
      if (historicalRequests === 1) {
        await route.abort('failed');
      } else if (historicalRequests === 2) {
        await route.abort('connectionreset');
      } else {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      }
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    await route.abort();
  });

  await page.goto('/browser-tests/fixture.html');
  const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) => {
    element.style.maxHeight = '92dvh';
    element.style.overflowY = 'auto';
  });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

  // Model 400% browser zoom with a reflowed CSS viewport one quarter the
  // original dimensions. Page-scale emulation only simulates pinch zoom.
  await page.setViewportSize({ width: 105, height: 240 });
  const zoomViewport = await page.evaluate(() => ({
    forcedColors: matchMedia('(forced-colors: active)').matches,
    scale: window.visualViewport?.scale,
    visibleWidth: window.visualViewport?.width,
    visibleHeight: window.visualViewport?.height,
  }));
  expect(zoomViewport.forcedColors).toBe(true);
  expect(zoomViewport.scale).toBe(1);
  expect(zoomViewport.visibleWidth).toBe(420 / 4);
  expect(zoomViewport.visibleHeight).toBe(960 / 4);

  await focusByTab(page, 'button-load-historical-reference-preview-golden_image');
  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === historicalSourceUrl,
  );
  await page.keyboard.press('Enter');
  await initialFailure;

  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  await expectVisibleForcedColorsFocus(retry);
  await expectForcedColorsFocusPainted(retry);

  const secondFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === historicalSourceUrl,
  );
  await page.keyboard.press('Enter');
  const interruptedRequest = await secondFailure;

  expect(interruptedRequest.failure()).not.toBeNull();
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  await expectVisibleForcedColorsFocus(retry);
  await expectKeyboardFocusWithinViewport(retry);
  expect(historicalRequests).toBe(2);

  const unavailableNotice = page.getByTestId('notice-historical-reference-unavailable-golden_image');
  await expect(unavailableNotice).toBeVisible();

  const recoveredRequest = page.waitForRequest((request) => request.url() === historicalSourceUrl);
  await retry.click();
  await recoveredRequest;

  const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
  await expectLoadedImage(historicalImage);
  await expect(unavailableNotice).toHaveCount(0);
  expect(historicalRequests).toBe(3);
});

test('protected historical image Retry stays visible and focused after an interrupted transfer', async ({ page }) => {
  let historicalRequests = 0;
  const partialAttempts: {
    started: Promise<void>;
    notifyStarted: () => void;
    interrupt?: () => void;
  }[] = [];
  const partialImageBytes = onePixelPng.subarray(0, 24);
  const imageHost = createServer((request, response) => {
    if (new URL(request.url ?? '/', 'http://127.0.0.1').pathname !== '/historical.png') {
      response.writeHead(404).end();
      return;
    }

    historicalRequests += 1;
    if (historicalRequests <= 2) {
      let notifyStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        notifyStarted = resolve;
      });
      const attempt = { started, notifyStarted } as (typeof partialAttempts)[number];
      partialAttempts.push(attempt);
      response.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': 'no-store',
        'content-length': onePixelPng.length + 128,
      });
      response.write(partialImageBytes, () => {
        attempt.notifyStarted();
        attempt.interrupt = () => response.socket?.destroy();
      });
      return;
    }

    response.writeHead(200, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    });
    response.end(onePixelPng);
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const imageOrigin = `http://127.0.0.1:${address.port}`;
    const historicalUrl = new URL('/historical.png', imageOrigin).href;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === historicalArtworkUrl) {
        await route.fulfill({
          status: 302,
          headers: {
            'cache-control': 'no-store',
            location: historicalUrl,
          },
        });
      } else if (url.pathname === savedArtworkUrl) {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
      } else if (url.hostname === 'images.example.test') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      } else {
        await route.abort();
      }
    });

    const initialInterruptedTransfer = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => partialAttempts.length).toBe(1);
    await partialAttempts[0].started;
    expect(partialImageBytes.byteLength).toBeGreaterThan(0);
    partialAttempts[0].interrupt?.();
    const initialFailure = await initialInterruptedTransfer;
    expect(initialFailure.failure()).not.toBeNull();
    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage');

    const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');

    const retryTransfer = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === historicalUrl,
    );
    await page.keyboard.press('Enter');
    await expect.poll(() => partialAttempts.length).toBe(2);
    await partialAttempts[1].started;
    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    await expect(historicalImage).toHaveCount(1);
    await expect(historicalImage).toHaveJSProperty('naturalWidth', 0);
    await expect(retry).toHaveCount(0);
    partialAttempts[1].interrupt?.();
    const retryFailure = await retryTransfer;
    expect(retryFailure.failure()).not.toBeNull();

    await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
      .toContainText('unavailable from protected storage');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    expect(historicalRequests).toBe(2);

    const recoveredResponse = page.waitForResponse(
      (response) => response.url() === historicalUrl && response.status() === 200,
    );
    await page.keyboard.press('Enter');
    await recoveredResponse;
    await expectLoadedImage(historicalImage);
    await expect(retry).toHaveCount(0);
    expect(historicalRequests).toBe(3);
  } finally {
    partialAttempts.forEach((attempt) => attempt.interrupt?.());
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('a hidden historical preview stays hidden when its partial image transfer fails', async ({ page }) => {
  let notifyPartialResponseStarted!: () => void;
  let interruptPartialResponse: (() => void) | undefined;
  const partialResponseStarted = new Promise<void>((resolve) => {
    notifyPartialResponseStarted = resolve;
  });
  const partialImageBytes = onePixelPng.subarray(0, onePixelPng.length - 8);
  const imageHost = createServer((request, response) => {
    if (new URL(request.url ?? '/', 'http://127.0.0.1').pathname !== '/historical.png') {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      'content-length': onePixelPng.length + 128,
    });
    response.write(partialImageBytes, () => notifyPartialResponseStarted());
    interruptPartialResponse = () => response.socket?.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const imageOrigin = `http://127.0.0.1:${address.port}`;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }
      await route.abort();
    });

    await page.goto(`/browser-tests/fixture.html?imageHost=${encodeURIComponent(imageOrigin)}`);
    const historicalUrl = new URL('/historical.png', imageOrigin).href;
    const load = page.getByTestId('button-load-historical-reference-preview-golden_image');
    const request = page.waitForRequest((item) => item.url() === historicalUrl);
    const partialResponse = page.waitForResponse(
      (response) => response.url() === historicalUrl && response.status() === 200,
    );
    await load.click();
    await Promise.all([request, partialResponse, partialResponseStarted]);
    expect(partialImageBytes.byteLength).toBeGreaterThan(0);

    const historicalImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    const historicalLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const hide = page.getByTestId('button-hide-historical-reference-preview-golden_image');
    const hiddenAnnouncement = page.getByTestId('notice-historical-reference-preview-hidden');
    await expect(historicalLoading).toBeVisible();
    await hide.click();
    await expect(hiddenAnnouncement).toHaveText('Historical Golden Image preview hidden.');
    await expect(load).toBeVisible();

    const interruptedTransfer = page.waitForEvent(
      'requestfailed',
      (failedRequest) => failedRequest.url() === historicalUrl,
    );
    interruptPartialResponse?.();
    const failedRequest = await interruptedTransfer;
    expect(failedRequest.failure()).not.toBeNull();

    await expect(load).toBeVisible();
    await expect(hide).toHaveCount(0);
    await expect(historicalImage).toHaveCount(0);
    await expect(historicalLoading).toHaveCount(0);
    await expect(page.getByTestId('button-retry-historical-reference-preview-golden_image')).toHaveCount(0);
    await expect(hiddenAnnouncement).toHaveText('Historical Golden Image preview hidden.');
  } finally {
    interruptPartialResponse?.();
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('Page 1 reload keeps Hide focused and visibly outlined at 400% zoom in forced-colors mode while loading', async (
{

}

, testInfo) => 
{


  const projectLaunchOptions = testInfo.project.use.launchOptions as 
{


    args?: string[]
;


    executablePath?: string
;


}

;


  const baseURL = testInfo.project.use.baseURL
;


  if (typeof baseURL !== 'string') 
{


    throw new Error('The Chromium browser-zoom test requires the configured base URL')
;


}


  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'page-one-browser-zoom-'))
;


  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined
;


  let pageOneRequests = 0
;


  let releaseReloadResponse: (() => void) | undefined
;


  let notifyReloadStarted: (() => void) | undefined
;


  const reloadResponse = new Promise<void>((resolve) => 
{


    releaseReloadResponse = resolve
;


}

)
;


  const reloadStarted = new Promise<void>((resolve) => 
{


    notifyReloadStarted = resolve
;


}

)
;


  try 
{


    context = await chromium.launchPersistentContext(userDataDir, 
{


      args: projectLaunchOptions.args,
      baseURL,
      executablePath: projectLaunchOptions.executablePath,
      headless: true,
      viewport: 
{

 width: 390, height: 360 
}

,
    
}

)
;


    const page = context.pages()[0] ?? await context.newPage()
;


    await page.emulateMedia(
{

 forcedColors: 'active', reducedMotion: 'reduce' 
}

)
;


    const initialDevicePixelRatio = await page.evaluate(() => window.devicePixelRatio)
;


    // Set browser zoom through Chromium's settings page, not viewport or pinch emulation.
    await page.goto('chrome://settings/appearance');
    const pageZoom = page.locator('#zoomLevel');
    await expect(pageZoom).toHaveValue('1');
    await pageZoom.selectOption('4');
    await expect(pageZoom).toHaveValue('4');
    await expect(pageZoom.locator('option:checked')).toHaveText('400%');

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue();
        return;
      }

      if (url.href === frontPageSourceUrl) {
        pageOneRequests += 1;
        if (pageOneRequests === 1) {
          await route.fulfill({
            status: 503,
            contentType: 'image/png',
            headers: { 'cache-control': 'no-store' },
            body: 'Temporary image host failure',
          });
          return;
        }

        notifyReloadStarted?.();
        await reloadResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
        return;
      }

      if (url.hostname === 'images.example.test') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
        return;
      }

      await route.abort();
    });

    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const pageOneImage = page.getByTestId('img-comparison-reference-front_page');
    const hide = page.getByTestId('button-hide-reference-preview-front_page');
    const load = page.getByTestId('button-load-reference-preview-front_page');
    const firstFailure = page.waitForResponse(
      (response) => response.url() === frontPageSourceUrl && response.status() === 503,
    );
    await focusByTab(page, 'button-load-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await firstFailure;
    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();

    await focusByTab(page, 'button-hide-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await expect(load).toBeVisible();
    await expect(load).toBeFocused();

    const zoomViewport = await page.evaluate(() => ({
      devicePixelRatio: window.devicePixelRatio,
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.devicePixelRatio / initialDevicePixelRatio).toBe(4);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.visibleWidth).toBeGreaterThanOrEqual(390 / 4 - 1);
    expect(zoomViewport.visibleWidth).toBeLessThanOrEqual(390 / 4 + 1);
    expect(zoomViewport.visibleHeight).toBeGreaterThanOrEqual(360 / 4 - 1);
    expect(zoomViewport.visibleHeight).toBeLessThanOrEqual(360 / 4 + 1);

    await focusByTab(page, 'button-load-reference-preview-front_page');
    const reloadRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([reloadStarted, reloadRequest]);

    await expect(page.getByTestId('img-comparison-reference-front_page-loading')).toBeVisible();
    await expect(hide).toBeVisible();
    await expect(hide).toBeFocused();
    await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0);
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide);
    expect(pageOneRequests).toBe(2);

    releaseReloadResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide);

  } finally {
    releaseReloadResponse?.();
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test('Page 1 failed reload keeps Retry focused and visibly outlined at 400% zoom in forced-colors mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let pageOneRequests = 0;
  let releaseReloadResponse: (() => void) | undefined;
  let notifyReloadStarted: (() => void) | undefined;
  const reloadResponse = new Promise<void>((resolve) => {
    releaseReloadResponse = resolve;
  });
  const reloadStarted = new Promise<void>((resolve) => {
    notifyReloadStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.href === frontPageSourceUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: 'Temporary image host failure',
        });
        return;
      }

      notifyReloadStarted?.();
      await reloadResponse;
      await route.fulfill({
        status: 503,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: 'Temporary image host failure',
      });
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    await route.abort();
  });

  try {
    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const hide = page.getByTestId('button-hide-reference-preview-front_page');
    const load = page.getByTestId('button-load-reference-preview-front_page');
    const firstFailure = page.waitForResponse(
      (response) => response.url() === frontPageSourceUrl && response.status() === 503,
    );
    await focusByTab(page, 'button-load-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await firstFailure;
    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();

    await focusByTab(page, 'button-hide-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await expect(load).toBeVisible();
    await expect(load).toBeFocused();

    // Model 400% browser zoom with a reflowed CSS viewport one quarter the
    // original dimensions. Page-scale emulation only simulates pinch zoom.
    await page.setViewportSize({ width: 96, height: 90 });
    const zoomViewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
    }));
    expect(zoomViewport.forcedColors).toBe(true);
    expect(zoomViewport.scale).toBe(1);
    expect(zoomViewport.visibleWidth).toBeLessThanOrEqual(390 / 4);
    expect(zoomViewport.visibleHeight).toBeLessThanOrEqual(360 / 4);

    await focusByTab(page, 'button-load-reference-preview-front_page');
    const reloadRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await load.press('Enter');
    await Promise.all([reloadStarted, reloadRequest]);

    const loading = page.getByTestId('img-comparison-reference-front_page-loading');
    await expect(loading).toBeVisible();
    await expect(hide).toBeVisible();
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    expect(pageOneRequests).toBe(2);

    const failedReload = page.waitForResponse(
      (response) => response.url() === frontPageSourceUrl && response.status() === 503,
    );
    releaseReloadResponse?.();
    await failedReload;
    await expect(loading).toHaveCount(0);
    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();

    const retry = page.getByTestId('button-retry-reference-preview-front_page');
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    await expectVisibleForcedColorsFocus(retry);
    await expectKeyboardFocusWithinViewport(retry);
    await expectForcedColorsFocusPainted(retry);
    expect(pageOneRequests).toBe(2);

    for (const width of [99, 100, 101]) {
      await page.setViewportSize({ width, height: 90 });
      await expect(retry).toBeFocused();

      const responsiveState = await page.evaluate(() => ({
        forcedColors: matchMedia('(forced-colors: active)').matches,
        narrowLayout: matchMedia('(max-width: 100px)').matches,
        visibleWidth: window.visualViewport?.width,
      }));
      expect(responsiveState.forcedColors).toBe(true);
      expect(responsiveState.narrowLayout).toBe(width <= 100);
      expect(responsiveState.visibleWidth).toBe(width);

      await expectVisibleForcedColorsFocus(retry);
      await expectKeyboardFocusWithinViewport(retry);
      await expectForcedColorsFocusPainted(retry);
    }
  } finally {
    releaseReloadResponse?.();
  }
});

async function runPageOneReloadFocusCheck(page: Page, use400PercentViewport: boolean) {
  await page.setViewportSize(use400PercentViewport
    ? { width: 390, height: 360 }
    : { width: 390, height: 320 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let pageOneRequests = 0;
  let releaseReloadResponse: (() => void) | undefined;
  let notifyReloadStarted: (() => void) | undefined;
  const reloadResponse = new Promise<void>((resolve) => {
    releaseReloadResponse = resolve;
  });
  const reloadStarted = new Promise<void>((resolve) => {
    notifyReloadStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.href === frontPageSourceUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: 'Temporary image host failure',
        });
        return;
      }

      notifyReloadStarted?.();
      await reloadResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    await route.abort();
  });

  try {
    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const pageOneImage = page.getByTestId('img-comparison-reference-front_page');
    const hide = page.getByTestId('button-hide-reference-preview-front_page');
    const load = page.getByTestId('button-load-reference-preview-front_page');
    const firstFailure = page.waitForResponse(
      (response) => response.url() === frontPageSourceUrl && response.status() === 503,
    );
    await focusByTab(page, 'button-load-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await firstFailure;
    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();

    await focusByTab(page, 'button-hide-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await expect(load).toBeVisible();
    await expect(load).toBeFocused();

    if (use400PercentViewport) {
      // Model 400% browser zoom with a reflowed CSS viewport one quarter the
      // original dimensions. Page-scale emulation only simulates pinch zoom.
      await page.setViewportSize({ width: 96, height: 90 });
      const zoomViewport = await page.evaluate(() => ({
        forcedColors: matchMedia('(forced-colors: active)').matches,
        scale: window.visualViewport?.scale,
        visibleWidth: window.visualViewport?.width,
        visibleHeight: window.visualViewport?.height,
      }));
      expect(zoomViewport.forcedColors).toBe(true);
      expect(zoomViewport.scale).toBe(1);
      expect(zoomViewport.visibleWidth).toBeLessThanOrEqual(390 / 4);
      expect(zoomViewport.visibleHeight).toBeLessThanOrEqual(360 / 4);
    }

    await focusByTab(page, 'button-load-reference-preview-front_page');
    const reloadRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([reloadStarted, reloadRequest]);

    await expect(page.getByTestId('img-comparison-reference-front_page-loading')).toBeVisible();
    await expect(hide).toBeVisible();
    await expect(hide).toBeFocused();
    await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0);
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide);
    expect(pageOneRequests).toBe(2);

    releaseReloadResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    await expectForcedColorsFocusPainted(hide);
  } finally {
    releaseReloadResponse?.();
  }
}

test('Page 1 reload keeps Hide focused and visibly outlined in forced-colors mode while loading', async ({ page }) => {
  await runPageOneReloadFocusCheck(page, false);
});

test('Page 1 reload keeps Hide focused and visibly outlined in a simulated 400% viewport while loading', async ({ page }) => {
  await runPageOneReloadFocusCheck(page, true);
});

test('Page 1 reload keeps Hide focused and visibly outlined at 200% zoom in forced-colors mode while loading', async ({ page }, testInfo) => {
  const viewportWidth = 390;
  const viewportHeight = 320;
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let pageOneRequests = 0;
  let releaseReloadResponse: (() => void) | undefined;
  let notifyReloadStarted: (() => void) | undefined;
  const reloadResponse = new Promise<void>((resolve) => {
    releaseReloadResponse = resolve;
  });
  const reloadStarted = new Promise<void>((resolve) => {
    notifyReloadStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (url.href === frontPageSourceUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: 'Temporary image host failure',
        });
        return;
      }

      notifyReloadStarted?.();
      await reloadResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
      return;
    }

    if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      return;
    }

    await route.abort();
  });

  try {
    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      element.style.maxHeight = '92dvh';
      element.style.overflowY = 'auto';
    });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

    const pageOneImage = page.getByTestId('img-comparison-reference-front_page');
    const hide = page.getByTestId('button-hide-reference-preview-front_page');
    const load = page.getByTestId('button-load-reference-preview-front_page');
    const firstFailure = page.waitForResponse(
      (response) => response.url() === frontPageSourceUrl && response.status() === 503,
    );
    await focusByTab(page, 'button-load-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await firstFailure;
    await expect(page.getByTestId('notice-reference-unavailable-front_page')).toBeVisible();

    await focusByTab(page, 'button-hide-reference-preview-front_page');
    await page.keyboard.press('Enter');
    await expect(load).toBeVisible();
    await expect(load).toBeFocused();
    await expect(pageOneImage).toHaveCount(0);

    if (testInfo.project.name === 'chromium') {
      const zoomSession = await page.context().newCDPSession(page);
      await zoomSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    } else {
      // Playwright has no browser-UI zoom control in Firefox or WebKit. Halving
      // the CSS viewport models the narrower 200% zoom layout area.
      await page.setViewportSize({ width: 195, height: 160 });
    }
    const zoom = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      scale: window.visualViewport?.scale,
      visibleWidth: window.visualViewport?.width,
      visibleHeight: window.visualViewport?.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
    expect(zoom.forcedColors).toBe(true);
    if (testInfo.project.name === 'chromium') {
      expect(zoom.scale).toBe(2);
      expect(zoom.visibleWidth).toBeLessThanOrEqual(zoom.viewportWidth / 2);
      expect(zoom.visibleHeight).toBeLessThanOrEqual(zoom.viewportHeight / 2);
    } else {
      expect(zoom.scale).toBe(1);
      expect(zoom.visibleWidth).toBe(195);
      expect(zoom.visibleHeight).toBe(160);
      expect(zoom.viewportWidth).toBe(195);
      expect(zoom.viewportHeight).toBe(160);
      await focusByTab(page, 'button-load-reference-preview-front_page');
    }
    await expect(load).toBeFocused();
    await load.evaluate((element) => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    }));
    const reloadRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([reloadStarted, reloadRequest]);

    const loading = page.getByTestId('img-comparison-reference-front_page-loading');
    await expect(loading).toBeVisible();
    await expect(hide).toBeVisible();
    await expect(hide).toBeFocused();
    await expect(pageOneImage).toHaveJSProperty('naturalWidth', 0);
    await expectVisibleForcedColorsFocus(hide);
    if (testInfo.project.name !== 'chromium') {
      await expectForcedColorsFocusPainted(hide);
    }
    await expectKeyboardFocusWithinViewport(hide);
    expect(pageOneRequests).toBe(2);

    releaseReloadResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(hide).toBeFocused();
    await expectVisibleForcedColorsFocus(hide);
    await expectKeyboardFocusWithinViewport(hide);
    if (testInfo.project.name !== 'chromium') {
      await expectForcedColorsFocusPainted(hide);
    }
  } finally {
    releaseReloadResponse?.();
  }
});
test('newsroom form fields keep a visible focus indicator in forced-colors mode', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/browser-tests/fixture.html');
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);

  const reviewerField = page.getByLabel('Reviewer name');
  await reviewerField.focus();
  await expect(reviewerField).toBeFocused();

  const focusIndicator = await reviewerField.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.outlineColor,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusIndicator.style).toBe('solid');
  expect(focusIndicator.width).toBeGreaterThanOrEqual(3);
  expect(focusIndicator.color).not.toBe(focusIndicator.backgroundColor);
});

test('Page 1 preview retry keeps keyboard focus useful through successful recovery', async ({ page }) => {
  let pageOneRequests = 0;
  let releaseRetryResponse: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  const retryStarted = new Promise<void>((resolve) => {
    notifyRetryStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (requestUrl.href === frontPageSourceUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.abort();
        return;
      }

      notifyRetryStarted?.();
      await retryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
      return;
    }

    await route.abort();
  });

  try {
    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();

    await focusByTab(page, 'button-load-reference-preview-front_page');
    const unavailableNotice = page.getByTestId('notice-reference-unavailable-front_page');
    const firstRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await page.keyboard.press('Enter');
    await firstRequest;
    await expect(unavailableNotice).toBeVisible();
    expect(pageOneRequests).toBe(1);

    const retryButton = await focusByTab(page, 'button-retry-reference-preview-front_page');
    const retryRequest = page.waitForRequest((request) => request.url() === frontPageSourceUrl);
    await page.keyboard.press('Enter');
    await Promise.all([retryStarted, retryRequest]);

    const hideButton = page.getByTestId('button-hide-reference-preview-front_page');
    const pageOneImage = page.getByTestId('img-comparison-reference-front_page');
    await expect(page.getByTestId('img-comparison-reference-front_page-loading')).toBeVisible();
    await expect(hideButton).toBeVisible();
    await expect(hideButton).toBeFocused();
    expect(pageOneRequests).toBe(2);

    releaseRetryResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(unavailableNotice).toHaveCount(0);
    await expect(retryButton).toHaveCount(0);
    await expect(hideButton).toBeVisible();
    await expect(hideButton).toBeFocused();
  } finally {
    releaseRetryResponse?.();
  }
});

test('Golden Image Retry focus rings stay within ultra-narrow viewports in forced-colors mode', async ({ page }) => {
  await page.setViewportSize({ width: 101, height: 900 });
  await page.emulateMedia({ forcedColors: 'active' });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalArtworkUrl || url.href === sourceUrl) {
      await route.abort('failed');
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  const historicalFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1');
  await historicalFailure;
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
    .toBeVisible();

  const goldenImageLoad = page.getByTestId('button-load-reference-preview-golden_image');
  const goldenImageFailure = page.waitForEvent(
    'requestfailed',
    (request) => request.url() === sourceUrl,
  );
  await goldenImageLoad.click();
  await goldenImageFailure;
  await expect(page.getByTestId('notice-reference-unavailable-golden_image')).toBeVisible();

  const retryControls = [
    'button-retry-reference-preview-golden_image',
    'button-retry-historical-reference-preview-golden_image',
  ];
  for (const width of [99, 100, 101]) {
    await page.setViewportSize({ width, height: 900 });
    const viewport = await page.evaluate(() => ({
      forcedColors: matchMedia('(forced-colors: active)').matches,
      width: window.visualViewport?.width,
    }));
    expect(viewport.forcedColors).toBe(true);
    expect(viewport.width).toBe(width);

    for (const testId of retryControls) {
      const retry = await focusByTab(page, testId);
      await expect(retry).toBeFocused();
      await expectVisibleForcedColorsFocus(retry);
      await expectKeyboardFocusWithinViewport(retry);
      await expectForcedColorsFocusPainted(retry);
    }
  }
});

test('saved historical image Retry keeps visible keyboard focus in forced-colors mode', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  let historicalImageRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalArtworkUrl) {
      historicalImageRequests += 1;
      await route.abort('failed');
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else {
      await route.abort();
    }
  });

  const initialFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1');
  await expect(page.getByRole('dialog', { name: 'Style checklist: Saved cover' })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await initialFailure;
  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
    .toContainText('unavailable from protected storage');

  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
  await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
  await expectVisibleForcedColorsFocus(retry);
  expect(historicalImageRequests).toBe(1);
});

test('protected historical image Retry remains focused and fully outlined after a second failure at a narrow viewport in forced-colors mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });

  let historicalImageRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalArtworkUrl) {
      historicalImageRequests += 1;
      await route.abort('failed');
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else {
      await route.abort();
    }
  });

  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1');
  await expect(page.getByRole('dialog', { name: 'Style checklist: Saved cover' })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await firstFailure;
  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
    .toContainText('unavailable from protected storage');

  await page.setViewportSize({ width: 101, height: 900 });
  expect(await page.evaluate(() => window.visualViewport?.width)).toBe(101);
  const retry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await focusByTab(page, 'button-retry-historical-reference-preview-golden_image');
  await expect(retry).toBeFocused();
  await expectVisibleForcedColorsFocus(retry);
  await expectKeyboardFocusWithinViewport(retry);

  const secondFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalArtworkUrl,
  );
  const retryRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === historicalArtworkUrl,
  );
  await page.keyboard.press('Enter');
  await Promise.all([secondFailure, retryRequest]);

  await expect(page.getByTestId('notice-historical-reference-unavailable-golden_image'))
    .toContainText('unavailable from protected storage');
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  await expectVisibleForcedColorsFocus(retry);
  await expectKeyboardFocusWithinViewport(retry);
  await expectForcedColorsFocusPainted(retry);
  expect(historicalImageRequests).toBe(2);
});

test('Retry recovers the Golden Image after its first image request is aborted', async ({ page }) => {
  let requests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl || url.pathname === historicalArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else if (url.href === sourceUrl && ++requests === 1) {
      await route.abort('connectionreset');
    } else if (url.href === sourceUrl) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.hostname === 'images.example.test') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else {
      await route.abort();
    }
  });

  await page.goto('/browser-tests/fixture.html');
  const unavailable = page.getByTestId('notice-reference-unavailable-golden_image');
  const goldenImage = page.getByTestId('img-comparison-reference-golden_image');
  const retry = page.getByTestId('button-retry-reference-preview-golden_image');

  const firstRequest = page.waitForRequest((request) => request.url() === sourceUrl);
  await page.getByTestId('button-load-reference-preview-golden_image').click();
  await firstRequest;
  await expect(unavailable).toBeVisible();
  await expect(goldenImage).toHaveCount(0);
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  expect(requests).toBe(1);

  const retryRequest = page.waitForRequest((request) => request.url() === sourceUrl);
  await retry.click();
  await retryRequest;
  await expectLoadedImage(goldenImage);
  await expect(unavailable).toHaveCount(0);
  expect(requests).toBe(2);
});

test('Retry loads the Golden Image after its external host recovers', async ({ page }) => {
  let imageRequests = 0;
  const imageHost = createServer((_request, response) => {
    imageRequests += 1;
    response.writeHead(imageRequests === 1 ? 503 : 200, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    });
    response.end(imageRequests === 1 ? 'Temporary image host failure' : onePixelPng);
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const origin = `http://127.0.0.1:${address.port}`;
    const currentUrl = new URL('/current.png', origin).href;
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === '127.0.0.1' || host === 'localhost') await route.continue();
      else await route.abort();
    });
    await page.goto(`/browser-tests/fixture.html?imageHost=${encodeURIComponent(origin)}`);
    const firstRequest = page.waitForRequest((request) => request.url() === currentUrl);
    await page.getByTestId('button-load-reference-preview-golden_image').click();
    await firstRequest;
    const unavailable = page.getByTestId('notice-reference-unavailable-golden_image');
    await expect(unavailable).toBeVisible();
    await expect(page.getByTestId('img-comparison-reference-golden_image')).toHaveCount(0);
    expect(imageRequests).toBe(1);
    const retryRequest = page.waitForRequest((request) => request.url() === currentUrl);
    await page.getByTestId('button-retry-reference-preview-golden_image').click();
    await retryRequest;
    await expectLoadedImage(page.getByTestId('img-comparison-reference-golden_image'));
    await expect(unavailable).toHaveCount(0);
    expect(imageRequests).toBe(2);
  } finally {
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('concurrent saved historical retries announce and clear only their own references', async ({ page }) => {
  let goldenRequests = 0;
  let pageOneRequests = 0;
  let notifyGoldenRetryStarted!: () => void;
  let notifyPageOneRetryStarted!: () => void;
  let releaseGoldenRetry!: () => void;
  let releasePageOneRetry!: () => void;
  const goldenRetryStarted = new Promise<void>((resolve) => {
    notifyGoldenRetryStarted = resolve;
  });
  const pageOneRetryStarted = new Promise<void>((resolve) => {
    notifyPageOneRetryStarted = resolve;
  });
  const goldenRetryGate = new Promise<void>((resolve) => {
    releaseGoldenRetry = resolve;
  });
  const pageOneRetryGate = new Promise<void>((resolve) => {
    releasePageOneRetry = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalArtworkUrl) {
      goldenRequests += 1;
      if (goldenRequests === 1) {
        await route.abort('failed');
      } else {
        notifyGoldenRetryStarted();
        await goldenRetryGate;
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      }
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.abort('failed');
      } else {
        notifyPageOneRetryStarted();
        await pageOneRetryGate;
        await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
      }
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const goldenInitialFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    );
    const pageOneInitialFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1&savedHistoricalPageOne=1');
    await Promise.all([goldenInitialFailure, pageOneInitialFailure]);

    const goldenUnavailable = page.getByTestId('notice-historical-reference-unavailable-golden_image');
    const pageOneUnavailable = page.getByTestId('notice-historical-reference-unavailable-front_page');
    const goldenRetry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    const pageOneRetry = page.getByTestId('button-retry-historical-reference-preview-front_page');
    await expect(goldenUnavailable).toContainText('unavailable from protected storage');
    await expect(pageOneUnavailable).toContainText('unavailable from protected storage');
    await expect(page.getByTestId('comparison-historical-reference-golden_image'))
      .toContainText('Previous golden_image · v1 · saved predecessor');
    await expect(page.getByTestId('comparison-historical-reference-front_page'))
      .toContainText('Archived Page 1 cover · v1 · saved predecessor');

    const goldenRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalArtworkUrl,
    );
    const pageOneRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await goldenRetry.click();
    await pageOneRetry.click();
    await Promise.all([goldenRetryRequest, pageOneRetryRequest, goldenRetryStarted, pageOneRetryStarted]);

    const goldenLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const pageOneLoading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    const goldenSuccess = page.getByTestId('notice-historical-reference-retry-success-golden_image');
    const pageOneSuccess = page.getByTestId('notice-historical-reference-retry-success-front_page');
    await expect(goldenLoading).toHaveText('Loading historical Golden Image preview: Previous golden_image, version 1.');
    await expect(pageOneLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(goldenSuccess).toHaveAttribute('aria-live', 'polite');
    await expect(pageOneSuccess).toHaveAttribute('aria-live', 'polite');
    await expect(goldenSuccess).toHaveText('');
    await expect(pageOneSuccess).toHaveText('');

    releaseGoldenRetry();
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-golden_image'));
    await expect(goldenLoading).toHaveText('');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.');
    await expect(pageOneLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(pageOneSuccess).toHaveText('');

    releasePageOneRetry();
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
    await expect(pageOneLoading).toHaveText('');
    await expect(pageOneSuccess)
      .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    expect(goldenRequests).toBe(2);
    expect(pageOneRequests).toBe(2);
  } finally {
    releaseGoldenRetry();
    releasePageOneRetry();
  }
});

test('current and historical previews remain paired when their downloads finish out of order', async ({ page }) => {
  let releaseCurrent!: () => void;
  let releaseHistorical!: () => void;
  let notifyCurrent!: () => void;
  let notifyHistorical!: () => void;
  const currentPending = new Promise<void>((resolve) => { releaseCurrent = resolve; });
  const historicalPending = new Promise<void>((resolve) => { releaseHistorical = resolve; });
  const currentStarted = new Promise<void>((resolve) => { notifyCurrent = resolve; });
  const historicalStarted = new Promise<void>((resolve) => { notifyHistorical = resolve; });
  await page.route(`**${savedArtworkUrl}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
  });
  await page.route(sourceUrl, async (route) => {
    notifyCurrent();
    await currentPending;
    await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
  });
  await page.route(historicalSourceUrl, async (route) => {
    notifyHistorical();
    await historicalPending;
    await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
  });
  try {
    await page.goto('/browser-tests/fixture.html');
    await page.getByTestId('button-load-reference-preview-golden_image').click();
    await currentStarted;
    await page.getByTestId('button-load-historical-reference-preview-golden_image').click();
    await historicalStarted;
    releaseHistorical();
    const historical = page.getByTestId('img-comparison-historical-reference-golden_image');
    await expectLoadedImage(historical);
    await expect(historical).toHaveAttribute('src', historicalSourceUrl);
    releaseCurrent();
    const current = page.getByTestId('img-comparison-reference-golden_image');
    await expectLoadedImage(current);
    await expect(current).toHaveAttribute('src', sourceUrl);
    await expect(historical).toHaveAttribute('src', historicalSourceUrl);
  } finally {
    releaseHistorical();
    releaseCurrent();
  }
});

test('current and historical external previews send no newsroom Referer to the image host', async ({ page }) => {
  const requests: Array<{ path: string; referer: string | undefined }> = [];
  const imageHost = createServer((request, response) => {
    requests.push({
      path: new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
      referer: request.headers.referer,
    });
    response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    response.end(onePixelPng);
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const origin = `http://127.0.0.1:${address.port}`;
    const currentUrl = new URL('/current.png', origin).href;
    const historicalUrl = new URL('/historical.png', origin).href;
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === '127.0.0.1' || host === 'localhost') await route.continue();
      else await route.abort();
    });
    await page.goto(`/browser-tests/fixture.html?imageHost=${encodeURIComponent(origin)}`);
    await expect(page.getByTestId('notice-reference-preview-pending-golden_image')).toBeVisible();
    await expect(page.getByTestId('notice-historical-reference-preview-pending-golden_image')).toBeVisible();
    expect(requests).toEqual([]);
    const currentRequest = page.waitForRequest((request) => request.url() === currentUrl);
    await page.getByTestId('button-load-reference-preview-golden_image').click();
    await currentRequest;
    await expectLoadedImage(page.getByTestId('img-comparison-reference-golden_image'));
    const historicalRequest = page.waitForRequest((request) => request.url() === historicalUrl);
    await page.getByTestId('button-load-historical-reference-preview-golden_image').click();
    await historicalRequest;
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-golden_image'));
    expect(requests.map(({ path }) => path)).toEqual(['/current.png', '/historical.png']);
    expect(requests.map(({ referer }) => referer)).toEqual([undefined, undefined]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('Golden Image preview retry is keyboard accessible and keeps focus useful during recovery', async ({ page }) => {
  let goldenImageRequests = 0;
  let releaseRetryResponse: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  const retryStarted = new Promise<void>((resolve) => {
    notifyRetryStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') {
      await route.continue();
      return;
    }

    if (requestUrl.href === sourceUrl) {
      goldenImageRequests += 1;
      if (goldenImageRequests === 1) {
        await route.abort();
        return;
      }

      notifyRetryStarted?.();
      await retryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
      return;
    }

    await route.abort();
  });

  try {
    await page.goto('/browser-tests/fixture.html');
    const dialog = page.getByRole('dialog', { name: 'Style checklist: Saved cover' });
    await expect(dialog).toBeVisible();

    const closeButton = page.getByTestId('button-close-dialog');
    const loadButton = page.getByTestId('button-load-reference-preview-golden_image');
    const getTabStopIndex = (target: typeof closeButton) => target.evaluate((element, selector) => {
      const ownerDialog = element.closest('[role="dialog"]');
      if (!ownerDialog) return -1;
      return Array.from(ownerDialog.querySelectorAll<HTMLElement>(selector))
        .indexOf(element as HTMLElement);
    }, tabStopSelector);
    const reachWithTab = async (target: typeof closeButton) => {
      const closeIndex = await getTabStopIndex(closeButton);
      const targetIndex = await getTabStopIndex(target);
      expect(targetIndex).toBeGreaterThanOrEqual(closeIndex);
      await closeButton.focus();
      for (let index = closeIndex; index < targetIndex; index += 1) {
        await page.keyboard.press('Tab');
      }
      await expect(target).toBeFocused();
    };

    await reachWithTab(loadButton);
    const firstRequest = page.waitForRequest((request) => request.url() === sourceUrl);
    await page.keyboard.press('Enter');
    await firstRequest;
    await expect(page.getByTestId('notice-reference-unavailable-golden_image')).toBeVisible();
    expect(goldenImageRequests).toBe(1);

    const retryButton = page.getByTestId('button-retry-reference-preview-golden_image');
    await reachWithTab(retryButton);
    const retryRequest = page.waitForRequest((request) => request.url() === sourceUrl);
    await page.keyboard.press('Enter');
    await retryStarted;
    await retryRequest;

    const hideButton = page.getByTestId('button-hide-reference-preview-golden_image');
    const retryAnnouncement = page.getByTestId('img-comparison-reference-golden_image-retry-failed');
    await expect(page.getByTestId('img-comparison-reference-golden_image-loading')).toBeVisible();
    await expect(hideButton).toBeFocused();
    await expect(retryAnnouncement).toHaveText('');
    expect(goldenImageRequests).toBe(2);

    releaseRetryResponse?.();
    const goldenImage = page.getByTestId('img-comparison-reference-golden_image');
    await expect.poll(() => goldenImage.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth === 1,
    )).toBe(true);
    await expect(retryAnnouncement).toHaveText('Golden Image preview loaded successfully.');
    await expect(hideButton).toBeFocused();
  } finally {
    releaseRetryResponse?.();
  }
});

test('Retry keeps the Golden Image unavailable and retryable when its host fails again', async ({ page }) => {
  let imageRequests = 0;
  const imageHost = createServer((_request, response) => {
    imageRequests += 1;
    response.writeHead(503, {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    });
    response.end('Temporary image host failure');
  });

  await new Promise<void>((resolve, reject) => {
    imageHost.once('error', reject);
    imageHost.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = imageHost.address();
    if (!address || typeof address === 'string') throw new Error('The controlled image host did not start.');
    const imageOrigin = `http://127.0.0.1:${address.port}`;
    const currentUrl = new URL('/current.png', imageOrigin).href;

    await page.goto(`/browser-tests/fixture.html?imageHost=${encodeURIComponent(imageOrigin)}`);
    await expect(page.getByRole('dialog', { name: 'Style checklist: Saved cover' })).toBeVisible();

    const unavailableNotice = page.getByTestId('notice-reference-unavailable-golden_image');
    const retryButton = page.getByTestId('button-retry-reference-preview-golden_image');
    const goldenImage = page.getByTestId('img-comparison-reference-golden_image');
    const retryAnnouncement = page.getByTestId('img-comparison-reference-golden_image-retry-failed');

    const firstImageRequest = page.waitForRequest((request) => request.url() === currentUrl);
    await page.getByTestId('button-load-reference-preview-golden_image').click();
    await firstImageRequest;
    await expect(unavailableNotice).toBeVisible();
    await expect(goldenImage).toHaveCount(0);
    await expect(retryButton).toBeVisible();
    await expect(retryAnnouncement).toHaveText('');
    expect(imageRequests).toBe(1);

    const retryImageRequest = page.waitForRequest((request) => request.url() === currentUrl);
    await retryButton.click();
    await retryImageRequest;

    await expect(unavailableNotice).toBeVisible();
    await expect(goldenImage).toHaveCount(0);
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
    await expect(retryAnnouncement)
      .toHaveText('Golden Image preview retry failed. The preview is still unavailable.');
    await expect(retryAnnouncement).toHaveAttribute('aria-live', 'polite');
    expect(imageRequests).toBe(2);
  } finally {
    await new Promise<void>((resolve, reject) => {
      imageHost.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('saved historical Golden Image and Page 1 retry statuses stay independent in the same dialog', async ({ page }) => {
  const requestCounts = new Map<string, number>();
  let releaseGoldenRetry: (() => void) | undefined;
  let releasePageOneFailure: (() => void) | undefined;
  let releasePageOneSuccess: (() => void) | undefined;
  let notifyGoldenRetry: (() => void) | undefined;
  let notifyPageOneFailure: (() => void) | undefined;
  let notifyPageOneSuccess: (() => void) | undefined;
  const goldenRetry = new Promise<void>((resolve) => { releaseGoldenRetry = resolve; });
  const pageOneFailure = new Promise<void>((resolve) => { releasePageOneFailure = resolve; });
  const pageOneSuccess = new Promise<void>((resolve) => { releasePageOneSuccess = resolve; });
  const goldenRetryStarted = new Promise<void>((resolve) => { notifyGoldenRetry = resolve; });
  const pageOneFailureStarted = new Promise<void>((resolve) => { notifyPageOneFailure = resolve; });
  const pageOneSuccessStarted = new Promise<void>((resolve) => { notifyPageOneSuccess = resolve; });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalArtworkUrl || url.pathname === historicalPageOneArtworkUrl) {
      const count = (requestCounts.get(url.pathname) ?? 0) + 1;
      requestCounts.set(url.pathname, count);
      if (count === 1) {
        await route.abort();
      } else if (url.pathname === historicalArtworkUrl) {
        notifyGoldenRetry?.();
        await goldenRetry;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      } else if (count === 2) {
        notifyPageOneFailure?.();
        await pageOneFailure;
        await route.abort();
      } else {
        notifyPageOneSuccess?.();
        await pageOneSuccess;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const initialFailures = Promise.all([
      page.waitForEvent('requestfailed', (request) => new URL(request.url()).pathname === historicalArtworkUrl),
      page.waitForEvent('requestfailed', (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl),
    ]);
    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1&savedHistoricalPageOne=1');
    await initialFailures;

    const goldenRetryButton = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    const pageOneRetryButton = page.getByTestId('button-retry-historical-reference-preview-front_page');
    const goldenLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const pageOneLoading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    const goldenFailure = page.getByTestId('notice-historical-reference-retry-failure-golden_image');
    const pageOneFailureNotice = page.getByTestId('notice-historical-reference-retry-failure-front_page');
    const goldenSuccess = page.getByTestId('notice-historical-reference-retry-success-golden_image');
    const pageOneSuccessNotice = page.getByTestId('notice-historical-reference-retry-success-front_page');

    const goldenRequest = page.waitForRequest((request) => new URL(request.url()).pathname === historicalArtworkUrl);
    await goldenRetryButton.click();
    await Promise.all([goldenRetryStarted, goldenRequest]);
    await expect(goldenLoading)
      .toHaveText('Loading historical Golden Image preview: Previous golden_image, version 1.');
    await expect(pageOneLoading).toHaveText('');

    const pageOneFailingRequest = page.waitForRequest((request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl);
    await pageOneRetryButton.click();
    await Promise.all([pageOneFailureStarted, pageOneFailingRequest]);
    await expect(goldenLoading)
      .toHaveText('Loading historical Golden Image preview: Previous golden_image, version 1.');
    await expect(pageOneLoading)
      .toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');

    releaseGoldenRetry?.();
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-golden_image'));
    await expect(goldenLoading).toHaveText('');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.');
    await expect(pageOneLoading)
      .toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(pageOneFailureNotice).toHaveText('');

    const pageOneRetryFailed = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    releasePageOneFailure?.();
    await pageOneRetryFailed;
    await expect(pageOneFailureNotice)
      .toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.');
    await expect(goldenFailure).toHaveText('');

    const pageOneSuccessRequest = page.waitForRequest((request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl);
    await pageOneRetryButton.click();
    await Promise.all([pageOneSuccessStarted, pageOneSuccessRequest]);
    await expect(pageOneLoading)
      .toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.');

    releasePageOneSuccess?.();
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
    await expect(pageOneSuccessNotice)
      .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Previous golden_image, version 1.');
  } finally {
    releaseGoldenRetry?.();
    releasePageOneFailure?.();
    releasePageOneSuccess?.();
  }
});

test('saved historical Page 1 retry announces its title and version while the protected image is loading', async ({ page }) => {
  let historicalRequests = 0;
  let releaseRetryResponse: (() => void) | undefined;
  let notifyRetryStarted: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  const retryStarted = new Promise<void>((resolve) => {
    notifyRetryStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests === 1) {
        await route.abort();
        return;
      }
      notifyRetryStarted?.();
      await retryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const firstRequestFailed = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1');
    await firstRequestFailed;

    await expect(page.getByTestId('comparison-historical-reference-front_page'))
      .toContainText('Archived Page 1 cover · v1 · saved predecessor');
    const retry = page.getByTestId('button-retry-historical-reference-preview-front_page');
    await expect(retry).toBeVisible();

    const retryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await retry.click();
    await Promise.all([retryStarted, retryRequest]);

    const loading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    const success = page.getByTestId('notice-historical-reference-retry-success-front_page');
    const image = page.getByTestId('img-comparison-historical-reference-front_page');
    await expect(loading).toHaveAttribute('role', 'status');
    await expect(loading).toHaveAttribute('aria-live', 'polite');
    await expect(loading)
      .toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(success).toHaveText('');
    await expect(image).toHaveJSProperty('naturalWidth', 0);
    expect(historicalRequests).toBe(2);

    releaseRetryResponse?.();
    await expectLoadedImage(image);
    await expect(loading).toHaveText('');
    await expect(success).toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    await expect(success).toHaveAttribute('role', 'status');
    await expect(success).toHaveAttribute('aria-live', 'polite');
  } finally {
    releaseRetryResponse?.();
  }
});
test('current Golden Image and saved historical Page 1 retry messages remain separate while retries overlap', async ({ page }) => {
  let currentRequests = 0;
  let historicalRequests = 0;
  let releaseCurrentFailure: (() => void) | undefined;
  let releaseCurrentSuccess: (() => void) | undefined;
  let releaseHistoricalFailure: (() => void) | undefined;
  let releaseHistoricalSuccess: (() => void) | undefined;
  const currentFailureResponse = new Promise<void>((resolve) => { releaseCurrentFailure = resolve; });
  const currentSuccessResponse = new Promise<void>((resolve) => { releaseCurrentSuccess = resolve; });
  const historicalFailureResponse = new Promise<void>((resolve) => { releaseHistoricalFailure = resolve; });
  const historicalSuccessResponse = new Promise<void>((resolve) => { releaseHistoricalSuccess = resolve; });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.href === sourceUrl) {
      currentRequests += 1;
      if (currentRequests === 1) {
        await route.abort();
      } else if (currentRequests === 2) {
        await currentFailureResponse;
        await route.abort();
      } else {
        await currentSuccessResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests === 1) {
        await route.abort();
      } else if (historicalRequests === 2) {
        await historicalFailureResponse;
        await route.abort();
      } else {
        await historicalSuccessResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const historicalFirstFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1');
    await historicalFirstFailure;

    const currentFirstFailure = page.waitForEvent('requestfailed', (request) => request.url() === sourceUrl);
    await page.getByTestId('button-load-reference-preview-golden_image').click();
    await currentFirstFailure;

    const currentRetry = page.getByTestId('button-retry-reference-preview-golden_image');
    const historicalRetry = page.getByTestId('button-retry-historical-reference-preview-front_page');
    const currentLoading = page.getByTestId('img-comparison-reference-golden_image-loading');
    const historicalLoading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    const currentStatus = page.getByTestId('img-comparison-reference-golden_image-retry-failed');
    const historicalFailure = page.getByTestId('notice-historical-reference-retry-failure-front_page');
    const historicalSuccess = page.getByTestId('notice-historical-reference-retry-success-front_page');

    const currentRetryRequest = page.waitForRequest((request) => request.url() === sourceUrl);
    const historicalRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await currentRetry.click();
    await historicalRetry.click();
    await Promise.all([currentRetryRequest, historicalRetryRequest]);
    await expect(currentLoading).toHaveText('Loading external image preview for current Golden Image reference “Current golden_image”, version 2.');
    await expect(historicalLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(currentStatus).toHaveText('');
    await expect(historicalFailure).toHaveText('');

    const currentRetryFailed = page.waitForEvent('requestfailed', (request) => request.url() === sourceUrl);
    releaseCurrentFailure?.();
    await currentRetryFailed;
    await expect(currentStatus).toHaveText('Golden Image preview retry failed. The preview is still unavailable.');
    await expect(historicalLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(historicalFailure).toHaveText('');

    const historicalRetryFailed = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    releaseHistoricalFailure?.();
    await historicalRetryFailed;
    await expect(historicalFailure).toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    await expect(currentStatus).toHaveText('Golden Image preview retry failed. The preview is still unavailable.');

    const currentSuccessRequest = page.waitForRequest((request) => request.url() === sourceUrl);
    await currentRetry.click();
    await currentSuccessRequest;
    await expect(historicalFailure).toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    releaseCurrentSuccess?.();
    await expectLoadedImage(page.getByTestId('img-comparison-reference-golden_image'));
    await expect(currentStatus).toHaveText('Golden Image preview loaded successfully.');
    await expect(historicalFailure).toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');

    const historicalSuccessRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await historicalRetry.click();
    await historicalSuccessRequest;
    await expect(historicalLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(currentStatus).toHaveText('Golden Image preview loaded successfully.');
    releaseHistoricalSuccess?.();
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
    await expect(historicalSuccess).toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    await expect(currentStatus).toHaveText('Golden Image preview loaded successfully.');
  } finally {
    releaseCurrentFailure?.();
    releaseCurrentSuccess?.();
    releaseHistoricalFailure?.();
    releaseHistoricalSuccess?.();
  }
});
test('saved historical Page 1 first-load success stays silent and a later retry announces success', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl || url.pathname === historicalPageOneArtworkUrl) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1');

  const image = page.getByTestId('img-comparison-historical-reference-front_page');
  const success = page.getByTestId('notice-historical-reference-retry-success-front_page');
  await expectLoadedImage(image);
  await expect(success).toHaveText('');
  await expect(page.getByTestId('button-retry-historical-reference-preview-front_page')).toHaveCount(0);

  // Simulate a later image failure after the successful initial load so the real Retry action is available.
  await image.evaluate((element) => element.dispatchEvent(new Event('error')));
  const retry = page.getByTestId('button-retry-historical-reference-preview-front_page');
  await expect(retry).toBeVisible();
  await expect(success).toHaveText('');

  await retry.click();
  await expectLoadedImage(image);

  await expect(success)
    .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
  await expect(success).toHaveAttribute('role', 'status');
  await expect(success).toHaveAttribute('aria-live', 'polite');
});

test('saved historical Page 1 first-load failure stays out of retry status until Retry fails', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      await route.abort();
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  const firstRequestFailed = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1');
  await firstRequestFailed;

  const retryFailure = page.getByTestId('notice-historical-reference-retry-failure-front_page');
  await expect(retryFailure).toHaveAttribute('role', 'status');
  await expect(retryFailure).toHaveAttribute('aria-live', 'polite');
  await expect(retryFailure).toHaveText('');

  const retry = page.getByTestId('button-retry-historical-reference-preview-front_page');
  await expect(retry).toBeVisible();
  const retryRequestFailed = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await retry.click();
  await retryRequestFailed;

  await expect(page.getByTestId('button-retry-historical-reference-preview-front_page')).toBeVisible();
  await expect(retryFailure)
    .toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
});

test('saved historical Page 1 retry failure clears when a later retry succeeds', async ({ page }) => {
  let historicalRequests = 0;
  let releaseSuccessfulRetry: (() => void) | undefined;
  let notifySuccessfulRetryStarted: (() => void) | undefined;
  const successfulRetryResponse = new Promise<void>((resolve) => {
    releaseSuccessfulRetry = resolve;
  });
  const successfulRetryStarted = new Promise<void>((resolve) => {
    notifySuccessfulRetryStarted = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests <= 2) {
        await route.abort('failed');
        return;
      }
      notifySuccessfulRetryStarted?.();
      await successfulRetryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const firstRequestFailed = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1');
    await firstRequestFailed;

    const retryFailure = page.getByTestId('notice-historical-reference-retry-failure-front_page');
    const retry = page.getByTestId('button-retry-historical-reference-preview-front_page');
    const image = page.getByTestId('img-comparison-historical-reference-front_page');
    const success = page.getByTestId('notice-historical-reference-retry-success-front_page');
    const failedRetry = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await retry.click();
    await failedRetry;

    await expect(retryFailure)
      .toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');
    await expect(success).toHaveText('');

    const successfulRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await retry.click();
    await Promise.all([successfulRetryStarted, successfulRetryRequest]);

    const loading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    await expect(retryFailure).toHaveText('');
    await expect(success).toHaveText('');
    await expect(loading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(image).toHaveJSProperty('naturalWidth', 0);
    expect(historicalRequests).toBe(3);

    releaseSuccessfulRetry?.();
    await expectLoadedImage(image);
    await expect(retryFailure).toHaveText('');
    await expect(success)
      .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
  } finally {
    releaseSuccessfulRetry?.();
  }
});
test('concurrent archived Golden Image and Page 1 retries keep independent title, version, and success messages', async ({ page }) => {
  let goldenRequests = 0;
  let pageOneRequests = 0;
  let releaseGoldenResponse: (() => void) | undefined;
  let releasePageOneResponse: (() => void) | undefined;
  const goldenRetryResponse = new Promise<void>((resolve) => {
    releaseGoldenResponse = resolve;
  });
  const pageOneRetryResponse = new Promise<void>((resolve) => {
    releasePageOneResponse = resolve;
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalGoldenArtworkUrl) {
      goldenRequests += 1;
      if (goldenRequests === 1) {
        await route.abort();
        return;
      }
      await goldenRetryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      pageOneRequests += 1;
      if (pageOneRequests === 1) {
        await route.abort();
        return;
      }
      await pageOneRetryResponse;
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'no-store' },
        body: onePixelPng,
      });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const firstGoldenFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalGoldenArtworkUrl,
    );
    const firstPageOneFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalImage=1&savedHistoricalPageOne=1&concurrentHistoricalRetries=1');
    await Promise.all([firstGoldenFailure, firstPageOneFailure]);

    await expect(page.getByTestId('comparison-historical-reference-golden_image'))
      .toContainText('Archived Golden Image · v1 · saved predecessor');
    await expect(page.getByTestId('comparison-historical-reference-front_page'))
      .toContainText('Archived Page 1 cover · v1 · saved predecessor');
    const goldenRetry = page.getByTestId('button-retry-historical-reference-preview-golden_image');
    const pageOneRetry = page.getByTestId('button-retry-historical-reference-preview-front_page');
    await expect(goldenRetry).toBeVisible();
    await expect(pageOneRetry).toBeVisible();

    const goldenRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalGoldenArtworkUrl,
    );
    const pageOneRetryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await goldenRetry.click();
    await pageOneRetry.click();
    await Promise.all([goldenRetryRequest, pageOneRetryRequest]);

    const goldenLoading = page.getByTestId('img-comparison-historical-reference-golden_image-loading');
    const pageOneLoading = page.getByTestId('img-comparison-historical-reference-front_page-loading');
    const goldenSuccess = page.getByTestId('notice-historical-reference-retry-success-golden_image');
    const pageOneSuccess = page.getByTestId('notice-historical-reference-retry-success-front_page');
    const goldenImage = page.getByTestId('img-comparison-historical-reference-golden_image');
    const pageOneImage = page.getByTestId('img-comparison-historical-reference-front_page');

    await expect(goldenLoading).toHaveAttribute('role', 'status');
    await expect(goldenLoading).toHaveAttribute('aria-live', 'polite');
    await expect(goldenLoading).toHaveText('Loading historical Golden Image preview: Archived Golden Image, version 1.');
    await expect(pageOneLoading).toHaveAttribute('role', 'status');
    await expect(pageOneLoading).toHaveAttribute('aria-live', 'polite');
    await expect(pageOneLoading).toHaveText('Loading historical front-page benchmark preview: Archived Page 1 cover, version 1.');
    await expect(goldenSuccess).toHaveText('');
    await expect(pageOneSuccess).toHaveText('');
    expect(goldenRequests).toBe(2);
    expect(pageOneRequests).toBe(2);

    releasePageOneResponse?.();
    await expectLoadedImage(pageOneImage);
    await expect(pageOneLoading).toHaveText('');
    await expect(pageOneSuccess)
      .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
    await expect(goldenLoading)
      .toHaveText('Loading historical Golden Image preview: Archived Golden Image, version 1.');
    await expect(goldenSuccess).toHaveText('');

    releaseGoldenResponse?.();
    await expectLoadedImage(goldenImage);
    await expect(goldenLoading).toHaveText('');
    await expect(goldenSuccess)
      .toHaveText('Historical Golden Image preview loaded successfully: Archived Golden Image, version 1.');
    await expect(pageOneSuccess)
      .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');
  } finally {
    releaseGoldenResponse?.();
    releasePageOneResponse?.();
  }
});

test('closing a saved review clears its historical retry failure before another review opens', async ({ page }) => {
  let historicalRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests <= 2) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1&reviewSwitch=1');
  await firstFailure;

  const retryFailure = page.getByTestId('notice-historical-reference-retry-failure-front_page');
  const retryFailureRequest = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await page.getByTestId('button-retry-historical-reference-preview-front_page').click();
  await retryFailureRequest;
  await expect(retryFailure)
    .toHaveText('Historical front-page benchmark preview retry failed. The preview is still unavailable.');

  await page.getByTestId('button-close-dialog').click();
  await page.getByTestId('button-open-second-saved-review').click();
  await expect(page.getByRole('dialog')).toContainText('Second saved cover');
  await expect(page.getByTestId('notice-historical-reference-retry-failure-front_page')).toHaveText('');
  await expect(page.getByTestId('notice-historical-reference-retry-success-front_page')).toHaveText('');
  await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
});

test('closing a saved review clears its historical retry success before another review opens', async ({ page }) => {
  let historicalRequests = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  const firstFailure = page.waitForEvent(
    'requestfailed',
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1&reviewSwitch=1');
  await firstFailure;

  const retryRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
  );
  await page.getByTestId('button-retry-historical-reference-preview-front_page').click();
  await retryRequest;
  const success = page.getByTestId('notice-historical-reference-retry-success-front_page');
  await expect(success)
    .toHaveText('Historical front-page benchmark preview loaded successfully: Archived Page 1 cover, version 1.');

  await page.getByTestId('button-close-dialog').click();
  await page.getByTestId('button-open-second-saved-review').click();
  await expect(page.getByRole('dialog')).toContainText('Second saved cover');
  await expect(page.getByTestId('notice-historical-reference-retry-failure-front_page')).toHaveText('');
  await expect(page.getByTestId('notice-historical-reference-retry-success-front_page')).toHaveText('');
  await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
});

test('a late historical image response from another saved review cannot set its retry status', async ({ page }) => {
  let historicalRequests = 0;
  let releaseFirstRetry: (() => void) | undefined;
  const delayedRetryResponse = new Promise<void>((resolve) => {
    releaseFirstRetry = resolve;
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === savedArtworkUrl) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng });
    } else if (url.pathname === historicalPageOneArtworkUrl) {
      historicalRequests += 1;
      if (historicalRequests === 1) {
        await route.abort('failed');
      } else if (historicalRequests === 2) {
        await delayedRetryResponse;
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'cache-control': 'no-store' },
          body: onePixelPng,
        });
      }
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  try {
    const firstFailure = page.waitForEvent(
      'requestfailed',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.goto('/browser-tests/fixture.html?savedHistoricalPageOne=1&reviewSwitch=1');
    await firstFailure;

    const retryRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    await page.getByTestId('button-retry-historical-reference-preview-front_page').click();
    await retryRequest;

    await page.getByTestId('button-close-dialog').click();
    await page.getByTestId('button-open-second-saved-review').click();
    await expect(page.getByRole('dialog')).toContainText('Second saved cover');

    const retryFinished = page.waitForEvent(
      'requestfinished',
      (request) => new URL(request.url()).pathname === historicalPageOneArtworkUrl,
    );
    releaseFirstRetry?.();
    await retryFinished;
    await expectLoadedImage(page.getByTestId('img-comparison-historical-reference-front_page'));
    await expect(page.getByTestId('notice-historical-reference-retry-failure-front_page')).toHaveText('');
    await expect(page.getByTestId('notice-historical-reference-retry-success-front_page')).toHaveText('');
    expect(historicalRequests).toBeGreaterThanOrEqual(2);
  } finally {
    releaseFirstRetry?.();
  }
});
