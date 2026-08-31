// ============================================================
// SOVI - LOCALIZADOR VISUAL DE PRODUCTOS
//
// Objetivo:
// - recibir una imagen
// - recibir marca/producto a localizar
// - devolver coordenadas de cada facing visible
//
// NO reemplaza analyze.js
// NO recalcula la auditoría completa
// ============================================================


const GEMINI_MODEL =
  "gemini-3.5-flash-lite";


function responderError(
  res,
  status,
  mensaje,
  extra = {}
) {

  return res
    .status(status)
    .json({
      ok: false,
      error: mensaje,
      ...extra
    });

}


function textoSeguro(
  valor,
  fallback = ""
) {

  if (
    typeof valor === "string"
  ) {

    return valor.trim();

  }


  if (
    valor === null ||
    valor === undefined
  ) {

    return fallback;

  }


  return String(valor).trim();

}


function numeroSeguro(
  valor,
  fallback = 0
) {

  const numero =
    Number(valor);


  if (
    !Number.isFinite(numero)
  ) {

    return fallback;

  }


  return numero;

}


function limitarCoordenada(
  valor
) {

  return Math.max(
    0,
    Math.min(
      1000,
      Math.round(
        numeroSeguro(
          valor,
          0
        )
      )
    )
  );

}


function limpiarJson(
  texto
) {

  let limpio =
    textoSeguro(texto);


  limpio =
    limpio
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();


  const inicio =
    limpio.indexOf("{");


  const fin =
    limpio.lastIndexOf("}");


  if (
    inicio !== -1 &&
    fin !== -1 &&
    fin > inicio
  ) {

    limpio =
      limpio.slice(
        inicio,
        fin + 1
      );

  }


  return limpio;

}


function normalizarImagen(
  imagen
) {

  if (!imagen) {

    return null;

  }


  if (
    typeof imagen === "string"
  ) {

    const coincidencia =
      imagen.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );


    if (coincidencia) {

      return {

        mimeType:
          coincidencia[1],

        data:
          coincidencia[2]

      };

    }


    return {

      mimeType:
        "image/jpeg",

      data:
        imagen

    };

  }


  const mimeType =

    imagen.mimeType ||
    imagen.mime_type ||
    imagen.type ||
    "image/jpeg";


  let data =

    imagen.data ||
    imagen.base64 ||
    imagen.image ||
    "";


  if (
    typeof data === "string" &&
    data.startsWith("data:")
  ) {

    const coincidencia =
      data.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );


    if (coincidencia) {

      return {

        mimeType:
          coincidencia[1],

        data:
          coincidencia[2]

      };

    }

  }


  return {

    mimeType,

    data

  };

}


function crearPrompt(
  objetivo
) {

  return `

Sos SOVI, un sistema profesional de auditoría visual
para puntos de venta.

Tu tarea NO es realizar una auditoría completa.

Tu única tarea es localizar visualmente
un producto o marca específica dentro de una imagen.


============================================================
OBJETIVO A LOCALIZAR
============================================================

${objetivo}


============================================================
QUÉ TENÉS QUE HACER
============================================================

1. Observá toda la imagen.

2. Detectá solamente facings visibles
que correspondan al objetivo solicitado.

3. No marques productos que no correspondan.

4. Cada frente visible debe tener su propia ubicación.

5. Si un producto está parcialmente tapado
pero sigue siendo reconocible, podés marcarlo.

6. Si tenés dudas fuertes,
no inventes una ubicación.


============================================================
COORDENADAS
============================================================

La imagen completa se representa
con coordenadas entre 0 y 1000.

Esquina superior izquierda:

x = 0
y = 0

Esquina inferior derecha:

x = 1000
y = 1000


Para cada facing devolvé:

{
  "x": 100,
  "y": 200,
  "ancho": 80,
  "alto": 180,
  "confianza": "alta"
}


x:
posición horizontal izquierda.

y:
posición vertical superior.

ancho:
ancho del facing.

alto:
alto del facing.


============================================================
REGLAS VISUALES
============================================================

- cada caja debe rodear principalmente un solo facing;

- no marques toda la góndola como una sola caja;

- no marques carteles, logos o POP
  si no corresponden al producto físico;

- no marques productos de otra marca;

- no devuelvas coordenadas fuera de 0-1000.


============================================================
CONFIANZA
============================================================

Usá:

"alta"
"media"
"baja"


============================================================
FORMATO DE RESPUESTA
============================================================

Respondé EXCLUSIVAMENTE JSON válido.

No uses Markdown.

No agregues texto antes ni después.


Usá esta estructura exacta:


{
  "objetivo": "${objetivo}",

  "cantidad_detectada": 0,

  "ubicaciones": [

    {
      "x": 0,
      "y": 0,
      "ancho": 0,
      "alto": 0,
      "confianza": "alta"
    }

  ],

  "observaciones": []
}


Antes de responder:

- contá nuevamente;
- verificá que cantidad_detectada
  coincida con la cantidad de ubicaciones;
- verificá que todas las cajas correspondan
  al objetivo solicitado;
- asegurate de devolver JSON válido.

`;

}


