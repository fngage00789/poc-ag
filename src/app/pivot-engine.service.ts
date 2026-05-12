import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import * as _ from 'lodash';

export interface PivotConfig {
  rows: string[];
  allFields: string[];
  numericFields: string[];
}

@Injectable({ providedIn: 'root' })
export class PivotEngineService {
  
  transformData(rawData: any[], config: PivotConfig): { treeData: TreeNode[], visibleCols: string[] } {
    if (!rawData || rawData.length === 0) return { treeData: [], visibleCols: [] };
    const { rows, allFields, numericFields } = config;

    const visibleCols = allFields.filter(f => !rows.includes(f));

    if (rows.length === 0) {
      const flatNodes = rawData.map(item => ({ data: { ...item } }));
      return { treeData: flatNodes, visibleCols };
    }

    const buildTree = (data: any[], groupFields: string[], currentDepth: number): TreeNode[] => {
      if (groupFields.length === 0) {
        return data.map(item => ({ data: { ...item } }));
      }

      const currentField = groupFields[0];
      const grouped = _.groupBy(data, currentField);
      const nodes: TreeNode[] = [];

      Object.keys(grouped).forEach(key => {
        const groupData = grouped[key];
        const nodeData: any = { groupField: `${key} (${groupData.length})` };
        
        numericFields.forEach(v => {
           nodeData[v] = _.sumBy(groupData, item => Number(item[v]) || 0);
        });

        const childrenFields = groupFields.slice(1);
        const children = buildTree(groupData, childrenFields, currentDepth + 1);

        nodes.push({
          data: nodeData,
          expanded: currentDepth === 0,
          children: children
        });
      });

      return nodes;
    };

    let treeNodes = buildTree(rawData, rows, 0);

    return { 
      treeData: treeNodes, 
      visibleCols: visibleCols 
    };
  }
}
