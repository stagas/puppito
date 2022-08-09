import { devito, DevitoOptions } from 'devito'
import puppeteer, { PuppeteerLaunchOptions } from 'puppeteer'
import pretty, { print } from 'puppeteer-pretty-console'

export class PuppitoOptions extends DevitoOptions {
  headless = true

  /** Puppeteer launch options */
  puppeteer: PuppeteerLaunchOptions = {}

  /** Filter console output */
  consoleFilter?: (args: any[]) => any[]

  /** Silence browser output. */
  browserQuiet = false

  /** Print puppeteer page errors with console.error(). */
  printPageErrors = false

  constructor(options: Partial<DevitoOptions> = {}) {
    super(options)
    Object.assign(this, options)
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
      '--disable-background-timer-throttling',
      '--disable-default-apps',
      '--disable-device-discovery-notifications',
      '--disable-popup-blocking',
      '--disable-renderer-backgrounding',
      '--disable-translate',
      '--no-default-browser-check',
      '--no-first-run',
      // '--single-process',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ]),
  ]

  const browser = await puppeteer.launch(options.puppeteer)

  const close = async () => {
    // flush console up to this point
    await flush()

    // wait for console to flush
    await new Promise(resolve => setTimeout(resolve, 20))

    try {
      !options.quiet && console.log('shutting down browser')
      await browser.close()
      !options.quiet && console.log('browser shut down')
    } catch {}

    try {
      !options.quiet && console.log('shutting down server...')
      await server.close()
      !options.quiet && console.log('server shut down')
    } catch {}
  }

  const flush = async () => {
    // by awaiting a void print call, we essentially wait
    // for the console queue to flush
    await print(async () => {})
  }

  const pages = await browser.pages()
  const page = pages[0]

  if (options.printPageErrors) {
    page.on('error', console.error)
    page.on('pageerror', console.error)
    page.on('requestfailed', console.error)
  }

  if (!options.browserQuiet) {
    pretty(page, options.consoleFilter)
  }

  return {
    server,
    browser,
    page,
    close,
    flush,
  }
}
