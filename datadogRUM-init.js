import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';

datadogRum.init({
    applicationId: '80e4a476-c42c-47ee-9908-b68a57faaf3e',
    clientToken: 'pub498a726e46ebf83831095640a0be1d01',
    site: 'us5.datadoghq.com',
    service: '<SERVICE-NAME>',
    env: '<ENV-NAME>',
    version: '<VERSION-NUMBER>',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true,
    plugins: [reactPlugin({ router: false })],
});