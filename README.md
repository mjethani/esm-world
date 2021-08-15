This is an ES module loader for BDD-style testing.

```js
/* test.js */

import { createWorld } from 'esm-world';

let myModule = null;

beforeEach(async () => {
  // Load module in a new world.
  myModule = await createWorld('./index.js');
});

it('should foo', () => {
  myModule.foo();
});

it('should bar', () => {
  myModule.bar();
});
```

It needs the `--experimental-vm-modules` option to Node.js and is meant for testing with the Mocha framework only for now.

Under development.
