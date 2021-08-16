import { readFile } from 'fs/promises';
import { builtinModules } from 'module';
import { dirname, resolve as resolvePath } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { SourceTextModule, SyntheticModule, createContext } from 'vm';

let cacheMap = new WeakMap();

async function builtinLinker(moduleId, { context }) {
  let cache = cacheMap.get(context);
  let module = cache.get(moduleId);

  if (typeof module !== 'undefined')
    return module;

  let object = await import(moduleId);
  let keys = Object.keys(object);

  let evaluateCallback = function () {
    for (let key of keys)
      this.setExport(key, object[key]);
  };

  module = new SyntheticModule(keys, evaluateCallback,
                               { identifier: moduleId, context });
  cache.set(moduleId, module);

  return module;
}

async function fileLinker(moduleId, { identifier, context }) {
  let path = resolvePath(dirname(fileURLToPath(identifier)), moduleId);
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

async function linker(moduleId, { identifier, context }) {
  if (builtinModules.includes(moduleId))
    return builtinLinker(moduleId, { identifier, context });

  return fileLinker(moduleId, { identifier, context });
}

export async function createWorld(moduleId, { globals = {} } = {}) {
  globals.global = globals;

  let path = resolvePath(moduleId);
  let url = pathToFileURL(path).toString();

  let context = createContext(globals);

  cacheMap.set(context, new Map());

  let module = await fileLinker(moduleId, { identifier: url, context });

  await module.link(linker);
  await module.evaluate();

  return module.namespace;
}
