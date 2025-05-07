import pkg from 'shelljs';
const { rm, exec, cp } = pkg;

rm('-rf', './dist/');
rm('-rf', './tsconfig.tsbuildinfo');
exec('yarn tsc');
rm('-rf', './tsconfig.tsbuildinfo');
cp('./package.json', './dist/package.json');
cp('./LICENSE', './dist/LICENSE');
rm('-rf', './dist/tsconfig.tsbuildinfo');
cp('-R', './dist/*', 'E:\\pro\\v\\apps-services\\fast-start\\node_modules\\baja-lite-field');
cp('-R', './dist/*', 'E:\\pro\\v\\apps-services\\attack-service\\node_modules\\baja-lite-field');
cp('-R', './dist/*', 'E:\\pro\\v\\apps-services\\attack-front\\node_modules\\baja-lite-field');
cp('-R', './dist/*', 'E:\\pro\\v\\apps-services\\entity\\node_modules\\baja-lite-field');
cp('-R', './dist/*', 'E:\\pro\\v\\apps-services\\wechat\\node_modules\\baja-lite-field');
console.log('cp over');