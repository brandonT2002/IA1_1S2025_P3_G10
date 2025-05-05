// --- Configuración inicial de Three.js (Scene, Camera, Renderer, Controls, Lights) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // Asegúrate que este sea el único canvas que quieres

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.DOLLY
};

controls.enableZoom = true;
controls.zoomSpeed = 0.5;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- Materiales y variables globales ---
const loader = new THREE.FBXLoader();
let mixer, walkAction;

const textureLoader = new THREE.TextureLoader();
const brickTexture = textureLoader.load('assets/brick.jpeg');
brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
brickTexture.repeat.set(2, 2);

const wallMaterial = new THREE.MeshStandardMaterial({ map: brickTexture });
const floorMaterial1 = new THREE.MeshStandardMaterial({ color: 0xdddddd });
const floorMaterial2 = new THREE.MeshStandardMaterial({ color: 0x999999 });
const startMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const endMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, opacity: 0.6, transparent: true });
const exploredMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500, opacity: 0.5, transparent: true });
const frontierMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, opacity: 0.5, transparent: true });

const cubeSize = 1;
let robot;
let path = [];
let step = 0;
let searchStarted = false;
let mazeData; // Guardará los datos del laberinto cargado
let mazeObjects = []; // Para guardar referencias a los objetos del laberinto y poder limpiarlos
let explorationPhase = true;
let explorationSteps = [];
let currentExplorationStep = 0;
let explorationSpeed = 100;
let explorationTimeout;
const explorationTiles = new Map(); // Mapa para las baldosas de exploración

// --- Referencias a elementos del DOM ---
const inputArchivo = document.getElementById('archivoLaberinto');
const botonCargar = document.getElementById('cargarLaberintoBtn');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const algorithmSelect = document.getElementById('algorithmSelect');
const camUp = document.getElementById('camUp');
const camDown = document.getElementById('camDown');
const camLeft = document.getElementById('camLeft');
const camRight = document.getElementById('camRight');
const camZoomIn = document.getElementById('camZoomIn');
const camZoomOut = document.getElementById('camZoomOut');

const mazeStats = document.getElementById('mazeStats');
const algorithmStatus = document.getElementById('algorithmStatus');

function bfs(maze, start, end) {
    const { ancho, alto, paredes } = maze;
    const queue = [[start[0], start[1]]];
    const visited = Array.from({ length: ancho }, () => Array(alto).fill(false));
    const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    explorationSteps = [];

    visited[start[0]][start[1]] = true;
    explorationSteps.push({
        type: 'visited',
        position: [start[0], start[1]],
        frontier: [...queue]
    });

    while (queue.length > 0) {
        const [x, y] = queue.shift();

        if (x === end[0] && y === end[1]) {
            explorationSteps.push({
                type: 'found',
                position: [x, y]
            });
            break;
        }

        const newFrontier = [];
        directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !visited[nx][ny] && !paredes.some(([px, py]) => px === nx && py === ny)) {
                visited[nx][ny] = true;
                prev[nx][ny] = [x, y];
                queue.push([nx, ny]);
                newFrontier.push([nx, ny]);
            }
        });

        if (newFrontier.length > 0) {
            explorationSteps.push({
                type: 'frontier',
                position: [x, y],
                newFrontier: [...newFrontier],
                frontier: [...queue]
            });
        }
    }

    let current = end;
    path = [];
    while (current && (current[0] !== start[0] || current[1] !== start[1])) {
        path.unshift(current);
        current = prev[current[0]][current[1]];
    }
    path.unshift(start);

    explorationSteps.push({
        type: 'exploration_complete'
    });

    return { path, explorationSteps };
}

