<div align="center">
  <img src="logo.png" alt="Logotipo de NoHouseNumberOSM" width="180">
  <h1>NoHouseNumberOSM</h1>
  <p>Mapa de posibles candidatos a <code>nohousenumber=yes</code> en OpenStreetMap.</p>
  <p>
    <a href="https://atarom.github.io/NoHouseNumberOSM/">
      <strong>Abre el mapa ↗</strong>
    </a>
  </p>
</div>
---
Consulta elementos de OpenStreetMap cuyo valor de `addr:housenumber` parece indicar que no tienen número, agrupa los valores detectados y permite inspeccionarlos directamente en el mapa.
Al seleccionar un valor del resumen se resaltan sus elementos y se habilita una consulta equivalente en Overpass Turbo para ese `addr:housenumber` exacto.
## Tecnologías y datos
- [MapLibre GL JS](https://maplibre.org/) — renderización del mapa.
- [OpenFreeMap](https://openfreemap.org/) — estilo Dark y teselas del mapa.
- [Postpass](https://github.com/woodpeck/postpass) — consulta SQL sobre datos de OpenStreetMap.
- [Overpass Turbo](https://overpass-turbo.eu/) — inspección de los valores seleccionados.
- © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) — datos disponibles bajo licencia ODbL.
