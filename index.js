import { readFile } from 'fs/promises';
import { dirname, resolve as resolvePath } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { SourceTextModule, SyntheticModule, createContext } from 'vm';

let cacheMap = new WeakMap();

async function packageLinker(specifier, { context }) {
  // Return a module object from cache if available.
  let cache = cacheMap.get(context);
  let module = cache.get(specifier);

  if (typeof module !== 'undefined')
    return module;

  // Dynamically import the module, turn it into a synthetic module object, and
  // save the object to cache.
  let object = await import(specifier);
  let keys = Object.keys(object);

  let evaluateCallback = function () {
    for (let key of keys)
      this.setExport(key, object[key]);
  };

  module = new SyntheticModule(keys, evaluateCallback,
                               { identifier: specifier, context });
  cache.set(specifier, module);

  return module;
}

async function fileLinker(specifier, { identifier, context }) {
  // The specifier is a path relative to the identifier of the referencing
  // module, which is a file URL. e.g. './src/utils.js' relative to
  // 'file:///Users/joe/Code/new-widget/index.js' gives us
  // 'file:///Users/joe/Code/new-widget/src/utils.js'.
  let path = resolvePath(dirname(fileURLToPath(identifier)), specifier);
  let url = pathToFileURL(path).toString();

  // If we already have the module object in the cache, return it. This is not
  // merely an optimization: modules are expected to work this way. Within a
  // "world," there is only one instance of a module.
  let cache = cacheMap.get(context);
  let module = cache.get(url);

  if (typeof module !== 'undefined')
    return module;

  // Load the code.
  let source = await readFile(path, 'utf8');

  // Set up the import.meta object.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import.meta
  let initializeImportMeta = (meta, { identifier }) => {
    meta.url = identifier;
  };

  // Use the resolved URL above as the module identifier and save the module
  // object to cache.
  module = new SourceTextModule(source,
                                { identifier: url,
                                  context,
                                  initializeImportMeta });
  cache.set(url, module);

  return module;
}

async function linker(specifier, { identifier, context }) {
  // If the specifier is a relative path, pass it to the file linker;
  // otherwise, pass it to the package linker.
  if (!specifier.startsWith('./') && !specifier.startsWith('../'))
    return packageLinker(specifier, { context });

  return fileLinker(specifier, { identifier, context });
}

export async function createWorld(path, { globals = {} } = {}) {
  // The entry point must be a relative path.
  if (!path.startsWith('./') && !path.startsWith('../'))
    throw new Error('Only relative paths are supported');

  // Typically there won't be a global property, which many programs need.
  if (!('global' in globals))
    globals.global = globals;

  // This gives us the file URL. e.g. './index.js' becomes
  // 'file:///Users/joe/Code/new-widget/index.js'
  let url = pathToFileURL(path).toString();

  // Create a new VM context.
  let context = createContext(globals);

  // Each context has a map of module identifiers to module objects.
  cacheMap.set(context, new Map());

  // Since we know we are loading a file, call the file linker with the URL as
  // the identifier of the referencing module.
  let module = await fileLinker(path, { identifier: url, context });

  // Link and evaluate recursively.
  //
  // Note: This API is experimental.
  // https://nodejs.org/api/vm.html#vm_class_vm_module
  await module.link(linker);
  await module.evaluate();

  // Return the module namespace, which should contain all of the module's
  // exports.
  return module.namespace;
}