function dijkstra(maze, start, end) {
    const { ancho, alto, paredes } = maze;
    const grid = Array.from({ length: ancho }, () => Array(alto).fill(Infinity));
    const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
    const visited = Array.from({ length: ancho }, () => Array(alto).fill(false));

    const queue = [];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    explorationSteps = [];

    grid[start[0]][start[1]] = 0;
    queue.push([start[0], start[1], 0]);

    explorationSteps.push({
        type: 'visited',
        position: [start[0], start[1]],
        frontier: [[start[0], start[1]]]
    });

    while (queue.length > 0) {
        queue.sort((a, b) => a[2] - b[2]);
        const [x, y, dist] = queue.shift();

        if (visited[x][y]) continue;
        visited[x][y] = true;

        if (x === end[0] && y === end[1]) {
            explorationSteps.push({
                type: 'found',
                position: [x, y]
            });
            break;
        }

        const newFrontier = [];
        directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !visited[nx][ny] && !paredes.some(([px, py]) => px === nx && py === ny)) {
                const newDist = dist + 1;
                if (newDist < grid[nx][ny]) {
                    grid[nx][ny] = newDist;
                    prev[nx][ny] = [x, y];
                    queue.push([nx, ny, newDist]);
                    newFrontier.push([nx, ny]);
                }
            }
        });

        if (newFrontier.length > 0) {
            explorationSteps.push({
                type: 'frontier',
                position: [x, y],
                newFrontier: [...newFrontier],
                frontier: queue.map(q => [q[0], q[1]])
            });
        }
    }

    let current = end;
    path = [];
    while (current && (current[0] !== start[0] || current[1] !== start[1])) {
        path.unshift(current);
        current = prev[current[0]][current[1]];
    }
    path.unshift(start);

    explorationSteps.push({
        type: 'exploration_complete'
    });

    return { path, explorationSteps };
}

function aStar(maze, start, end) {
    const { ancho, alto, paredes } = maze;
    const gScore = Array.from({ length: ancho }, () => Array(alto).fill(Infinity));
    const fScore = Array.from({ length: ancho }, () => Array(alto).fill(Infinity));
    const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
    const visited = Array.from({ length: ancho }, () => Array(alto).fill(false));

    const openSet = [];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    const h = (x, y) => Math.abs(x - end[0]) + Math.abs(y - end[1]);

    explorationSteps = [];

    gScore[start[0]][start[1]] = 0;
    fScore[start[0]][start[1]] = h(start[0], start[1]);
    openSet.push([start[0], start[1], fScore[start[0]][start[1]]]);

    explorationSteps.push({
        type: 'visited',
        position: [start[0], start[1]],
        frontier: [[start[0], start[1]]]
    });

    while (openSet.length > 0) {
        openSet.sort((a, b) => a[2] - b[2]);
        const [x, y] = openSet.shift();

        if (visited[x][y]) continue;
        visited[x][y] = true;

        if (x === end[0] && y === end[1]) {
            explorationSteps.push({
                type: 'found',
                position: [x, y]
            });
            break;
        }

        const newFrontier = [];
        directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !visited[nx][ny] && !paredes.some(([px, py]) => px === nx && py === ny)) {
                const tentativeG = gScore[x][y] + 1;

                if (tentativeG < gScore[nx][ny]) {
                    prev[nx][ny] = [x, y];
                    gScore[nx][ny] = tentativeG;
                    fScore[nx][ny] = tentativeG + h(nx, ny);

                    const existingIndex = openSet.findIndex(item => item[0] === nx && item[1] === ny);
                    if (existingIndex !== -1) {
                        openSet[existingIndex][2] = fScore[nx][ny];
                    } else {
                        openSet.push([nx, ny, fScore[nx][ny]]);
                        newFrontier.push([nx, ny]);
                    }
                }
            }
        });

        if (newFrontier.length > 0) {
            explorationSteps.push({
                type: 'frontier',
                position: [x, y],
                newFrontier: [...newFrontier],
                frontier: openSet.map(item => [item[0], item[1]])
            });
        }
    }

    let current = end;
    path = [];
    while (current && (current[0] !== start[0] || current[1] !== start[1])) {
        path.unshift(current);
        current = prev[current[0]][current[1]];
    }
    path.unshift(start);

    explorationSteps.push({
        type: 'exploration_complete'
    });

    return { path, explorationSteps };
}

