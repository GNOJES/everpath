import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
 appId: 'com.everpath.game',
 appName: 'EVERPATH',
 webDir: 'dist',
 backgroundColor: '#0d1717',
 android: { backgroundColor: '#0d1717', allowMixedContent: false },
 plugins: {
  SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'contain', style: 'DARK' },
 },
};
export default config;
