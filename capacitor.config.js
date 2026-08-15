const config = {
  appId: 'com.hydraagro.app',
  appName: 'Hydra Agro',
  webDir: 'public',
  backgroundColor: '#0B5136',
  android: { backgroundColor: '#0b5136', allowMixedContent: false },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      launchFadeOutDuration: 350,
      backgroundColor: '#0b5136',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

if (process.env.HYDRA_APP_URL) {
  config.server = { url: process.env.HYDRA_APP_URL, cleartext: false, androidScheme: 'https' };
}

module.exports = config;
