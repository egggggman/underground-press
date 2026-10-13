import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.resolve(configDirectory, '..');

export default defineConfig({
  testDir: configDirectory,
  testMatch: '*.spec.ts',
  outputDir: path.join(configDirectory, 'test-results'),
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4178',
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/repl/tools/bin/chromium',
          args: ['--no-sandbox'],
        },
      },
    },
    {
      name: 'firefox',
      grep: /(?:Escape returns focus to the style checklist opener|Cancel and backdrop dismissal return focus to the style checklist opener|keyboard (?:Enter|Space) (?:hides only Page 1 and keeps the Golden Image preview visible|hides a failed Page 1 preview and keeps focus useful|hides a failed Page 1 preview and reloads it without changing the Golden Image|hides a failed Page 1 preview after invalid image bytes and reloads it without changing the Golden Image|retries a failed (?:Page 1 preview without disturbing Golden Image|Golden Image preview without disturbing Page 1))|Page 1 (?:loaded|failed) preview hide announcement stays polite and does not repeat|Page 1 failed reload announces its status and Retry action without repeating the status on refocus|a failed external historical preview focuses Retry and recovers without changing (?:current artwork|the Golden Image)|historical SVG preview with a fragment recovers on keyboard retry without changing current artwork|Page 1 preview controls keep visible keyboard focus at compact scroll boundaries in forced-colors mode|historical preview load, hide, and retry controls keep visible keyboard focus in forced-colors mode|historical preview Retry keeps Hide focused and visibly outlined at 400% zoom in forced-colors mode through recovery|historical preview Retry keeps Hide focused and visibly outlined at actual Firefox 400% page zoom through recovery|historical preview Retry recovers after a second failure at actual Firefox 400% page zoom in forced-colors mode|protected historical image Retry remains focused and visibly outlined after a second failure at actual Firefox 400% page zoom in forced-colors mode|protected historical image Retry remains focused and visibly outlined after three failures at actual Firefox 400% page zoom in forced-colors mode|Page 1 retry announces failure and recovery success while preserving keyboard focus|Page 1 preview retry keeps keyboard focus useful through successful recovery|Page 1 reload keeps Hide focused and visibly outlined in forced-colors mode while loading|Page 1 reload keeps Hide focused and visibly outlined at 200% zoom in forced-colors mode while loading|Page 1 can (?:load again after hiding (?:a failed preview|a preview with invalid image bytes|an aborted preview|an HTTP-error preview)|reload after an aborted image request is hidden) without changing (?:the Golden Image|the historical Golden Image)|saved historical Page 1 first-load success stays silent and a later retry announces success)/,
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://127.0.0.1:4178',
        browserName: 'firefox',
      },
    },
    {
      name: 'webkit',
      // This host's Linux WPE runtime cannot create an EGL display, but that host
      // limitation does not indicate missing WebKit forced-colors support. Keep the
      // Page 1 forced-colors focus test selected for hosts where WebKit can launch.
      grep: /(?:Escape returns focus to the style checklist opener|Cancel and backdrop dismissal return focus to the style checklist opener|keyboard (Enter|Space) (?:hides only Page 1 and keeps the Golden Image preview visible|hides a failed Page 1 preview and keeps focus useful|hides a failed Page 1 preview and reloads it without changing the Golden Image|hides a failed Page 1 preview after invalid image bytes and reloads it without changing the Golden Image|retries a failed (Page 1 preview without disturbing Golden Image|Golden Image preview without disturbing Page 1))|Page 1 (?:loaded|failed) preview hide announcement stays polite and does not repeat|Page 1 failed reload announces its status and Retry action without repeating the status on refocus|a failed external historical preview focuses Retry and recovers without changing (?:current artwork|the Golden Image)|historical SVG preview with a fragment recovers on keyboard retry without changing current artwork|Page 1 preview controls keep visible keyboard focus at compact scroll boundaries in forced-colors mode|historical preview load, hide, and retry controls keep visible keyboard focus in forced-colors mode|Page 1 reload keeps Hide focused and visibly outlined in forced-colors mode while loading|Page 1 reload keeps Hide focused and visibly outlined at 200% zoom in forced-colors mode while loading|Page 1 can (?:load again after hiding (?:a failed preview|a preview with invalid image bytes|an aborted preview|an HTTP-error preview)|reload after an aborted image request is hidden) without changing (?:the Golden Image|the historical Golden Image)|saved historical Page 1 first-load success stays silent and a later retry announces success)/,
      use: {
        ...devices['Desktop Safari'],
        baseURL: 'http://127.0.0.1:4178',
        browserName: 'webkit',
      },
    },
  ],
  reporter: 'line',
  webServer: {
    command: 'pnpm exec vite --config browser-tests/vite.config.ts',
    cwd: artifactRoot,
    url: 'http://127.0.0.1:4178/browser-tests/fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      PORT: '4178',
    },
  },
});
