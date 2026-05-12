import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr.component.html',
  styleUrls: ['./ocr.component.css']
})
export class OcrComponent {
  apiKey: string = '';
  imagePreview: string | null = null;
  base64Image: string | null = null;
  isLoading: boolean = false;
  ocrResult: string = '';
  errorMessage: string = '';

  constructor(private cdr: ChangeDetectorRef) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
        this.ocrResult = '';
        this.errorMessage = '';
        
        // Resize image before sending to API
        this.resizeImage(e.target.result, 1200).then(resizedBase64 => {
          this.base64Image = resizedBase64;
          this.cdr.detectChanges(); // Force UI update immediately
        });
      };
      reader.readAsDataURL(file);
    }
  }

  // Helper to resize image to prevent massive payloads and API timeouts
  resizeImage(base64Str: string, maxWidth: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Use quality 0.8 to reduce file size
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        reject(new Error('Failed to load image for resizing'));
      };
      // Set src after onload and onerror
      img.src = base64Str;
    });
  }

  async processImage() {
    if (!this.apiKey) {
      this.errorMessage = 'Please enter your OpenTyphoon API Key.';
      return;
    }
    if (!this.base64Image) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.ocrResult = '';
    this.cdr.detectChanges();

    const controller = new AbortController();
    // 3 minute timeout
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch('/typhoon-api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey.trim()}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'typhoon-ocr',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: this.base64Image
                  }
                },
                {
                  type: 'text',
                  text: 'Extract the text from this document.'
                }
              ]
            }
          ],
          temperature: 0
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errStr = `HTTP Error ${response.status}`;
        try {
          const errJson = await response.json();
          errStr = errJson.error?.message || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        this.ocrResult = data.choices[0].message.content;
      } else {
        this.errorMessage = 'No text extracted. Unexpected API response.';
      }
    } catch (error: any) {
      console.error('OCR Error:', error);
      if (error.name === 'AbortError') {
        this.errorMessage = 'The request timed out after 3 minutes. The OpenTyphoon API might be overloaded or struggling with this image size/complexity.';
      } else {
        this.errorMessage = error.message || 'Failed to communicate with OpenTyphoon API. Check your API key and network.';
      }
    } finally {
      clearTimeout(timeoutId);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Optional: Add a toast notification here
      console.log('Copied to clipboard');
    });
  }
}
