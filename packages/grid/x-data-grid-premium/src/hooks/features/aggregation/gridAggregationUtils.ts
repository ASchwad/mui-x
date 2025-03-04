import * as React from 'react';
import { unstable_capitalize as capitalize } from '@mui/utils';
import {
  GridColDef,
  GridFooterNode,
  GridRowId,
  GRID_ROOT_GROUP_ID,
  GridGroupNode,
} from '@mui/x-data-grid-pro';
import {
  addPinnedRow,
  GridColumnRawLookup,
  GridHydrateRowsValue,
  isDeepEqual,
  insertNodeInTree,
  removeNodeFromTree,
} from '@mui/x-data-grid-pro/internals';
import {
  GridAggregationFunction,
  GridAggregationModel,
  GridAggregationRule,
  GridAggregationRules,
} from './gridAggregationInterfaces';
import { GridStatePremium } from '../../../models/gridStatePremium';
import { DataGridPremiumProcessedProps } from '../../../models/dataGridPremiumProps';
import { GridApiPremium, GridPrivateApiPremium } from '../../../models/gridApiPremium';

export const GRID_AGGREGATION_ROOT_FOOTER_ROW_ID = 'auto-generated-group-footer-root';

export const getAggregationFooterRowIdFromGroupId = (groupId: GridRowId | null) => {
  if (groupId == null) {
    return GRID_AGGREGATION_ROOT_FOOTER_ROW_ID;
  }

  return `auto-generated-group-footer-${groupId}`;
};

export const canColumnHaveAggregationFunction = ({
  colDef,
  aggregationFunctionName,
  aggregationFunction,
}: {
  colDef: GridColDef | undefined;
  aggregationFunctionName: string;
  aggregationFunction: GridAggregationFunction | undefined;
}): boolean => {
  if (!colDef || !colDef.aggregable) {
    return false;
  }

  if (!aggregationFunction) {
    return false;
  }

  if (colDef.availableAggregationFunctions != null) {
    return colDef.availableAggregationFunctions.includes(aggregationFunctionName);
  }

  if (!aggregationFunction.columnTypes) {
    return true;
  }

  return aggregationFunction.columnTypes.includes(colDef.type!);
};

export const getAvailableAggregationFunctions = ({
  aggregationFunctions,
  colDef,
}: {
  aggregationFunctions: Record<string, GridAggregationFunction>;
  colDef: GridColDef;
}) =>
  Object.keys(aggregationFunctions).filter((aggregationFunctionName) =>
    canColumnHaveAggregationFunction({
      colDef,
      aggregationFunctionName,
      aggregationFunction: aggregationFunctions[aggregationFunctionName],
    }),
  );

export const mergeStateWithAggregationModel =
  (aggregationModel: GridAggregationModel) =>
  (state: GridStatePremium): GridStatePremium => ({
    ...state,
    aggregation: { ...state.aggregation, model: aggregationModel },
  });

export const getAggregationRules = ({
  columnsLookup,
  aggregationModel,
  aggregationFunctions,
}: {
  columnsLookup: GridColumnRawLookup;
  aggregationModel: GridAggregationModel;
  aggregationFunctions: Record<string, GridAggregationFunction>;
}) => {
  const aggregationRules: GridAggregationRules = {};

  Object.entries(aggregationModel).forEach(([field, columnItem]) => {
    if (
      columnsLookup[field] &&
      canColumnHaveAggregationFunction({
        colDef: columnsLookup[field],
        aggregationFunctionName: columnItem,
        aggregationFunction: aggregationFunctions[columnItem],
      })
    ) {
      aggregationRules[field] = {
        aggregationFunctionName: columnItem,
        aggregationFunction: aggregationFunctions[columnItem],
      };
    }
  });

  return aggregationRules;
};

interface AddFooterRowsParams {
  groupingParams: GridHydrateRowsValue;
  getAggregationPosition: DataGridPremiumProcessedProps['getAggregationPosition'];
  /**
   * If `true`, there are some aggregation rules to apply
   */
  hasAggregationRule: boolean;
  apiRef: React.MutableRefObject<GridPrivateApiPremium>;
}

/**
 * Add a footer for each group that has at least one column with an aggregated value.
 */