function visualizeExplorationStep(step) {
    if (!step) return false;

    if (step.type === 'exploration_complete') {
        explorationPhase = false;
        console.log("Exploración completada, iniciando recorrido del camino");

        setTimeout(() => {
            explorationTiles.forEach((tile) => {
                scene.remove(tile);
            });
            explorationTiles.clear();
        }, 1000);

        return false;
    }

    if (step.type === 'visited' || step.type === 'frontier') {
        const [x, y] = step.position;
        const material = step.type === 'visited' ? exploredMaterial : exploredMaterial;

        const key = `${x},${y}`;
        if (!explorationTiles.has(key)) {
            const tile = new THREE.Mesh(
                new THREE.BoxGeometry(cubeSize * 0.8, 0.08, cubeSize * 0.8),
                material
            );
            tile.position.set(y, 0.04, x);
            scene.add(tile);
            explorationTiles.set(key, tile);
        }

        if (step.newFrontier) {
            step.newFrontier.forEach(([nx, ny]) => {
                const frontierKey = `${nx},${ny}`;
                if (!explorationTiles.has(frontierKey)) {
                    const tile = new THREE.Mesh(
                        new THREE.BoxGeometry(cubeSize * 0.7, 0.07, cubeSize * 0.7),
                        frontierMaterial
                    );
                    tile.position.set(ny, 0.03, nx);
                    scene.add(tile);
                    explorationTiles.set(frontierKey, tile);
                }
            });
        }
    }

    return true;
}

// --- Función para limpiar el laberinto anterior ---
function limpiarLaberintoActual() {
    mazeObjects.forEach(obj => scene.remove(obj));
    mazeObjects = [];
    explorationTiles.forEach(tile => scene.remove(tile));
    explorationTiles.clear();
    if (robot) {
        scene.remove(robot);
        robot = null; // Asegúrate de limpiar la referencia
        mixer = null;
        walkAction = null;
    }
    // Detener cualquier animación o timeout pendiente
    clearTimeout(explorationTimeout);
    searchStarted = false;
    explorationPhase = true;
    step = 0;
    path = [];
    console.log("Laberinto anterior limpiado.");
}

// --- Función para reiniciar el laberinto actual ---
function reiniciarLaberinto() {
    // Solo reiniciar si hay un laberinto cargado
    if (!mazeData) {
        alert("No hay laberinto para reiniciar. Carga un laberinto primero.");
        return;
    }

    console.log("Reiniciando laberinto...");
    
    // Detener cualquier animación o timeout pendiente
    clearTimeout(explorationTimeout);

    // Restablecer variables de estado
    searchStarted = false;
    explorationPhase = true;
    currentExplorationStep = 0;
    step = 0;
    path = [];
    previousDirection = null;

    // Limpiar visualizaciones del camino y exploración
    explorationTiles.forEach(tile => scene.remove(tile));
    explorationTiles.clear();
    
    // Eliminar solo las baldosas del camino recorrido
    scene.children.forEach(child => {
        if (child.material === pathMaterial || child.material === exploredMaterial || child.material === frontierMaterial) {
            scene.remove(child);
        }
    });
    
    // Filtrar mazeObjects para mantener solo elementos del laberinto base
    mazeObjects = mazeObjects.filter(obj => {
        return obj.material === wallMaterial || obj.material === floorMaterial1 || 
               obj.material === floorMaterial2 || obj.material === startMaterial || 
               obj.material === endMaterial;
    });

    // Mover el robot a la posición inicial si existe
    if (robot) {
        const { inicio } = mazeData;
        robot.position.set(inicio[1], 0, inicio[0]);
        robot.rotation.y = 0;
        
        // Detener la animación de caminar si está activa
        if (walkAction && walkAction.isRunning()) {
            walkAction.stop();
        }
    }

    // Restablecer información en la interfaz
    algorithmStatus.textContent = "Seleccione un algoritmo y haga clic en 'Iniciar Búsqueda'";
    
    console.log("Laberinto reiniciado con éxito");
}

