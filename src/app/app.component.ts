import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem, copyArrayItem } from '@angular/cdk/drag-drop';
import { TabulatorComponent } from './tabulator/tabulator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TabulatorComponent, DragDropModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  rawData: any[] = [];
  pivotData: any[] = []; // Output of the pivot engine

  pinTitleFormatter = (cell: any) => {
    // Tabulator 5+ passes the column component directly to titleFormatter
    const column = cell.getColumn ? cell.getColumn() : cell; 
    const def = column.getDefinition();
    const isPinned = def.frozen;
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.justifyContent = 'space-between';
    container.style.alignItems = 'center';
    container.style.width = '100%';

    const title = document.createElement('span');
    title.innerText = def.title;
    
    const icon = document.createElement('i');
    icon.className = isPinned ? 'pi pi-lock' : 'pi pi-unlock';
    icon.style.color = isPinned ? '#4daafc' : '#666';
    icon.style.cursor = 'pointer';
    icon.style.marginLeft = '8px';
    icon.title = isPinned ? 'Unpin Column' : 'Pin Column';
    
    // Toggle freeze state when clicking the icon
    icon.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop click from triggering a sort
      column.updateDefinition({ frozen: !isPinned });
    });

    container.appendChild(title);
    container.appendChild(icon);
    return container;
  };

  getBaseColumns() {
    return [
      { title: 'Region', field: 'Region', headerFilter: 'input', width: 150, frozen: true, titleFormatter: this.pinTitleFormatter },
      { title: 'Branch', field: 'Branch', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Year', field: 'Year', headerFilter: 'input', width: 100, titleFormatter: this.pinTitleFormatter },
      { title: 'Month', field: 'Month', headerFilter: 'input', width: 100, titleFormatter: this.pinTitleFormatter },
      { title: 'Category', field: 'Category', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Product', field: 'Product', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Manager', field: 'Manager', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Customer', field: 'Customer', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Status', field: 'Status', headerFilter: 'input', width: 120, titleFormatter: this.pinTitleFormatter },
      { title: 'Priority', field: 'Priority', headerFilter: 'input', width: 100, titleFormatter: this.pinTitleFormatter },
      { title: 'Ship Mode', field: 'ShipMode', headerFilter: 'input', width: 120, titleFormatter: this.pinTitleFormatter },
      { title: 'Warehouse', field: 'Warehouse', headerFilter: 'input', width: 130, titleFormatter: this.pinTitleFormatter },
      { title: 'Supplier', field: 'Supplier', headerFilter: 'input', width: 150, titleFormatter: this.pinTitleFormatter },
      { title: 'Currency', field: 'Currency', headerFilter: 'input', width: 90, titleFormatter: this.pinTitleFormatter },
      { title: 'Order Date', field: 'OrderDate', headerFilter: 'input', width: 120, titleFormatter: this.pinTitleFormatter },
      { 
        title: 'Tax', field: 'Tax', headerFilter: 'number', width: 100,
        hozAlign: 'right', formatter: 'money', formatterParams: { symbol: '$' },
        bottomCalc: 'sum', bottomCalcFormatter: 'money', bottomCalcFormatterParams: { symbol: '$' },
        titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Shipping Cost', field: 'ShippingCost', headerFilter: 'number', width: 120,
        hozAlign: 'right', formatter: 'money', formatterParams: { symbol: '$' },
        bottomCalc: 'sum', bottomCalcFormatter: 'money', bottomCalcFormatterParams: { symbol: '$' },
        titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Margin', field: 'Margin', headerFilter: 'number', hozAlign: 'right', width: 100,
        formatter: (cell: any) => cell.getValue() + '%', titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Sales', field: 'Sales', headerFilter: 'number', width: 120,
        hozAlign: 'right', formatter: 'money', formatterParams: { symbol: '$' },
        bottomCalc: 'sum', bottomCalcFormatter: 'money', bottomCalcFormatterParams: { symbol: '$' },
        titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Profit', field: 'Profit', headerFilter: 'number', width: 120,
        hozAlign: 'right', formatter: 'money', formatterParams: { symbol: '$' },
        bottomCalc: 'sum', bottomCalcFormatter: 'money', bottomCalcFormatterParams: { symbol: '$' },
        titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Discount', field: 'Discount', headerFilter: 'number', hozAlign: 'right', width: 100,
        formatter: (cell: any) => cell.getValue() + '%', titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Qty', field: 'Qty', headerFilter: 'number', hozAlign: 'right', width: 100,
        bottomCalc: 'sum', titleFormatter: this.pinTitleFormatter
      },
      { 
        title: 'Rating', field: 'Rating', headerFilter: 'number', hozAlign: 'right', width: 100,
        formatter: 'star', titleFormatter: this.pinTitleFormatter
      }
    ];
  }

  tabulatorColumns: any[] = [];
  
  availableGroupingFields: string[] = ['Region', 'Branch', 'Year', 'Month', 'Category', 'Product', 'Manager', 'Customer', 'Status', 'Priority', 'ShipMode', 'Warehouse', 'Supplier', 'Currency', 'OrderDate', 'Sales', 'Profit', 'Qty', 'Tax', 'ShippingCost', 'Margin', 'Discount', 'Rating'];
  groupedFields: string[] = [];
  pivotFields: string[] = [];
  valueFields: string[] = ['Sales', 'Qty']; // Default values to aggregate
  groupByField: string[] = [];
  isPivotMode: boolean = false; // AG-Grid style toggle

  togglePivotMode() {
    this.isPivotMode = !this.isPivotMode;
    this.rebuildPivotAndColumns();
  }

  // Used to distinguish metrics from dimensions
  allMetricFields: string[] = ['Sales', 'Profit', 'Qty', 'Tax', 'ShippingCost', 'Margin', 'Discount', 'Rating'];

  ngOnInit() {
    this.generateMockData(10); // Generate 10 rows per region
    this.rebuildPivotAndColumns(); // Initialize
  }

  rebuildPivotAndColumns() {
    const baseCols = this.getBaseColumns();
    const dynamicColumns: any[] = [];
    const pivotData: any[] = [];
    
    // If Pivot Mode is OFF, just show standard data and Tabulator grouping
    if (!this.isPivotMode) {
      this.tabulatorColumns = baseCols;
      this.pivotData = this.rawData;
      return;
    }

    // 1. Identify remaining dimension fields (everything that is not in valueFields and not pivoted)
    const activeDimensions = this.availableGroupingFields.concat(this.groupedFields)
      .filter(f => !this.valueFields.includes(f) && !this.pivotFields.includes(f) && !this.allMetricFields.includes(f));

    // 2. Add Active Dimensions to the dynamic columns array
    activeDimensions.forEach(dim => {
      const colDef = baseCols.find((c: any) => c.field === dim);
      if (colDef) dynamicColumns.push(colDef);
    });

    if (!this.pivotFields || this.pivotFields.length === 0) {
      // No pivot -> Just show the dimensions + the selected value fields
      this.valueFields.forEach(valField => {
         const colDef = baseCols.find((c: any) => c.field === valField);
         if (colDef) dynamicColumns.push(colDef);
      });
      this.tabulatorColumns = dynamicColumns;
      this.pivotData = this.rawData;
      return;
    }

    // 3. Find unique pivot value combinations in the raw data
    const uniquePivotKeys = new Set<string>();
    this.rawData.forEach(row => {
      const key = this.pivotFields.map(f => row[f]).join('_');
      uniquePivotKeys.add(key);
    });

    // 4. Generate the nested dynamic pivot column groups
    Array.from(uniquePivotKeys).sort().forEach(pivotKey => {
      
      const pivotColumnGroup: any = {
        title: pivotKey.replace(/_/g, ' '), // e.g. "2023" or "2023 Jan"
        columns: []
      };

      this.valueFields.forEach(metric => {
        const baseMetricDef = baseCols.find((c: any) => c.field === metric);
        if (baseMetricDef) {
           pivotColumnGroup.columns.push({
             ...baseMetricDef,
             title: baseMetricDef.title, // e.g. "Sales"
             field: `${pivotKey}_${metric}`, // e.g. "2023_Sales"
             width: 120
           });
        }
      });
      
      if (pivotColumnGroup.columns.length > 0) {
        dynamicColumns.push(pivotColumnGroup);
      }
    });

    this.tabulatorColumns = dynamicColumns;

    // 5. Transform Data: Group the raw data by active dimensions
    const groupedData = new Map<string, any[]>();
    
    this.rawData.forEach(row => {
      const groupKey = activeDimensions.map(d => row[d]).join('|||');
      if (!groupedData.has(groupKey)) groupedData.set(groupKey, []);
      groupedData.get(groupKey)!.push(row);
    });

    // For each group, create a flattened row
    let idCounter = 1;
    groupedData.forEach((rowsInGroup, groupKey) => {
       const flatRow: any = { id: idCounter++ };
       
       // Add dimension properties
       activeDimensions.forEach(dim => {
         flatRow[dim] = rowsInGroup[0][dim];
       });

       // Initialize metric totals to 0
       Array.from(uniquePivotKeys).forEach(pivotKey => {
         this.valueFields.forEach(metric => {
           flatRow[`${pivotKey}_${metric}`] = 0;
         });
       });

       // Sum the metrics into the dynamic keys
       rowsInGroup.forEach(row => {
         const rowPivotKey = this.pivotFields.map(f => row[f]).join('_');
         this.valueFields.forEach(metric => {
            flatRow[`${rowPivotKey}_${metric}`] += (Number(row[metric]) || 0);
         });
       });

       pivotData.push(flatRow);
    });

    this.pivotData = pivotData;
  }

  generateMockData(recordsPerRegion: number) {
    const geographyMap: { [key: string]: { branches: string[], currencies: string[] } } = {
      'United States': { branches: ['New York', 'California', 'Texas', 'Florida', 'Chicago'], currencies: ['USD'] },
      'Europe': { branches: ['London', 'Berlin', 'Paris', 'Rome', 'Madrid', 'Amsterdam'], currencies: ['EUR', 'GBP'] },
      'Asia': { branches: ['Tokyo', 'Seoul', 'Beijing', 'Singapore', 'Mumbai', 'Bangkok'], currencies: ['JPY', 'CNY', 'SGD'] },
      'Australia': { branches: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'], currencies: ['AUD'] },
      'South America': { branches: ['Sao Paulo', 'Buenos Aires', 'Santiago', 'Bogota'], currencies: ['BRL', 'ARS'] }
    };
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const years = ['2023', '2024', '2025'];
    const products = ['Laptop', 'Desktop', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Server', 'Router'];
    const categories = ['Electronics', 'Accessories', 'Office', 'Hardware', 'Networking'];
    const managers = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Davis', 'Eve Wilson'];
    const customers = ['Acme Corp', 'Globex', 'Soylent', 'Initech', 'Umbrella', 'Stark Ind.', 'Wayne Ent.'];
    const statuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Processing'];
    const priorities = ['Low', 'Medium', 'High', 'Critical'];
    const shipModes = ['Standard', 'Express', 'Next Day', 'Freight'];
    const warehouses = ['WH-East', 'WH-West', 'WH-Central', 'WH-North', 'WH-South', 'WH-Global'];
    const suppliers = ['TechSource', 'GlobalGoods', 'OfficeMax', 'ElectroSupply', 'MegaCorp'];

    const data: any[] = [];
    let idCounter = 1;
    
    Object.keys(geographyMap).forEach(region => {
      const geo = geographyMap[region];
      
      for (let i = 0; i < recordsPerRegion; i++) {
        data.push({
          id: idCounter++,
          Region: region,
          Branch: geo.branches[Math.floor(Math.random() * geo.branches.length)],
          Year: years[Math.floor(Math.random() * years.length)],
          Month: months[Math.floor(Math.random() * months.length)],
          Category: categories[Math.floor(Math.random() * categories.length)],
          Product: products[Math.floor(Math.random() * products.length)],
          Manager: managers[Math.floor(Math.random() * managers.length)],
          Customer: customers[Math.floor(Math.random() * customers.length)],
          Status: statuses[Math.floor(Math.random() * statuses.length)],
          Priority: priorities[Math.floor(Math.random() * priorities.length)],
          ShipMode: shipModes[Math.floor(Math.random() * shipModes.length)],
          Warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
          Supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
          Currency: geo.currencies[Math.floor(Math.random() * geo.currencies.length)],
          OrderDate: `202${Math.floor(Math.random() * 5)}-0${Math.floor(Math.random() * 9) + 1}-1${Math.floor(Math.random() * 9)}`,
          Tax: Math.floor(Math.random() * 500),
          ShippingCost: Math.floor(Math.random() * 200),
          Margin: Math.floor(Math.random() * 60) + 10,
          Sales: Math.floor(Math.random() * 10000) + 100,
          Profit: Math.floor(Math.random() * 5000) - 500,
          Discount: Math.floor(Math.random() * 30),
          Qty: Math.floor(Math.random() * 200) + 10,
          Rating: Math.floor(Math.random() * 5) + 1
        });
      }
    });
    this.rawData = data;
  }

  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const item = event.previousContainer.data[event.previousIndex];
      // Prevent duplicates in the target bucket
      if (!event.container.data.includes(item)) {
        if (event.previousContainer.id === 'availableList') {
          copyArrayItem(
            event.previousContainer.data,
            event.container.data,
            event.previousIndex,
            event.currentIndex,
          );
        } else {
          transferArrayItem(
            event.previousContainer.data,
            event.container.data,
            event.previousIndex,
            event.currentIndex,
          );
        }
      }
    }
    
    // Update Tabulator grouping
    this.groupByField = [...this.groupedFields];
    
    // Trigger Pivot Engine
    this.rebuildPivotAndColumns();
  }

  removeGroup(field: string, target: 'row' | 'pivot' | 'value') {
    if (target === 'row') {
      this.groupedFields = this.groupedFields.filter(f => f !== field);
      this.groupByField = [...this.groupedFields];
    } else if (target === 'pivot') {
      this.pivotFields = this.pivotFields.filter(f => f !== field);
    } else if (target === 'value') {
      this.valueFields = this.valueFields.filter(f => f !== field);
    }
    // We no longer push back to availableGroupingFields because it is a persistent copy list.
    
    this.rebuildPivotAndColumns();
  }
}
