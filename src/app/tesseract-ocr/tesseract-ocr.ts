import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createWorker } from 'tesseract.js';

@Component({
  selector: 'app-tesseract-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tesseract-ocr.html',
  styleUrls: ['./tesseract-ocr.css']
})
export class TesseractOcr {
  imagePreview: string | null = null;
  isLoading: boolean = false;
  ocrResult: string = '';
  errorMessage: string = '';
  progressText: string = '';

  constructor(private cdr: ChangeDetectorRef) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
        this.ocrResult = '';
        this.errorMessage = '';
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  async processImage() {
    if (!this.imagePreview) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.ocrResult = '';
    this.progressText = 'initializing';
    this.cdr.detectChanges();

    try {
      const worker = await createWorker('tha', 1, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
        logger: m => {
          if (m.status === 'recognizing text') {
            this.progressText = `${Math.round(m.progress * 100)}%`;
            this.cdr.detectChanges();
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(this.imagePreview);
      this.ocrResult = text;
      
      await worker.terminate();
      
      if (!text || text.trim().length === 0) {
        this.errorMessage = 'No text extracted.';
      }
    } catch (error: any) {
      console.error('Tesseract Error:', error);
      this.errorMessage = error.message || 'Failed to extract text using Tesseract.js.';
    } finally {
      this.isLoading = false;
      this.progressText = '';
      this.cdr.detectChanges();
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard');
    });
  }
}
