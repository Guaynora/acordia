# Formato de las canciones

Qué se puede escribir en el campo de la canción al subirla. Todo se guarda como [ChordPro](https://www.chordpro.org/), y el motor (`packages/chord-engine`) lo interpreta al validar, al mostrar y al tocar.

Hay dos formas de escribir, y la app detecta cuál usas:

1. **Acordes sobre la letra**, como en la mayoría de webs. El importador (`importer.ts`) coloca cada acorde en la sílaba que tiene debajo:
   ```
   G        D
   Caminando por la calle
   ```
2. **ChordPro**, con los acordes entre corchetes: `[G]Caminando [D]por la calle`.

Solo los acordes entre corchetes marcan ChordPro. Todo lo de abajo funciona en las dos formas: las directivas `{...}` y las barras se conservan al importar.

## Secciones

Una línea con el nombre: `Coro:`, `[Puente]`, `Estrofa 2:` (en español o en inglés). En ChordPro: `{start_of_chorus: Coro}` … `{end_of_chorus}`.

## Compases

`|` separa compases. Así se dice cuánto dura cada acorde:

```
| G     D   | Em      |  |
  Caminando por la calle
```

- Los acordes de un compás se lo reparten a partes iguales: G y D, medio compás cada uno.
- Un compás vacío (`|  |`) sostiene el acorde anterior.
- Lo que va antes de la primera `|` sin acordes es una anacrusa y no consume tiempo.
- Una línea **sin barras** da un compás a cada acorde, y una línea de letra sin acordes, dos compases.

Las dos clases de línea se pueden mezclar. Las reglas viven en `lineBars` (`apps/web/src/domain/scroll-timeline.ts`).

## Cambios por sección

En líneas propias, al inicio de la parte que cambia. Lo que no se cambia se mantiene.

| Directiva | Qué hace |
| --- | --- |
| `{tempo: 140}` | Tempo nuevo, de 30 a 300 BPM |
| `{time: 7/8}` | Compás nuevo (sobre 2, 4 u 8) |
| `{x_groups: 2+2+3}` | Dónde caen los acentos; tiene que sumar el compás |
| `{x_ramp: 140-120 4}` | Accelerando o ritardando: de 140 a 120 BPM en 4 compases |
| `{key: Ab}` | La sección cambia de tono |

- En compases compuestos (6/8, 9/8, 12/8) el BPM cuenta la negra con puntillo; en 5/8 y 7/8, la corchea.
- Al transportar, una sección que modula se mueve el mismo intervalo que la canción, pero con la escritura de su propio tono: el coro en Ab de una canción en G, llevada a F, queda en Gb.
- Las directivas que van antes de la primera línea de letra repiten los valores de la canción, que mandan los campos del formulario.

## Repeticiones y saltos

Van por líneas completas:

| Escritura | Qué hace |
| --- | --- |
| `\|:` … `:\|` | Repite esas líneas; `:\|x3` para tres veces. Sin `\|:`, desde el inicio de la sección |
| `Coro x2:` | Repite la sección entera |
| `{x_ending: 1}` / `{x_ending: 2}` | Casillas: la 1.ª acaba en `:\|` y la 2.ª va después (también `1,2` o `1-3`) |
| `{x_segno}`, `{x_coda}`, `{x_fine}` | Marcas |
| `{x_to_coda}` | Saltar a la coda en la pasada tras el D.S./D.C. |
| `{x_ds_al_coda}`, `{x_dc_al_coda}`, `{x_ds_al_fine}`, `{x_dc_al_fine}` | Saltos al Segno (D.S.) o al inicio (D.C.) |

- Después de un D.S. o D.C., las repeticiones se tocan una vez y se toma la última casilla.
- El orden de ejecución lo calcula `performanceOrder` (`packages/chord-engine/src/performance.ts`), y lo siguen el auto-scroll y el metrónomo.

## Validación

Al publicar, se bloquea la canción si algo no se puede seguir, igual que con un acorde desconocido:

- un tempo fuera de rango;
- un compás o una agrupación que no encaja;
- una rampa mal escrita;
- un `:|x1`;
- una casilla fuera de una repetición;
- un D.S. sin `{x_segno}`;
- un salto a la coda sin `{x_coda}`.

Lo comprueban `validateTempoDirectives` y `validateStructure`.

## Ejemplo completo

```
Intro x2:
| C     | F   C | G7    | C     |

Estrofa:
{x_segno}
|:          C
Oh when the saints go marching in
{x_ending: 1}
          C             C7   F
Oh Lord I want to be in that number
         C         G7       C  :|
When the saints go marching in
{x_ending: 2}
         C         G7       C
When the saints go marching in
{x_to_coda}

Puente:
{time: 2/4}
| F   | C   | G7  | C   |
{x_ds_al_coda}

{x_coda}
Final:
{time: 4/4}
{x_ramp: 120-90 2}
| C   G7 | C     |
```
