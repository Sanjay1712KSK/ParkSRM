import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'in.edu.srmist.parksrm',
  appName: 'ParkSRM',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
}
export default config
