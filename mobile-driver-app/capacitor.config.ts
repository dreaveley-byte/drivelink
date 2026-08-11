import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.carbyclick.drivflo.driver',
  appName: 'Drivflo Driver',
  // Points at the live, already-deployed web app instead of bundling local
  // web assets. This is the whole point of this approach: the driver pages,
  // their logic, and any future updates all come from drivflo.ca automatically.
  // Nothing about the existing web app changes because of this - it's just
  // being displayed inside a native shell that also has background GPS access.
  server: {
    url: 'https://www.drivflo.ca/driver',
    // Only ever allow navigation within our own domain - if a link somehow
    // pointed elsewhere, the native webview would refuse to follow it rather
    // than becoming a general-purpose browser.
    allowNavigation: ['www.drivflo.ca', 'drivflo.ca'],
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
