// Este archivo lo usan `ng serve` y `ng build --configuration development`.
// Para producción (`ng build` / `ng build --configuration production`) se
// reemplaza automáticamente por environment.prod.ts (ver "fileReplacements"
// en angular.json), así que no hace falta tocar este apiUrl antes de deployar.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  // Google Maps JavaScript API key, usada por el picker de ubicacion en
  // "Nuevo lote" (admin_polo). Restringila por HTTP referrer en Google
  // Cloud Console a los dominios donde corre el front.
  googleMapsApiKey: 'AIzaSyAeA3SIUTc5frhPj64YBDaKASP8zjzoN7Q',
};
