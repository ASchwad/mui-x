import * as React from 'react';
import { unstable_debounce as debounce, unstable_capitalize as capitalize } from '@mui/utils';
import { GridPrivateApiCommunity } from '../../../models/api/gridApiCommunity';
import { GridRowsMetaApi, GridRowsMetaPrivateApi } from '../../../models/api/gridRowsMetaApi';
import { DataGridProcessedProps } from '../../../models/props/DataGridProps';
import { useGridVisibleRows } from '../../utils/useGridVisibleRows';
import { useGridApiMethod } from '../../utils/useGridApiMethod';
import { GridRowEntry, GridRowId } from '../../../models/gridRows';
import { useGridSelector } from '../../utils/useGridSelector';
import { gridDensityFactorSelector } from '../density/densitySelector';
import { gridFilterModelSelector } from '../filter/gridFilterSelector';
import { gridPaginationSelector } from '../pagination/gridPaginationSelector';
import { gridSortModelSelector } from '../sorting/gridSortingSelector';
import { GridStateInitializer } from '../../utils/useGridInitializeState';
import { useGridRegisterPipeApplier } from '../../core/pipeProcessing';
import { gridPinnedRowsSelector } from './gridRowsSelector';

export const rowsMetaStateInitializer: GridStateInitializer = (state) => ({
  ...state,
  rowsMeta: {
    currentPageTotalHeight: 0,
    positions: [],
  },
});

/**
 * @requires useGridPageSize (method)
 * @requires useGridPage (method)
 */
