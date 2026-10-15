import { Fragment, type ReactElement } from 'react';
import { matrix } from './Matrix.styled';
import type { MatrixProps } from './types';

type ColumnCount = 1 | 2 | 3 | 4;

const toColumnCount = (n: number): ColumnCount => (n <= 1 ? 1 : n >= 4 ? 4 : (n as ColumnCount));

export function Matrix({ title, columns, rows, rtlSpecimen, rtlCaption }: MatrixProps): ReactElement {
  const styles = matrix({ columns: toColumnCount(columns.length) });

  return (
    <section className={styles.root()} aria-label={title}>
      <h2 className={styles.title()}>{title}</h2>
      <div className={styles.grid()}>
        <div className={styles.head()} />
        {columns.map((column) => (
          <div key={column} className={styles.head()}>
            {column}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row.caption}>
            <div className={styles.caption()}>
              {row.caption}
            </div>
            {row.cells.map((cell, index) => (
              <div key={`${row.caption}-${columns[index] ?? index}`} className={styles.cell()}>
                {cell}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      {rtlSpecimen === undefined ? null : (
        <div dir="rtl" className={styles.specimen()}>
          <span className={styles.caption()}>{rtlCaption}</span>
          {rtlSpecimen}
        </div>
      )}
    </section>
  );
}
