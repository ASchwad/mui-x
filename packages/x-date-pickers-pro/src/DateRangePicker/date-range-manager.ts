import { MuiPickersAdapter } from '@mui/x-date-pickers/internals';
import { DateRange, RangePosition } from '../internal/models';

interface CalculateRangeChangeOptions<TDate> {
  utils: MuiPickersAdapter<TDate>;
  range: DateRange<TDate>;
  newDate: TDate | null;
  rangePosition: RangePosition;
  /**
   * Should allow flipping range `start` and `end` dates if the `newDate` would result in a new range creation.
   *
   * It is used to allow dragging range `start` date past `end` date essentially becoming the new `end` date and vice versa.
   */
  allowRangeFlip?: boolean;
}

interface CalculateRangeChangeResponse<TDate> {
  nextSelection: RangePosition;
  newRange: DateRange<TDate>;
}

export function calculateRangeChange<TDate>({
  utils,
  range,
  newDate: selectedDate,
  rangePosition,
  allowRangeFlip = false,
}: CalculateRangeChangeOptions<TDate>): CalculateRangeChangeResponse<TDate> {
  const [start, end] = range;

  if (rangePosition === 'start') {
    const truthyResult: CalculateRangeChangeResponse<TDate> = allowRangeFlip
      ? { nextSelection: 'start', newRange: [end!, selectedDate] }
      : { nextSelection: 'end', newRange: [selectedDate, null] };
    return Boolean(end) && utils.isAfter(selectedDate!, end!)
      ? truthyResult
      : { nextSelection: 'end', newRange: [selectedDate, end] };
  }

  const truthyResult: CalculateRangeChangeResponse<TDate> = allowRangeFlip
    ? { nextSelection: 'end', newRange: [selectedDate, start!] }
    : { nextSelection: 'end', newRange: [selectedDate, null] };
  return Boolean(start) && utils.isBefore(selectedDate!, start!)
    ? truthyResult
    : { nextSelection: 'start', newRange: [start, selectedDate] };
}

export function calculateRangePreview<TDate>(
  options: CalculateRangeChangeOptions<TDate>,
): DateRange<TDate> {
  if (options.newDate == null) {
    return [null, null];
  }

  const [start, end] = options.range;
  const { newRange } = calculateRangeChange(options as CalculateRangeChangeOptions<TDate>);

  if (!start || !end) {
    return newRange;
  }

  const [previewStart, previewEnd] = newRange;
  return options.rangePosition === 'end' ? [end, previewEnd] : [previewStart, start];
}