export const addFooterRows = ({
  groupingParams,
  apiRef,
  getAggregationPosition,
  hasAggregationRule,
}: AddFooterRowsParams) => {
  let newGroupingParams: GridHydrateRowsValue = {
    ...groupingParams,
    tree: { ...groupingParams.tree },
    treeDepths: { ...groupingParams.treeDepths },
  };

  const updateChildGroupFooter = (groupNode: GridGroupNode) => {
    const shouldHaveFooter = hasAggregationRule && getAggregationPosition(groupNode) === 'footer';

    if (shouldHaveFooter) {
      const footerId = getAggregationFooterRowIdFromGroupId(groupNode.id);
      if (groupNode.footerId !== footerId) {
        if (groupNode.footerId != null) {
          removeNodeFromTree({
            node: newGroupingParams.tree[groupNode.footerId],
            tree: newGroupingParams.tree,
            treeDepths: newGroupingParams.treeDepths,
          });
        }

        const footerNode: GridFooterNode = {
          id: footerId,
          parent: groupNode.id,
          depth: groupNode ? groupNode.depth + 1 : 0,
          type: 'footer',
        };

        insertNodeInTree({
          node: footerNode,
          tree: newGroupingParams.tree,
          treeDepths: newGroupingParams.treeDepths,
        });
      }
    } else if (groupNode.footerId != null) {
      removeNodeFromTree({
        node: newGroupingParams.tree[groupNode.footerId],
        tree: newGroupingParams.tree,
        treeDepths: newGroupingParams.treeDepths,
      });

      newGroupingParams.tree[groupNode.id] = {
        ...(newGroupingParams.tree[groupNode.id] as GridGroupNode),
        footerId: null,
      };
    }
  };

  const updateRootGroupFooter = (groupNode: GridGroupNode) => {
    const shouldHaveFooter = hasAggregationRule && getAggregationPosition(groupNode) === 'footer';

    if (shouldHaveFooter) {
      newGroupingParams = addPinnedRow({
        groupingParams: newGroupingParams,
        rowModel: undefined,
        rowId: getAggregationFooterRowIdFromGroupId(null),
        position: 'bottom',
        apiRef,
        isAutoGenerated: true,
      });
    }
  };

  const updateGroupFooter = (groupNode: GridGroupNode) => {
    if (groupNode.id === GRID_ROOT_GROUP_ID) {
      updateRootGroupFooter(groupNode);
    } else {
      updateChildGroupFooter(groupNode);
    }

    groupNode.children.forEach((childId) => {
      const childNode = newGroupingParams.tree[childId];
      if (childNode.type === 'group') {
        updateGroupFooter(childNode);
      }
    });
  };

  updateGroupFooter(newGroupingParams.tree[GRID_ROOT_GROUP_ID] as GridGroupNode);

  return newGroupingParams;
};

/**
 * Compares two sets of aggregation rules to determine if they are equal or not.
 */
export const areAggregationRulesEqual = (
  previousValue: GridAggregationRules | undefined,
  newValue: GridAggregationRules,
) => {
  const previousFields = Object.keys(previousValue ?? {});
  const newFields = Object.keys(newValue);

  if (!isDeepEqual(previousFields, newFields)) {
    return false;
  }

  return newFields.every((field) => {
    const previousRule = previousValue?.[field];
    const newRule = newValue[field];

    if (previousRule?.aggregationFunction !== newRule?.aggregationFunction) {
      return false;
    }

    if (previousRule?.aggregationFunctionName !== newRule?.aggregationFunctionName) {
      return false;
    }

    return true;
  });
};

export const getAggregationFunctionLabel = ({
  apiRef,
  aggregationRule,
}: {
  apiRef: React.MutableRefObject<GridApiPremium>;
  aggregationRule: GridAggregationRule;
}): string => {
  if (aggregationRule.aggregationFunction.label != null) {
    return aggregationRule.aggregationFunction.label;
  }

  try {
    return apiRef.current.getLocaleText(
      `aggregationFunctionLabel${capitalize(
        aggregationRule.aggregationFunctionName,
      )}` as 'aggregationFunctionLabelSum',
    );
  } catch (e) {
    return aggregationRule.aggregationFunctionName;
  }
};
