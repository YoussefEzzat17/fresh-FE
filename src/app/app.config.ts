import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { DspPreset } from './core/theme/dsp-preset';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),

    providePrimeNG({
      theme: {
        preset: DspPreset,
        options: {
          darkModeSelector: false, // light mode only for now
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      }
    })
  ]
};
