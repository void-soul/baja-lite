// import { rm, exec, cp } from 'shelljs';
import fs from 'fs';
import pkg from 'shelljs';
import cjs from './package-cjs.json' with { type: "json" };
import def from './package.json' with { type: "json" };
const { rm, exec, cp } = pkg;

rm('-rf', './dist/');
rm('-rf', './tsconfig.tsbuildinfo');
exec('yarn tsc');
rm('-rf', './tsconfig.tsbuildinfo');
cp('./package.json', './dist/package.json');
cp('./README.md', './dist/README.md');
cp('./LICENSE', './dist/LICENSE');
rm('-rf', './dist/tsconfig.tsbuildinfo');

rm('-rf', './dist-cjs/');
rm('-rf', './tsconfig.cjs.tsbuildinfo');
exec('yarn tsc -p tsconfig.cjs.json');
rm('-rf', './tsconfig.cjs.tsbuildinfo');
fs.writeFileSync('./dist-cjs/package.json', JSON.stringify(Object.assign(def, cjs), null, 2));
cp('./README.md', './dist-cjs/README.md');
cp('./LICENSE', './dist-cjs/LICENSE');


console.log('build over');
cp('-R', './dist/*', '../fast-start/node_modules/baja-lite');
console.log('fast-start over');
cp('-R', './dist/*', '../attack-service/node_modules/baja-lite');
console.log('attack-service over');
cp('-R', './dist/*', '../attack-front/node_modules/baja-lite');
console.log('attack-front over');
console.log('cp over');