import { clearDevitoCaches, devito, DevitoOptions, FS_PREFIX } from 'devito'
import puppeteer, { Browser, Frame, Page, PuppeteerLaunchOptions } from 'puppeteer'
import pretty, { print } from 'puppeteer-pretty-console'

export { clearDevitoCaches, FS_PREFIX }

export type { Browser, Frame, Page, puppeteer }

export class PuppitoOptions extends DevitoOptions {
  headless = true

  /** Puppeteer launch options */
  puppeteer: PuppeteerLaunchOptions = {}

  /** Transform console output */
  transformArgs?: (args: any[], originUrl: string) => Promise<any[]>

  /** Filter console output */
  failedRequestFilter?: (msg: string) => boolean

  /** Silence browser output. */
  browserQuiet = false

  /** Custom console object. */
  console = globalThis.console

  /** Completely disable console. */
  silent = false

  /** Print puppeteer page errors with console.error(). */
  printPageErrors = false

  constructor(options: Partial<PuppitoOptions> = {}) {
    super(options)
    this.inlineSourceMaps = true
    this.cache = false
    this.puppeteer.defaultViewport = {
      width: 640,
      height: 480,
      deviceScaleFactor: 2,
    }
    Object.assign(this, options)
    this.puppeteer.args ??= []
    this.puppeteer.args.push('--window-size=640,480')
  }
}

export async function puppito(partialOptions: Partial<PuppitoOptions> = {}) {
  const options = new PuppitoOptions(partialOptions)

  const server = await devito(partialOptions)

  options.puppeteer.headless ??= options.headless ?? true
  options.puppeteer.args ??= []
  options.puppeteer.args = [
    ...new Set([
      ...options.puppeteer.args,
      '--js-flags=--expose-gc',
      '--disable-background-timer-throttling',
      '--disable-default-apps',
      '--disable-device-discovery-notifications',
      '--disable-popup-blocking',
      '--disable-renderer-backgrounding',
      '--disable-translate',
      '--no-default-browser-check',
      '--no-first-run',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ]),
  ]

  const browser = await puppeteer.launch(options.puppeteer)

  const close = async () => {
    await flush()

    await new Promise(resolve => setTimeout(resolve, 20))

    try {
      await page.close()
    } catch { }

    try {
      await browser.close()
    } catch { }

    try {
      await server.close()
    } catch { }
  }

  const flush = async () => {
    // by awaiting a void print call, we essentially wait
    // for the console queue to flush
    await print(async () => { })
  }

  const pages = await browser.pages()
  const page = pages[0]

  if (options.printPageErrors) {
    page.on('error', options.console.error)
    page.on('pageerror', options.console.error)
    page.on('requestfailed', options.console.error)
  }

  if (!options.browserQuiet) {
    const console: any = options.silent
      ? {
        clear() { },
        groupCollapsed() { },
        groupEnd() { },
        group() { },
        error() { },
        table() { },
        log() { },
        warn() { },
      }
      : options.console

    pretty(page, options.transformArgs, options.failedRequestFilter, console)
  }

  return {
    server,
    browser,
    page,
    close,
    flush,
  }
}
