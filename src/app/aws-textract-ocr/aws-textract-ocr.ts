import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  type Block,
  type FeatureType
} from '@aws-sdk/client-textract';

interface TextractResult {
  text: string;
  tables: string[][];
  keyValuePairs: { key: string; value: string }[];
  wordCount: number;
  lineCount: number;
  confidence: number | null;
  blockCount: number;
}

@Component({
  selector: 'app-aws-textract-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aws-textract-ocr.html',
  styleUrls: ['./aws-textract-ocr.css']
})
export class AwsTextractOcr {
  accessKeyId: string = '';
  secretAccessKey: string = '';
  region: string = 'ap-southeast-1';
  imagePreview: string | null = null;
  base64Bytes: Uint8Array | null = null;
  isLoading: boolean = false;
  ocrResult: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isDragging: boolean = false;
  selectedFileName: string = '';

  // Analysis mode
  analysisMode: 'text' | 'document' = 'text';

  // Result metadata
  wordCount: number = 0;
  lineCount: number = 0;
  confidence: number | null = null;
  blockCount: number = 0;
  tables: string[][] = [];
  keyValuePairs: { key: string; value: string }[] = [];

  // Tab control for results
  activeResultTab: 'text' | 'tables' | 'keyvalue' = 'text';

  // AWS Region options
  regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-west-2', label: 'Europe (London)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ca-central-1', label: 'Canada (Central)' },
  ];

  constructor(private cdr: ChangeDetectorRef) { }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.handleFile(file);
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
        this.errorMessage = 'Please upload an image (JPEG, PNG) or PDF file.';
      }
    }
  }

  handleFile(file: File) {
    // Textract has a 5 MB limit for synchronous operations
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'File exceeds 5 MB limit for synchronous Textract. Please use a smaller file.';
      return;
    }

    this.selectedFileName = file.name;
    this.errorMessage = '';
    this.successMessage = '';

    // Read as ArrayBuffer for Textract (raw bytes)
    const bytesReader = new FileReader();
    bytesReader.onload = (e: any) => {
      this.base64Bytes = new Uint8Array(e.target.result);
      this.cdr.detectChanges();
    };
    bytesReader.readAsArrayBuffer(file);

    // Read as DataURL for preview
    const previewReader = new FileReader();
    previewReader.onload = (e: any) => {
      this.imagePreview = e.target.result;
      this.ocrResult = '';
      this.tables = [];
      this.keyValuePairs = [];
      this.cdr.detectChanges();
    };
    previewReader.readAsDataURL(file);
  }

  async processImage() {
    if (!this.accessKeyId || !this.secretAccessKey) {
      this.errorMessage = 'Please enter your AWS Access Key ID and Secret Access Key.';
      return;
    }
    if (!this.base64Bytes) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ocrResult = '';
    this.tables = [];
    this.keyValuePairs = [];
    this.wordCount = 0;
    this.lineCount = 0;
    this.confidence = null;
    this.blockCount = 0;
    this.activeResultTab = 'text';
    this.cdr.detectChanges();

    try {
      const client = new TextractClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId.trim(),
          secretAccessKey: this.secretAccessKey.trim()
        }
      });

      let result: TextractResult;

      if (this.analysisMode === 'document') {
        result = await this.analyzeDocument(client);
      } else {
        result = await this.detectText(client);
      }

      this.ocrResult = result.text;
      this.tables = result.tables;
      this.keyValuePairs = result.keyValuePairs;
      this.wordCount = result.wordCount;
      this.lineCount = result.lineCount;
      this.confidence = result.confidence;
      this.blockCount = result.blockCount;

      if (!this.ocrResult && this.tables.length === 0 && this.keyValuePairs.length === 0) {
        this.errorMessage = 'No text, tables, or form data detected in the image.';
      } else {
        this.successMessage = 'Text extraction completed successfully!';
        // Auto-switch to tab with content
        if (!this.ocrResult && this.tables.length > 0) {
          this.activeResultTab = 'tables';
        } else if (!this.ocrResult && this.keyValuePairs.length > 0) {
          this.activeResultTab = 'keyvalue';
        }
      }
    } catch (error: any) {
      console.error('AWS Textract Error:', error);
      if (error.name === 'InvalidSignatureException' || error.name === 'UnrecognizedClientException') {
        this.errorMessage = 'Invalid AWS credentials. Please check your Access Key ID and Secret Access Key.';
      } else if (error.name === 'AccessDeniedException') {
        this.errorMessage = 'Access denied. Ensure your IAM user/role has textract:DetectDocumentText and textract:AnalyzeDocument permissions.';
      } else if (error.name === 'ProvisionedThroughputExceededException') {
        this.errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.name === 'UnsupportedDocumentException') {
        this.errorMessage = 'Unsupported document format. Textract supports JPEG, PNG, and single-page PDF.';
      } else if (error.name === 'DocumentTooLargeException') {
        this.errorMessage = 'Document too large. Max 5 MB for synchronous processing.';
      } else if (error.message?.includes('CORS') || error.message?.includes('NetworkError')) {
        this.errorMessage = 'Network error — this may be a CORS issue. Consider routing through a backend proxy or deploying to AWS.';
      } else {
        this.errorMessage = error.message || 'Failed to communicate with AWS Textract.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async detectText(client: TextractClient): Promise<TextractResult> {
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: this.base64Bytes! }
    });
    const response = await client.send(command);
    return this.parseBlocks(response.Blocks || []);
  }

  private async analyzeDocument(client: TextractClient): Promise<TextractResult> {
    const features: FeatureType[] = ['TABLES', 'FORMS'];
    const command = new AnalyzeDocumentCommand({
      Document: { Bytes: this.base64Bytes! },
      FeatureTypes: features
    });
    const response = await client.send(command);
    return this.parseBlocks(response.Blocks || []);
  }

  private parseBlocks(blocks: Block[]): TextractResult {
    const lines: string[] = [];
    let wordCount = 0;
    const confidences: number[] = [];
    const tables: string[][] = [];
    const keyValuePairs: { key: string; value: string }[] = [];

    // Build block map for relationship lookups
    const blockMap = new Map<string, Block>();
    for (const block of blocks) {
      if (block.Id) blockMap.set(block.Id, block);
    }

    for (const block of blocks) {
      if (block.BlockType === 'LINE') {
        lines.push(block.Text || '');
      }
      if (block.BlockType === 'WORD') {
        wordCount++;
      }
      if (block.Confidence != null) {
        confidences.push(block.Confidence);
      }

      // Extract key-value pairs from FORMS analysis
      if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
        const keyText = this.getTextFromRelationships(block, 'CHILD', blockMap);
        const valueBlock = this.getRelatedBlock(block, 'VALUE', blockMap);
        const valueText = valueBlock
          ? this.getTextFromRelationships(valueBlock, 'CHILD', blockMap)
          : '';
        if (keyText) {
          keyValuePairs.push({ key: keyText, value: valueText });
        }
      }
    }

    // Extract tables
    const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
    for (const table of tableBlocks) {
      const cells = this.getRelatedBlocks(table, 'CHILD', blockMap)
        .filter(b => b.BlockType === 'CELL');
      if (cells.length > 0) {
        const maxRow = Math.max(...cells.map(c => c.RowIndex || 0));
        const maxCol = Math.max(...cells.map(c => c.ColumnIndex || 0));
        const grid: string[][] = [];
        for (let r = 0; r < maxRow; r++) {
          grid.push(new Array(maxCol).fill(''));
        }
        for (const cell of cells) {
          const row = (cell.RowIndex || 1) - 1;
          const col = (cell.ColumnIndex || 1) - 1;
          grid[row][col] = this.getTextFromRelationships(cell, 'CHILD', blockMap);
        }
        // Flatten table rows into strings
        for (const row of grid) {
          tables.push(row);
        }
      }
    }

    const avgConfidence = confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : null;

    return {
      text: lines.join('\n'),
      tables,
      keyValuePairs,
      wordCount,
      lineCount: lines.length,
      confidence: avgConfidence,
      blockCount: blocks.length
    };
  }

  private getTextFromRelationships(block: Block, relType: string, blockMap: Map<string, Block>): string {
    const children = this.getRelatedBlocks(block, relType, blockMap);
    return children
      .filter(b => b.BlockType === 'WORD' || b.BlockType === 'SELECTION_ELEMENT')
      .map(b => b.BlockType === 'SELECTION_ELEMENT' ? (b.SelectionStatus === 'SELECTED' ? '☑' : '☐') : (b.Text || ''))
      .join(' ');
  }

  private getRelatedBlock(block: Block, relType: string, blockMap: Map<string, Block>): Block | null {
    const rel = block.Relationships?.find((r: any) => r.Type === relType);
    if (rel?.Ids && rel.Ids.length > 0) {
      return blockMap.get(rel.Ids[0]) || null;
    }
    return null;
  }

  private getRelatedBlocks(block: Block, relType: string, blockMap: Map<string, Block>): Block[] {
    const rel = block.Relationships?.find((r: any) => r.Type === relType);
    if (!rel?.Ids) return [];
    return rel.Ids.map((id: string) => blockMap.get(id)).filter((b: any): b is Block => b != null);
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

  copyTableAsCSV() {
    if (this.tables.length === 0) return;
    const csv = this.tables.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    this.copyToClipboard(csv);
  }

  clearAll() {
    this.imagePreview = null;
    this.base64Bytes = null;
    this.ocrResult = '';
    this.tables = [];
    this.keyValuePairs = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedFileName = '';
    this.wordCount = 0;
    this.lineCount = 0;
    this.confidence = null;
    this.blockCount = 0;
    this.cdr.detectChanges();
  }

  downloadResult() {
    if (!this.ocrResult) return;
    const blob = new Blob([this.ocrResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textract-result-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadTableCSV() {
    if (this.tables.length === 0) return;
    const csv = this.tables.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textract-table-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
