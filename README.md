This is an ES module loader for BDD-style testing.

```js
/* index.js */

let instance = null;

export class MySingleton {
  constructor() {
    if (instance !== null)
      throw new Error('Only a single instance is supported');

    instance = this;
  }

  sayFoo() {
    console.log('Foo!');
  }

  sayBar() {
    console.log('Bar!');
  }
}
```

```js
/* test.js */

import { strict as assert } from 'assert';

import { createWorld } from 'esm-world';

let mockConsole = new (class MockConsole {
  log(message) {
    this.message = message;
  }
})();

describe('MySingleton', () => {
  let instance = null;

  beforeEach(async () => {
    // Load module in a new world.
    let { MySingleton } = await createWorld('./index.js', { globals: { console: mockConsole } });

    instance = new MySingleton();
  });

  describe('#sayFoo()', () => {
    it('should say foo', () => {
      instance.sayFoo();

      assert.equal(mockConsole.message, 'Foo!');
    });
  });

  describe('#sayBar()', () => {
    it('should say bar', () => {
      instance.sayBar();

      assert.equal(mockConsole.message, 'Bar!');
    });
  });
});
```

It needs the `--experimental-vm-modules` option to Node.js and is meant for testing with the [Mocha](https://mochajs.org/) framework only for now.

Under development.