function normalizarResultado(
  datos,
  objetivo
) {

  const ubicacionesEntrada =

    Array.isArray(
      datos?.ubicaciones
    )

      ? datos.ubicaciones

      : [];


  const ubicaciones =

    ubicacionesEntrada

      .map(
        (item) => {

          const x =
            limitarCoordenada(
              item?.x
            );


          const y =
            limitarCoordenada(
              item?.y
            );


          const ancho =
            limitarCoordenada(
              item?.ancho
            );


          const alto =
            limitarCoordenada(
              item?.alto
            );


          if (
            ancho <= 0 ||
            alto <= 0
          ) {

            return null;

          }


          let confianza =
            textoSeguro(
              item?.confianza,
              "media"
            ).toLowerCase();


          if (
            ![
              "alta",
              "media",
              "baja"
            ].includes(
              confianza
            )
          ) {

            confianza =
              "media";

          }


          return {

            x,

            y,

            ancho,

            alto,

            confianza

          };

        }
      )

      .filter(Boolean);


  return {

    ok: true,

    objetivo,

    cantidad_detectada:
      ubicaciones.length,

    ubicaciones,

    observaciones:

      Array.isArray(
        datos?.observaciones
      )

        ? datos.observaciones
            .map(
              (item) =>
                textoSeguro(item)
            )
            .filter(Boolean)

        : [],

    proveedor:
      "Gemini",

    modelo:
      GEMINI_MODEL

  };

}


async function localizarConGemini(
  imagen,
  objetivo
) {

  const apiKey =
    process.env
      .GEMINI_API_KEY;


  if (
    !apiKey
  ) {

    throw new Error(
      "GEMINI_API_KEY no está configurada."
    );

  }


  const respuesta =
    await fetch(

      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,

      {

        method:
          "POST",


        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey

        },


        body:
          JSON.stringify({

            contents: [

              {

                role:
                  "user",

                parts: [

                  {

                    text:
                      crearPrompt(
                        objetivo
                      )

                  },

                  {

                    inlineData: {

                      mimeType:
                        imagen.mimeType,

                      data:
                        imagen.data

                    }

                  }

                ]

              }

            ],


            generationConfig: {

              temperature:
                0,

              maxOutputTokens:
                8192,

              responseMimeType:
                "application/json"

            }

          })

      }

    );


  const datos =
    await respuesta.json();


  if (
    !respuesta.ok
  ) {

    const mensaje =

      datos?.error?.message ||

      `Gemini respondió HTTP ${respuesta.status}`;


    throw new Error(
      mensaje
    );

  }


  const texto =

    datos?.candidates?.[0]
      ?.content?.parts

      ?.map(
        (parte) =>
          parte?.text || ""
      )

      .join("")

      .trim();


  if (
    !texto
  ) {

    throw new Error(
      "Gemini no devolvió contenido."
    );

  }


  let json;


  try {

    json =
      JSON.parse(
        limpiarJson(
          texto
        )
      );

  } catch (error) {

    console.error(

      "[SOVI] localize JSON inválido:",

      texto.slice(
        0,
        1000
      )

    );


    throw new Error(
      "No se pudo interpretar la respuesta de localización."
    );

  }


  return normalizarResultado(
    json,
    objetivo
  );

}


// ============================================================
// HANDLER
// ============================================================


export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "POST"
  ) {

    res.setHeader(
      "Allow",
      "POST"
    );


    return responderError(

      res,

      405,

      "Método no permitido."

    );

  }


  const objetivo =

    textoSeguro(
      req.body?.objetivo
    );


  if (
    !objetivo
  ) {

    return responderError(

      res,

      400,

      "Falta indicar qué producto o marca se desea localizar."

    );

  }


  const imagen =
    normalizarImagen(
      req.body?.image ||
      req.body?.imagen
    );


  if (
    !imagen ||
    !imagen.data
  ) {

    return responderError(

      res,

      400,

      "No se recibió una imagen válida."

    );

  }


  try {

    console.log(
      `[SOVI] Localizando: ${objetivo}`
    );


    const resultado =
      await localizarConGemini(

        imagen,

        objetivo

      );


    console.log(
      `[SOVI] Localización terminada. ${resultado.cantidad_detectada} facing(s).`
    );


    return res
      .status(200)
      .json(
        resultado
      );


  } catch (error) {

    console.error(
      "[SOVI] Error localizando:",
      error
    );


    return responderError(

      res,

      500,

      "No se pudo completar la localización visual.",

      {
        detalle:
          error?.message ||
          "Error desconocido."
      }

    );

  }

}
