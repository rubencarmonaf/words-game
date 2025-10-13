# Assets Folder

## Logo Usage

Para usar tu logo personalizado en WordWars:

1. **Guarda tu logo** como `logo.png` en esta carpeta (`client/assets/logo.png`)
2. **Formatos recomendados**: PNG con fondo transparente o SVG
3. **Tamaño recomendado**: Mínimo 120x60px, máximo 240x120px
4. **El logo se mostrará automáticamente** cuando esté disponible

## Fallback

Si no hay logo disponible, se mostrará una versión CSS que recrea tu diseño:
- Letra "W" estilizada
- Tres formas apiladas (representando las letras del logo)

## Estructura de Archivos

```
client/assets/
├── logo.png          # Tu logo personalizado (añadir aquí)
└── README.md         # Este archivo
```

Una vez que añadas tu logo, se mostrará automáticamente en:
- Landing page (header)
- Pantalla de autenticación
- Menú principal