export const useGridRowsMeta = (
  apiRef: React.MutableRefObject<GridPrivateApiCommunity>,
  props: Pick<
    DataGridProcessedProps,
    | 'getRowHeight'
    | 'getEstimatedRowHeight'
    | 'getRowSpacing'
    | 'pagination'
    | 'paginationMode'
    | 'rowHeight'
  >,
): void => {
  const { getRowHeight: getRowHeightProp, getRowSpacing, getEstimatedRowHeight } = props;
  const rowsHeightLookup = React.useRef<{
    [key: GridRowId]: {
      isResized: boolean;
      sizes: Record<string, number>;
      autoHeight: boolean; // Determines if the row has dynamic height
      needsFirstMeasurement: boolean; // Determines if the row was never measured. If true, use the estimated height as row height.
    };
  }>({});

  // Inspired by https://github.com/bvaughn/react-virtualized/blob/master/source/Grid/utils/CellSizeAndPositionManager.js
  const lastMeasuredRowIndex = React.useRef(-1);
  const hasRowWithAutoHeight = React.useRef(false);
  const densityFactor = useGridSelector(apiRef, gridDensityFactorSelector);
  const filterModel = useGridSelector(apiRef, gridFilterModelSelector);
  const paginationState = useGridSelector(apiRef, gridPaginationSelector);
  const sortModel = useGridSelector(apiRef, gridSortModelSelector);
  const currentPage = useGridVisibleRows(apiRef, props);
  const pinnedRows = useGridSelector(apiRef, gridPinnedRowsSelector);
  const rowHeight = Math.floor(props.rowHeight * densityFactor);

  const hydrateRowsMeta = React.useCallback(() => {
    hasRowWithAutoHeight.current = false;

    const calculateRowProcessedSizes = (row: GridRowEntry) => {
      if (!rowsHeightLookup.current[row.id]) {
        rowsHeightLookup.current[row.id] = {
          sizes: { baseCenter: rowHeight },
          isResized: false,
          autoHeight: false,
          needsFirstMeasurement: true, // Assume all rows will need to be measured by default
        };
      }

      const { isResized, needsFirstMeasurement, sizes } = rowsHeightLookup.current[row.id];
      let baseRowHeight = rowHeight;
      const existingBaseRowHeight = sizes.baseCenter;

      if (isResized) {
        // Do not recalculate resized row height and use the value from the lookup
        baseRowHeight = existingBaseRowHeight;
      } else if (getRowHeightProp) {
        const rowHeightFromUser = getRowHeightProp({ ...row, densityFactor });

        if (rowHeightFromUser === 'auto') {
          if (needsFirstMeasurement) {
            const estimatedRowHeight = getEstimatedRowHeight
              ? getEstimatedRowHeight({ ...row, densityFactor })
              : rowHeight;

            // If the row was not measured yet use the estimated row height
            baseRowHeight = estimatedRowHeight ?? rowHeight;
          } else {
            baseRowHeight = existingBaseRowHeight;
          }

          hasRowWithAutoHeight.current = true;
          rowsHeightLookup.current[row.id].autoHeight = true;
        } else {
          // Default back to base rowHeight if getRowHeight returns null or undefined.
          baseRowHeight = rowHeightFromUser ?? rowHeight;
          rowsHeightLookup.current[row.id].needsFirstMeasurement = false;
          rowsHeightLookup.current[row.id].autoHeight = false;
        }
      } else {
        rowsHeightLookup.current[row.id].needsFirstMeasurement = false;
      }

      const existingBaseSizes = Object.entries(sizes).reduce<Record<string, number>>(
        (acc, [key, size]) => {
          if (/^base[A-Z]/.test(key)) {
            acc[key] = size;
          }
          return acc;
        },
        {},
      );

      // We use an object to make simple to check if a height is already added or not
      const initialHeights: Record<string, number> = {
        ...existingBaseSizes,
        baseCenter: baseRowHeight,
      };

      if (getRowSpacing) {
        const indexRelativeToCurrentPage = apiRef.current.getRowIndexRelativeToVisibleRows(row.id);

        const spacing = getRowSpacing({
          ...row,
          isFirstVisible: indexRelativeToCurrentPage === 0,
          isLastVisible: indexRelativeToCurrentPage === currentPage.rows.length - 1,
          indexRelativeToCurrentPage,
        });

        initialHeights.spacingTop = spacing.top ?? 0;
        initialHeights.spacingBottom = spacing.bottom ?? 0;
      }

      const processedSizes = apiRef.current.unstable_applyPipeProcessors(
        'rowHeight',
        initialHeights,
        row,
      ) as Record<string, number>;

      rowsHeightLookup.current[row.id].sizes = processedSizes;

      return processedSizes;
    };

    const positions: number[] = [];
    const currentPageTotalHeight = currentPage.rows.reduce((acc, row) => {
      positions.push(acc);

      let maximumBaseSize = 0;
      let otherSizes = 0;

      const processedSizes = calculateRowProcessedSizes(row);
      Object.entries(processedSizes).forEach(([size, value]) => {
        if (/^base[A-Z]/.test(size)) {
          maximumBaseSize = value > maximumBaseSize ? value : maximumBaseSize;
        } else {
          otherSizes += value;
        }
      });

      return acc + maximumBaseSize + otherSizes;
    }, 0);

    pinnedRows?.top?.forEach((row) => {
      calculateRowProcessedSizes(row);
    });

    pinnedRows?.bottom?.forEach((row) => {
      calculateRowProcessedSizes(row);
    });

    apiRef.current.setState((state) => {
      return {
        ...state,
        rowsMeta: {
          currentPageTotalHeight,
          positions,
        },
      };
    });

    if (!hasRowWithAutoHeight.current) {
      // No row has height=auto, so all rows are already measured
      lastMeasuredRowIndex.current = Infinity;
    }

    apiRef.current.forceUpdate();
  }, [
    apiRef,
    currentPage.rows,
    rowHeight,
    getRowHeightProp,
    getRowSpacing,
    getEstimatedRowHeight,
    pinnedRows,
    densityFactor,
  ]);

  const getRowHeight = React.useCallback<GridRowsMetaApi['unstable_getRowHeight']>(
    (rowId) => {
      const height = rowsHeightLookup.current[rowId];
      return height ? height.sizes.baseCenter : rowHeight;
    },
    [rowHeight],
  );

  const getRowInternalSizes = (rowId: GridRowId): Record<string, number> | undefined =>
    rowsHeightLookup.current[rowId]?.sizes;

  const setRowHeight = React.useCallback<GridRowsMetaApi['unstable_setRowHeight']>(
    (id: GridRowId, height: number) => {
      rowsHeightLookup.current[id].sizes.baseCenter = height;
      rowsHeightLookup.current[id].isResized = true;
      rowsHeightLookup.current[id].needsFirstMeasurement = false;
      hydrateRowsMeta();
    },
    [hydrateRowsMeta],
  );

  const debouncedHydrateRowsMeta = React.useMemo(
    () => debounce(hydrateRowsMeta),
    [hydrateRowsMeta],
  );

  const storeMeasuredRowHeight = React.useCallback<
    GridRowsMetaApi['unstable_storeRowHeightMeasurement']
  >(
    (id, height, position) => {
      if (!rowsHeightLookup.current[id] || !rowsHeightLookup.current[id].autoHeight) {
        return;
      }

      // Only trigger hydration if the value is different, otherwise we trigger a loop
      const needsHydration =
        rowsHeightLookup.current[id].sizes[`base${capitalize(position)}`] !== height;

      rowsHeightLookup.current[id].needsFirstMeasurement = false;
      rowsHeightLookup.current[id].sizes[`base${capitalize(position)}`] = height;

      if (needsHydration) {
        debouncedHydrateRowsMeta();
      }
    },
    [debouncedHydrateRowsMeta],
  );

  const rowHasAutoHeight = React.useCallback<GridRowsMetaPrivateApi['rowHasAutoHeight']>((id) => {
    return rowsHeightLookup.current[id]?.autoHeight || false;
  }, []);

  const getLastMeasuredRowIndex = React.useCallback<
    GridRowsMetaPrivateApi['getLastMeasuredRowIndex']
  >(() => {
    return lastMeasuredRowIndex.current;
  }, []);

  const setLastMeasuredRowIndex = React.useCallback<
    GridRowsMetaApi['unstable_setLastMeasuredRowIndex']
  >((index) => {
    if (hasRowWithAutoHeight.current && index > lastMeasuredRowIndex.current) {
      lastMeasuredRowIndex.current = index;
    }
  }, []);

  const resetRowHeights = React.useCallback(() => {
    rowsHeightLookup.current = {};
    hydrateRowsMeta();
  }, [hydrateRowsMeta]);

  // The effect is used to build the rows meta data - currentPageTotalHeight and positions.
  // Because of variable row height this is needed for the virtualization
  React.useEffect(() => {
    hydrateRowsMeta();
  }, [rowHeight, filterModel, paginationState, sortModel, hydrateRowsMeta]);

  useGridRegisterPipeApplier(apiRef, 'rowHeight', hydrateRowsMeta);

  const rowsMetaApi: GridRowsMetaApi = {
    unstable_setLastMeasuredRowIndex: setLastMeasuredRowIndex,
    unstable_getRowHeight: getRowHeight,
    unstable_getRowInternalSizes: getRowInternalSizes,
    unstable_setRowHeight: setRowHeight,
    unstable_storeRowHeightMeasurement: storeMeasuredRowHeight,
    resetRowHeights,
  };

  const rowsMetaPrivateApi: GridRowsMetaPrivateApi = {
    getLastMeasuredRowIndex,
    rowHasAutoHeight,
  };

  useGridApiMethod(apiRef, rowsMetaApi, 'public');
  useGridApiMethod(apiRef, rowsMetaPrivateApi, 'private');
};
