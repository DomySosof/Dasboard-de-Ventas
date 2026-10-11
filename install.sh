#!/usr/bin/env bash
#
# install.sh
# Instala y levanta el Dashboard de Ventas y Asociados usando Docker (macOS / Linux).
#
# Uso:
#   chmod +x install.sh
#   ./install.sh
#   (o también:  bash install.sh)
#
# Antes de instalar te RECOMIENDA un puerto libre (para no chocar con tus otros
# proyectos). Si no te gusta, escribes el que quieras. Con el puerto elegido se
# genera un docker-compose TEMPORAL, se instala, y al terminar se elimina ese
# temporal (tu docker-compose.yml original no se modifica).

set -euo pipefail

# Colores (solo si la salida es una terminal)
if [ -t 1 ]; then
  C_CYAN='\033[36m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_DIM='\033[2m'; C_OFF='\033[0m'
else
  C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''; C_OFF=''
fi

titulo() { printf "\n${C_CYAN}==== %s ====${C_OFF}\n" "$1"; }

# Ir a la carpeta donde está este script (raíz del proyecto)
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$raiz"

tmp_compose="docker-compose.install.tmp.yml"

# Borra el compose temporal al salir, pase lo que pase
limpiar() { rm -f "$tmp_compose"; }
trap limpiar EXIT

# ¿Está libre el puerto? Si algo responde en 127.0.0.1:puerto, está ocupado.
puerto_libre() {
  local p="$1"
  if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
    return 1
  fi
  return 0
}

titulo "Dashboard de Ventas y Asociados - Instalador"

# 1) Verificar que Docker esté instalado
titulo "Verificando Docker"
if ! command -v docker >/dev/null 2>&1; then
  printf "${C_RED}No se encontró Docker.${C_OFF}\n"
  echo "Instálalo desde: https://docs.docker.com/get-docker/"
  exit 1
fi
echo "Docker encontrado: $(command -v docker)"

# 2) Verificar que el motor de Docker esté corriendo
if ! docker info >/dev/null 2>&1; then
  printf "${C_RED}Docker no está corriendo.${C_OFF}\n"
  echo "En macOS abre Docker Desktop. En Linux:  sudo systemctl start docker"
  exit 1
fi
echo "El motor de Docker está activo."

# 3) Detectar el comando de compose (v2 'docker compose' o v1 'docker-compose')
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  printf "${C_RED}No se encontró 'docker compose' ni 'docker-compose'.${C_OFF}\n"
  echo "Instala Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi
echo "Usando: ${COMPOSE[*]}"

# 4) Elegir el puerto: recomendado (libre) o el que escriba el usuario
titulo "Elección del puerto"

puerto_base="$(sed -nE 's/^[[:space:]]*-[[:space:]]*"([0-9]+):[0-9]+".*/\1/p' docker-compose.yml 2>/dev/null | head -n1 || true)"
puerto_base="${puerto_base:-45000}"

recomendado=""
p="$puerto_base"
while [ "$p" -lt "$((puerto_base + 100))" ]; do
  if puerto_libre "$p"; then recomendado="$p"; break; fi
  p=$((p + 1))
done
[ -z "$recomendado" ] && recomendado="$puerto_base"

printf "${C_DIM}Puerto configurado en el proyecto: %s${C_OFF}\n" "$puerto_base"
if [ "$recomendado" = "$puerto_base" ]; then
  printf "${C_GREEN}El puerto %s está libre.${C_OFF}\n" "$recomendado"
else
  printf "${C_YELLOW}El puerto %s está ocupado. Puerto libre recomendado: %s${C_OFF}\n" "$puerto_base" "$recomendado"
fi

printf "¿Usar el puerto %s? [S/n] " "$recomendado"
read -r resp || resp=""
case "$resp" in
  n|N|no|No|NO)
    # El usuario quiere escribir su propio puerto
    while true; do
      printf "Escribe el puerto que quieres usar (1-65535): "
      read -r entrada || entrada=""
      case "$entrada" in
        ''|*[!0-9]*) echo "Puerto no válido, intenta de nuevo."; continue ;;
      esac
      if [ "$entrada" -lt 1 ] || [ "$entrada" -gt 65535 ]; then
        echo "Puerto no válido, intenta de nuevo."; continue
      fi
      if ! puerto_libre "$entrada"; then
        printf "El puerto %s parece estar ocupado. ¿Usarlo igual? [s/N] " "$entrada"
        read -r forzar || forzar=""
        case "$forzar" in
          s|S|si|Si|SI|sí|Sí) : ;;
          *) continue ;;
        esac
      fi
      puerto="$entrada"; break
    done
    ;;
  *)
    puerto="$recomendado"
    ;;