// --- Función para cargar y renderizar el laberinto ---
function cargarLaberinto(data) {
    limpiarLaberintoActual(); // Limpia el laberinto anterior si existe

    mazeData = data; // Guarda los nuevos datos
    const { ancho, alto, inicio, fin, paredes } = data;

    // Actualizar la información del laberinto
    mazeStats.innerHTML = `
        <strong>Laberinto cargado:</strong><br>
        Dimensiones: ${ancho} x ${alto}<br>
        Inicio: (${inicio[0]}, ${inicio[1]})<br>
        Fin: (${fin[0]}, ${fin[1]})<br>
        Paredes: ${paredes.length}
    `;
    algorithmStatus.textContent = "Seleccione un algoritmo y haga clic en 'Iniciar Búsqueda'";

    // Crear piso
    for (let x = 0; x < ancho; x++) {
        for (let y = 0; y < alto; y++) {
            const mat = ((x + y) % 2 === 0) ? floorMaterial1 : floorMaterial2;
            const floor = new THREE.Mesh(
                new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
                mat
            );
            floor.position.set(y, -0.05, x); // OJO: Parece que usas (y, z=x)
            scene.add(floor);
            mazeObjects.push(floor); // Guardar referencia para limpiar
        }
    }

    // Crear paredes
    paredes.forEach(([x, y]) => {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(cubeSize, 1, cubeSize),
            wallMaterial
        );
        wall.position.set(y, 0.5, x); // OJO: Parece que usas (y, z=x)
        scene.add(wall);
        mazeObjects.push(wall); // Guardar referencia para limpiar
    });

    // Crear inicio y fin
    const startMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
        startMaterial
    );
    startMesh.position.set(inicio[1], 0.01, inicio[0]); // OJO: Parece que usas (y, z=x)
    scene.add(startMesh);
    mazeObjects.push(startMesh);

    const endMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
        endMaterial
    );
    endMesh.position.set(fin[1], 0.01, fin[0]); // OJO: Parece que usas (y, z=x)
    scene.add(endMesh);
    mazeObjects.push(endMesh);

    // Cargar Robot (si no está cargado o si se eliminó)
    if (!robot) {
        loader.load('robot2.fbx', function (object) {
            object.scale.set(0.01, 0.01, 0.01);
            object.position.set(inicio[1], 0, inicio[0]); // Posición inicial
            robot = object;

            mixer = new THREE.AnimationMixer(object);
            const walkClip = object.animations.find(anim => anim.name === "mixamo.com"); // Ajusta el nombre si es diferente
            if (walkClip) {
                walkAction = mixer.clipAction(walkClip);
                walkAction.setLoop(THREE.LoopRepeat);
                walkAction.timeScale = 2.0; // Ajusta la velocidad si es necesario
            } else {
                console.warn("Animación 'mixamo.com' no encontrada en robot2.fbx");
            }
            scene.add(object);
            console.log("Robot cargado.");
        }, undefined, function (error) {
            console.error("Error cargando el robot:", error);
        });
    } else {
        // Si el robot ya existe, solo moverlo a la nueva posición inicial
        robot.position.set(inicio[1], 0, inicio[0]);
    }

    console.log("Nuevo laberinto renderizado.");
}

// --- Event Listener para el botón de Cargar Laberinto ---
botonCargar.addEventListener('click', () => {
    const archivo = inputArchivo.files[0];

    if (!archivo) {
        alert("Por favor, selecciona un archivo JSON.");
        return;
    }

    if (archivo.type !== "application/json") {
        alert("Por favor, selecciona un archivo con formato JSON.");
        inputArchivo.value = ''; // Limpiar selección
        return;
    }

    const reader = new FileReader();

    reader.onload = function(evento) {
        try {
            const contenido = evento.target.result;
            const data = JSON.parse(contenido);

            // Validar estructura básica
            if (data.ancho && data.alto && data.inicio && data.fin && data.paredes) {
                cargarLaberinto(data); // Llama a la función que renderiza
            } else {
                alert("El archivo JSON no tiene la estructura esperada (ancho, alto, inicio, fin, paredes).");
            }
        } catch (error) {
            console.error("Error al leer o parsear el archivo JSON:", error);
            alert("Hubo un error al procesar el archivo JSON.");
            mazeStats.textContent = "Error al cargar el laberinto";
        } finally {
            inputArchivo.value = ''; // Limpiar selección después de procesar
        }
    };

    reader.onerror = function(evento) {
        console.error("Error al leer el archivo:", evento.target.error);
        alert("No se pudo leer el archivo seleccionado.");
        mazeStats.textContent = "Error al cargar el laberinto";
        inputArchivo.value = ''; // Limpiar selección
    };

    reader.readAsText(archivo);
});

