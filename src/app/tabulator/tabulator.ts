import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

@Component({
  selector: 'app-tabulator',
  standalone: true,
  templateUrl: './tabulator.html',
  styleUrl: './tabulator.css',
  encapsulation: ViewEncapsulation.None
})
export class TabulatorComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('tableElement') tableElement!: ElementRef;
  
  @Input() data: any[] = [];
  @Input() columns: any[] = [];
  @Input() groupBy: string | string[] | undefined;

  private tabulator!: Tabulator;

  ngAfterViewInit() {
    this.tabulator = new Tabulator(this.tableElement.nativeElement, {
      data: this.data,
      columns: this.columns,
      groupBy: this.groupBy,
      groupStartOpen: true, // Expand groups by default
      height: '100%',
      pagination: false, // Disabled pagination for infinite scrolling (virtual DOM)
      movableColumns: true,
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.tabulator) {
      if (changes['data'] && !changes['data'].firstChange) {
        this.tabulator.setData(this.data);
      }
      if (changes['columns'] && !changes['columns'].firstChange) {
        this.tabulator.setColumns(this.columns);
      }
      if (changes['groupBy'] && !changes['groupBy'].firstChange) {
        this.tabulator.setGroupBy(this.groupBy || '');
      }
    }
  }

  ngOnDestroy() {
    if (this.tabulator) {
      this.tabulator.destroy();
    }
  }
}