esac
printf "${C_GREEN}Se usará el puerto %s.${C_OFF}\n" "$puerto"

# 5) Crear carpeta de datos persistentes si no existe
if [ ! -d "data" ]; then
  mkdir -p data
  echo "Carpeta ./data creada (aquí vivirá tu base de datos, sobrevive a docker compose down)."
fi

# 6) Crear el docker-compose TEMPORAL con el puerto elegido
if ! sed -E "s/^([[:space:]]*-[[:space:]]*)\"[0-9]+:([0-9]+)\"/\1\"${puerto}:\2\"/" docker-compose.yml | tr -d '\r' > "$tmp_compose"; then
  printf "${C_RED}No se pudo crear el compose temporal.${C_OFF}\n"
  exit 1
fi
if ! grep -q "\"${puerto}:\"" "$tmp_compose"; then
  printf "${C_RED}No se pudo ajustar el puerto en docker-compose.yml (revisa el formato de 'ports').${C_OFF}\n"
  exit 1
fi
printf "${C_GREEN}Creado %s con el puerto %s (temporal).${C_OFF}\n" "$tmp_compose" "$puerto"

# 7) Construir la imagen y levantar el contenedor
titulo "Construyendo la imagen (puede tardar unos minutos la primera vez)"
"${COMPOSE[@]}" -f "$tmp_compose" build

titulo "Levantando el contenedor"
"${COMPOSE[@]}" -f "$tmp_compose" up -d

# 8) Esperar a que el servidor responda
titulo "Esperando a que el servidor esté listo"
http_ok() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 2 "$url" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 2 -O /dev/null "$url" >/dev/null 2>&1
  else
    return 1
  fi
}

listo=0
for ((intento = 0; intento < 60; intento++)); do
  if http_ok "http://localhost:${puerto}/api/health"; then listo=1; break; fi
  sleep 1
done

if [ "$listo" = "1" ]; then
  printf "\n${C_GREEN}¡Listo! El dashboard está corriendo en http://localhost:%s${C_OFF}\n" "$puerto"
  echo "Abriendo el navegador..."
  if command -v xdg-open >/dev/null 2>&1; then
    (xdg-open "http://localhost:${puerto}" >/dev/null 2>&1 &)
  elif command -v open >/dev/null 2>&1; then
    (open "http://localhost:${puerto}" >/dev/null 2>&1 &)
  fi
else
  printf "${C_YELLOW}El contenedor se levantó pero el servidor tardó en responder.${C_OFF}\n"
  echo "Revisa los logs con:  docker logs -f dashboard-turismo"
fi

titulo "Comandos útiles"
echo "  Ver logs:            docker logs -f dashboard-turismo"
echo "  Detener:             docker stop dashboard-turismo"
echo "  Volver a iniciar:    docker start dashboard-turismo"
echo "  Reiniciar:           docker restart dashboard-turismo"
echo "  Cargar datos demo:   docker exec dashboard-turismo node src/scripts/seed-demo.js"
printf "\n${C_DIM}Nota: el compose temporal se borra al terminar; administra el contenedor por su${C_OFF}\n"
printf "${C_DIM}nombre (dashboard-turismo) o vuelve a ejecutar install.sh para cambiar el puerto.${C_OFF}\n"