// --- Event Listener para el botón de Reiniciar ---
resetButton.addEventListener('click', reiniciarLaberinto);

// --- Bucle de Animación ---
const clock = new THREE.Clock();
let previousDirection = null; // Para la rotación del robot

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    controls.update(); // Actualizar OrbitControls

    // Lógica de movimiento del robot (si la búsqueda ha iniciado y no está en exploración)
    if (!explorationPhase && robot && searchStarted && path.length > 0) {
        if (step < path.length) {
            const [targetX, targetY] = path[step];
            const targetPosition = new THREE.Vector3(targetY, 0, targetX); // OJO: Coordenadas (y, z=x)
            const robotPosition = robot.position;

            // --- Lógica de rotación y movimiento (lerp) ---
            let direction = null;
            const xDiff = targetPosition.x - robotPosition.x; // Diferencia en X (corresponde a 'y' en mazeData)
            const zDiff = targetPosition.z - robotPosition.z; // Diferencia en Z (corresponde a 'x' en mazeData)

            // Determinar dirección principal del movimiento
            if (Math.abs(xDiff) > 0.01 || Math.abs(zDiff) > 0.01) { // Solo rotar si hay movimiento significativo
                if (Math.abs(xDiff) > Math.abs(zDiff)) {
                    direction = xDiff > 0 ? 'right' : 'left'; // Movimiento en eje X de Three.js
                } else {
                    direction = zDiff > 0 ? 'forward' : 'backward'; // Movimiento en eje Z de Three.js
                }

                // Rotar el robot si la dirección cambió
                if (direction !== previousDirection) {
                    let targetRotationY;
                    // CORRECCIÓN: Invertir las rotaciones para que el robot camine hacia adelante
                    if (direction === 'right') targetRotationY = Math.PI / 2; // Derecha en Three.js (X positivo)
                    else if (direction === 'left') targetRotationY = -Math.PI / 2;  // Izquierda en Three.js (X negativo)
                    else if (direction === 'forward') targetRotationY = 0; // Adelante en Three.js (Z positivo)
                    else if (direction === 'backward') targetRotationY = Math.PI; // Atrás en Three.js (Z negativo)

                    robot.rotation.y = targetRotationY; // Rotación instantánea

                    previousDirection = direction;
                }

                // Iniciar animación de caminar si no está corriendo
                if (walkAction && !walkAction.isRunning()) {
                    walkAction.reset().play();
                }
            }

            // Mover el robot hacia el objetivo
            robotPosition.lerp(targetPosition, 0.05); // Ajusta 0.05 para cambiar velocidad de movimiento

            // Comprobar si llegó al siguiente paso
            if (robotPosition.distanceTo(targetPosition) < 0.1) {
                // Dibujar baldosa del camino recorrido
                const pathTile = new THREE.Mesh(
                    new THREE.BoxGeometry(cubeSize * 0.8, 0.05, cubeSize * 0.8),
                    pathMaterial
                );
                pathTile.position.set(targetY, 0.02, targetX); // OJO: Coordenadas (y, z=x)
                scene.add(pathTile);
                mazeObjects.push(pathTile); // Añadir a objetos para limpiar después

                step++; // Avanzar al siguiente paso

                // Si es el último paso, detener animación
                if (step >= path.length) {
                    if (walkAction && walkAction.isRunning()) {
                        walkAction.stop();
                    }
                }
            }
        }
    } else if (robot && walkAction && walkAction.isRunning() && (!searchStarted || explorationPhase)) {
        // Detener animación si la búsqueda no ha comenzado o está en exploración
        walkAction.stop();
    }

    renderer.render(scene, camera);
}

