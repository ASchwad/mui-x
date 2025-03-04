import * as React from 'react';
import dayjs from 'dayjs';
import { DemoContainer, DemoItem } from 'docsx/src/modules/components/DemoContainer';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';

export default function DateCalendarFormProps() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer>
        <DemoItem label="disabled">
          <DateCalendar defaultValue={dayjs('2022-04-07')} disabled />
        </DemoItem>
        <DemoItem label="readOnly">
          <DateCalendar defaultValue={dayjs('2022-04-07')} readOnly />
        </DemoItem>
      </DemoContainer>
    </LocalizationProvider>
  );
}
