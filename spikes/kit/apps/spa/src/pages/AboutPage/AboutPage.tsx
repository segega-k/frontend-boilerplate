import { Button } from '@kit/ui/Button';
import type { ReactElement } from 'react';
import { homePage } from '../HomePage/HomePage.styled';

const styles = homePage();

export function AboutPage(): ReactElement {
  return (
    <section className={styles.root()}>
      <h1 className={styles.title()}>About</h1>
      <p className={styles.lead()}>Second route to exercise the view transition between screens.</p>
      <div className={styles.actions()}>
        <Button tone="neutral" size="lg" fullWidth>
          Full width
        </Button>
      </div>
    </section>
  );
}
