// Declaraciones de tipos para importar CSS en TypeScript (Expo Router web + native).
// Resuelve: TS2307 (module.css) y TS2882 (side-effect import de global.css).

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css';
