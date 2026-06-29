import pkg from 'shelljs';
const { rm, exec, cp } = pkg;

rm('-rf', './dist/');
rm('-rf', './tsconfig.tsbuildinfo');
const { code } = exec('yarn tsc --module esnext');
if (code !== 0) {
    console.error('tsc failed');
    process.exit(code);
}
rm('-rf', './tsconfig.tsbuildinfo');
cp('./package.json', './dist/package.json');
cp('./README.md', './dist/README.md');
cp('./LICENSE', './dist/LICENSE');
rm('-rf', './dist/tsconfig.tsbuildinfo');

console.log('build over');
