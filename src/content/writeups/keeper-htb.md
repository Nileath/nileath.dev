---
title: 'Keeper'
description: 'WriteUp de la máquina Keeper'
pubDate: 'Sep 25 2023'
heroImage: '/htb/keeper/placeholder.png'
private: false
category: 'writeups'
tags: ['htb']
---

La máquina Keeper, fue una máquina de temporada de HackTheBox de dificultad fácil declarada por la plataforma.

## Fase de reconocimiento
### Escaneo de la máquina
Como siempre, realizamos una traza TCP por ping para detectar si la máquina está activa y ver ante que sistema operativo nos enfrentamos mediante el TTL, el cual al ser de 63 la identificamos como una máquina Linux.

![Captura ping](https://i.imgur.com/QHtVSuD.png)

Confirmando la conexión con la máquina, procedemos a realizar un escaneo con nmap, primero comenzamos con por el protocolo TCP y luego, en el caso de no encontrar nada, usamos UDP.

Comenzamos escanenando todo el rango de puertos y le agregamos los siguientes parámetros para un escáneo rápido:

```bash
-p- # Para barcar los 65535 puertos
--open # Solo obtener los puertos con estado open
-sS # Realizar escaneo TCP SYN SCAN
--min-rate 5000 # Envío mínimo de 5000 paquetes por segundos
-v # Verbose
-n # Evitar resolución DNS
-Pn # Evitar host discovery
-oG # Exporte en formato greppeable 
# para luego usar extractPorts
```

###### [!] Existen casos en los que usar 5000 paquetes es demasiado, en esos casos reducir a la mitad.
###### [!] ExtractPorts es un script creado por s4vitar para la rápida extracción de puertos de una captura de nmap [link](https://gist.github.com/Nileath/8f3e8c135963636cda3d2810e9a3824f)

![Captura nmap](https://i.imgur.com/pEuldSU.png)

Con esto ya sabemos que tiene un servicio SSH corriendo (puerto 22) y un servidor web (puerto 80), de todas formas siempre es recomendable obtener más información de estos servicios, para eso usamos los scripts básicos de reconocimiento y versionado de nmap.
```bash
-sC # Reconocimiento
-sV # Versionado

-sCV # Ambos
```
![Captura nmap 2](https://i.imgur.com/UqSmNYg.png)

Adicionalmente, mientras se realiza el escaneo de nmap, podemos adelantar trabajo usando `whatweb` para obtener más información del sitio web

![Captura whatweb](https://i.imgur.com/E95TUdb.png)

El cual nos indica, al igual que nmap, que estamos ante un sistema ubuntu, si vemos la página desde el navegador, podemos ver que tiene virtualhosting, el cual debemos agregarlo en el archivo `/etc/hosts` del sistema para poder visualizarlo

![Captura virtualhosting](https://i.imgur.com/phZojBA.png)

Luego de agregar el host, podemos ver en la web un panel de login de `request tracker`
![Captura login panel](https://i.imgur.com/30rJXPQ.png)

El cual si hacemos una búsqueda rápida por credenciales por defecto, encontramos que el usuario es `root` y la contraseña es `password`, las cuales al probarlas en el panel, nos deja acceder sin problemas.

### Accediento al usuario
Como estamos loggeados como root, lo primero que vamos a revisar son los paneles superiores, en los cuales nos llaman la atención 2:

El primero es dentro de `search`, vemos un apartado de tickets, lo cual nos da a entender que pueden haber registros de errores o demás que hayan tenido los usuarios y podemos ver uno en los `recien vistos` que nos indica por donde puede ir el acceso o escalada, esto lo tendremos en cuenta para más adelante

![Captura resumen tickes](https://i.imgur.com/adnEhxC.png)

El segundo apartado es el de los usuarios, en el cual solo vemos dos, `lnorgaard` y `root`.

![Captura usuarios](https://i.imgur.com/fD8thzH.png)

Viendo el detalle de cada uno, podemos ver un leak en el usuario lnorgaard, el cual nos deja ver su contraseña como comentario

![Captura detalle de usuario](https://i.imgur.com/iL3sh20.png)

Si probamos esta contraseña como el usuario lnorgaard mediante ssh, vemos que podemos acceder al usuario y por ende a la flag del usuario.
![Captura ssh y flag](https://i.imgur.com/c3fr8K2.png)

## Fase de explotación

Además de la flag en el home del usuario, podemos ver un archivo comprimido, el cual si listamos, podemos ver un dump de KeePass, el cual, si hacemos memoria, en el ticket que habiamos visto, nos decía algo de un keepass, por lo cual entendemos que por aquí se debe seguir para escalar privilegios.

![Captura zip](https://i.imgur.com/jHvV4yY.png)

Descargamos el archivo a nuestro local para poder trabajar más cómodos

![Captura scp](https://i.imgur.com/NrN1AwM.png)

Si exportamos el contenido y usamos la vulnerabilidad `CVE-2023-32784` en [el siguiente repo](https://github.com/CMEPW/keepass-dump-masterkey) para poder obtener la contraseña del dump vemos lo siguiente:

![Captura dump key](https://i.imgur.com/A0z0F1W.png)

###### [!] Existen casos en que no logres ver los carácteres, recomiendo usar kali o parrot o instalar distintas fuentes

Lo cual no hace mucho sentido, pero si recordamos el usuario del perfil, podiamos ver una frase, que al usar google translate para detectar el idioma, vemos que es Danés, por lo cual la contraseña también debe estar en ese idioma.

Si buscamos en google por el texto `●Mdgr●d med fl●de` podemos ver que hace referencia a `Rødgrød med fløde`, una especie de receta danesa, si probamos usarla para abrir el keepas, vemos que funciona usando todo el texto en minúscula

![Captura receta](https://i.imgur.com/OauQdZH.png)

## Obteniendo root
Ya dentro del keepass, podemos ver una contraseña y una llave ssh para root, si probamos la contraseña vemos que no es la que buscamos, pero trataremos de probar con la llave

![Captura keepass](https://i.imgur.com/xYqzybl.png)

Si guardamos la llave, vemos que es una llave del software `putty`, para transformarla a llave de ssh debemos usar `puttygen`, el cual viene dentro del paquete `putty-tools`, de la siguiente manera
```bash
puttygen putty-key -O private-openssh -o keyfile
```

Luego con la llave ya transformada a ssh, accedemos y ya tenemos disponible la flag como root

![Captura root](https://i.imgur.com/NOXtx0O.png)