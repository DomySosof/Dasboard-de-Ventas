<#
    install.ps1
    Instala y levanta el Dashboard de Ventas y Asociados usando Docker Desktop.
    Uso:  Clic derecho -> "Ejecutar con PowerShell"
          o, desde una terminal PowerShell abierta en esta carpeta:  .\install.ps1

    Antes de instalar te RECOMIENDA un puerto libre (para no chocar con tus otros
    proyectos). Si no te gusta, escribes el que quieras. Con el puerto elegido se
    genera un docker-compose TEMPORAL, se instala, y al terminar se elimina ese
    temporal (tu docker-compose.yml original no se modifica).
#>

$ErrorActionPreference = "Stop"

function Write-Titulo($texto) {
    Write-Host ""
    Write-Host "==== $texto ====" -ForegroundColor Cyan
}

# ¿Está libre el puerto? (revisa sockets escuchando y prueba a enlazarlo)
function Test-PuertoLibre([int]$puerto) {
    if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
        return $false
    }
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $puerto)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

# Devuelve el primer puerto libre a partir de "desde" (busca hasta +100)
function Buscar-PuertoLibre([int]$desde) {
    for ($p = $desde; $p -lt ($desde + 100); $p++) {
        if (Test-PuertoLibre $p) { return $p }
    }
    return $desde
}

Write-Titulo "Dashboard de Ventas y Asociados - Instalador"

# 1) Verificar que Docker esté instalado
Write-Titulo "Verificando Docker Desktop"
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "No se encontró Docker en este equipo." -ForegroundColor Red
    Write-Host "Instala Docker Desktop desde: https://www.docker.com/products/docker-desktop/"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "Docker encontrado: $($docker.Source)" -ForegroundColor Green

# 2) Verificar que el motor de Docker esté corriendo
try {
    docker info | Out-Null
} catch {
    Write-Host "Docker Desktop no está corriendo. Ábrelo y espera a que diga 'Engine running', luego vuelve a ejecutar este script." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "El motor de Docker está activo." -ForegroundColor Green

# 3) Ir a la carpeta donde está este script (raíz del proyecto)
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz
Write-Host "Carpeta del proyecto: $raiz"

# 4) Elegir el puerto: recomendado (libre) o el que escriba el usuario
Write-Titulo "Elección del puerto"

# Puerto actual declarado en docker-compose.yml (45000 por defecto)
$puertoBase = 45000
$lineaPuerto = Select-String -Path ".\docker-compose.yml" -Pattern '^\s*-\s*"(\d+):(\d+)"' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($lineaPuerto) { $puertoBase = [int]$lineaPuerto.Matches[0].Groups[1].Value }

$recomendado = Buscar-PuertoLibre $puertoBase

Write-Host "Puerto configurado en el proyecto: $puertoBase" -ForegroundColor DarkGray
if ($recomendado -eq $puertoBase) {
    Write-Host "El puerto $recomendado está libre." -ForegroundColor Green
} else {
    Write-Host "El puerto $puertoBase está ocupado. Puerto libre recomendado: $recomendado" -ForegroundColor Yellow
}

$resp = Read-Host "¿Usar el puerto $recomendado? [S/n]"
if ($resp -match '^\s*(n|no)\s*$') {
    # El usuario quiere escribir su propio puerto
    while ($true) {
        $entrada = Read-Host "Escribe el puerto que quieres usar (1-65535)"
        $puerto = 0
        if (-not [int]::TryParse($entrada, [ref]$puerto) -or $puerto -lt 1 -or $puerto -gt 65535) {
            Write-Host "Puerto no válido, intenta de nuevo." -ForegroundColor Yellow
            continue
        }
        if (-not (Test-PuertoLibre $puerto)) {
            $forzar = Read-Host "El puerto $puerto parece estar ocupado. ¿Usarlo igual? [s/N]"
            if ($forzar -notmatch '^\s*(s|si|sí)\s*$') { continue }
        }
        break
    }
} else {
    $puerto = $recomendado
}
Write-Host "Se usará el puerto $puerto." -ForegroundColor Green

# 5) Crear carpeta de datos persistentes si no existe
if (-not (Test-Path ".\data")) {
    New-Item -ItemType Directory -Path ".\data" | Out-Null
    Write-Host "Carpeta .\data creada (aquí vivirá tu base de datos, sobrevive a docker compose down)."
}

# 6) Crear el docker-compose TEMPORAL con el puerto elegido
$composeTemporal = ".\docker-compose.install.tmp.yml"
$contenido = Get-Content ".\docker-compose.yml" -Raw
$reemplazo = '$1"' + $puerto + ':$3"'
$nuevoContenido = $contenido -replace '(?m)^(\s*-\s*)"(\d+):(\d+)"', $reemplazo
if ($nuevoContenido -eq $contenido) {
    Write-Host "No se pudo ajustar el puerto en docker-compose.yml (revisa el formato de 'ports')." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}
$rutaTemporal = Join-Path $raiz "docker-compose.install.tmp.yml"
[System.IO.File]::WriteAllText($rutaTemporal, $nuevoContenido, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Creado docker-compose.install.tmp.yml con el puerto $puerto (temporal)." -ForegroundColor Green

# 7) Construir y levantar usando el compone temporal, y borrarlo al terminar
try {
    Write-Titulo "Construyendo la imagen (puede tardar unos minutos la primera vez)"
    docker compose -f $composeTemporal build

    Write-Titulo "Levantando el contenedor"
    docker compose -f $composeTemporal up -d

    Write-Titulo "Esperando a que el servidor esté listo"
    $listo = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $health = Invoke-WebRequest -Uri "http://localhost:$puerto/api/health" -UseBasicParsing -TimeoutSec 2
            if ($health.StatusCode -eq 200) { $listo = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }

    if ($listo) {
        Write-Host ""
        Write-Host "Listo! El dashboard está corriendo en http://localhost:$puerto" -ForegroundColor Green
        Write-Host "Abriendo el navegador..."
        Start-Process "http://localhost:$puerto"
    } else {
        Write-Host "El contenedor se levantó pero el servidor tardó en responder." -ForegroundColor Yellow
        Write-Host "Revisa los logs con:  docker logs -f dashboard-turismo"
    }
}
finally {
    if (Test-Path $composeTemporal) {
        Remove-Item $composeTemporal -Force
        Write-Host "Archivo temporal docker-compose.install.tmp.yml eliminado." -ForegroundColor DarkGray
    }
}

Write-Titulo "Comandos útiles"
Write-Host "  Ver logs:            docker logs -f dashboard-turismo"
Write-Host "  Detener:             docker stop dashboard-turismo"
Write-Host "  Volver a iniciar:    docker start dashboard-turismo"
Write-Host "  Reiniciar:           docker restart dashboard-turismo"
Write-Host "  Cargar datos demo:   docker exec dashboard-turismo node src/scripts/seed-demo.js"
Write-Host ""
Write-Host "Nota: el compose temporal se borra al terminar; administra el contenedor por su" -ForegroundColor DarkGray
Write-Host "nombre (dashboard-turismo) o vuelve a ejecutar este instalador si quieres cambiar el puerto." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Presiona Enter para cerrar"