// --- Event Listener para Iniciar Búsqueda ---
startButton.addEventListener('click', () => {
    if (!mazeData) {
        alert("Primero carga un laberinto desde un archivo JSON.");
        return;
    }
    if (searchStarted && !explorationPhase) {
        console.log("La búsqueda ya se completó. Carga un nuevo laberinto o reinicia.");
        return;
    }
    if (searchStarted && explorationPhase) {
        console.log("La exploración ya está en curso.");
        return;
    }

    console.log("Iniciando búsqueda...");
    searchStarted = true;
    explorationPhase = true;
    currentExplorationStep = 0;
    step = 0; // Reiniciar el paso del camino del robot
    path = []; // Limpiar camino anterior
    previousDirection = null; // Reiniciar dirección del robot

    // Limpiar visualizaciones anteriores (excepto el laberinto base)
    mazeObjects = mazeObjects.filter(obj => {
        return obj.material === wallMaterial || obj.material === floorMaterial1 || obj.material === floorMaterial2 || obj.material === startMaterial || obj.material === endMaterial;
    });
    explorationTiles.forEach(tile => scene.remove(tile));
    explorationTiles.clear();
    scene.children.forEach(child => {
        if (child.material === pathMaterial || child.material === exploredMaterial || child.material === frontierMaterial) {
            scene.remove(child);
        }
    });

    const { inicio, fin } = mazeData;
    const algorithm = algorithmSelect.value;
    let result;

    // Actualizar estado del algoritmo
    algorithmStatus.textContent = `Ejecutando algoritmo: ${algorithm}...`;

    console.log(`Algoritmo seleccionado: ${algorithm}`);

    if (algorithm === 'dijkstra') {
        result = dijkstra(mazeData, inicio, fin);
    } else if (algorithm === 'aStar') {
        result = aStar(mazeData, inicio, fin);
    } else {
        result = bfs(mazeData, inicio, fin);
    }

    path = result.path; // Guardar el camino encontrado
    explorationSteps = result.explorationSteps; // Guardar los pasos de exploración

    // Cuando se completa el algoritmo, actualizar la información
    algorithmStatus.innerHTML = `
        <strong>Algoritmo:</strong> ${algorithm}<br>
        <strong>Camino encontrado:</strong> ${path.length} pasos<br>
        <strong>Exploración:</strong> ${explorationSteps.length} nodos
    `;

    function processNextExplorationStep() {
        if (!explorationPhase) return;

        if (currentExplorationStep < explorationSteps.length) {
            const continueExploration = visualizeExplorationStep(explorationSteps[currentExplorationStep]);
            currentExplorationStep++;

            if (continueExploration) {
                explorationTimeout = setTimeout(processNextExplorationStep, explorationSpeed);
            } else {
                explorationPhase = false;
            }
        } else {
            explorationPhase = false;
        }
    }

    processNextExplorationStep();

    if (robot) {
        robot.position.set(inicio[1], 0, inicio[0]);
        robot.rotation.y = 0;
    }
});

// --- Event Listeners para Controles de Cámara ---
camUp.addEventListener('click', () => { controls.target.z -= 1; camera.position.z -= 1; controls.update(); });
camDown.addEventListener('click', () => { controls.target.z += 1; camera.position.z += 1; controls.update(); });
camLeft.addEventListener('click', () => { controls.target.x -= 1; camera.position.x -= 1; controls.update(); });
camRight.addEventListener('click', () => { controls.target.x += 1; camera.position.x += 1; controls.update(); });

camZoomIn.addEventListener('click', () => { controls.dollyOut(1.2); controls.update(); });
camZoomOut.addEventListener('click', () => { controls.dollyIn(1.2); controls.update(); });

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

camera.position.set(5, 15, 15);
controls.target.set(5, 0, 5);
controls.update();
animate();