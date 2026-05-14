import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DocumentEntity {
  type: string;
  mentionText: string;
  confidence: number | null;
}

@Component({
  selector: 'app-google-document-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './google-document-ai.html',
  styleUrls: ['./google-document-ai.css']
})
export class GoogleDocumentAi {
  accessToken: string = '';
  projectId: string = '';
  location: string = 'asia-southeast1';
  processorId: string = '';

  imagePreview: string | null = null;
  base64Content: string | null = null;
  fileMimeType: string = '';
  isPdf: boolean = false;
  isLoading: boolean = false;
  ocrResult: string = '';
  entities: DocumentEntity[] = [];
  errorMessage: string = '';
  successMessage: string = '';
  isDragging: boolean = false;
  selectedFileName: string = '';

  // Stats
  confidenceScore: number | null = null;
  detectedLanguages: string[] = [];
  pageCount: number = 0;
  wordCount: number = 0;

  // Tabs
  activeTab: 'text' | 'entities' = 'text';

  // Location options (all available Document AI regions)
  locations = [
    { value: 'asia-southeast1', label: 'Asia Pacific — Singapore (asia-southeast1)' },
    { value: 'asia-south1', label: 'Asia Pacific — Mumbai (asia-south1)' },
    { value: 'australia-southeast1', label: 'Australia — Sydney (australia-southeast1)' },
    { value: 'us', label: 'United States — Multi-region (us)' },
    { value: 'eu', label: 'Europe — Multi-region (eu)' },
    { value: 'europe-west2', label: 'Europe — London (europe-west2)' },
    { value: 'europe-west3', label: 'Europe — Frankfurt (europe-west3)' },
    { value: 'northamerica-northeast1', label: 'Canada — Montréal (northamerica-northeast1)' },
  ];

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
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'];
      if (allowed.includes(file.type)) {
        this.handleFile(file);
      } else {
        this.errorMessage = 'Please upload an image (JPEG, PNG, WebP, TIFF) or PDF file.';
      }
    }
  }

  handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      this.errorMessage = 'File exceeds 20 MB limit for Document AI online processing.';
      return;
    }

    this.selectedFileName = file.name;
    this.fileMimeType = file.type;
    this.isPdf = file.type === 'application/pdf';
    this.errorMessage = '';
    this.successMessage = '';
    this.ocrResult = '';
    this.entities = [];
    this.confidenceScore = null;
    this.detectedLanguages = [];
    this.pageCount = 0;
    this.wordCount = 0;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const dataUrl: string = e.target.result;
      // Store raw base64 (without data URL prefix)
      this.base64Content = dataUrl.split(',')[1];

      if (!this.isPdf) {
        this.imagePreview = dataUrl;
      } else {
        this.imagePreview = null;
      }

      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  async processDocument() {
    if (!this.accessToken) {
      this.errorMessage = 'Please enter your Access Token.';
      return;
    }
    if (!this.projectId) {
      this.errorMessage = 'Please enter your Google Cloud Project ID.';
      return;
    }
    if (!this.processorId) {
      this.errorMessage = 'Please enter the Processor ID.';
      return;
    }
    if (!this.base64Content) {
      this.errorMessage = 'Please upload a document first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ocrResult = '';
    this.entities = [];
    this.confidenceScore = null;
    this.detectedLanguages = [];
    this.pageCount = 0;
    this.wordCount = 0;
    this.activeTab = 'text';
    this.cdr.detectChanges();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const loc = this.location.trim();
      const proj = this.projectId.trim();
      const proc = this.processorId.trim();

      const url = `https://${loc}-documentai.googleapis.com/v1/projects/${proj}/locations/${loc}/processors/${proc}:process`;

      const requestBody = {
        rawDocument: {
          content: this.base64Content,
          mimeType: this.fileMimeType || 'application/octet-stream'
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });

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
      this.parseDocumentResponse(data);

      if (!this.ocrResult && this.entities.length === 0) {
        this.errorMessage = 'No text or entities were detected in the document.';
      } else {
        this.successMessage = 'Document processed successfully!';
        if (!this.ocrResult && this.entities.length > 0) {
          this.activeTab = 'entities';
        }
      }
    } catch (error: any) {
      console.error('Document AI Error:', error);
      if (error.name === 'AbortError') {
        this.errorMessage = 'The request timed out after 120 seconds. Please try again.';
      } else if (error.message?.includes('401') || error.message?.includes('UNAUTHENTICATED')) {
        this.errorMessage = 'Authentication failed. Your access token may be expired or invalid. Generate a fresh token with: gcloud auth print-access-token';
      } else if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
        this.errorMessage = 'Permission denied. Ensure the Document AI API is enabled and your account has documentai.processors.processDocument permission.';
      } else if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        this.errorMessage = 'Processor not found. Check your Project ID, Location, and Processor ID.';
      } else if (error.message?.includes('400')) {
        this.errorMessage = 'Bad request. The document might be invalid or unsupported.';
      } else if (error.message?.includes('CORS') || error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        this.errorMessage = 'Network error — this may be a CORS issue. Try using a backend proxy or ensure your access token is correct.';
      } else {
        this.errorMessage = error.message || 'Failed to communicate with Google Document AI.';
      }
    } finally {
      clearTimeout(timeoutId);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private parseDocumentResponse(data: any) {
    const doc = data.document;
    if (!doc) return;

    // Extract text
    this.ocrResult = doc.text || '';
    this.wordCount = this.ocrResult.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Extract page info
    if (doc.pages && doc.pages.length > 0) {
      this.pageCount = doc.pages.length;

      const languages = new Set<string>();
      const confidences: number[] = [];

      for (const page of doc.pages) {
        // Page-level detected languages
        if (page.detectedLanguages) {
          for (const lang of page.detectedLanguages) {
            if (lang.languageCode) {
              languages.add(lang.languageCode);
            }
          }
        }

        // Page confidence from layout
        if (page.layout?.confidence != null) {
          confidences.push(page.layout.confidence);
        }

        // Walk blocks for additional confidence
        for (const block of page.blocks || []) {
          if (block.layout?.confidence != null) {
            confidences.push(block.layout.confidence);
          }
          if (block.detectedLanguages) {
            for (const lang of block.detectedLanguages) {
              if (lang.languageCode) languages.add(lang.languageCode);
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

    // Extract entities
    if (doc.entities && doc.entities.length > 0) {
      this.entities = doc.entities.map((entity: any) => ({
        type: entity.type || 'unknown',
        mentionText: entity.mentionText || entity.normalizedValue?.text || '',
        confidence: entity.confidence != null ? Math.round(entity.confidence * 100) : null
      }));
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

  copyEntitiesToClipboard() {
    const json = JSON.stringify(this.entities, null, 2);
    this.copyToClipboard(json);
  }

  clearAll() {
    this.imagePreview = null;
    this.base64Content = null;
    this.fileMimeType = '';
    this.isPdf = false;
    this.ocrResult = '';
    this.entities = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedFileName = '';
    this.confidenceScore = null;
    this.detectedLanguages = [];
    this.pageCount = 0;
    this.wordCount = 0;
    this.activeTab = 'text';
    this.cdr.detectChanges();
  }

  downloadResult() {
    if (!this.ocrResult) return;
    const blob = new Blob([this.ocrResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-ai-result-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadEntitiesJSON() {
    if (this.entities.length === 0) return;
    const json = JSON.stringify(this.entities, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-ai-entities-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
