import * as React from 'react';
import { DataGridPremium, GridRenderCellParams } from '@mui/x-data-grid-premium';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const getPlanProps = (plan: string) => {
  switch (plan.toLowerCase()) {
    case 'premium':
      return {
        href: '/x/introduction/licensing/#premium-plan',
        className: 'plan-premium',
        title: 'Premium plan',
      };
    case 'pro':
      return {
        href: '/x/introduction/licensing/#pro-plan',
        className: 'plan-pro',
        title: 'Pro plan',
      };
    default:
      return null;
  }
};

function PlanIcon(props: { plan?: string }) {
  if (!props.plan) {
    return null;
  }
  const planProps = getPlanProps(props.plan);
  if (!planProps) {
    return null;
  }
  return (
    <a href={planProps.href} target="_blank" rel="noreferrer">
      <span className={planProps.className} title={planProps.title} />
    </a>
  );
}

function ComponentTag(props: { value?: string; plan?: string }) {
  if (!props.value) {
    return null;
  }
  const components = props.value.split(',');
  return (
    <Stack gap={0.5}>
      {components.map((c, key) => (
        <div>
          <Typography
            key={key}
            sx={{
              borderRadius: '5px',
              background: 'rgba(102, 178, 255, 0.15)',
              fontSize: '0.8rem',
              fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
              padding: '0 5px',
              display: 'inline-block',
            }}
          >
            {c}
          </Typography>
          <PlanIcon plan={props.plan} />
        </div>
      ))}
    </Stack>
  );
}

const columns = [
  {
    field: 'slot',
    headerName: 'Component',
    width: 240,
    renderCell: (params: GridRenderCellParams<string>) => (
      <ComponentTag value={params.value} plan={params.row.plan} />
    ),
  },
  {
    field: 'defaultComponent',
    headerName: 'Default Component',
    width: 300,
    renderCell: (params: GridRenderCellParams<string>) => (
      <ComponentTag value={params.value} />
    ),
  },
  { field: 'displayOrder', headerName: 'Display Order', width: 140, type: 'number' },
];

const rows = [
  {
    id: 1,
    slot: 'ColumnMenuSortItem',
    defaultComponent: 'GridColumnMenuSortItem',
    displayOrder: 10,
    plan: 'Community',
  },
  {
    id: 3,
    slot: 'ColumnMenuFilterItem',
    defaultComponent: 'GridColumnMenuFilterItem',
    displayOrder: 20,
    plan: 'Community',
  },
  {
    id: 7,
    slot: 'ColumnMenuColumnsItem',
    defaultComponent: 'GridColumnMenuColumnsItem',
    displayOrder: 30,
    plan: 'Community',
  },
  {
    id: 9,
    slot: 'ColumnMenuPinningItem',
    defaultComponent: 'GridColumnMenuPinningItem',
    displayOrder: 15,
    plan: 'Pro',
  },
  {
    id: 11,
    slot: 'ColumnMenuAggregationItem',
    defaultComponent: 'GridColumnMenuAggregationItem',
    displayOrder: 23,
    plan: 'Premium',
  },
  {
    id: 13,
    slot: 'ColumnMenuGroupingItem',
    defaultComponent: 'GridColumnMenuGroupingItem',
    displayOrder: 27,
    plan: 'Premium',
  },
];

export default function ColumnMenuGridReferences() {
  return (
    <div style={{ width: '100%' }}>
      <DataGridPremium
        columns={columns}
        rows={rows}
        disableColumnMenu
        autoHeight
        hideFooter
      />
    </div>
  );
}
