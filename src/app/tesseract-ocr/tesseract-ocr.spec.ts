import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TesseractOcr } from './tesseract-ocr';

describe('TesseractOcr', () => {
  let component: TesseractOcr;
  let fixture: ComponentFixture<TesseractOcr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TesseractOcr],
    }).compileComponents();

    fixture = TestBed.createComponent(TesseractOcr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
