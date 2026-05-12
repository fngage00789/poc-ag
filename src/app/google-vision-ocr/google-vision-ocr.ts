import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface VisionAnnotation {
  locale?: string;
  description: string;
  boundingPoly?: any;
}

@Component({
  selector: 'app-google-vision-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './google-vision-ocr.html',
  styleUrls: ['./google-vision-ocr.css']
})
export class GoogleVisionOcr {
  apiKey: string = '';
  imagePreview: string | null = null;
  base64Image: string | null = null;
  isLoading: boolean = false;
  ocrResult: string = '';
  rawAnnotations: VisionAnnotation[] = [];
  errorMessage: string = '';
  successMessage: string = '';
  detectionMode: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION' = 'DOCUMENT_TEXT_DETECTION';
  languageHints: string = 'th,en';
  isDragging: boolean = false;
  selectedFileName: string = '';
  confidenceScore: number | null = null;
  detectedLanguages: string[] = [];
  pageCount: number = 0;
  wordCount: number = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        this.handleFile(file);
      } else {
        this.errorMessage = 'Please upload an image file (JPEG, PNG, WebP, GIF, BMP, TIFF) or PDF.';
      }
    }
  }

  handleFile(file: File) {
    this.selectedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
      this.ocrResult = '';
      this.rawAnnotations = [];
      this.errorMessage = '';
      this.successMessage = '';
      this.confidenceScore = null;
      this.detectedLanguages = [];
      this.pageCount = 0;
      this.wordCount = 0;

      // Resize image to keep payload reasonable
      this.resizeImage(e.target.result, 2048).then(resizedBase64 => {
        this.base64Image = resizedBase64;
        this.cdr.detectChanges();
      });
    };
    reader.readAsDataURL(file);
  }

  resizeImage(base64Str: string, maxDim: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = base64Str;
    });
  }

  async processImage() {
    if (!this.apiKey) {
      this.errorMessage = 'Please enter your Google Cloud Vision API Key.';
      return;
    }
    if (!this.base64Image) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ocrResult = '';
    this.rawAnnotations = [];
    this.confidenceScore = null;
    this.detectedLanguages = [];
    this.pageCount = 0;
    this.wordCount = 0;
    this.cdr.detectChanges();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      // Strip the data URL prefix to get pure base64
      const base64Content = this.base64Image.replace(/^data:image\/\w+;base64,/, '');

      const langHints = this.languageHints
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const requestBody: any = {
        requests: [
          {
            image: {
              content: base64Content
            },
            features: [
              {
                type: this.detectionMode,
                maxResults: 50
              }
            ],
            imageContext: {}
          }
        ]
      };

      if (langHints.length > 0) {
        requestBody.requests[0].imageContext.languageHints = langHints;
      }

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(requestBody)
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errStr = `HTTP Error ${response.status}`;
        try {
          const errJson = await response.json();
          errStr = errJson.error?.message || errStr;
        } catch (e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      const result = data.responses?.[0];

      if (result?.error) {
        throw new Error(result.error.message || 'Google Vision API returned an error.');
      }

      if (this.detectionMode === 'DOCUMENT_TEXT_DETECTION') {
        this.processDocumentTextResult(result);
      } else {
        this.processTextResult(result);
      }

      if (!this.ocrResult || this.ocrResult.trim().length === 0) {
        this.errorMessage = 'No text was detected in the image.';
      } else {
        this.successMessage = 'Text extraction completed successfully!';
      }
    } catch (error: any) {
      console.error('Google Vision OCR Error:', error);
      if (error.name === 'AbortError') {
        this.errorMessage = 'The request timed out after 60 seconds. Please try again.';
      } else if (error.message?.includes('403')) {
        this.errorMessage = 'Access denied. Check that the Vision API is enabled in your Google Cloud project and your API key is valid.';
      } else if (error.message?.includes('400')) {
        this.errorMessage = 'Bad request. The image might be invalid or too large.';
      } else {
        this.errorMessage = error.message || 'Failed to communicate with Google Vision API.';
      }
    } finally {
      clearTimeout(timeoutId);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private processDocumentTextResult(result: any) {
    const fullTextAnnotation = result.fullTextAnnotation;
    if (fullTextAnnotation) {
      this.ocrResult = fullTextAnnotation.text || '';
      this.wordCount = this.ocrResult.split(/\s+/).filter((w: string) => w.length > 0).length;

      // Extract page-level info
      if (fullTextAnnotation.pages) {
        this.pageCount = fullTextAnnotation.pages.length;

        // Gather confidence and language data
        const confidences: number[] = [];
        const languages = new Set<string>();

        for (const page of fullTextAnnotation.pages) {
          if (page.confidence) {
            confidences.push(page.confidence);
          }
          if (page.property?.detectedLanguages) {
            for (const lang of page.property.detectedLanguages) {
              languages.add(lang.languageCode);
            }
          }
          // Walk blocks for additional language info
          for (const block of page.blocks || []) {
            if (block.confidence) confidences.push(block.confidence);
            if (block.property?.detectedLanguages) {
              for (const lang of block.property.detectedLanguages) {
                languages.add(lang.languageCode);
              }
            }
          }
        }

        if (confidences.length > 0) {
          this.confidenceScore = Math.round(
            (confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length) * 100
          );
        }
        this.detectedLanguages = Array.from(languages);
      }
    }

    // Also store text annotations for reference
    if (result.textAnnotations) {
      this.rawAnnotations = result.textAnnotations;
    }
  }

  private processTextResult(result: any) {
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      // The first annotation contains the full detected text
      this.ocrResult = result.textAnnotations[0].description || '';
      this.rawAnnotations = result.textAnnotations;
      this.wordCount = this.ocrResult.split(/\s+/).filter((w: string) => w.length > 0).length;
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.successMessage = 'Copied to clipboard!';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.detectChanges();
      }, 2000);
    });
  }

  clearAll() {
    this.imagePreview = null;
    this.base64Image = null;
    this.ocrResult = '';
    this.rawAnnotations = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedFileName = '';
    this.confidenceScore = null;
    this.detectedLanguages = [];
    this.pageCount = 0;
    this.wordCount = 0;
    this.cdr.detectChanges();
  }

  downloadResult() {
    if (!this.ocrResult) return;
    const blob = new Blob([this.ocrResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
