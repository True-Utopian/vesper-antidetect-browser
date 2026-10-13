import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,realpath,readlink,stat,chmod} from 'node:fs/promises';
import {relative,join,isAbsolute} from 'node:path';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';

/** A versioned per-user install; application data is never copied or replaced. */
export async function prepareLinuxPortableInstaller(directory,{product,version}){
 assert.ok(['browser','workbench'].includes(product));assert.match(version,/^\d+\.\d+\.\d+$/);
 const root=await realpath(directory),installer=join(root,'install.sh');
 const script=`#!/bin/sh
set -eu
umask 077
vesper_product='${product}'
vesper_version='${version}'
vesper_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
vesper_prefix="$HOME/.local/share/vesper-apps"
vesper_link=true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) [ "$#" -ge 2 ] || exit 2; vesper_prefix=$2; shift 2 ;;
    --no-launcher) vesper_link=false; shift ;;
    *) printf '%s\\n' 'Usage: install.sh [--prefix PATH] [--no-launcher]' >&2; exit 2 ;;
  esac
done
(cd -- "$vesper_source" && sha256sum --check --status -- install-manifest.sha256) || { printf '%s\\n' 'Package integrity check failed; nothing installed.' >&2; exit 3; }
mkdir -p -- "$vesper_prefix/$vesper_product"
vesper_parent=$(CDPATH= cd -- "$vesper_prefix/$vesper_product" && pwd -P)
vesper_target="$vesper_parent/$vesper_version"
[ ! -e "$vesper_target" ] && [ ! -L "$vesper_target" ] || { printf '%s\\n' 'This version is already present; existing files were preserved.' >&2; exit 4; }
vesper_stage=$(mktemp -d "$vesper_parent/.install-XXXXXX")
vesper_cleanup() { case "$vesper_stage" in "$vesper_parent"/.install-*) [ ! -L "$vesper_stage" ] && rm -rf -- "$vesper_stage" ;; esac; }
trap vesper_cleanup EXIT HUP INT TERM
cp -a -- "$vesper_source/." "$vesper_stage/"
(cd -- "$vesper_stage" && sha256sum --check --status -- install-manifest.sha256) || { printf '%s\\n' 'Copied package integrity check failed.' >&2; exit 5; }
mv -T --no-clobber -- "$vesper_stage" "$vesper_target"
[ ! -d "$vesper_stage" ] || { printf '%s\\n' 'Another installer already created this version; existing files were preserved.' >&2; exit 4; }
trap - EXIT HUP INT TERM
if [ "$vesper_link" = true ]; then
  mkdir -p -- "$HOME/.local/bin"
  vesper_launcher="$HOME/.local/bin/vesper-$vesper_product"
  if [ ! -e "$vesper_launcher" ] && [ ! -L "$vesper_launcher" ]; then
    ln -s -- "$vesper_target/vesper-$vesper_product" "$vesper_launcher"
  else
    printf '%s\\n' 'Existing launcher preserved. Run the installed executable directly.' >&2
  fi
fi
printf 'Installed Vesper %s %s by true-utopian: %s\\n' "$vesper_product" "$vesper_version" "$vesper_target/vesper-$vesper_product"
`;
 await writeFile(installer,script);await chmod(installer,0o755);
 const entries=[];
 async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name),name=relative(root,path).replaceAll('\\','/');assert.ok(!/[\r\n\\]/.test(name),'Unsupported checksum filename');if(name==='install-manifest.sha256')continue;if(entry.isDirectory()){await visit(path);continue;}if(entry.isSymbolicLink()){assert.ok(!isAbsolute(await readlink(path)),'Portable packages must contain only relative links');const physical=await realpath(path),child=relative(root,physical);assert.ok(child&&!child.startsWith('..')&&!isAbsolute(child),'Portable package link escapes its directory');assert.ok((await stat(physical)).isFile(),'Portable directory links are unsupported');}else assert.ok(entry.isFile());const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);entries.push(`${hash.digest('hex')}  ./${name}`);}}
 await visit(root);await writeFile(join(root,'install-manifest.sha256'),entries.sort().join('\n')+'\n');return {files:entries.length,installer};
}
