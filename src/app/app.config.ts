import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { PivotComponent } from './pivot/pivot.component';
import { OcrComponent } from './ocr/ocr.component';
import { TesseractOcr } from './tesseract-ocr/tesseract-ocr';
import { GoogleVisionOcr } from './google-vision-ocr/google-vision-ocr';

const routes: Routes = [
  { path: 'pivot', component: PivotComponent },
  { path: 'ocr', component: OcrComponent },
  { path: 'tesseract-ocr', component: TesseractOcr },
  { path: 'google-vision-ocr', component: GoogleVisionOcr },
  { path: '', redirectTo: '/pivot', pathMatch: 'full' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    providePrimeNG({
        theme: {
            preset: Aura
        }
    })
  ]
};
