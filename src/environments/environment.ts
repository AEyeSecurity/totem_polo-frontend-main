// Este archivo lo usan `ng serve` y `ng build --configuration development`.
// Para producción (`ng build` / `ng build --configuration production`) se
// reemplaza automáticamente por environment.prod.ts (ver "fileReplacements"
// en angular.json), así que no hace falta tocar este apiUrl antes de deployar.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
};
