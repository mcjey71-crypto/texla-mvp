# Walkie-talkie para documentos compartidos

En un documento compartido aparece **Walkie-talkie**. Cada participante pulsa **Activar walkie-talkie** y permite el micrófono. Mantén pulsado **Mantén pulsado para hablar** con el ratón o el dedo; suelta para dejar de transmitir. También puedes enfocar ese botón con Tab y mantener Espacio o Enter. El resto del documento conserva sus atajos normales.

Una persona tiene el turno cada vez. El canal indica quién habla y cuántas personas activaron el audio. Un turno dura hasta **30 segundos**: vuelve a pulsar si necesitas continuar. **Silenciar sonido** afecta solo a tu escucha; **Desactivar walkie-talkie** abandona el canal y libera el micrófono. Al cambiar de pestaña, perder el foco de la ventana, desconectarte, abrir otro documento o cerrar la página, Texla deja de transmitir. Tras una desconexión debes activar el canal de nuevo: no se vuelve a abrir el micrófono automáticamente.

Al activar el canal, el navegador abre el dispositivo de entrada y puede mostrar su indicador de uso. La pista permanece deshabilitada y no se envían muestras hasta que mantienes pulsado y el servidor concede el turno. Salir del canal detiene las pistas y cierra el dispositivo. Si el navegador deniega el permiso o no hay micrófono, muestra un aviso y puedes seguir editando.

El control sigue disponible en **Despejar pantalla** y desaparece de la impresión. Los documentos privados no muestran el canal.

## Activación en producción

Se necesitan **dos publicaciones**: la web de GitHub Pages y el Worker de colaboración actualizado. No hay que ejecutar SQL, cambiar Supabase ni crear una cuenta en un proveedor de llamadas.

El workflow [Publish collaboration server](https://github.com/mcjey71-crypto/texla-mvp/actions/workflows/collaboration.yml) ahora se ejecuta al cambiar el servidor o su protocolo en `main`, además de permitir **Run workflow**. Reutiliza `CLOUDFLARE_API_TOKEN` (secret) y `CLOUDFLARE_ACCOUNT_ID` (variable), descritos en [la guía de colaboración](collaboration.md). Si faltan, el despliegue falla con una indicación explícita; el código no puede instalarse en Cloudflare sin una credencial autorizada. No pegues el token en el chat ni en el repositorio.

Si usas despliegues conectados directamente desde Cloudflare, publica la revisión nueva del mismo Worker `texla-collaboration` con `npm run collab:deploy`. Mantén su binding `ROOMS` y su almacenamiento: esta actualización no requiere migraciones de Durable Objects ni sustituir documentos.

El servidor anuncia `voiceVersion: 1` en `/health` y al autenticar la sesión. Una web actualizada con un Worker antiguo deshabilita el botón y muestra que falta actualizar el servidor; no interrumpe la redacción ni envía mensajes desconocidos a ese servidor. Después de actualizar ambos, recarga Texla en los dispositivos participantes.

## Funcionamiento, privacidad y capacidad

- El audio circula por la conexión **WebSocket HTTPS/WSS ya autenticada del documento**, sin conexiones directas entre dispositivos. No requiere STUN/TURN, aperturas de puertos ni claves adicionales.
- Se usa PCM16 mono a 16 kHz, con paquetes de 100 ms y un búfer corto de reproducción. La latencia depende de la conexión y del navegador; no se garantiza audio sin interrupciones. Es un canal de conversación breve por turnos, no una videollamada.
- El servidor verifica membresía, turno, duración, tamaño y frecuencia. Solo reenvía a personas que activaron el audio en **esa misma sala**. Un participante que solo edita no recibe los paquetes. El turno caduca si deja de recibir audio y se libera al salir o desconectarse.
- **Texla no graba ni persiste el audio**: no se incorpora a Yjs, SQLite, Supabase, IndexedDB, copias editables ni exportaciones. Los paquetes se procesan en memoria y se descartan. Los turnos y la lista del canal son temporales; no se guardan como contenido.
- WSS protege el transporte. El servidor procesa el audio: no es cifrado de extremo a extremo. Quien tiene el enlace de edición puede entrar al canal y elegir un nombre; el nombre no acredita identidad. Otras personas o dispositivos pueden grabar lo que oyen fuera de Texla.
- El canal comparte el límite de **12 conexiones simultáneas por documento**. Solo una transmite a la vez. No añade usuarios ilimitados ni una cuota independiente de Cloudflare.
- Cada transmisión genera unos **2,6 MB/minuto por receptor**, más encabezados, y unos diez mensajes entrantes por segundo mientras se habla. El uso consume las cuotas de red, solicitudes y procesamiento del proyecto Cloudflare. Los planes gratuitos no son ilimitados: revisa su panel Usage antes de abrirlo a muchos usuarios. La función no cambia tu plan ni configura pagos.
- Usa auriculares si varias personas están cerca o si aparece eco. Se solicita cancelación de eco y reducción de ruido al navegador, pero su calidad depende del dispositivo.

## Comprobaciones

Las pruebas con Chromium y el Worker local usan una señal de micrófono de prueba y miden energía en la salida del otro navegador. Verifican recepción de sonido, silencio al soltar, ausencia de retorno propio, silenciamiento, micrófono cerrado al salir/desconectar, edición concurrente, navegación móvil y modo despejado. Las pruebas del protocolo verifican exclusión de turnos, ausencia de envío a no participantes, rechazo de suplantación del turno, caducidad y ausencia de persistencia en el documento. Se comprueba también que otra sala permanece en silencio y que el turno termina tras 30 segundos.

También se comprueba el comportamiento cuando se deniega el permiso o se cancela una solicitud de micrófono pendiente. Estas pruebas no sustituyen una comprobación de micrófonos físicos y dispositivos reales en el sitio publicado, especialmente Safari/iOS y conexiones móviles. Se requiere HTTPS (o localhost para desarrollo), AudioWorklet y permiso de micrófono en un navegador actualizado.

### Comprobación de la web publicada

El workflow [Verify published Texla and live audio](https://github.com/mcjey71-crypto/texla-mvp/actions/workflows/verify-production.yml) permite ejecutar **Run workflow** para revisar GitHub Pages y el Worker publicados. No inicia un servidor local ni sustituye sus respuestas por simulaciones.

Abre dos sesiones independientes de Chromium, crea un documento temporal, transmite una señal de micrófono sintética por el servidor real en ambos sentidos y mide la señal en el navegador receptor. Comprueba silencio al soltar, silenciamiento, cierre del micrófono y edición simultánea. Al terminar desactiva la sala creada por esa prueba, también si falla una comprobación. No abre documentos de usuarios ni inicia sesión en cuentas personales. Consume una creación de sala y unos segundos de tráfico de audio.

También comprueba que cargue el editor y consulta qué proveedores de acceso anuncia Supabase. Los resultados aparecen en las anotaciones de Actions. Esta comprobación no confirma la entrega de correos, el consentimiento real de Google ni el acceso a la biblioteca de una cuenta real; esas operaciones necesitan una prueba con el propietario de la cuenta. Tampoco verifica micrófonos físicos ni redes móviles: una ejecución correcta confirma la transmisión en el entorno de Chromium utilizado.
