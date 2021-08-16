import { readFile } from 'fs/promises';
import { builtinModules } from 'module';
import { dirname, resolve as resolvePath } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { SourceTextModule, SyntheticModule, createContext } from 'vm';

let cacheMap = new WeakMap();

async function builtinLinker(specifier, { context }) {
  let cache = cacheMap.get(context);
  let module = cache.get(specifier);

  if (typeof module !== 'undefined')
    return module;

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
  let path = resolvePath(dirname(fileURLToPath(identifier)), specifier);
  let url = pathToFileURL(path).toString();

  let cache = cacheMap.get(context);
  let module = cache.get(url);

  if (typeof module !== 'undefined')
    return module;

  let source = await readFile(path, 'utf8');

  let initializeImportMeta = (meta, { identifier }) => {
    meta.url = identifier;
  };

  module = new SourceTextModule(source,
                                { identifier: url,
                                  context,
                                  initializeImportMeta });
  cache.set(url, module);

  return module;
}

async function linker(specifier, { identifier, context }) {
  if (builtinModules.includes(specifier))
    return builtinLinker(specifier, { identifier, context });

  return fileLinker(specifier, { identifier, context });
}

export async function createWorld(path, { globals = {} } = {}) {
  if (!('global' in globals))
    globals.global = globals;

  let url = pathToFileURL(path).toString();

  let context = createContext(globals);

  cacheMap.set(context, new Map());

  let module = await fileLinker(path, { identifier: url, context });

  await module.link(linker);
  await module.evaluate();

  return module.namespace;
}
