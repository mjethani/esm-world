import { readFile } from 'fs/promises';
import { builtinModules } from 'module';
import { dirname, resolve as resolvePath } from 'path';
import { pathToFileURL } from 'url';
import { SourceTextModule, SyntheticModule, createContext } from 'vm';

async function builtinLinker(moduleId, { context }) {
  let object = await import(moduleId);
  let keys = Object.keys(object);

  let evaluateCallback = function () {
    for (let key of keys)
      this.setExport(key, object[key]);
  };

  return new SyntheticModule(keys, evaluateCallback,
                             { identifier: moduleId, context });
}

async function fileLinker(moduleId, { identifier, context }) {
  let path = resolvePath(dirname(identifier), moduleId);
  let source = await readFile(path, 'utf8');

  let initializeImportMeta = (meta, { identifier }) => {
    meta.url = pathToFileURL(identifier);
  };

  let module = new SourceTextModule(source,
                                    { identifier: path,
                                      context,
                                      initializeImportMeta });
  await module.link(linker);
  await module.evaluate();

  return module;
}

async function linker(moduleId, { identifier, context }) {
  if (builtinModules.includes(moduleId))
    return builtinLinker(moduleId, { identifier, context });

  return fileLinker(moduleId, { identifier, context });
}

export async function createWorld(moduleId, { globals = {} } = {}) {
  globals.global = globals;

  let identifier = '';
  let context = createContext(globals);

  let module = await linker(moduleId, { identifier, context });
  return module.namespace;
}
