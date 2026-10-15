import type { ReactNode } from 'react';

export type MatrixRow = {
  caption: string;
  cells: ReactNode[];
};

export type MatrixProps = {
  title: string;
  columns: readonly string[];
  rows: MatrixRow[];
  rtlSpecimen?: ReactNode;
  rtlCaption?: string;
};
