import type { ReactElement } from 'react';
import { Button } from '../Button';
import { Field } from '../Field';

export function ClosedKitTypeTest(): ReactElement {
  return (
    <>
      {/* @ts-expect-error kit is closed for className */}
      <Button className="mt-4">x</Button>
      {/* @ts-expect-error kit is closed for className functions from Base UI */}
      <Button className={() => 'mt-4'}>x</Button>
      {/* @ts-expect-error kit is closed for style */}
      <Button style={{ marginTop: 4 }}>x</Button>
      {/* @ts-expect-error unknown tone */}
      <Button tone="purple">x</Button>
      {/* @ts-expect-error label is required */}
      <Field />
      <Button tone="danger" size="lg" fullWidth loading>
        ok
      </Button>
    </>
  );
}
